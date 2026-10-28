import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { TopBar } from '../components/TopBar'
import { Toast } from '../components/Toast'
import { BellIcon, CameraIcon, ChevronRightIcon, IdIcon, LogoutIcon, MailIcon, MoonIcon, PhoneIcon, ShieldIcon, UserIcon, WalletIcon } from '../components/Icons'
import { api } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useToast } from '../hooks/useToast'

type Props = { theme: 'light' | 'dark'; onToggleTheme: () => void }

function Row({ icon, label, value, onClick, right }: { icon: React.ReactNode; label: string; value?: string; onClick?: () => void; right?: React.ReactNode }) {
  const content = (
    <>
      <span className="w-10 h-10 rounded-full bg-brand/20 text-ink dark:text-brand grid place-items-center shrink-0">{icon}</span>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[14.5px] font-bold">{label}</p>
        {value && <p className="text-[12.5px] text-subtle truncate">{value}</p>}
      </div>
      {right ?? <ChevronRightIcon size={20} className="text-subtle" />}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 py-3 active:opacity-70 transition">{content}</button>
  ) : (
    <div className="flex items-center gap-3 py-3">{content}</div>
  )
}

export function Perfil({ theme, onToggleTheme }: Props) {
  const navigate = useNavigate()
  const { message, show } = useToast()
  const dark = theme === 'dark'
  const { data: u } = useAsync(() => api.getUsuario())
  const user = u ?? { nomeCompleto: '…', email: '', cpf: '', telefone: '', conta: '', notificacoes: 0 }

  return (
    <PageTransition>
      <TopBar title="Perfil" backTo="/" />
      <div className="px-4 pt-5 pb-4 space-y-4">
        <section className="card p-5 flex items-center gap-4 fade-up">
          <div className="relative w-[72px] h-[72px] rounded-full bg-ink grid place-items-center shrink-0">
            <UserIcon size={36} className="text-white" />
            <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-brand border-[3px] border-surface dark:border-dark-card grid place-items-center"><CameraIcon size={13} className="text-ink" /></span>
          </div>
          <div className="min-w-0">
            <p className="text-[19px] font-extrabold">{user.nomeCompleto}</p>
            <p className="text-[13px] text-subtle truncate">{user.email}</p>
            <span className="inline-block mt-1.5 text-[11px] font-extrabold bg-brand text-ink rounded-full px-2.5 py-0.5">Cliente MAIS</span>
          </div>
        </section>

        <section className="card px-5 py-2 divide-y divide-black/5 dark:divide-white/10 fade-up delay-1">
          <Row icon={<IdIcon size={20} />} label="CPF" value={user.cpf} right={<span />} />
          <Row icon={<PhoneIcon size={20} />} label="Telefone" value={user.telefone} onClick={() => show('Edição de telefone em breve')} />
          <Row icon={<MailIcon size={20} />} label="E-mail" value={user.email} onClick={() => show('Edição de e-mail em breve')} />
          <Row icon={<WalletIcon size={20} />} label="Conta+" value={`Agência / Conta ${user.conta}`} right={<span />} />
        </section>

        <section className="card px-5 py-2 divide-y divide-black/5 dark:divide-white/10 fade-up delay-2">
          <Row
            icon={<MoonIcon size={20} />}
            label="Tema escuro"
            value={dark ? 'Ativado' : 'Desativado'}
            onClick={onToggleTheme}
            right={
              <span role="switch" aria-checked={dark} className={`w-12 h-7 rounded-full p-1 transition ${dark ? 'bg-brand' : 'bg-neutral-300 dark:bg-neutral-600'}`}>
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${dark ? 'translate-x-5' : ''}`} />
              </span>
            }
          />
          <Row icon={<BellIcon size={20} />} label="Notificações" value={`${user.notificacoes} não lidas`} onClick={() => show('Central de notificações em breve')} />
          <Row icon={<ShieldIcon size={20} />} label="Segurança" value="Senha, biometria e dispositivos" onClick={() => show('Configurações de segurança em breve')} />
        </section>

        <button type="button" onClick={() => navigate('/')} className="w-full card p-4 flex items-center justify-center gap-2 text-danger font-extrabold fade-up delay-3 active:scale-[0.98] transition">
          <LogoutIcon size={20} /> Sair da conta
        </button>
        <p className="text-center text-[11.5px] text-subtle">MAIS Card · versão 1.0.0 (demo)</p>
      </div>
      <Toast message={message} />
    </PageTransition>
  )
}
