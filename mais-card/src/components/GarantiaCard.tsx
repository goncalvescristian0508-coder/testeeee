import { useNavigate } from 'react-router-dom'
import { WalletIcon } from './Icons'
import { diasNaCaixinha, formatBRL, formatDate, garantia as regras } from '../data/mock'
import type { Garantia } from '../services/types'

/** Resumo da Caixinha Garantia com o progresso da carência de 7 dias. */
export function GarantiaCard({ garantia }: { garantia: Garantia }) {
  const navigate = useNavigate()
  const dias = diasNaCaixinha(garantia)
  const ativo = garantia.status === 'ativo' || dias >= garantia.carenciaDias
  const pct = Math.round((dias / garantia.carenciaDias) * 100)

  return (
    <section className="card p-5">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-full bg-brand text-ink grid place-items-center shrink-0"><WalletIcon size={22} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] text-subtle">Caixinha Garantia</p>
          <p className="text-[20px] font-extrabold leading-tight">{formatBRL(garantia.valor)}</p>
        </div>
        <span className={`text-[11.5px] font-extrabold rounded-full px-2.5 py-1 ${ativo ? 'bg-brand text-ink' : 'bg-cream dark:bg-dark-cream text-ink dark:text-brand'}`}>
          {ativo ? 'Limite ativo' : `Dia ${dias} de ${garantia.carenciaDias}`}
        </span>
      </div>

      <div className="mt-4 h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${ativo ? 100 : pct}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-subtle">
        {ativo
          ? `Limite de ${formatBRL(garantia.valor)} ativo desde ${formatDate(garantia.liberaEm)}.`
          : `Limite de ${formatBRL(garantia.valor)} será ativado em ${formatDate(garantia.liberaEm)}. Rende ${garantia.rendimento} desde o depósito.`}
      </p>
      <div className="mt-4 flex gap-2">
        {garantia.valor < regras.maximo && (
          <button type="button" onClick={() => navigate('/garantia')} className="btn-pill flex-1 py-2.5 text-[13px]">Guardar mais</button>
        )}
        <button type="button" className="btn-outline flex-1 py-2.5 text-[13px]">Resgatar</button>
      </div>
    </section>
  )
}
