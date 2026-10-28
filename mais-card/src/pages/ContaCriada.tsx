import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { CheckIcon, ShieldIcon } from '../components/Icons'
import { ANALISE_MINUTOS, api } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useOnboarding } from '../hooks/useOnboarding'

/** Fim do cadastro: a conta entra em análise. Nenhum depósito acontece aqui. */
export function ContaCriada() {
  const navigate = useNavigate()
  const { data, reset } = useOnboarding()
  const primeiroNome = data.nome.trim().split(' ')[0] || 'você'
  // Envia o cadastro uma única vez ao abrir a tela. Com backend, é aqui que a conta é criada.
  const abertura = useAsync(() =>
    api.abrirConta({
      respostasQuiz: data.respostas,
      nome: data.nome,
      cpf: data.cpf,
      email: data.email,
      celular: data.celular,
      senha: data.senha,
      endereco: data.endereco,
      identidade: data.identidade,
    }),
  )

  const etapas = [
    { t: 'Cadastro enviado', ok: true },
    { t: 'Análise do documento e da selfie', ok: false, atual: true },
    { t: 'Aviso de aprovação no app', ok: false },
    { t: 'Caixinha Garantia e limite', ok: false },
  ]

  return (
    <PageTransition>
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+36px)] pb-6 flex flex-col items-center text-center">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="w-20 h-20 rounded-full bg-brand text-ink grid place-items-center">
          {abertura.loading ? <ShieldIcon size={36} /> : <CheckIcon size={40} strokeWidth={3} />}
        </motion.span>
        <h1 className="mt-5 text-[26px] leading-tight font-extrabold text-balance">{abertura.loading ? 'Enviando seu cadastro…' : `Cadastro enviado, ${primeiroNome}!`}</h1>
        <p className="mt-2 text-[14.5px] text-subtle">
          {abertura.error ? abertura.error : `Estamos conferindo seu documento e sua selfie. Leva cerca de ${ANALISE_MINUTOS} minutos. Você já pode entrar no app e recebe o aviso aqui quando a conta for aprovada.`}
        </p>

        <ol className="card w-full mt-7 p-5 text-left space-y-4">
          {etapas.map((e, i) => (
            <li key={e.t} className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full grid place-items-center text-[12px] font-extrabold shrink-0 ${e.ok ? 'bg-brand text-ink' : e.atual ? 'bg-brand text-ink ring-4 ring-brand/30' : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'}`}>
                {e.ok ? <CheckIcon size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-[14.5px] font-bold ${!e.ok && !e.atual ? 'text-subtle' : ''}`}>{e.t}</span>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-[12.5px] text-subtle">Nada é cobrado nem depositado nesta etapa. A Caixinha Garantia só aparece depois da aprovação.</p>
        <button type="button" disabled={abertura.loading} onClick={() => { reset(); navigate('/') }} className="btn-pill w-full mt-5 disabled:opacity-60">Entrar no app</button>
      </div>
    </PageTransition>
  )
}
