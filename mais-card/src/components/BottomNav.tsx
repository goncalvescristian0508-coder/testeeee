import { NavLink, useNavigate } from 'react-router-dom'
import { CardIcon, HomeIcon, PixDiamondIcon, SendIcon, UserIcon } from './Icons'

const items = [
  { to: '/', label: 'Início', Icon: HomeIcon },
  { to: '/card', label: 'MAIS Card', Icon: CardIcon },
  null,
  { to: '/indicar', label: 'Indicar', Icon: SendIcon },
  { to: '/perfil', label: 'Perfil', Icon: UserIcon },
] as const

export function BottomNav() {
  const navigate = useNavigate()
  return (
    <nav
      aria-label="Navegação principal"
      className="absolute bottom-0 inset-x-0 z-30 bg-brand rounded-t-[26px] pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-[0_-6px_24px_rgba(0,0,0,0.12)]"
    >
      <div className="grid grid-cols-5 items-end">
        {items.map((item, i) =>
          item ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-1 text-[12px] font-bold text-ink transition-opacity ${isActive ? 'opacity-100' : 'opacity-60'}`
              }
            >
              <item.Icon size={26} />
              {item.label}
            </NavLink>
          ) : (
            <div key={`center-${i}`} className="relative flex justify-center">
              <button
                type="button"
                aria-label="Pix e transferências"
                onClick={() => navigate('/transferir')}
                className="absolute -top-14 w-[72px] h-[72px] rounded-full bg-ink text-white grid place-items-center border-[6px] border-brand shadow-[0_10px_25px_rgba(0,0,0,0.35)] active:scale-95 transition"
              >
                <PixDiamondIcon size={32} />
              </button>
              <div className="h-[46px]" />
            </div>
          ),
        )}
      </div>
    </nav>
  )
}
