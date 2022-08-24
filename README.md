# xeres

This is a React state manager.
+ Out of the box.
+ zero configuration.
+ decentralized.
+ freely combined.
### Install


```bash
npm install xeres
```
## Getting Started

```ts
// countStore.ts
import { defineStore } from 'xeres'

export default defineStore({
  state: () => ({
    name: 'world',
    count: 0
  }),
  getters: {
    welcome() {
      return `Hello, ${this.name}`
    }
  },
  actions: {
    increment() {
      this.count += 1
    },
    decrement() {
      this.count -= 1
    }
  }
})
```
```tsx
import countStore from './countStore'

const useCountStore = () => countStore.useSelector(store => ({
  count: store.count,
  welcome: store.welcome
}))

export function counter() {
  /**
   * // All state data changes respond.
   * const { count, welcome } = countStore.useSelector()
   */
  // just responds to changes in count and welcome.
  const { count, welcome } = useCountStore()
  return (
    <div>
      <h2>{welcome}</h2>
      <div>
        <button onClick={countStore.increment} >
          Increment
        </button>
        <span>{count}</span>
        <button onClick={countStore.decrement} >
          Decrement
        </button>
      </div>
    </div>
  )
}
```


## License

This project is licensed under the MIT License.
