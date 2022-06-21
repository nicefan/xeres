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
): (initState?: Partial<S> | undefined) => BaseStore<S & {}> &
  S &
  GetterRes<
    G &
      ThisType<
        S &
          GetterRes<G> & {
            $depend: <B extends Record<string, any>>(
              store: B
            ) => ReturnType<B['getState']>
          }
      >
  > &
  A &
  ThisType<ActionHandler<A> & BaseStore<S> & S & GetterRes<G>>
export declare function defineStore<S = Obj, G = Obj, A = Obj>(
  config: ModelOptions<S, G, A>
): BaseStore<S> &
  S &
  GetterRes<
    G &
      ThisType<
        S &
          GetterRes<G> & {
            $depend: <B extends Record<string, any>>(
              store: B
            ) => ReturnType<B['getState']>
          }
      >
  > &
  A &
  ThisType<ActionHandler<A> & BaseStore<S> & S & GetterRes<G>>
export declare function useStore<S extends BaseStore>(store: S): S
export declare function useStore<
  S extends BaseStore,
  F extends (store: S) => any
>(store: S, selector: F): ReturnType<F>
export {}
/** selector, getters 依赖收集 */
