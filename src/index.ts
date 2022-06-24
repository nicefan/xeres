import { useEffect, useMemo, useReducer } from 'react'

type ActionHandler<A> = {
  [k in keyof A]: A[k] extends (...args: infer P) => infer R
    ? (...args: P) => R
    : never
}

type Getters<S extends Obj> = Record<
  string,
  ((state: S) => any) | ((...args: any[]) => any)
>

export type GetterRes<G> = {
  readonly [k in keyof G]: G[k] extends (...args: any[]) => infer R ? R : G[k]
}

type Obj<T = any> = Record<string, T>
type Fn<T = any> = (...args: T[]) => any
type ModelOptions<S, G, A> = {
  name?: string
  state: S | (() => S)
  getters?: G &
    ThisType<
      S &
        GetterRes<G> & {
          $depend: <B extends Obj>(store: B) => ReturnType<B['getState']>
        }
    > // & Getters<S>
  actions?: A & ThisType<ActionHandler<A> & BaseStore<S> & S & GetterRes<G>>
}
type Subscibe = {
  deps: string[]
  result?: any
  updater: Fn
}

function getValueOfPath(target, path: string[]) {
  return path.reduce((result, key) => result[key], target)
}
type ChangeRecord = { path: string[]; value: any }

function accessHelper(store, getState) {
  const changes = new Map<string, any>()
  const map = new Map()
  const handler = {
    get(_target, key: string) {
      const target = _target.store || _target
      const path = map.get(target) || []
      const current = target[key]
      if (current && typeof current === 'object') {
        map.set(current, [...path, key])
        return new Proxy(current, handler)
      } else if (typeof current === 'function') {
        return current.bind(store)
      } else {
        return current
      }
    },
    set: (_target, key, value) => {
      const target = _target.store || _target
      if (target[key] !== value) {
        const path = [...(map.get(target) || []), key]
        changes.set(path.join(), value)
        const state = getState()
        if (target === store && Reflect.has(state, key)) {
          return Reflect.set(state, key, value)
        } else {
          return Reflect.set(target, key, value)
        }
      }
      return true
    },
  }
  // 在set属性值时，即便不改变目标对象上的属性，也会校验目标上的对应属性是否可写
  const context = new Proxy({ store }, handler)
  const accessor =
    (action, callback) =>
    (...args) => {
      !args.length && args.push(context)
      const result = Reflect.apply(action, context, args)
      if (changes.size) callback(changes)
      if (result && result.then) {
        result.then(() => {
          if (changes.size) callback(changes)
          changes.clear()
        })
      }
      changes.clear()
      return result
    }
  return accessor
}
interface IStore<Opt extends Obj> extends BaseStore<Opt['state']> {
  new (config: Opt, updater?: Fn): BaseStore<Opt['state']> &
    Opt['state'] &
    GetterRes<Opt['getters']> &
    Opt['actions']
}

class BaseStore<S extends Obj = Obj> {
  #state: S
  #readonly: Readonly<S>
  #getterSubscriber = new Map()
  #accessor = accessHelper(this, () => this.#state)
  #collector = getCollectProxy(this)
  #forceUpdate?: (...args: any) => void

  constructor(
    {
      state,
      actions = {},
      getters = {},
    }: { state: S; actions?: Obj; getters?: Obj },
    forceUpdate?: Fn
  ) {
    this.#forceUpdate = forceUpdate
    this.#state = state

    const _state = Object.create(null)
    Object.keys(this.#state).forEach((key) => {
      const property = {
        enumerable: true,
        get: () => this.#state[key],
      }
      Object.defineProperty(_state, key, property)
      Object.defineProperty(this, key, property)
    })
    this.#readonly = Object.freeze(_state)

    // 映射 getters
    const getterSubscriber = this.#getterSubscriber
    Object.keys(getters).forEach((key) => {
      Object.defineProperty(this, key, {
        enumerable: true,
        get: () => {
          if (!getterSubscriber.has(key)) {
            const sub = this.#getterSubs(getters[key], key)
            this.#getterSubscriber.set(key, sub)
            sub.updater()
          }
          return getterSubscriber.get(key).result
        },
      })
    })

