import { useEffect, useMemo, useReducer } from 'react'
import { Consumer } from './getterHelper'
import { registActions } from './setter'

type ActionHandler<A> = {
  [k in keyof A]: A[k] extends (...args: infer P) => infer R
    ? (...args: P) => R
    : never
}

export type GetterRes<G> = {
  readonly [k in keyof G]: G[k] extends (...args: any[]) => infer R
    ? R
    : G[k] extends { getState: () => infer S }
    ? S
    : G[k]
}

type Obj<T = any> = Record<string, T>
type Fn<T = any> = (...args: T[]) => any
type ModelOptions<S, G, A> = {
  name?: string
  state: S | (() => S)
  getters?: G & ThisType<S & GetterRes<G>> // & Getters<S>
  actions?: A & ThisType<ActionHandler<A> & BaseStore<S> & S & GetterRes<G>>
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

interface BaseStore<S> {
  getState: () => Readonly<S>
  setState: (setter: (state: S) => void) => void
}
interface InnerStore<S = Obj> extends BaseStore<S> {
  subscribe: (
    updater: Fn<[Obj]>,
    selector?: Fn
  ) => [get: () => any, unSubscribe: Fn]
}

export function createModel<S, A, G>({
  state,
  actions,
  getters,
}: ModelOptions<S, G, A>) {
  const __state = typeof state === 'function' ? (state as Fn)() : state
  const readonlyState = {}
  const outerSubscribers = new Set<Fn>()
  const changeList = new Map()

  const instance: Obj = {}

  // 映射state
  Object.keys(__state).forEach((key) => {
    const property = {
      enumerable: true,
      get: () => __state[key],
    }
    Object.defineProperty(readonlyState, key, property)
    Object.defineProperty(instance, key, property)
  })

  // 映射 getters
  const consumer = new Consumer(instance, __state, getters)

  // 映射actions
  const { actionMap, createAction } = registActions(instance, __state, actions)

  // 提交变更
  function emitChange(path, value) {
    if (changeList.size === 0) {
      Promise.resolve().then(() => {
        consumer.consumerMap.forEach((sub, updater) => {
          sub.changeFlag && updater([...changeList])
        })

        // TODO:查找改变来自哪些action生成操作记录对接redux
        actionMap.forEach((sub) => {
          sub.changes.clear()
        })
        changeList.clear()
      })
    }
    changeList.set(path, value)
    consumer.notify(path, value)
    // 如果有外部订阅，立即通知
    outerSubscribers.forEach((notify) => notify(path, value))
  }

  Object.setPrototypeOf(
    instance,
    Object.defineProperties(
      {},
      {
        __outerSubscribe__: {
          value: (subscribe) => outerSubscribers.add(subscribe),
        },
        __emitChange__: {
          value: emitChange,
        },
        subscribe: {
          value: (...args) =>
            Reflect.apply(consumer.registConsumer, consumer, args),
        },
        getState: {
          value: () => readonlyState,
        },
        setState: {
          value: createAction('setState'),
        },
      }
    )
  )
  return instance as InnerStore<S> & S & GetterRes<G> & A
}

export function defineModel<S, G = {}, A = {}>(config: ModelOptions<S, G, A>) {
  function useModel(initState?: S) {
    const [_, forceUpdate] = useReducer((d) => d + 1, 0)
    const model = useMemo(() => {
      const instance = createModel({
        ...config,
        ...(initState && { state: initState }),
      })
      instance.subscribe(forceUpdate)
      return instance
    }, [])
    // TODO: 清除异步action
    return model as Store<S, G, A>
  }
  return useModel
}

type Store<S, G, A> = BaseStore<S> & S & GetterRes<G> & A

interface Selector<S> {
  <F extends Obj & { call?: never }>(
    selector?: (store: S) => RObj<F>
  ): Obj extends F ? S : F
}
type RObj<T> = Obj extends T ? never : T

export function defineStore<S = {}, G = {}, A = {}>(
  config: ModelOptions<S, G, A>
) {
  const instance = createModel(config)

  const useSelector: Selector<Store<S, G, A>> = (selector) => {
    const [_, forceUpdate] = useReducer((d) => d + 1, 0)
    const [getData, unRegistry] = useMemo(
      () => instance.subscribe(forceUpdate, selector),
      []
    )
    useEffect(() => unRegistry, [])

    return getData()
  }
  Object.defineProperties(instance, {
    useSelector: { value: useSelector },
  })
  return instance as unknown as Store<S, G, A> & {
    useSelector: Selector<Store<S, G, A>>
  }
}

// export function useStore<S extends BaseStore, F extends (store: S) => any>(
//   store: S,
//   selector?: F
// ) {
//   const [_, forceUpdate] = useReducer((d) => d + 1, 0)
//   const [getData, unRegist] = useMemo(
//     () => store.__registConsumer__(forceUpdate, selector),
//     []
//   )

//   useEffect(() => unRegist, [])

//   return getData()
// }
