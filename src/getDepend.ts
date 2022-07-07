function hasOwn(target: Obj, name: string) {
  return Object.prototype.hasOwnProperty.call(target, name)
}

export function createContext<S extends Obj>(data: S, hook: Obj = {}) {
  const subMap = new WeakMap()
  const handler: ProxyHandler<Obj> = {
    get: (target, key: string, receiver) => {
      const { path } = subMap.get(target)
      const value = target[key]
      switch (key) {
        case '__path__':
          return path
        case '__target__':
          return target
        case '$has':
          return (k: string) => hasOwn(target, k)
      }
      if (hasOwn(target, key)) {
        hook.getter && hook.getter(path, key, value, target)
        if (value && typeof value === 'object') {
          const subPath = [...path, key]
          return getSubProxy(value, subPath)
        }
      }
      return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
      const { path } = subMap.get(target)
      return hook.setter && hook.setter(path, key, value, target, receiver)
    },
  }
  const getSubProxy = (target, path: string[] = []) => {
    if (!subMap.has(target)) {
      const proxy = new Proxy(target, handler)
      subMap.set(target, {
        path,
        proxy,
      })
    }
    return subMap.get(target).proxy
  }
  return getSubProxy(data) as S
}

export function createRecorder(data: Obj) {
  let __logs = new Set<string>()
  let prePath: string[] = []
  const proxy = createContext(data, {
    getter(path: string[], key) {
      __logs.add(prePath.concat(path, key).join()) //[...prePath, ...path, key])
    },
  })
  return (logs: Set<string>, name?: string) => {
    __logs = logs
    prePath = name ? [name] : []
    return proxy
  }
}

