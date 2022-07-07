declare type ActionHandler<A> = {
  [k in keyof A]: A[k] extends (...args: infer P) => infer R
    ? (...args: P) => R
    : never
}
export declare type GetterRes<G> = {
  readonly [k in keyof G]: G[k] extends (...args: any[]) => infer R
    ? R
    : G[k] extends {
        getState: () => infer S
      }
    ? S
    : G[k]
}
declare type Obj<T = any> = Record<string, T>
declare type Fn<T = any> = (...args: T[]) => any
declare type ModelOptions<S, G, A> = {
  name?: string
  state: S | (() => S)
  getters?: G & ThisType<S & GetterRes<G>>
  actions?: A & ThisType<ActionHandler<A> & BaseStore<S> & S & GetterRes<G>>
}
interface BaseStore<S> {
  getState: () => Readonly<S>
}
interface InnerStore<S = Obj> extends BaseStore<S> {
  $subscribe: (
    updater: Fn<[Obj]>,
    selector?: Fn
  ) => [get: () => any, unSubscribe: Fn]
}
declare type Store<S, G, A> = BaseStore<S> & S & GetterRes<G> & A
declare type Selector<S> = <F extends Obj>(
  selector?: (store: S) => RObj<F>
) => Obj extends F ? S : F
declare type RObj<T> = [keyof T] extends never ? never : T
export declare function createModel<S, A, G = Obj>({
  state,
  actions,
  getters,
}: ModelOptions<S, G, A>): InnerStore<S> & S & GetterRes<G> & A
export declare function defineModel<S = Obj, G = Obj, A = Obj>(
  config: ModelOptions<S, G, A>
): (initState?: S | undefined) => Store<S, G, A>
export declare function defineStore<S = Obj, G = Obj, A = Obj>(
  config: ModelOptions<S, G, A>
): [Store<S, G, A>, Selector<Store<S, G, A>>]
export {}
