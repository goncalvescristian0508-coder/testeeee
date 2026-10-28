import { PageTransition } from '../components/PageTransition'
import { TopBar } from '../components/TopBar'
import { Toast } from '../components/Toast'
import { CoinIcon, SwapIcon } from '../components/Icons'
import { formatBRL, formatNumber } from '../data/mock'
import { api } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useToast } from '../hooks/useToast'

export function Coins() {
  const { message, show } = useToast()
  const coins = useAsync(() => api.getCoins())
  const saldo = coins.data?.saldo ?? 0
  const emReais = saldo * (coins.data?.valorConversao ?? 0.01)

  const trocar = async () => {
    if (!saldo) return show('Você não tem +Coins para trocar')
    await api.trocarCoins()
    coins.reload()
    show(`${formatBRL(emReais)} creditados na Carteira+`)
  }

  return (
    <PageTransition>
      <TopBar title="+Coins" backTo="/" />
      <div className="px-4 pt-5 pb-4 space-y-4">
        <section className="relative rounded-[24px] p-6 bg-[#5A2CC7] text-white overflow-hidden fade-up">
          <span className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
          <span className="absolute right-5 top-5 w-14 h-14 rounded-full bg-brand text-ink grid place-items-center"><CoinIcon size={30} /></span>
          <p className="text-[13px] text-white/80">Seu saldo de moedas</p>
          <p className="mt-1 text-[38px] font-extrabold leading-none flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-brand inline-block" />{coins.data ? formatNumber(saldo) : '…'}</p>
          <p className="mt-3 text-[13px] text-white/85">Equivale a <span className="font-extrabold">{formatBRL(emReais)}</span></p>
        </section>
        <section className="card p-5 fade-up delay-1">
          <h2 className="text-[17px] font-extrabold">Trocar +Coins</h2>
          <p className="text-[13px] text-subtle mt-1">Converta suas moedas em saldo na Carteira+. Cada 100 +Coins valem R$ 1,00.</p>
          <button type="button" onClick={trocar} className="btn-pill w-full mt-4 gap-2"><SwapIcon size={18} /> Trocar por {formatBRL(emReais)}</button>
        </section>
        <section className="card p-5 fade-up delay-2">
          <h2 className="text-[17px] font-extrabold mb-2">Como ganhar</h2>
          <ul className="space-y-2 text-[13.5px]">
            {['Compras no MAIS Card: 1 +Coin a cada R$ 1', 'Indicações concluídas: 1.000 +Coins', 'Pagamento da fatura em dia: 200 +Coins'].map((t) => (
              <li key={t} className="flex gap-2"><span className="w-2 h-2 mt-2 rounded-full bg-brand shrink-0" />{t}</li>
            ))}
          </ul>
        </section>
      </div>
      <Toast message={message} />
    </PageTransition>
  )
}
