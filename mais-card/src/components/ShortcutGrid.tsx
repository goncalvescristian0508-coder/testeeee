import { useNavigate } from 'react-router-dom'
import { atalhos } from '../data/mock'
import { CoinIcon, ListIcon, PlusCircleIcon, SendIcon, SplitIcon, SwapIcon } from './Icons'

const icons: Record<(typeof atalhos)[number]['icon'], React.ComponentType<{ size?: number; className?: string }>> = {
  parcela: SplitIcon,
  transferir: SendIcon,
  extrato: ListIcon,
  coins: CoinIcon,
  trocar: SwapIcon,
  saldo: PlusCircleIcon,
}

const routes: Record<string, string> = {
  transferir: '/transferir',
  extrato: '/extrato',
  coins: '/coins',
  trocar: '/coins',
  saldo: '/transferir',
  parcela: '/card',
}

export function ShortcutGrid() {
  const navigate = useNavigate()
  return (
    <div className="card grid grid-cols-3 overflow-hidden">
      {atalhos.map((a, i) => {
        const Icon = icons[a.icon]
        const borderR = i % 3 !== 2 ? 'border-r' : ''
        const borderB = i < 3 ? 'border-b' : ''
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => navigate(routes[a.id] ?? '/')}
            className={`flex flex-col items-center text-center px-2 py-5 gap-2 border-black/5 dark:border-white/10 ${borderR} ${borderB} hover:bg-black/[0.02] dark:hover:bg-white/5 active:bg-black/5 transition`}
          >
            <span className="w-12 h-12 rounded-full bg-brand text-ink grid place-items-center">
              <Icon size={22} />
            </span>
            <span className="text-[13.5px] font-bold leading-tight">{a.titulo}</span>
            <span className="text-[11.5px] leading-tight text-subtle">{a.descricao}</span>
          </button>
        )
      })}
    </div>
  )
}
