import { useNavigate } from 'react-router-dom'
import { CheckIcon, ShieldIcon } from './Icons'
import type { StatusConta } from '../services/types'

type Props = { status: StatusConta; restanteMs: number; temGarantia: boolean }

function formatarRestante(ms: number) {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Card da tela inicial: conta em análise, ou aprovada e aguardando a Caixinha. */
export function StatusContaCard({ status, restanteMs, temGarantia }: Props) {
  const navigate = useNavigate()

  if (status.status === 'em_analise') {
    return (
      <section className="card-cream p-5 flex items-center gap-4" aria-live="polite">
        <span className="relative w-12 h-12 rounded-full bg-brand text-ink grid place-items-center shrink-0">
          <ShieldIcon size={24} />
          <span className="absolute inset-0 rounded-full border-2 border-brand animate-ping opacity-60" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-[15px]">Analisando seu cadastro</p>
          <p className="text-[13px] text-subtle mt-0.5">Conferindo documento e selfie. Você recebe um aviso aqui quando terminar.</p>
          <p className="text-[12.5px] font-bold mt-1 tabular-nums">Previsão: {formatarRestante(restanteMs)} min</p>
        </div>
      </section>
    )
  }

  if (status.status === 'aprovada' && !temGarantia) {
    return (
      <section className="card-cream p-5">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-full bg-brand text-ink grid place-items-center shrink-0"><CheckIcon size={24} strokeWidth={3} /></span>
          <div className="min-w-0">
            <p className="font-extrabold text-[15px]">Conta aprovada!</p>
            <p className="text-[13px] text-subtle mt-0.5">Agora é só guardar na Caixinha Garantia para ativar seu limite em 7 dias.</p>
          </div>
        </div>
        <button type="button" onClick={() => navigate('/garantia')} className="btn-pill w-full mt-4">Ativar meu limite</button>
      </section>
    )
  }

  if (status.status === 'recusada') {
    return (
      <section className="card p-5">
        <p className="font-extrabold text-[15px] text-danger">Não conseguimos aprovar sua conta</p>
        <p className="text-[13px] text-subtle mt-0.5">{status.motivoRecusa ?? 'Fale com o suporte para entender o motivo.'}</p>
      </section>
    )
  }

  return null
}
