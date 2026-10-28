import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { BannerCarousel } from '../components/BannerCarousel'
import { ShortcutGrid } from '../components/ShortcutGrid'
import { PageTransition } from '../components/PageTransition'
import { Skeleton } from '../components/Skeleton'
import { StatusContaCard } from '../components/StatusContaCard'
import { AprovacaoModal } from '../components/AprovacaoModal'
import { useStatusConta } from '../hooks/useStatusConta'
import { ArrowRightIcon, ChevronRightIcon, CoinIcon, EyeIcon, EyeOffIcon, GearIcon, StarIcon, UsersIcon } from '../components/Icons'
import { formatBRL, formatNumber } from '../data/mock'
import { api } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useHideBalance } from '../hooks/useHideBalance'

type Props = { theme: 'light' | 'dark'; onToggleTheme: () => void }

export function Home({ theme, onToggleTheme }: Props) {
  const navigate = useNavigate()
  const { hidden, toggle } = useHideBalance()
  const usuario = useAsync(() => api.getUsuario())
  const carteira = useAsync(() => api.getCarteira())
  const coins = useAsync(() => api.getCoins())
  const indicacao = useAsync(() => api.getIndicacao())
  const garantia = useAsync(() => api.getGarantia())
  const conta = useStatusConta()
  const money = (v: number) => (hidden ? 'R$ ••••' : formatBRL(v))

  return (
    <PageTransition>
      <Header theme={theme} onToggleTheme={onToggleTheme} usuario={usuario.data} />

      <div className="px-4 -mt-4 pb-4 space-y-4">
        {/* Carteira+ */}
        <section className="card p-5 fade-up">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-extrabold">Carteira+</h2>
            <button type="button" aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'} onClick={toggle} className="text-subtle hover:text-ink dark:hover:text-white">
              {hidden ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
            <button type="button" aria-label="Configurações da carteira" onClick={() => navigate('/perfil')} className="text-subtle hover:text-ink dark:hover:text-white">
              <GearIcon size={18} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-[1.15fr_1fr_1fr] gap-2">
            <button type="button" onClick={() => navigate('/extrato')} className="text-left">
              <p className="text-[12px] text-subtle">Saldo disponível</p>
              {carteira.data ? (
                <p className="text-[20px] font-extrabold mt-1 flex items-center gap-0.5">
                  {money(carteira.data.saldoDisponivel)}
                  <ChevronRightIcon size={18} className="text-subtle" />
                </p>
              ) : (
                <Skeleton className="h-7 w-24 mt-1" />
              )}
            </button>
            <div className="border-l border-black/5 dark:border-white/10 pl-3">
              <p className="text-[12px] text-subtle">Em processamento</p>
              {carteira.data ? <p className="text-[18px] font-extrabold mt-1">{money(carteira.data.emProcessamento)}</p> : <Skeleton className="h-6 w-20 mt-1" />}
            </div>
            <div className="border-l border-black/5 dark:border-white/10 pl-3">
              <p className="text-[12px] text-subtle">Saldo reservado</p>
              {carteira.data ? <p className="text-[18px] font-extrabold mt-1 text-danger">{money(carteira.data.saldoReservado)}</p> : <Skeleton className="h-6 w-16 mt-1" />}
            </div>
          </div>
        </section>

        {conta.status && (conta.status.status !== 'aprovada' || (garantia.data === null && !garantia.loading)) && (
          <section className="fade-up delay-1">
            <StatusContaCard status={conta.status} restanteMs={conta.restanteMs} temGarantia={!!garantia.data} />
          </section>
        )}

        <section className="fade-up delay-1">
          {/* Sem Caixinha ativa não existe cartão emitido: esconde esse banner. */}
          <BannerCarousel ocultar={!garantia.loading && !garantia.data ? ['b1'] : []} />
        </section>

        <section className="fade-up delay-2">
          <ShortcutGrid />
        </section>

        <section className="grid grid-cols-2 gap-3 fade-up delay-3">
          <button
            type="button"
            onClick={() => navigate('/coins')}
            className="relative text-left rounded-[24px] p-4 bg-[#5A2CC7] text-white overflow-hidden min-h-[170px] active:scale-[0.98] transition"
          >
            <span className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
            <span className="absolute right-3 top-3 w-11 h-11 rounded-full bg-brand text-ink grid place-items-center"><CoinIcon size={24} /></span>
            <p className="font-extrabold text-[15px]">+Coins</p>
            <p className="flex items-center gap-1.5 mt-1 text-[14px] font-bold"><span className="w-2.5 h-2.5 rounded-full bg-brand inline-block" /> {coins.data ? formatNumber(coins.data.saldo) : '…'}</p>
            <p className="mt-5 text-[13.5px] text-white/85 leading-snug">Suas moedas e recompensas</p>
            <p className="mt-3 text-[12.5px] font-bold underline underline-offset-2">Ver minhas moedas</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/indicar')}
            className="relative text-left rounded-[24px] p-4 bg-[#1E6B3C] text-white overflow-hidden min-h-[170px] active:scale-[0.98] transition"
          >
            <span className="absolute right-3 top-3 w-11 h-11 rounded-full bg-brand text-ink grid place-items-center"><UsersIcon size={22} /></span>
            <p className="inline-flex items-center gap-1 text-[10.5px] font-extrabold tracking-wide bg-[#2E8B57] rounded-full px-2 py-1"><StarIcon size={11} className="text-brand" /> INDIQUE E GANHE</p>
            <p className="mt-3 text-[26px] font-extrabold leading-none">
              R$ {indicacao.data?.recompensaReais ?? 10}
              <span className="text-[12px] font-bold ml-1">+ {formatNumber(indicacao.data?.recompensaCoins ?? 1000)} <span className="text-brand">+Coins</span></span>
            </p>
            <p className="mt-2 text-[12px] text-white/85 leading-snug">por cada <span className="text-brand font-bold">indicação</span> concluída!</p>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#2E8B57] px-3 py-1.5 text-[12.5px] font-bold">Indicar agora <ArrowRightIcon size={14} /></span>
          </button>
        </section>
      </div>
      {conta.avisoPendente && <AprovacaoModal nome={usuario.data?.nome} onFechar={conta.marcarAvisoVisto} />}
    </PageTransition>
  )
}
