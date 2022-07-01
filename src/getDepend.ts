function buildProxy(data: Obj, handler) {
  /** 子对象代理 */
  const subMap = new WeakMap()

  const getSubProxy = (_data, path: string[] = []) => {
    return new Proxy(_data, {
      ...handler,
      get(target, key: string, receiver) {
        const value = _data[key]
        if (key === '__path__') {
          return path
        } else if (key === '__target__') {
          return target
        }
        
        if (value && typeof value === 'object') {
          if (!subMap.has(value)) {
            const subPath = [...path, key]
            const proxy = getSubProxy(value, subPath)
            subMap.set(value, proxy)
          }
          return subMap.get(value)
        } else if (handler.get) {
          handler.get(target, key, receiver)
        } else {
          return Reflect.get(target, key, receiver)
        }
      },
    })
  }
  return getSubProxy(data)
}

function getCollectProxy(ctx) {
  const paths = new Set<string>()
  const otherDepend = new Map<any, Set<string>>()

  const handler = {
    get(target, key: string) {
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
      paths.delete(_path) // 监听子元素就不再监听父对象
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

function getterDepend(getter: Fn, key: string) {
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

function useFormBind(data: Obj = {}) {
  const state = useRef(data)
  const binds = useMemo(() => {
    const listens = new Map<string, Fn[]>()
    const emitChange = (path: string, value: any) => {

    }
    const proxyHandler: ProxyHandler<Obj> = {
      set: (target, key: string, value) => {
        if (target[key] !== value) {
          const path = [...target.__path__, key]
          emitChange(path.join('.'), value)
        }
        return Reflect.set(target, key, value)
      },
    }
    const _binds = {}
    const proxy = buildProxy(data, proxyHandler, (target, path: string[]) => {
      const propName = path.join('.')
      const key = path[path.length - 1]
      _binds[propName] = {
        key: propName,
        value: target[key],
        onInput: (e) => {
          target[key] = e.detail.value
        }
      }

    })
    return _binds
  }, [])
  const formModel = {
    state: state.current,
    setData: () => { },
    reset: () => { },
    watch: () => { },
  }
  return [binds, formModel]
}

