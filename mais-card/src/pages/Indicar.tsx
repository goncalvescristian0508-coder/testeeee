import { PageTransition } from '../components/PageTransition'
import { Skeleton } from '../components/Skeleton'
import { StatCard } from '../components/StatCard'
import { Toast } from '../components/Toast'
import { TopBar } from '../components/TopBar'
import { CheckIcon, CopyIcon, SendIcon, StarIcon, UsersIcon } from '../components/Icons'
import { formatBRL, formatNumber } from '../data/mock'
import { api } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useToast } from '../hooks/useToast'

export function Indicar() {
  const { message, show } = useToast()
  const { data: ind } = useAsync(() => api.getIndicacao())
  const indicados = useAsync(() => api.getIndicados())

  const copy = async () => {
    if (!ind) return
    try {
      await navigator.clipboard.writeText(ind.link)
      show('Link copiado!')
    } catch {
      show('Não foi possível copiar')
    }
  }

  const share = async () => {
    if (!ind) return
    const data = { title: 'MAIS Card', text: 'Vem ser MAIS comigo! Use meu convite:', url: ind.link }
    try {
      if (navigator.share) await navigator.share(data)
      else await copy()
    } catch {
      /* cancelado */
    }
  }

  return (
    <PageTransition>
      <TopBar title="Indicar amigos" backTo="/" />
      <div className="px-4 pt-5 pb-4 space-y-4">
        <section className="relative rounded-[24px] p-5 bg-[#1E6B3C] text-white overflow-hidden fade-up">
          <span className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10" />
          <span className="absolute right-4 top-4 w-12 h-12 rounded-full bg-brand text-ink grid place-items-center"><UsersIcon size={24} /></span>
          <p className="inline-flex items-center gap-1 text-[11px] font-extrabold tracking-wide bg-[#2E8B57] rounded-full px-2.5 py-1"><StarIcon size={12} className="text-brand" /> INDIQUE E GANHE</p>
          <p className="mt-3 text-[30px] font-extrabold leading-none">
            {formatBRL(ind?.recompensaReais ?? 10)} <span className="text-[14px] font-bold">+ {formatNumber(ind?.recompensaCoins ?? 1000)} <span className="text-brand">+Coins</span></span>
          </p>
          <p className="mt-2 text-[13.5px] text-white/85">por cada <span className="text-brand font-bold">indicação</span> concluída!</p>
        </section>

        <section className="card p-5 fade-up delay-1">
          <p className="text-[13px] text-subtle">Seu link de indicação</p>
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-muted dark:bg-white/5 px-4 py-3">
            {ind ? <span className="text-[13.5px] font-semibold truncate flex-1">{ind.link}</span> : <Skeleton className="h-5 flex-1" />}
            <button type="button" aria-label="Copiar link" onClick={copy} className="w-9 h-9 rounded-full bg-brand text-ink grid place-items-center active:scale-95 transition"><CopyIcon size={18} /></button>
          </div>
          <p className="mt-3 text-[12.5px] text-subtle">Código: <span className="font-extrabold text-ink dark:text-white">{ind?.codigo ?? '…'}</span></p>
          <button type="button" onClick={share} className="btn-pill w-full mt-4 gap-2"><SendIcon size={18} /> Compartilhar convite</button>
        </section>

        <section className="grid grid-cols-2 gap-3 fade-up delay-2">
          <StatCard label="Indicações concluídas" value={String(ind?.concluidas ?? '—')} hint={`${ind?.pendentes ?? 0} pendentes`} />
          <StatCard label="Ganhos em dinheiro" value={ind ? formatBRL(ind.ganhosReais) : '—'} hint={`+ ${formatNumber(ind?.ganhosCoins ?? 0)} +Coins`} tone="brand" />
        </section>

        <section className="card p-5 fade-up delay-3">
          <h2 className="text-[17px] font-extrabold mb-3">Suas indicações</h2>
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {(indicados.data ?? []).map((p) => (
              <li key={p.nome} className="flex items-center gap-3 py-3">
                <span className="w-10 h-10 rounded-full bg-brand/25 text-ink dark:text-brand grid place-items-center font-extrabold">{p.nome[0]}</span>
                <div className="flex-1">
                  <p className="font-bold text-[14.5px]">{p.nome}</p>
                  <p className="text-[12px] text-subtle">{p.data}</p>
                </div>
                {p.status === 'concluida' ? (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#1E6B3C] dark:text-[#5ad38a] bg-[#1E6B3C]/10 rounded-full px-2.5 py-1"><CheckIcon size={12} strokeWidth={3} /> Concluída</span>
                ) : (
                  <span className="text-[11.5px] font-bold text-brand-dark dark:text-brand bg-brand/15 rounded-full px-2.5 py-1">Pendente</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <Toast message={message} />
    </PageTransition>
  )
}
