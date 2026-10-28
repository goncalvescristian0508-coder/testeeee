import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { CardVirtual } from '../components/CardVirtual'
import { PageTransition } from '../components/PageTransition'
import { GarantiaCard } from '../components/GarantiaCard'
import { Skeleton } from '../components/Skeleton'
import { Toast } from '../components/Toast'
import { FileIcon, LockIcon, RefreshIcon, WalletIcon } from '../components/Icons'
import { formatBRL } from '../data/mock'
import { api } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useToast } from '../hooks/useToast'

export function MeuCard() {
  const navigate = useNavigate()
  const { message, show } = useToast()
  const usuario = useAsync(() => api.getUsuario())
  const cartao = useAsync(() => api.getCartao())
  const fatura = useAsync(() => api.getFatura())
  const garantia = useAsync(() => api.getGarantia())
  const [spinning, setSpinning] = useState(false)

  const c = cartao.data
  const pct = c ? Math.min(100, (c.utilizado / c.limiteCompras) * 100) : 0

  const refresh = () => {
    setSpinning(true)
    Promise.all([cartao.reload(), fatura.reload(), garantia.reload()]).finally(() => {
      setTimeout(() => {
        setSpinning(false)
        show('Dados atualizados')
      }, 600)
    })
  }

  const alternarBloqueio = async () => {
    if (!c) return
    const novo = await api.setCartaoBloqueado(!c.bloqueado)
    cartao.setData(novo)
    show(novo.bloqueado ? 'Cartão bloqueado' : 'Cartão desbloqueado')
  }

  const pagar = async () => {
    await api.pagarFatura()
    show('Pagamento enviado via Pix')
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
          <div className={`transition ${c?.bloqueado ? 'grayscale opacity-70' : ''}`}>
            <CardVirtual size="lg" />
          </div>
          <p className="mt-6 text-[15px] font-bold tracking-wide text-neutral-600 dark:text-neutral-300">{usuario.data?.nomeCartao ?? ' '}</p>
          <p className="mt-1 text-[20px] font-extrabold tracking-wider">•••• {c?.ultimosDigitos ?? '••••'}</p>
          {c ? (
            <span className={`mt-3 rounded-full px-5 py-2 text-[14px] font-extrabold ${c.bloqueado ? 'bg-danger text-white' : 'bg-brand text-ink'}`}>
              {c.bloqueado ? 'Bloqueado' : c.statusLabel}
            </span>
          ) : (
            <Skeleton className="mt-3 h-9 w-32 rounded-full" />
          )}
        </div>

        <section className="card p-5 fade-up delay-1">
          <p className="text-[13px] text-subtle">Limite disponível</p>
          {c ? <p className="text-[32px] font-extrabold leading-tight mt-1">{formatBRL(c.limiteDisponivel)}</p> : <Skeleton className="h-9 w-40 mt-1" />}
          <div className="mt-4 h-3 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
            <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-5 space-y-4 text-[15px]">
            <div className="flex justify-between"><span className="text-subtle">Limite de compras</span><span className="font-semibold">{c ? formatBRL(c.limiteCompras) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-subtle">Utilizado</span><span className="font-semibold">{c ? formatBRL(c.utilizado) : '—'}</span></div>
          </div>
        </section>

        {garantia.data ? (
          <div className="fade-up delay-2">
            <GarantiaCard garantia={garantia.data} />
          </div>
        ) : (
          !garantia.loading && (
            <section className="card-cream p-5 fade-up delay-2">
              <p className="font-extrabold text-[15px]">Seu limite ainda não foi ativado</p>
              <p className="text-[13px] text-subtle mt-0.5">Guarde um valor na Caixinha Garantia. Ele vira seu limite em 7 dias e continua seu.</p>
              <button type="button" onClick={() => navigate('/garantia')} className="btn-pill w-full mt-4">Ativar meu limite</button>
            </section>
          )
        )}

        <section className="card-cream p-5 space-y-4 text-[15px] fade-up delay-2">
          <div className="flex justify-between"><span className="text-subtle">Melhor dia de compra</span><span className="font-semibold">{fatura.data ? `dia ${fatura.data.melhorDiaCompra}` : '—'}</span></div>
          <div className="flex justify-between"><span className="text-subtle">Fechamento</span><span className="font-semibold">{fatura.data?.fechamento ?? '—'}</span></div>
          <div className="flex justify-between"><span className="text-subtle">Vencimento</span><span className="font-semibold">{fatura.data?.vencimento ?? '—'}</span></div>
          <div className="flex justify-between"><span className="text-subtle">Fatura atual</span><span className="font-extrabold">{fatura.data ? formatBRL(fatura.data.valorAtual) : '—'}</span></div>
        </section>

        <section className="grid grid-cols-3 gap-2 fade-up delay-3">
          <button type="button" onClick={alternarBloqueio} className="card p-3 flex flex-col items-center gap-2 text-[12.5px] font-bold active:scale-[0.97] transition">
            <span className={`w-11 h-11 rounded-full grid place-items-center ${c?.bloqueado ? 'bg-danger text-white' : 'bg-brand text-ink'}`}><LockIcon size={20} /></span>
            {c?.bloqueado ? 'Desbloquear' : 'Bloquear cartão'}
          </button>
          <button type="button" onClick={() => navigate('/extrato')} className="card p-3 flex flex-col items-center gap-2 text-[12.5px] font-bold active:scale-[0.97] transition">
            <span className="w-11 h-11 rounded-full bg-brand text-ink grid place-items-center"><FileIcon size={20} /></span>
            Ver fatura
          </button>
          <button type="button" onClick={pagar} className="card p-3 flex flex-col items-center gap-2 text-[12.5px] font-bold active:scale-[0.97] transition">
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
