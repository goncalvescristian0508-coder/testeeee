import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { StepHeader } from '../components/StepHeader'
import { CardVirtual } from '../components/CardVirtual'
import { CheckIcon, ShieldIcon } from '../components/Icons'
import { formatBRL, quizPerguntas } from '../data/mock'
import { useOnboarding } from '../hooks/useOnboarding'

export function Quiz() {
  const navigate = useNavigate()
  const { data, update } = useOnboarding()
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(false)
  const pergunta = quizPerguntas[idx]
  const total = quizPerguntas.length

  const escolher = (opcaoId: string) => {
    const respostas = { ...data.respostas, [pergunta.id]: opcaoId }
    update({ respostas, ...(pergunta.id === 'garantia' ? { valorGarantia: Number(opcaoId) } : {}) })
    if (idx < total - 1) setTimeout(() => setIdx(idx + 1), 180)
    else setTimeout(() => setDone(true), 180)
  }

  if (done) {
    const valor = data.valorGarantia
    return (
      <PageTransition>
        <div className="px-5 pt-[calc(env(safe-area-inset-top)+24px)] pb-6 flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold bg-brand text-ink rounded-full px-3 py-1"><CheckIcon size={14} strokeWidth={3} /> Perfil pronto</span>
          <h1 className="mt-4 text-[26px] leading-tight font-extrabold text-balance">O MAIS Card Garantido é para você</h1>
          <p className="mt-2 text-[14.5px] text-subtle">Abra sua conta sem depositar nada. Depois da aprovação, você escolhe quanto guardar na Caixinha Garantia e esse valor vira seu limite em 7 dias.</p>
          <div className="my-7"><CardVirtual size="md" variant="amarelo" /></div>
          <div className="card w-full p-5 text-left">
            <div className="flex justify-between text-[15px]"><span className="text-subtle">Sugestão para guardar</span><span className="font-extrabold">{formatBRL(valor)}</span></div>
            <div className="flex justify-between text-[15px] mt-3"><span className="text-subtle">Seu limite seria</span><span className="font-extrabold">{formatBRL(valor)}</span></div>
            <div className="flex justify-between text-[15px] mt-3"><span className="text-subtle">Rendimento</span><span className="font-extrabold">100% do CDI</span></div>
            <div className="flex justify-between text-[15px] mt-3"><span className="text-subtle">Limite ativo em</span><span className="font-extrabold">7 dias</span></div>
            <div className="flex justify-between text-[15px] mt-3"><span className="text-subtle">Resgate</span><span className="font-extrabold">Quando quiser</span></div>
          </div>
          <p className="mt-4 flex items-start gap-2 text-[12.5px] text-subtle text-left"><ShieldIcon size={18} className="shrink-0 text-brand-dark dark:text-brand" /> Sem consulta a restrições e sem taxa de adesão. O dinheiro continua seu e pode ser resgatado antes dos 7 dias, mas aí o limite não é ativado.</p>
          <button type="button" onClick={() => navigate('/cadastro')} className="btn-pill w-full mt-6">Abrir minha conta</button>
          <button type="button" onClick={() => navigate('/')} className="mt-3 text-[13.5px] font-bold text-subtle">Agora não</button>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <StepHeader step={idx + 1} total={total} title={pergunta.titulo} subtitle={pergunta.subtitulo} backTo={idx === 0 ? '/conheca' : undefined} />
      <div className="px-5 pt-6 pb-6">
        <AnimatePresence mode="wait">
          <motion.ul key={pergunta.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }} className="space-y-3">
            {pergunta.opcoes.map((o) => {
              const sel = data.respostas[pergunta.id] === o.id
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => escolher(o.id)}
                    className={`card w-full p-4 flex items-center gap-3 text-left border-2 transition active:scale-[0.98] ${sel ? 'border-brand' : 'border-transparent'}`}
                  >
                    <span className={`w-6 h-6 rounded-full border-2 grid place-items-center shrink-0 ${sel ? 'bg-brand border-brand text-ink' : 'border-neutral-300 dark:border-neutral-600'}`}>
                      {sel && <CheckIcon size={14} strokeWidth={3} />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-bold">{o.label}</span>
                      {o.hint && <span className="block text-[12.5px] text-subtle">{o.hint}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </motion.ul>
        </AnimatePresence>
      </div>
    </PageTransition>
  )
}
