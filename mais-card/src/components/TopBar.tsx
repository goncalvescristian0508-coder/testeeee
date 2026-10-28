import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from './Icons'

type Props = { title: string; right?: React.ReactNode; backTo?: string }

export function TopBar({ title, right, backTo }: Props) {
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-20 bg-surface dark:bg-dark-card border-b border-black/5 dark:border-white/5 px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-3 flex items-center gap-2">
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
        className="w-10 h-10 grid place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition"
      >
        <ArrowLeftIcon size={24} />
      </button>
      <h1 className="text-[20px] font-extrabold flex-1">{title}</h1>
      {right}
    </div>
  )
}