    // 映射actions
    // const accessor = accessHelper(this, () => this.#state)
    Object.keys(actions).forEach((key) => {
      // this[key] = accessor(actions[key], actionCallback)
      Object.defineProperty(this, key, {
        value: this.#accessor(actions[key], (change) =>
          this.#actionCallback(change, key)
        ),
      })
    })
  }

  #actionCallback(changes, propName) {
    const changePaths = [...changes.keys()]
    // TODO: 每次action，进行一次历史记录，用于连接redux
    for (const [key, sub] of this.#getterSubscriber) {
      if (!sub.deps.length) continue
      for (const dep of sub.deps) {
        const isDep = !!changePaths.find((path) => dep.startsWith(path)) // TODO：依赖的父元素改变，还需要对依赖的元素进行比较
        if (isDep) {
          const result = sub.updater()
          changes.set(key, result)
          break
        }
      }
    }
    this.#emitChange(changes)
  }

  #changeFlag = new Map()
  #emitChange(_changes) {
    if (this.#changeFlag.size === 0) {
      Promise.resolve().then(() => {
        this.#updater(this.#changeFlag)
        this.#changeFlag.clear()
      })
    }
    this.#changeFlag = new Map([...this.#changeFlag, ..._changes])
  }

  #subscribers = new Set<Subscibe>()
  get subscribers() {
    return this.#subscribers
  }
  #updater(changes: Map<string, any>) {
    if (this.#forceUpdate) {
      return this.#forceUpdate(changes)
    }
    const changePaths = [...changes.keys()]
    for (const sub of this.#subscribers) {
      if (sub.deps.length) {
        for (const dep of sub.deps) {
          const isDep = !!changePaths.find((path) => dep.startsWith(path)) // TODO：依赖的父元素改变，还需要对依赖的元素进行比较
          if (isDep) {
            sub.updater(changes)
            break
          }
        }
      } else {
        sub.updater(changes)
      }
    }
  }

  /** 定阅其它store变化 */
  $depend<T extends BaseStore<Obj>>(store: T) {
    return store.getState()
  }

  /** 收集getter方法依赖，并返回一个定阅 */
  #getterSubs(getter: Fn, key: string) {
    const { proxy, paths, otherDepend } = this.#collector
    Reflect.apply(getter, proxy, [])
    const notify = {
      deps: [...paths],
      result: undefined as any,
      updater: () => {
        notify.result = Reflect.apply(getter, this, [])
      },
    }
    if (otherDepend.size) {
      for (const [otherStore, otherDeps] of otherDepend) {
        otherStore.subscribers.add({
          deps: [...otherDeps],
          updater: (_changes) => {
            notify.updater()
            const changes = new Map()
            for (const [path, val] of _changes) {
              if (!otherDeps.size || otherDeps.has(path))
                changes.set(key + ',' + path, val)
            }
            this.#updater(changes)
          },
        })
      }
    }
    return notify
  }
  /** 监听者 */
  $subscribe(updater: Fn, selector?: Fn) {
    const { proxy, paths } = this.#collector
    paths.clear()
    selector && selector(proxy)
    const sub = {
      deps: [...paths],
      updater,
      // result,
      // updater: () => {
      //   sub.result = selector?.(store)
      //   forceUpdate()
      // },
    }
    this.#subscribers.add(sub)

    return () => {
      this.#subscribers.delete(sub)
    }
  }
  /** 收集其它store依赖 */
  // $collector(store, getterName, selector) {}
  getState() {
    return this.#readonly
  }

  setState(setter: (state: S) => void) {
    this.#accessor(
      (ctx) => setter(ctx),
      (change) => this.#actionCallback(change, 'setState')
    )()
  }

  private produce(changes: ChangeRecord[]) {
    const newState = { ...this.#state }
    changes.forEach(({ path, value }) => {
      let current: Obj = newState
      path.forEach((key, idx) => {
        if (idx === path.length - 1) {
          current[key] = value
        } else {
          current = current[key] = { ...current[key] }
        }
      })
    })
    this.#state = newState
  }
}
// type ModelConfig = {
//   state: Obj
//   getters?: Obj
//   actions?: Obj
// }
// function createModel<Opt extends ModelConfig>(config: Opt, updater?: Fn) {
//   const Store = BaseStore as IStore<Opt>
//   return new Store(config, updater)
//   // return new BaseStore(config, updater) as BaseStore<Opt['state']> &
//   //   Opt['state'] &
//   //   GetterRes<Opt['getters']> &
//   //   Opt['actions']
// }

