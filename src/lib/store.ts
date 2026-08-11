import { useSyncExternalStore } from 'react'

export interface Store<T> {
  get: () => T
  set: (next: T | ((prev: T) => T)) => void
  subscribe: (listener: () => void) => () => void
}

/** 极简模块级状态仓库（配合 useSyncExternalStore 驱动 React 渲染） */
export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? (next as (p: T) => T)(state) : next
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}
