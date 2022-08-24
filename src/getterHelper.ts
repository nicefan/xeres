import { createRecorder } from './getDepend'

type SubscribInfo = {
  deps: string[]
  result?: any
  changeFlag: boolean
  relations: string[]
}
export class Consumer {
  private instance: Obj
  private stateRecorder: ReturnType<typeof createRecorder>
  private getterMap: Map<string, Fn>
  /** 外部store getter */
  private extGetterMap: Map<string, Fn>
  getterSubscriber = new Map<string, SubscribInfo>()
  consumerMap = new Map<Fn, SubscribInfo>()

  constructor(instance, state, getters = {}) {
    this.instance = instance
    const { outerDepends, getterMap } = this.registGetters(instance, getters)
    this.getterMap = getterMap
    this.extGetterMap = outerDepends
    this.stateRecorder = createRecorder(state)
  }

  private collectDeps(getter: Fn) {
    const { getterMap, extGetterMap, instance } = this
    const records = new Set<string>()
    /** 依存其它getter */
    const relations = new Set<string>()
    const stateProxy = this.stateRecorder(records)

    const proxyCtx = new Proxy(
      {},
      {
        get(target, p: string) {
          if (stateProxy.$has(p)) {
            return stateProxy[p]
          }
          const outerRecorder = extGetterMap.get(p)
          if (outerRecorder) {
            return outerRecorder(records, p)
          }
          const depGetter = getterMap.get(p)
          if (depGetter) {
            relations.add(p)
            return depGetter()
          }
          return Reflect.get(instance, p, instance)
        },
      }
    )

    /** 执行收集依赖 */
    const result = Reflect.apply(getter, proxyCtx, [])
    return { result, records, relations }
  }

  private registGetters(instance, getters) {
    const outerDepends = new Map()
    const getterMap = new Map()
    Object.keys(getters).forEach((key) => {
      const item = getters[key]
      // 提取外部依赖
      if (item.__outerSubscribe__) {
        item.__outerSubscribe__((path, change) => {
          const _path = path ? key + ',' + path : key
          instance.__emitChange__(_path, change)
        })
        outerDepends.set(key, createRecorder(item.getState()))
        Object.defineProperty(instance, key, {
          enumerable: true,
          get: item.getState,
        })
      } else if (typeof item === 'function') {
        const getter = () => {
          let sub = this.getterSubscriber.get(key)
          if (!sub) {
            sub = this.createSubscriber(item)
            this.getterSubscriber.set(key, sub)
          }
          if (sub.changeFlag) {
            sub.result = Reflect.apply(item, instance, [])
            sub.changeFlag = false
          }
          return sub.result
        }
        getterMap.set(key, getter)
        Object.defineProperty(instance, key, {
          enumerable: true,
          get: getter,
        })
      }
    })
    return { getterMap, outerDepends }
  }

  /** 创建一个定阅者 */
  private createSubscriber(getter): SubscribInfo {
    /** 执行收集依赖 */
    const { result, records, relations } = this.collectDeps(getter)

    records.forEach((path) => {
      // depends父路径过滤
      for (const dep of records) {
        if (dep !== path && dep.startsWith(path)) {
          records.delete(path)
          break
        }
      }
    })
    return {
      deps: [...records],
      result: result?.__target__ || result,
      changeFlag: false,
      relations: [...relations],
    }
  }

  public notify(path, change) {
    const depends: string[] = []
    for (const [key, sub] of this.getterSubscriber) {
      // 如果已经记录变更，则跳过检查
      if (sub.changeFlag || sub.deps.length === 0) continue
      const isChange = this.checkDepends(path, change, sub)
      if (isChange) {
        depends.push(key)
        depends.push(...this.getRelation(key, this.getterSubscriber))
        sub.changeFlag = true
      }
    }
    for (const [key, sub] of this.consumerMap) {
      if (sub.changeFlag || sub.deps.length === 0) continue
      if (sub.relations.find((name) => depends.includes(name))) {
        sub.changeFlag = true
      } else {
        sub.changeFlag = this.checkDepends(path, change, sub)
      }
    }
  }

  private checkDepends(path, change, subscribInfo) {
    let isChange = false
    for (const depPath of subscribInfo.deps) {
      // 子元素变化，依赖的父元素都响应变化
      if (path.startsWith(depPath)) {
        isChange = true
        break
      } else {
        // 依赖的父元素改变，对依赖的元素进行比较
        const isParent = depPath.startsWith(path)
        if (isParent) {
          const endPath = depPath.substring(path.length + 1).split(',')
          const { old, value } = change
          const subValue = endPath.reduce((pre, cur) => pre && pre[cur], value)
          const oldValue = endPath.reduce((pre, cur) => pre && pre[cur], old)
          if (subValue !== oldValue) {
            isChange = true
            break
          }
        }
      }
    }
    return isChange
  }

  public registConsumer(updater, selector?: Fn) {
    const { consumerMap, instance } = this
    if (selector) {
      const sub = this.createSubscriber(function (this: any) {
        selector(this)
      })

      const getData = () => {
        if (sub.changeFlag) {
          sub.result = Reflect.apply(selector, null, [instance])
          sub.changeFlag = false
        }
        return sub.result
      }
      consumerMap.set(updater, sub)
      return [getData, () => consumerMap.delete(updater)]
    } else {
      consumerMap.set(updater, {
        deps: [],
        changeFlag: true,
        relations: [],
      })
      return [() => instance, () => consumerMap.delete(updater)] as const
    }
  }

  private getRelation(name: string, subs: Map<string, any>): string[] {
    const relation: string[] = [name]
    for (const name of relation) {
      subs.forEach((sub, key) => {
        if (!sub.changeFlag && sub.relations.indexOf(name) >= 0) {
          relation.push(key)
          sub.changeFlag = true
        }
      })
    }
    return relation
  }
}
