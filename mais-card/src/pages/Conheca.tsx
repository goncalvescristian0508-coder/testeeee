import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { CardVirtual } from '../components/CardVirtual'
import { Logo } from '../components/Logo'
import { ArrowRightIcon, CheckIcon, ChevronRightIcon, ShieldIcon } from '../components/Icons'
import { formatBRL, garantia, landing } from '../data/mock'
import { useOnboarding } from '../hooks/useOnboarding'

/** Página de apresentação do MAIS Card Garantido: regras completas antes do quiz. */
export function Conheca() {
  const navigate = useNavigate()
  const { data, update } = useOnboarding()
  const [aberta, setAberta] = useState<number | null>(0)
  const valor = data.valorGarantia

  return (
    <PageTransition>
      {/* Hero */}
      <header className="bg-brand text-ink rounded-b-[32px] px-5 pt-[calc(env(safe-area-inset-top)+18px)] pb-8">
        <Logo height={40} />
        <h1 className="mt-6 text-[30px] leading-[1.1] font-extrabold text-balance">Cartão de crédito com limite garantido pelo seu dinheiro</h1>
        <p className="mt-3 text-[15px] font-semibold text-ink/80">Você guarda, o valor vira seu limite em 7 dias, rende enquanto isso e continua seu. Sem consulta ao nome.</p>
        <div className="mt-6 flex items-center gap-4">
          <CardVirtual size="sm" />
          <ul className="text-[13px] font-bold space-y-1.5">
            <li className="flex items-center gap-1.5"><CheckIcon size={14} strokeWidth={3} /> Sem anuidade</li>
            <li className="flex items-center gap-1.5"><CheckIcon size={14} strokeWidth={3} /> Resgate quando quiser</li>
            <li className="flex items-center gap-1.5"><CheckIcon size={14} strokeWidth={3} /> Limite de {formatBRL(garantia.minimo)} a {formatBRL(garantia.maximo)}</li>
          </ul>
        </div>
        <button type="button" onClick={() => navigate('/quiz')} className="btn-pill w-full mt-6 gap-2">Começar pelo quiz <ArrowRightIcon size={18} /></button>
      </header>

      <div className="px-4 pt-5 pb-8 space-y-5">
        {/* Simulador */}
        <section className="card p-5 fade-up">
          <h2 className="text-[18px] font-extrabold">Simule o seu limite</h2>
          <p className="text-[13px] text-subtle mt-1">Arraste para escolher quanto guardar, até {formatBRL(garantia.maximo)}.</p>
          <input
            id="simulador"
            type="range"
            min={garantia.minimo}
            max={garantia.maximo}
            step={25}
            value={Math.min(garantia.maximo, valor)}
            onChange={(e) => update({ valorGarantia: Number(e.target.value) })}
            className="w-full mt-4 accent-[#F5C21B]"
            aria-label="Valor a guardar"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted dark:bg-white/5 p-3">
              <p className="text-[12px] text-subtle">Você guarda</p>
              <p className="text-[22px] font-extrabold">{formatBRL(valor)}</p>
            </div>
            <div className="rounded-2xl bg-cream dark:bg-dark-cream p-3">
              <p className="text-[12px] text-subtle">Seu limite após 7 dias</p>
              <p className="text-[22px] font-extrabold">{formatBRL(valor)}</p>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] text-subtle">O valor guardado rende {garantia.rendimento} desde o primeiro dia e pode ser resgatado a qualquer momento.</p>
        </section>

        {/* Como funciona */}
        <section className="fade-up delay-1">
          <h2 className="text-[18px] font-extrabold px-1 mb-3">Como funciona</h2>
          <ol className="space-y-3">
            {landing.passos.map((p, i) => (
              <li key={p.titulo} className="card p-4 flex gap-4">
                <span className="w-9 h-9 rounded-full bg-brand text-ink grid place-items-center font-extrabold shrink-0">{i + 1}</span>
                <div>
                  <p className="font-extrabold text-[15px]">{p.titulo}</p>
                  <p className="text-[13px] text-subtle mt-0.5">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Vídeo explicativo (slot) */}
        <section className="card overflow-hidden fade-up delay-2">
          <div className="aspect-video bg-ink grid place-items-center relative">
            <span className="w-16 h-16 rounded-full bg-brand text-ink grid place-items-center"><ArrowRightIcon size={28} /></span>
            <span className="absolute bottom-3 left-4 text-white/80 text-[12px] font-bold">Vídeo explicativo · em breve</span>
          </div>
          <p className="p-4 text-[13px] text-subtle">Um minuto para entender a Caixinha Garantia, o limite e o resgate.</p>
        </section>

        {/* Regras */}
        <section className="card-cream p-5 fade-up delay-2">
          <h2 className="text-[18px] font-extrabold mb-3">Regras, sem letra miúda</h2>
          <ul className="space-y-2.5">
            {garantia.regras.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-[13.5px]"><span className="mt-0.5 w-5 h-5 rounded-full bg-brand text-ink grid place-items-center shrink-0"><CheckIcon size={12} strokeWidth={3} /></span>{r}</li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="fade-up delay-3">
          <h2 className="text-[18px] font-extrabold px-1 mb-3">Perguntas frequentes</h2>
          <div className="card divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
            {landing.faq.map((f, i) => {
              const open = aberta === i
              return (
                <div key={f.p}>
                  <button type="button" aria-expanded={open} onClick={() => setAberta(open ? null : i)} className="w-full flex items-center gap-3 p-4 text-left">
                    <span className="flex-1 font-bold text-[14.5px]">{f.p}</span>
                    <ChevronRightIcon size={20} className={`text-subtle transition-transform ${open ? 'rotate-90' : ''}`} />
                  </button>
                  {open && <p className="px-4 pb-4 -mt-1 text-[13.5px] text-subtle">{f.r}</p>}
                </div>
              )
            })}
          </div>
        </section>

        <button type="button" onClick={() => navigate('/quiz')} className="btn-pill w-full gap-2 fade-up delay-4">Começar pelo quiz <ArrowRightIcon size={18} /></button>

        <footer className="text-[11.5px] text-subtle leading-relaxed px-1 space-y-2 fade-up delay-4">
          <p className="flex items-start gap-2"><ShieldIcon size={16} className="shrink-0" /> O MAIS Card é emitido por {landing.parceiro}. O valor da Caixinha Garantia fica aplicado em nome do cliente e pode ser resgatado a qualquer momento.</p>
          <p>Juros e encargos só incidem sobre fatura não paga integralmente, conforme taxas informadas no contrato. Consulte o Custo Efetivo Total antes de contratar. [Razão social, CNPJ e canais de atendimento entram aqui.]</p>
        </footer>
      </div>
    </PageTransition>
  )
}
