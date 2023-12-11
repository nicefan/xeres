function hasOwn(target: Obj, name: string) {
  return Object.prototype.hasOwnProperty.call(target, name)
}

function isSupportObj(target: Obj) {
  const str = Object.prototype.toString.call(target)
  return (
    str === '[object Object]' ||
    str === '[object Array]' ||
    str === '[object Set]' ||
    str === '[object Map]'
  )
}

function isMapSet(target: Obj) {
  const str = Object.prototype.toString.call(target)
  return str === '[object Set]' || str === '[object Map]'
}

const setMethod = (target, key, value) => {
  return isMapSet(target)
    ? target.set(key, value)
    : Reflect.set(target, key, value)
}

function deepGet(target: Obj, paths: string[]) {
  let result = target
  paths.forEach((key) => {
    result = isMapSet(result) ? result.get(key) : result[key]
  })
  return result
}

type ContextMapItem = { proxy: Obj; paths: Set<string> }

export function createContext<S extends Obj>(
  data: S,
  { getter, setter }: Obj = {}
) {
  const subMap = new WeakMap<Obj, ContextMapItem>()

  const getHandler: (path: string[]) => ProxyHandler<Obj> = (path) => {
    const handler = {
      get: (target, key: string, receiver) => {
        switch (key) {
          case '__path__':
            return path
          case '__isMapSet__':
            return isMapSet(target)
          case '__target__':
            return target
          case '$has':
            return (k: string) => hasOwn(target, k)
        }

        if (hasOwn(target, key)) {
          const value = target[key]
          getter && getter(path, key, value, target)
          const subPath = [...path, key]
          return getSubProxy(value, subPath, target)
        } else if (receiver.__isMapSet__) {
          if (['add', 'del', 'clear'].includes(key)) {
            return (...arg) => {
              const oldVal = target.size
              target[key](...arg)
              const result = { value: target.size, old: oldVal }
              const paths: string[] = getRefPaths(path.toString())
              setter && setter(paths, 'size', result, target)
            }
          } else if (key === 'set') {
            return (...arg) => {
              if (typeof arg[0] === 'string') {
                handler.set(target, arg[0], arg[1], receiver)
              } else {
                target[key](...arg)
              }
            }
          } else if (key === 'get') {
            return (arg) => {
              const value = target.get(arg)
              if (typeof arg === 'string') {
                getter && getter(path, arg, value, target)

                const subPath = [...path, arg]
                return getSubProxy(value, subPath, receiver)
              }
              return value
            }
          } else {
            return Reflect.get(target, key, target)
          }
        }
        return Reflect.get(target, key, receiver)
      },
      deleteProperty: function (target, prop) {
        const paths: string[] = getRefPaths(path.toString())
        const result = { value: undefined, old: target[prop] }
        delete target[prop]
        if (result.old !== undefined && setter)
          setter(paths, prop, result, target)
        return true
      },
      set(target, key, value, receiver) {
        const raw = value && (value.__target__ || value)
        if (typeof key !== 'string') {
          return setMethod(target, key, value)
        }

        const isMap = isMapSet(target)
        const paths: string[] = getRefPaths(path.toString())
        const sizeField = Array.isArray(target) ? 'length' : isMap ? 'size' : ''
        const oldSize = target[sizeField]
        const oldVal = !isMapSet(target) ? target[key] : target.get(key)
        if (oldVal !== raw) {
          setMethod(target, key, raw)
          const result = { value: raw, old: oldVal }
          setter && setter(paths, key, result, target)
        }
        if (sizeField && sizeField !== key && target[sizeField] !== oldSize) {
          const result = { value: target[sizeField], old: oldSize }
          setter && setter(paths, sizeField, result, target)
        }

        // 值为对象时，建立一个引用
        if (value && value.__target__) {
          getSubProxy(raw, [...path, key])
        }
        return true
      },
    }

    return handler
  }

  /** 递归获取所有引用对象路径 */
  const getRefPaths = (_parentStr, _subs?: string[]) => {
    if (!_parentStr) return ['']
    const parent = deepGet(data, _parentStr.split(','))
    const ref = subMap.get(parent) as ContextMapItem
    // 遍历父对象所有引用路径
    const pathMap = new Map<string, string[]>()
    for (const p of ref.paths) {
      if (deepGet(data, p.split(',')) !== parent) {
        // 如果关联路径上的实际对象已经不是当前对象时，清理掉
        ref.paths.delete(p)
      } else {
        const arr = p.split(',')
        const end = arr.splice(-1, 1)[0]
        const pre = arr.toString() || 'root'
        const newSubs = pathMap.get(pre) || []
        _subs
          ? _subs.forEach((s) => {
              newSubs.push(end + ',' + s)
            })
          : newSubs.push(end)
        pathMap.set(pre, newSubs)
      }
    }
    let paths = pathMap.get('root') || []
    for (const [_key, _subs] of pathMap) {
      if (_key === 'root') {
        paths = paths.concat(_subs)
      } else {
        paths = paths.concat(getRefPaths(_key, _subs))
      }
    }
    return [...new Set(paths)]
  }

  /** 获取对象代理 */
  const getSubProxy = (target, path: string[] = [], parent?: any) => {
    if (!isSupportObj(target)) return target
    let source = subMap.get(target)
    const pathStr = path.toString()
    if (!source) {
      const proxy = new Proxy(target, getHandler(path))
      const paths = new Set([pathStr])
      source = { proxy, paths }
      subMap.set(target, source)
    } else {
      source.paths.add(pathStr)
    }
    return source.proxy
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
