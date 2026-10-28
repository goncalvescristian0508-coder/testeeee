import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckIcon } from './Icons'

type Props = { nome?: string; onFechar: () => void }

/** Mensagem exibida uma vez quando a análise termina com aprovação. */
export function AprovacaoModal({ nome, onFechar }: Props) {
  const navigate = useNavigate()
  return (
    <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="aprov-titulo">
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="card w-full p-6 text-center">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 16 }} className="mx-auto w-20 h-20 rounded-full bg-brand text-ink grid place-items-center">
          <CheckIcon size={40} strokeWidth={3} />
        </motion.span>
        <h2 id="aprov-titulo" className="mt-4 text-[24px] font-extrabold leading-tight text-balance">Sua conta foi aprovada{nome ? `, ${nome}` : ''}!</h2>
        <p className="mt-2 text-[14px] text-subtle">Documento e selfie conferidos. Agora você pode guardar na Caixinha Garantia: o valor vira seu limite após 7 dias e continua seu.</p>
        <button type="button" onClick={() => { onFechar(); navigate('/garantia') }} className="btn-pill w-full mt-5">Ativar meu limite</button>
        <button type="button" onClick={onFechar} className="mt-3 text-[13.5px] font-bold text-subtle">Depois</button>
      </motion.div>
    </div>
  )
}
