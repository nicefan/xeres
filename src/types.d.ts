type Obj<T = any> = { [k: string]: T } & { call?: never }
type Fn<P = any, R = void> = (...args: P) => R
type Cls<T = any> = new (...args: any[]) => T
// type Callback<P, R> = (...args:P)
