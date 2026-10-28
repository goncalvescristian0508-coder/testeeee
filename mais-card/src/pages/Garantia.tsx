import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { TopBar } from '../components/TopBar'
import { CardVirtual } from '../components/CardVirtual'
import { CheckIcon, PixDiamondIcon } from '../components/Icons'
import { calcularCiclo, diasVencimento, formatBRL, garantia } from '../data/mock'
import { api } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useOnboarding } from '../hooks/useOnboarding'

/** Depois da aprovação: escolher quanto guardar e o dia de vencimento. */
export function Garantia() {
  const navigate = useNavigate()
  const { data, update } = useOnboarding()
  const [custom, setCustom] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const atual = useAsync(() => api.getGarantia())
  const jaGuardado = atual.data?.valor ?? 0
  const maximo = Math.max(0, garantia.maximo - jaGuardado)
  const valor = data.valorGarantia
  const valido = valor >= garantia.minimo && valor <= maximo
  const setValor = (v: number) => update({ valorGarantia: v })

  const guardar = async () => {
    if (!valido) return
    setEnviando(true)
    setErro(null)
    try {
      await api.ativarGarantia(valor, data.diaVencimento)
      navigate('/card')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <PageTransition>
      <TopBar title="Caixinha Garantia" backTo="/" />
      <div className="px-4 pt-5 pb-6 space-y-4">
        <p className="px-1 text-[14px] text-subtle">Escolha quanto guardar. Esse valor vira o seu limite depois de 7 dias na Caixinha e rende desde o primeiro dia.</p>

        <section className="card-cream p-5 flex items-center gap-4">
          <CardVirtual size="sm" variant="amarelo" />
          <div className="min-w-0">
            <p className="text-[12.5px] text-subtle">Seu limite será</p>
            <p className="text-[26px] font-extrabold leading-tight">{formatBRL(valido ? jaGuardado + valor : jaGuardado)}</p>
            <p className="text-[12px] text-subtle">igual ao valor guardado, ativo em {garantia.carenciaDias} dias · máximo {formatBRL(garantia.maximo)}</p>
          </div>
        </section>

        {maximo < garantia.minimo && (
          <p className="card p-4 text-[13.5px] font-bold text-center">Você já está no limite máximo de {formatBRL(garantia.maximo)}.</p>
        )}

        <section>
          <p className="text-[12.5px] font-bold text-subtle mb-2">Valores sugeridos</p>
          <div className="grid grid-cols-3 gap-2">
            {garantia.valoresSugeridos.map((v) => {
              const sel = valor === v && !custom
              return (
                <button key={v} type="button" disabled={v > maximo} onClick={() => { setCustom(''); setValor(v) }} className={`card py-3 text-[15px] font-extrabold border-2 transition disabled:opacity-35 ${sel ? 'border-brand' : 'border-transparent'}`}>
                  {formatBRL(v)}
                </button>
              )
            })}
          </div>
          <label className="block mt-3">
            <span className="text-[12.5px] font-bold text-subtle">Ou digite outro valor</span>
            <div className="mt-1 flex items-center rounded-2xl bg-surface dark:bg-dark-card px-4 ring-1 ring-black/5 dark:ring-white/10 focus-within:ring-2 focus-within:ring-brand">
              <span className="font-extrabold text-subtle">R$</span>
              <input
                id="valor-garantia"
                inputMode="numeric"
                value={custom}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '')
                  setCustom(digits)
                  if (digits) setValor(Number(digits))
                }}
                placeholder={`de ${garantia.minimo} a ${maximo}`}
                className="w-full bg-transparent py-3 pl-2 text-[18px] font-extrabold outline-none"
              />
            </div>
          </label>
          {!valido && maximo >= garantia.minimo && <p role="alert" className="mt-2 text-[12.5px] font-bold text-danger">O valor precisa ficar entre {formatBRL(garantia.minimo)} e {formatBRL(maximo)}.</p>}
        </section>

        <section>
          <p className="text-[12.5px] font-bold text-subtle mb-2">Dia do vencimento da fatura</p>
          <div className="grid grid-cols-6 gap-1.5">
            {diasVencimento.map((d) => (
              <button key={d} type="button" onClick={() => update({ diaVencimento: d })} className={`card py-2.5 text-[15px] font-extrabold border-2 transition ${data.diaVencimento === d ? 'border-brand' : 'border-transparent'}`}>
                {d}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-subtle">Fatura fecha dia {calcularCiclo(data.diaVencimento).fechamento}. Melhor dia de compra: dia {calcularCiclo(data.diaVencimento).melhorDia}.</p>
        </section>

        <section className="card p-5">
          <h2 className="text-[16px] font-extrabold mb-3">Como funciona</h2>
          <ul className="space-y-2.5">
            {garantia.regras.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-[13.5px]"><span className="mt-0.5 w-5 h-5 rounded-full bg-brand text-ink grid place-items-center shrink-0"><CheckIcon size={12} strokeWidth={3} /></span>{r}</li>
            ))}
          </ul>
        </section>

        {erro && <p role="alert" className="text-[13px] font-bold text-danger">{erro}</p>}
        <button type="button" disabled={!valido || enviando} onClick={guardar} className="btn-pill w-full gap-2 disabled:opacity-40"><PixDiamondIcon size={18} /> {enviando ? 'Confirmando…' : `Guardar ${formatBRL(valido ? valor : 0)} via Pix`}</button>
        <p className="text-[12px] text-subtle text-center">Demonstração: nenhum pagamento é feito.</p>
      </div>
    </PageTransition>
  )
}
