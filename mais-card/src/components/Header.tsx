import { Logo } from './Logo'
import { BellIcon, CameraIcon, HeadsetIcon, MoonIcon, SearchIcon, SunIcon, UserIcon } from './Icons'
import { user } from '../data/mock'

type Props = { theme: 'light' | 'dark'; onToggleTheme: () => void }

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative w-10 h-10 grid place-items-center rounded-full text-ink hover:bg-black/10 active:scale-95 transition"
    >
      {children}
    </button>
  )
}

export function Header({ theme, onToggleTheme }: Props) {
  return (
    <header className="bg-brand text-ink rounded-b-[28px] px-5 pt-[calc(env(safe-area-inset-top)+14px)] pb-7 shadow-[0_6px_20px_rgba(245,194,27,0.25)]">
      <div className="flex items-center justify-between">
        <Logo height={44} />
        <div className="flex items-center gap-0.5">
          <IconButton label={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} onClick={onToggleTheme}>
            {theme === 'dark' ? <SunIcon size={24} /> : <MoonIcon size={24} />}
          </IconButton>
          <IconButton label="Suporte"><HeadsetIcon size={24} /></IconButton>
          <IconButton label="Notificações">
            <BellIcon size={24} />
            <span className="absolute -top-0.5 right-0 min-w-[22px] h-[22px] px-1 rounded-full bg-ink text-white text-[11px] font-bold grid place-items-center border-2 border-brand">
              {user.notificacoes}
            </span>
          </IconButton>
          <IconButton label="Buscar"><SearchIcon size={24} /></IconButton>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div className="relative w-[68px] h-[68px] rounded-full bg-ink grid place-items-center shrink-0">
          <UserIcon size={34} className="text-white" />
          <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-ink border-[3px] border-brand grid place-items-center">
            <CameraIcon size={14} className="text-brand" />
          </span>
        </div>
        <div>
          <h1 className="text-[22px] font-extrabold leading-tight">
            Olá, {user.nome}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-[15px] font-semibold text-ink/80">Aqui você é MAIS!</p>
        </div>
      </div>
    </header>
  )
}
