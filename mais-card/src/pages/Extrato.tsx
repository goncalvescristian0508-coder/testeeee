import { PageTransition } from '../components/PageTransition'
import { Skeleton } from '../components/Skeleton'
import { StatCard } from '../components/StatCard'
import { TopBar } from '../components/TopBar'
import { ArrowLeftIcon, ArrowRightIcon } from '../components/Icons'
import { formatBRL } from '../data/mock'
import { api } from '../services/api'
import { useAsync } from '../hooks/useAsync'

export function Extrato() {
  const carteira = useAsync(() => api.getCarteira())
  const transacoes = useAsync(() => api.getTransacoes())
  return (
    <PageTransition>
      <TopBar title="Extrato da Carteira" backTo="/" />
      <div className="px-4 pt-5 pb-4 space-y-4">
        <section className="grid grid-cols-2 gap-3 fade-up">
          <StatCard label="Saldo disponível" value={carteira.data ? formatBRL(carteira.data.saldoDisponivel) : '—'} />
          <StatCard label="Saldo reservado" value={carteira.data ? formatBRL(carteira.data.saldoReservado) : '—'} tone="danger" />
        </section>
        <section className="card p-5 fade-up delay-1">
          <h2 className="text-[17px] font-extrabold mb-2">Últimas movimentações</h2>
          {transacoes.loading && <div className="space-y-3 py-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>}
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {(transacoes.data ?? []).map((t) => {
              const credit = t.tipo === 'credito'
              return (
                <li key={t.id} className="flex items-center gap-3 py-3.5">
                  <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${credit ? 'bg-[#1E6B3C]/15 text-[#1E6B3C] dark:text-[#5ad38a]' : 'bg-brand/20 text-ink dark:text-brand'}`}>
                    {credit ? <ArrowLeftIcon size={18} className="-rotate-45" /> : <ArrowRightIcon size={18} className="-rotate-45" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14.5px] truncate">{t.descricao}</p>
                    <p className="text-[12px] text-subtle">{t.categoria} · {t.data}</p>
                  </div>
                  <span className={`font-extrabold text-[14.5px] ${credit ? 'text-[#1E6B3C] dark:text-[#5ad38a]' : ''}`}>
                    {credit ? '+' : ''}{formatBRL(t.valor)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </PageTransition>
  )
}
