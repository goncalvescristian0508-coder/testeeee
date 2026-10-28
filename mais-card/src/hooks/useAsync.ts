import { useCallback, useEffect, useState } from 'react'

type State<T> = { data: T | null; loading: boolean; error: string | null }

/** Carrega dados assíncronos (da camada `api`) com estados de loading e erro. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null })

  const run = useCallback(() => {
    let ativo = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fn()
      .then((data) => ativo && setState({ data, loading: false, error: null }))
      .catch((e: unknown) => ativo && setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'Erro ao carregar' }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => run(), [run])

  return { ...state, reload: run, setData: (data: T) => setState({ data, loading: false, error: null }) }
}
