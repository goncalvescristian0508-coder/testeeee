import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { StepHeader } from '../components/StepHeader'
import { TruckIcon } from '../components/Icons'
import { useOnboarding } from '../hooks/useOnboarding'
import { buscarCep } from '../services/cep'

const maskCep = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
const input = 'mt-1 w-full rounded-2xl bg-surface dark:bg-dark-card px-4 py-3.5 text-[15px] font-semibold outline-none ring-1 ring-black/5 dark:ring-white/10 focus:ring-2 focus:ring-brand disabled:opacity-60'

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[12.5px] font-bold text-subtle">{label}</span>
      {children}
    </label>
  )
}

export function Endereco() {
  const navigate = useNavigate()
  const { data, update } = useOnboarding()
  const e = data.endereco
  const set = (patch: Partial<typeof e>) => update({ endereco: { ...e, ...patch } })
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const onCep = async (v: string) => {
    const cep = maskCep(v)
    set({ cep })
    if (cep.length === 9) {
      setBuscando(true)
      const r = await buscarCep(cep)
      setBuscando(false)
      if (r) set({ cep, ...r })
    }
  }

  const continuar = () => {
    if (e.cep.length !== 9) return setErro('Informe o CEP completo.')
    if (!e.logradouro.trim() || !e.numero.trim() || !e.bairro.trim() || !e.cidade.trim() || e.uf.length !== 2) return setErro('Preencha o endereço completo para a entrega.')
    setErro(null)
    navigate('/documento')
  }

  return (
    <PageTransition>
      <StepHeader step={2} total={4} title="Onde entregar o cartão?" subtitle="O cartão físico vai para este endereço em 5 a 10 dias úteis após a ativação." backTo="/cadastro" />
      <div className="px-5 pt-6 pb-6 space-y-4">
        <Field label="CEP">
          <div className="relative">
            <input id="cep" className={input} inputMode="numeric" value={e.cep} onChange={(ev) => onCep(ev.target.value)} placeholder="00000-000" />
            {buscando && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold text-subtle">buscando…</span>}
          </div>
        </Field>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="Rua / Avenida"><input id="logradouro" className={input} value={e.logradouro} onChange={(ev) => set({ logradouro: ev.target.value })} autoComplete="address-line1" /></Field>
          <Field label="Número"><input id="numero" className={input} inputMode="numeric" value={e.numero} onChange={(ev) => set({ numero: ev.target.value })} /></Field>
        </div>
        <Field label="Complemento (opcional)"><input id="complemento" className={input} value={e.complemento} onChange={(ev) => set({ complemento: ev.target.value })} placeholder="Apto, bloco, casa" /></Field>
        <Field label="Bairro"><input id="bairro" className={input} value={e.bairro} onChange={(ev) => set({ bairro: ev.target.value })} /></Field>
        <div className="grid grid-cols-[1fr_80px] gap-3">
          <Field label="Cidade"><input id="cidade" className={input} value={e.cidade} onChange={(ev) => set({ cidade: ev.target.value })} /></Field>
          <Field label="UF"><input id="uf" className={`${input} uppercase`} maxLength={2} value={e.uf} onChange={(ev) => set({ uf: ev.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} /></Field>
        </div>

        <p className="flex items-start gap-2 text-[12.5px] text-subtle"><TruckIcon size={18} className="shrink-0 text-brand-dark dark:text-brand" /> Entrega grátis em todo o Brasil. Você acompanha cada etapa pelo app.</p>
        {erro && <p role="alert" className="text-[13px] font-bold text-danger">{erro}</p>}
        <button type="button" onClick={continuar} className="btn-pill w-full">Continuar</button>
      </div>
    </PageTransition>
  )
}
