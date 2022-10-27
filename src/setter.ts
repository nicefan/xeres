import { createContext } from './getDepend'
type ActionInfo = {
  changes: Map<string, { value: any; old: any }>
  isAsync: boolean
}
function getStateAccessor(state, callback) {
  return createContext(state, {
    setter(path, key, value, target) {
      let flag = true
      const isMap = target instanceof Map
      const oldVal = isMap ? target.get(key) : target[key]
      if (oldVal !== value || (Array.isArray(target) && key === 'length')) {
        const _path = [...path, key]
        const result = { value, old: oldVal }
        flag = isMap
          ? !!target.set(key, value)
          : Reflect.set(target, key, value)
        if (flag) {
          callback(_path, result)
        }
      }
      return flag
    },
  })
}
function accessor(instance, state, callback) {
  const stateProxy = getStateAccessor(state, callback)
  const ctx = new Proxy(
    {},
    {
      get(target, p) {
        return stateProxy.$has(p) ? stateProxy[p] : instance[p]
      },
      set(target, p, value) {
        const t = stateProxy.$has(p) ? stateProxy : instance
        return Reflect.set(t, p, value)
      },
    }
  )
  return ctx
}

export function registActions(instance, state, actions = {}) {
  const actionMap = new Map<string, ActionInfo>()

  // 映射actions
  Object.keys(actions).forEach((key) => {
    const changes = new Map()
    const ctx = accessor(instance, state, (path, value) => {
      // 通知更新
      const pathStr = path.join()
      instance.__emitChange__(pathStr, value)
      if (changes.has(pathStr)) {
        value.old = changes.get(pathStr).old
      }
      changes.set(pathStr, value)
    })
    const listens = {
      changes,
      isAsync: false,
    }
    actionMap.set(key, listens)
    Object.defineProperty(instance, key, {
      value: (...args) => {
        changes.clear()
        listens.isAsync = false
        const result = Reflect.apply(actions[key], ctx, args)
        listens.isAsync = true
        return result
      },
    })
  })

  function createAction(key) {
    const changes = new Map()
    const ctx = getStateAccessor(state, (path, value) => {
      // 通知更新
      const pathStr = path.join()
      instance.__emitChange__(pathStr, value)
      if (changes.has(pathStr)) {
        value.old = changes.get(pathStr).old
      }
      changes.set(pathStr, value)
    })
    const listens = {
      changes,
      isAsync: false,
    }
    actionMap.set(key, listens)
    return (setter: Fn) => {
      changes.clear()
      listens.isAsync = false
      Reflect.apply(setter, null, [ctx])
      listens.isAsync = true
    }
  }

  /** 任务执行完毕，收集变化生成数据记录 */
  // function produce() {}
  return {
    actionMap,
    createAction,
  }
}
