import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { CardVirtual } from '../components/CardVirtual'
import { CheckIcon } from '../components/Icons'
import { formatBRL } from '../data/mock'
import { useOnboarding } from '../hooks/useOnboarding'

export function ContaCriada() {
  const navigate = useNavigate()
  const { data, reset } = useOnboarding()
  const primeiroNome = data.nome.trim().split(' ')[0] || 'você'

  return (
    <PageTransition>
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+36px)] pb-6 flex flex-col items-center text-center">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="w-20 h-20 rounded-full bg-brand text-ink grid place-items-center">
          <CheckIcon size={40} strokeWidth={3} />
        </motion.span>
        <h1 className="mt-5 text-[26px] leading-tight font-extrabold text-balance">Conta criada, {primeiroNome}!</h1>
        <p className="mt-2 text-[14.5px] text-subtle">Seu MAIS Card Garantido já está sendo produzido.</p>
        <div className="my-7"><CardVirtual size="lg" /></div>
        <div className="card w-full p-5 text-left space-y-3 text-[15px]">
          <div className="flex justify-between"><span className="text-subtle">Guardado na Caixinha</span><span className="font-extrabold">{formatBRL(data.valorGarantia)}</span></div>
          <div className="flex justify-between"><span className="text-subtle">Limite liberado</span><span className="font-extrabold">{formatBRL(data.valorGarantia)}</span></div>
          <div className="flex justify-between"><span className="text-subtle">Rendimento</span><span className="font-extrabold">100% do CDI</span></div>
          <div className="flex justify-between"><span className="text-subtle">Cartão físico</span><span className="font-extrabold">5 a 10 dias úteis</span></div>
        </div>
        <button type="button" onClick={() => { reset(); navigate('/') }} className="btn-pill w-full mt-6">Ir para o início</button>
        <button type="button" onClick={() => navigate('/entrega')} className="mt-3 text-[13.5px] font-bold text-subtle">Acompanhar entrega</button>
      </div>
    </PageTransition>
  )
}
