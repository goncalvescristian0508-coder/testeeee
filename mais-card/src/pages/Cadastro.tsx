import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { StepHeader } from '../components/StepHeader'
import { useOnboarding } from '../hooks/useOnboarding'

const maskCpf = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
const maskCel = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-bold text-subtle">{label}</span>
      {children}
    </label>
  )
}

const input = 'mt-1 w-full rounded-2xl bg-surface dark:bg-dark-card px-4 py-3.5 text-[15px] font-semibold outline-none ring-1 ring-black/5 dark:ring-white/10 focus:ring-2 focus:ring-brand'

export function Cadastro() {
  const navigate = useNavigate()
  const { data, update } = useOnboarding()
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const continuar = () => {
    if (data.nome.trim().split(' ').length < 2) return setErro('Digite seu nome completo.')
    if (data.cpf.replace(/\D/g, '').length !== 11) return setErro('CPF incompleto.')
    if (!/^\S+@\S+\.\S+$/.test(data.email)) return setErro('E-mail inválido.')
    if (data.celular.replace(/\D/g, '').length !== 11) return setErro('Celular incompleto.')
    if (data.senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    if (!aceite) return setErro('Você precisa aceitar os termos para continuar.')
    setErro(null)
    navigate('/endereco')
  }

  return (
    <PageTransition>
      <StepHeader step={1} total={5} title="Vamos criar sua conta" subtitle="Preencha seus dados como estão no documento." backTo="/quiz" />
      <div className="px-5 pt-6 pb-6 space-y-4">
        <Field label="Nome completo"><input id="nome" className={input} value={data.nome} onChange={(e) => update({ nome: e.target.value })} autoComplete="name" placeholder="Como está no documento" /></Field>
        <Field label="CPF"><input id="cpf" className={input} inputMode="numeric" value={data.cpf} onChange={(e) => update({ cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" /></Field>
        <Field label="E-mail"><input id="email" className={input} type="email" value={data.email} onChange={(e) => update({ email: e.target.value })} autoComplete="email" placeholder="voce@email.com" /></Field>
        <Field label="Celular"><input id="celular" className={input} inputMode="tel" value={data.celular} onChange={(e) => update({ celular: maskCel(e.target.value) })} placeholder="(11) 90000-0000" /></Field>
        <Field label="Crie uma senha"><input id="senha" className={input} type="password" value={data.senha} onChange={(e) => update({ senha: e.target.value })} autoComplete="new-password" placeholder="Mínimo de 6 caracteres" /></Field>

        <label className="flex items-start gap-3 text-[13px] text-subtle pt-1">
          <input id="aceite" type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[#F5C21B]" />
          <span>Li e aceito os <span className="font-bold text-ink dark:text-white underline">Termos de uso</span> e a <span className="font-bold text-ink dark:text-white underline">Política de privacidade</span>. Meus documentos e minha selfie serão usados apenas para confirmar minha identidade.</span>
        </label>

        {erro && <p role="alert" className="text-[13px] font-bold text-danger">{erro}</p>}
        <button type="button" onClick={continuar} className="btn-pill w-full">Continuar</button>
      </div>
    </PageTransition>
  )
}
