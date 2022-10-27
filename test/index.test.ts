/*
 * @Author: 范阳峰
 * @Date: 2022-10-08 11:32:34
 * @Description: 
 */
import { test, expect, vi, assert } from 'vitest'
import { createModel, defineModel } from '../src'
class MyClass{
  #_val = ''
  get val() {
    return this.#_val
  }
  set val(v) {
    this.#_val = v
  }
}
const bj = Symbol('a')
const model = createModel({
  state: {
    num: 0,
    cls: new MyClass(),
    date: new Date(),
    setObj: new Set(),
    mapObj: new Map<any, any>(),
    arr: ['a', 'b', 'c', 'd'],
  },
  actions: {
    count() {
      // this.num += 1
      // this.del()
      this.setObj = new Set(['a'])
      this.mapObj.set(bj, { t: 't' })
      this.mapObj.set('a', { k: 'ax' })
      new Promise(resolve => setTimeout(resolve, 10)).then(() => {
        this.date = new Date()
        this.cls.val = String(this.num)
        this.setObj.add(this.num)
        const abc = this.mapObj.get('a')
        abc.k = 'ax3'
        this.mapObj.set(this.date, this.num)
      })
    },
    del() {
      this.arr.splice(1, 1)
    },
  },
})

const notify = (args) => {
  console.log(args)
}

test('should first', async () => {
  const viNotify = vi.fn((arg) => {
    console.log(arg)
    expect(arg).toBeTruthy()
  })
  expect.assertions(2)
  vi.useFakeTimers()
  model.subscribe(viNotify)
  model.count()
  vi.runAllTimers()
  vi.runAllTicks()

  // expect(viNotify).toHaveBeenCalledTimes(1)
})
