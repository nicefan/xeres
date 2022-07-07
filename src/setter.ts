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
        flag = Reflect.set(target, key, value)
        if (flag) {
          const _path = [...path, key]
          const result = { value, old: target[key] }
          callback(_path, result)
        }
      }
      return flag
    },
  })

  const ctx = new Proxy(instance, {
    get(target, p) {
      return stateProxy.$has(p) ? stateProxy[p] : target[p]
    },
    set(target, p, value, receiver) {
      const t = stateProxy.$has(p) ? stateProxy : target
      return Reflect.set(t, p, value, receiver)
    },
  })

  return ctx
}
export function registActions(instance, state, actions = {}) {
  const actionMap = new Map<string, ActionInfo>()

  // 映射actions
  Object.keys(actions).forEach((key) => {
    const changes = new Map()
    const ctx = accessor(instance, state, (path, value) => {
      // 通知更新
      instance.__emitChange__(path, value)
      changes.set(path.join(), value)
    })
    const listens = {
      changes,
      isAsync: false,
    }
    actionMap.set(key, listens)
    instance[key] = (...args) => {
      changes.clear()
      listens.isAsync = false
      Reflect.apply(actions[key], ctx, args)
      listens.isAsync = true
    }
  })

  /** 任务执行完毕，收集变化生成数据记录 */
  // function produce() {}
  return {
    actionMap,
  }
}
