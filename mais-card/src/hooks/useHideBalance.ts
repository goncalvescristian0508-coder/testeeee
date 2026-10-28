import { useCallback, useState } from 'react'

const KEY = 'mais-card-hide-balance'

export function useHideBalance() {
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  const toggle = useCallback(() => {
    setHidden((h) => {
      try {
        localStorage.setItem(KEY, h ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !h
    })
  }, [])
  return { hidden, toggle }
}
