import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { CardVirtual } from '../components/CardVirtual'
import { PageTransition } from '../components/PageTransition'
import { Toast } from '../components/Toast'
import { FileIcon, LockIcon, RefreshIcon, WalletIcon } from '../components/Icons'
import { cartao, fatura, formatBRL, user } from '../data/mock'
import { useToast } from '../hooks/useToast'

export function MeuCard() {
  const navigate = useNavigate()
  const { message, show } = useToast()
  const [bloqueado, setBloqueado] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const pct = Math.min(100, (cartao.utilizado / cartao.limiteCompras) * 100)

  const refresh = () => {
    setSpinning(true)
    setTimeout(() => {
      setSpinning(false)
      show('Dados atualizados')
    }, 900)
  }

  return (
    <PageTransition>
      <TopBar
        title="Meu MAIS Card"
        backTo="/"
        right={
          <button type="button" aria-label="Atualizar" onClick={refresh} className="w-10 h-10 grid place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10">
            <RefreshIcon size={24} className={spinning ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="px-4 pt-6 pb-4 space-y-4">
        <div className="flex flex-col items-center fade-up">
          <div className={`transition ${bloqueado ? 'grayscale opacity-70' : ''}`}>
            <CardVirtual size="lg" />
          </div>
          <p className="mt-6 text-[15px] font-bold tracking-wide text-neutral-600 dark:text-neutral-300">{user.nomeCartao}</p>
          <p className="mt-1 text-[20px] font-extrabold tracking-wider">•••• {cartao.ultimosDigitos}</p>
          <span className={`mt-3 rounded-full px-5 py-2 text-[14px] font-extrabold ${bloqueado ? 'bg-danger text-white' : 'bg-brand text-ink'}`}>
            {bloqueado ? 'Bloqueado' : cartao.statusLabel}
          </span>
        </div>

        <section className="card p-5 fade-up delay-1">
          <p className="text-[13px] text-subtle">Limite disponível</p>
          <p className="text-[32px] font-extrabold leading-tight mt-1">{formatBRL(cartao.limiteDisponivel)}</p>
          <div className="mt-4 h-3 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
            <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-5 space-y-4 text-[15px]">
            <div className="flex justify-between"><span className="text-subtle">Limite de compras</span><span className="font-semibold">{formatBRL(cartao.limiteCompras)}</span></div>
            <div className="flex justify-between"><span className="text-subtle">Utilizado</span><span className="font-semibold">{formatBRL(cartao.utilizado)}</span></div>
          </div>
        </section>

        <section className="card-cream p-5 space-y-4 text-[15px] fade-up delay-2">
          <div className="flex justify-between"><span className="text-subtle">Melhor dia de compra</span><span className="font-semibold">dia {fatura.melhorDiaCompra}</span></div>
          <div className="flex justify-between"><span className="text-subtle">Fechamento</span><span className="font-semibold">{fatura.fechamento}</span></div>
          <div className="flex justify-between"><span className="text-subtle">Vencimento</span><span className="font-semibold">{fatura.vencimento}</span></div>
          <div className="flex justify-between"><span className="text-subtle">Fatura atual</span><span className="font-extrabold">{formatBRL(fatura.valorAtual)}</span></div>
        </section>

        <section className="grid grid-cols-3 gap-2 fade-up delay-3">
          <button
            type="button"
            onClick={() => {
              setBloqueado((b) => !b)
              show(bloqueado ? 'Cartão desbloqueado' : 'Cartão bloqueado')
            }}
            className="card p-3 flex flex-col items-center gap-2 text-[12.5px] font-bold active:scale-[0.97] transition"
          >
            <span className={`w-11 h-11 rounded-full grid place-items-center ${bloqueado ? 'bg-danger text-white' : 'bg-brand text-ink'}`}><LockIcon size={20} /></span>
            {bloqueado ? 'Desbloquear' : 'Bloquear cartão'}
          </button>
          <button type="button" onClick={() => navigate('/extrato')} className="card p-3 flex flex-col items-center gap-2 text-[12.5px] font-bold active:scale-[0.97] transition">
            <span className="w-11 h-11 rounded-full bg-brand text-ink grid place-items-center"><FileIcon size={20} /></span>
            Ver fatura
          </button>
          <button type="button" onClick={() => show('Pagamento simulado via Pix')} className="card p-3 flex flex-col items-center gap-2 text-[12.5px] font-bold active:scale-[0.97] transition">
            <span className="w-11 h-11 rounded-full bg-ink text-brand dark:bg-white dark:text-ink grid place-items-center"><WalletIcon size={20} /></span>
            Pagar fatura
          </button>
        </section>

        <button type="button" onClick={() => navigate('/entrega')} className="btn-outline w-full fade-up delay-4">
          Acompanhar entrega do cartão
        </button>
      </div>
      <Toast message={message} />
    </PageTransition>
  )
}
