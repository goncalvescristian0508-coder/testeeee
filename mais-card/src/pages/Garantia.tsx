import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { StepHeader } from '../components/StepHeader'
import { CardVirtual } from '../components/CardVirtual'
import { CheckIcon, PixDiamondIcon } from '../components/Icons'
import { calcularCiclo, diasVencimento, formatBRL, garantia } from '../data/mock'
import { useOnboarding } from '../hooks/useOnboarding'

export function Garantia() {
  const navigate = useNavigate()
  const { data, update } = useOnboarding()
  const [custom, setCustom] = useState('')
  const valor = data.valorGarantia
  const valido = valor >= garantia.minimo && valor <= garantia.maximo

  const setValor = (v: number) => update({ valorGarantia: v })

  return (
    <PageTransition>
      <StepHeader step={5} total={5} title="Caixinha Garantia" subtitle="Escolha quanto guardar. Esse valor vira o seu limite depois de 7 dias na Caixinha e rende desde o primeiro dia." backTo="/selfie" />
      <div className="px-5 pt-6 pb-6 space-y-4">
        <section className="card-cream p-5 flex items-center gap-4">
          <CardVirtual size="sm" variant="amarelo" />
          <div className="min-w-0">
            <p className="text-[12.5px] text-subtle">Seu limite será</p>
            <p className="text-[26px] font-extrabold leading-tight">{formatBRL(valido ? valor : 0)}</p>
            <p className="text-[12px] text-subtle">igual ao valor guardado, ativo em {garantia.carenciaDias} dias</p>
          </div>
        </section>

        <section>
          <p className="text-[12.5px] font-bold text-subtle mb-2">Valores sugeridos</p>
          <div className="grid grid-cols-3 gap-2">
            {garantia.valoresSugeridos.map((v) => {
              const sel = valor === v && !custom
              return (
                <button key={v} type="button" onClick={() => { setCustom(''); setValor(v) }} className={`card py-3 text-[15px] font-extrabold border-2 transition ${sel ? 'border-brand' : 'border-transparent'}`}>
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
                placeholder={`de ${garantia.minimo} a ${garantia.maximo.toLocaleString('pt-BR')}`}
                className="w-full bg-transparent py-3 pl-2 text-[18px] font-extrabold outline-none"
              />
            </div>
          </label>
          {!valido && <p role="alert" className="mt-2 text-[12.5px] font-bold text-danger">O valor precisa ficar entre {formatBRL(garantia.minimo)} e {formatBRL(garantia.maximo)}.</p>}
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

        <button type="button" disabled={!valido} onClick={() => navigate('/conta-criada')} className="btn-pill w-full gap-2 disabled:opacity-40"><PixDiamondIcon size={18} /> Guardar {formatBRL(valido ? valor : 0)} via Pix</button>
        <p className="text-[12px] text-subtle text-center">Demonstração: nenhum pagamento é feito.</p>
      </div>
    </PageTransition>
  )
}
