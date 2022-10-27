function hasOwn(target: Obj, name: string) {
  return Object.prototype.hasOwnProperty.call(target, name)
}

function isSupportObj(target: Obj) {
  const str = Object.prototype.toString.call(target)
  return str === '[object Object]' || str === '[object Array]' || str === '[object Set]' || str === '[object Map]'
}

function isMapSet(target: Obj) {
  const str = Object.prototype.toString.call(target)
  return str === '[object Set]' || str === '[object Map]'
}

export function createContext<S extends Obj>(data: S, hook: Obj = {}) {
  const subMap = new WeakMap()
  const handler: ProxyHandler<Obj> = {
    get: (target, key: string, receiver) => {
      const { path } = subMap.get(target.__target || target)
      switch (key) {
        case '__path__':
          return path
        case '__target__':
          return target.__target || target
        case '$has':
          return (k: string) => hasOwn(target, k)
      }

      // TODO: 数组收集依赖时，如果遍历或解构应该监听整个数组变化
      if (hasOwn(target, key)) {
        const value = target[key]
        hook.getter && hook.getter(path, key, value, target)
        if (value && isSupportObj(value)) {
          const subPath = [...path, key]
          return getSubProxy(value, subPath)
        }
      } else if (target.__isMapSet) {
        const __target = target.__target
        if (['add', 'del', 'clear'].includes(key)) {
          return (...arg) => {
            __target[key](...arg)
            receiver.size = __target.size
          }
        } else if (key === 'set') {
          return (...arg) => {
            if (typeof arg[0] === 'string') {
              hook.setter && hook.setter(path, arg[0], arg[1], __target, receiver)
            } else {
              __target[key](...arg)
            }
            receiver.size = __target.size
          }
        } else if (key === 'get') {
          return (arg) => {
            const value = __target.get(arg)
            if (typeof arg === 'string') {
              hook.getter && hook.getter(path, arg, value, __target)
              if (value && isSupportObj(value)) {
                const subPath = [...path, arg]
                return getSubProxy(value, subPath)
              }
            }
            return value
          }
        } else {
          return Reflect.get(__target, key, __target)
        }
      }
      return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
      const { path } = subMap.get(target.__target || target)
      return hook.setter && hook.setter(path, key, value, target, receiver)
    },
  }
  const getSubProxy = (target, path: string[] = []) => {
    if (!subMap.has(target)) {
      let __target = target
      if (isMapSet(target)) {
        __target = {
          __isMapSet: true,
          __target: target,
          size: target.size,
        }
      }
      const proxy = new Proxy(__target, handler)
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

