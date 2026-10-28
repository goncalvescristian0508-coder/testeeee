import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from './Icons'

type Props = { step: number; total: number; title: string; subtitle?: string; backTo?: string }

/** Cabeçalho das etapas de abertura de conta, com barra de progresso. */
export function StepHeader({ step, total, title, subtitle, backTo }: Props) {
  const navigate = useNavigate()
  return (
    <div className="px-5 pt-[calc(env(safe-area-inset-top)+10px)]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="w-10 h-10 -ml-2 grid place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition"
        >
          <ArrowLeftIcon size={24} />
        </button>
        <span className="text-[12.5px] font-bold text-subtle">Etapa {step} de {total}</span>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? 'bg-brand' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
        ))}
      </div>
      <h1 className="mt-5 text-[24px] leading-tight font-extrabold text-balance">{title}</h1>
      {subtitle && <p className="mt-2 text-[14px] text-subtle leading-snug">{subtitle}</p>}
    </div>
  )
}