export function defineModel<S = Obj, G = Obj, A = Obj>(
  config: ModelOptions<S, G, A>
) {
  const { state: _state } = config
  const state: S = typeof _state === 'function' ? (_state as any)() : _state

  function useModel(initState?: Partial<S>) {
    const [_, forceUpdate] = useReducer((d) => d + 1, 0)
    const model = useMemo(() => {
      // return createModel(
      //   { ...config, state: { ...state, ...initState } },
      //   forceUpdate
      // )
      return new BaseStore(
        { ...config, state: { ...state, ...initState } },
        forceUpdate
      ) as ActionHandler<A> & BaseStore<S> & S & GetterRes<G>
    }, [])
    // TODO: 清除异步action
    return model
  }
  return useModel
}

export function defineStore<S = Obj, G = Obj, A = Obj>(
  config: ModelOptions<S, G, A>
) {
  const { state: _state } = config
  const state: S = typeof _state === 'function' ? (_state as any)() : _state

  // return createModel({ ...config, state })
  const store = new BaseStore({ ...config, state }) as ActionHandler<A> &
    BaseStore<S> &
    S &
    GetterRes<G>

  // const useStore = <T extends (model: typeof store) => any>(
  //   selector?: T
  // ): ReturnType<T> => {
  //   const [_, forceUpdate] = useReducer((d) => d + 1, 0)
  //   const model = selector ? selector(store) : store

  //   useEffect(() => {
  //     const unSubscribe = store.$subscribe(forceUpdate)

  //     return unSubscribe
  //   }, [])
  //   return model
  // }

  return store
}

export function useStore<S extends BaseStore, F extends (store: S) => any>(
  store: S,
  selector?: F
) {
  const [_, forceUpdate] = useReducer((d) => d + 1, 0)
  const model = useMemo(() => (selector ? selector(store) : store), [_])

  useEffect(() => {
    const unSubscribe = store.$subscribe(forceUpdate, selector)
    return unSubscribe
  }, [])
  return model
}

function getCollectProxy(ctx) {
  const map = new Map<object, string>()
  const paths = new Set<string>()
  const otherDepend = new Map<BaseStore, Set<string>>()
  const handler = {
    get(target, key: string) {
      const _path = map.get(target) || ''
      const current = target[key]
      if (key === '$depend') {
        // 返回一个新的方法，执行原方法，并获取返回值进行代理，收集依赖
        return (store: BaseStore) => {
          const dependState = current(store)
          const { proxy, paths: deps } = getCollectProxy(dependState)
          otherDepend.set(store, deps)
          return proxy
        }
        // return depend(current, (store, deps) => otherDepend.set(store, deps))
      }
      if (typeof current === 'function') return current
      paths.delete(_path)
      const path = _path ? _path + ',' + key : key
      paths.add(path)
      if (current && typeof current === 'object') {
        map.set(current, path)
        return new Proxy(current, handler)
      }
      return current
    },
    set(target, key, value) {
      return false
    },
  }
  const proxy = new Proxy(ctx, handler)

  return {
    proxy,
    otherDepend,
    paths,
  }
}

// 执行
// function depend(fn, cb) {
//   return (store) => {
//     const { proxy: stateProxy, paths: deps } = getCollectProxy(fn(store))
//     cb(store, deps)
//     return stateProxy
//   }
// }
