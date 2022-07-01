declare type ActionHandler<A> = {
  [k in keyof A]: A[k] extends (...args: infer P) => infer R
    ? (...args: P) => R
    : never
}
export declare type GetterRes<G> = {
  readonly [k in keyof G]: G[k] extends (...args: any[]) => infer R ? R : G[k]
}
declare type Obj<T = any> = Record<string, T>
declare type Fn<T = any> = (...args: T[]) => any
declare type ModelOptions<S, G, A> = {
  name?: string
  state: S | (() => S)
  getters?: G &
    ThisType<
      S &
        GetterRes<G> & {
          $depend: <B extends Obj>(store: B) => ReturnType<B['getState']>
        }
    >
  actions?: A & ThisType<ActionHandler<A> & BaseStore<S> & S & GetterRes<G>>
}
declare type Subscibe = {
  deps: string[]
  result?: any
  updater: Fn
}
declare class BaseStore<S extends Obj = Obj> {
  #private
  constructor(
    {
      state,
      actions,
      getters,
    }: {
      state: S
      actions?: Obj
      getters?: Obj
    },
    forceUpdate?: Fn
  )
  get subscribers(): Set<Subscibe>
  /** 定阅其它store变化 */
  $depend<T extends BaseStore<Obj>>(store: T): Readonly<Record<string, any>>
  /** 监听者 */
  $subscribe(updater: Fn, selector?: Fn): () => void
  /** 收集其它store依赖 */
  getState(): Readonly<S>
  setState(setter: (state: S) => void): void
  private produce
}

export declare function defineModel<S = Obj, G = Obj, A = Obj>(
  config: ModelOptions<S, G, A>
): (
  initState?: Partial<S> | undefined
) => BaseStore<S & {}> & S & GetterRes<G> & A

type RObj<T> = keyof T extends never ? never : T

type Store<S, G, A> = ActionHandler<A> &
  BaseStore<S> &
  S &
  GetterRes<G> & {
    selector: <F extends Obj>(
      selector?: (store: BaseStore<S> & S & GetterRes<G> & A) => RObj<F>
    ) => Obj extends F ? BaseStore<S> & S & GetterRes<G> & A : F
  }

export declare function defineStore<S = Obj, G = Obj, A = Obj>(
  config: ModelOptions<S, G, A>
): Store<S, G, A>
// export declare function useStore<S extends BaseStore>(store: S): S
export declare function useStore<S extends BaseStore, R extends Obj>(
  store: S,
  selector?: (store: S) => R
): Obj extends R ? S : R
export {}
/** selector, getters 依赖收集 */
