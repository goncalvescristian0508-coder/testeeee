import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { StatusConta } from '../services/types'

const CHAVE_AVISO = 'mais-card-aprovacao-vista'

/**
 * Acompanha a situação da conta. Enquanto estiver em análise, consulta a API
 * a cada 10 s (em produção o backend pode avisar por push; aqui é consulta).
 * `avisoPendente` fica true na primeira vez que a aprovação é vista.
 */
export function useStatusConta() {
  const [status, setStatus] = useState<StatusConta | null>(null)
  const [agora, setAgora] = useState(Date.now())
  const [avisoPendente, setAvisoPendente] = useState(false)

  useEffect(() => {
    let ativo = true
    const consultar = async () => {
      try {
        const s = await api.getStatusConta()
        if (!ativo) return
        setStatus(s)
        if (s.status === 'aprovada') {
          let visto = false
          try {
            visto = localStorage.getItem(CHAVE_AVISO) === s.aprovadaEm
          } catch {
            /* ignore */
          }
          // Só avisa quem passou pela análise nesta instalação (não o usuário demo antigo).
          const recente = s.aprovadaEm ? Date.now() - new Date(s.aprovadaEm).getTime() < 24 * 3_600_000 : false
          setAvisoPendente(!visto && recente)
        }
      } catch {
        /* mantém o último estado */
      }
    }
    consultar()
    const id = window.setInterval(() => {
      setAgora(Date.now())
      if (!status || status.status === 'em_analise') consultar()
    }, 10_000)
    return () => {
      ativo = false
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.status])

  const restanteMs = status?.status === 'em_analise' ? Math.max(0, new Date(status.previsaoEm).getTime() - agora) : 0

  const marcarAvisoVisto = () => {
    try {
      if (status?.aprovadaEm) localStorage.setItem(CHAVE_AVISO, status.aprovadaEm)
    } catch {
      /* ignore */
    }
    setAvisoPendente(false)
  }

  return { status, restanteMs, avisoPendente, marcarAvisoVisto }
}
