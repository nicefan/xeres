import { createContext } from './getDepend'
type ActionInfo = {
  changes: Map<string, { value: any; old: any }>
  isAsync: boolean
}

function accessor(instance, state, callback) {
  const stateProxy = createContext(state, {
    setter(path, key, value, target) {
      let flag = true
      if (
        target[key] !== value ||
        (Array.isArray(target) && key === 'length')
      ) {
        const _path = [...path, key]
        const result = { value, old: target[key] }
        flag = Reflect.set(target, key, value)
        if (flag) {
          callback(_path, result)
        }
      }
      return flag
    },
  })

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
        Reflect.apply(actions[key], ctx, args)
        listens.isAsync = true
      }
    })
  })

  /** 任务执行完毕，收集变化生成数据记录 */
  // function produce() {}
  return {
    actionMap,
  }
}
