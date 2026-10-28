import { CheckIcon } from './Icons'

export type TimelineStep = { id: string; titulo: string; descricao: string; data?: string }

type Props = { steps: TimelineStep[]; currentId: string }

export function Timeline({ steps, currentId }: Props) {
  const currentIdx = Math.max(0, steps.findIndex((s) => s.id === currentId))
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const done = i < currentIdx
        const current = i === currentIdx
        const last = i === steps.length - 1
        return (
          <li key={s.id} className="relative flex gap-4 pb-7 last:pb-0 fade-up" style={{ animationDelay: `${i * 70}ms` }}>
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute left-[15px] top-8 bottom-0 w-[3px] rounded-full ${done ? 'bg-brand' : 'bg-neutral-200 dark:bg-neutral-700'}`}
              />
            )}
            <span
              className={`relative z-10 w-8 h-8 rounded-full grid place-items-center shrink-0 font-extrabold text-[13px] transition
                ${done ? 'bg-brand text-ink' : ''}
                ${current ? 'bg-brand text-ink ring-4 ring-brand/30 scale-110' : ''}
                ${!done && !current ? 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400' : ''}`}
            >
              {done ? <CheckIcon size={16} strokeWidth={3} /> : i + 1}
            </span>
            <div className="flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className={`font-extrabold text-[16px] ${!done && !current ? 'text-subtle' : ''}`}>{s.titulo}</p>
                {s.data && <span className="text-[12px] text-subtle">{s.data}</span>}
              </div>
              <p className="text-[13px] text-subtle mt-0.5">{s.descricao}</p>
              {current && (
                <span className="inline-block mt-2 text-[11px] font-bold bg-brand text-ink rounded-full px-2.5 py-1">Etapa atual</span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
