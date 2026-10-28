import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { StepHeader } from '../components/StepHeader'
import { CameraIcon, CheckIcon, IdIcon, ShieldIcon } from '../components/Icons'
import { documentosAceitos } from '../data/mock'
import { useOnboarding } from '../hooks/useOnboarding'
import { identity } from '../services/identity'

function Captura({ label, done, busy, onCapture }: { label: string; done: boolean; busy: boolean; onCapture: () => void }) {
  return (
    <button
      type="button"
      onClick={onCapture}
      disabled={done || busy}
      className={`relative w-full aspect-[1.58] rounded-[20px] border-2 border-dashed grid place-items-center transition active:scale-[0.98] ${done ? 'border-brand bg-brand/10' : 'border-neutral-300 dark:border-neutral-600 bg-surface dark:bg-dark-card'}`}
    >
      {done ? (
        <span className="flex flex-col items-center gap-2 text-[13.5px] font-bold"><span className="w-12 h-12 rounded-full bg-brand text-ink grid place-items-center"><CheckIcon size={22} strokeWidth={3} /></span>{label} aceita</span>
      ) : (
        <span className="flex flex-col items-center gap-2 text-[13.5px] font-bold text-subtle"><span className={`w-12 h-12 rounded-full bg-muted dark:bg-white/10 grid place-items-center ${busy ? 'animate-pulse' : ''}`}><CameraIcon size={22} /></span>{busy ? 'Analisando…' : `Fotografar ${label.toLowerCase()}`}</span>
      )}
    </button>
  )
}

export function Documento() {
  const navigate = useNavigate()
  const { data, update } = useOnboarding()
  const [busy, setBusy] = useState<'frente' | 'verso' | null>(null)
  const pronto = data.documento && data.docFrente && data.docVerso

  const capturar = async (lado: 'frente' | 'verso') => {
    setBusy(lado)
    const ok = await identity.capturarDocumento(data.documento, lado)
    setBusy(null)
    if (ok) update(lado === 'frente' ? { docFrente: true } : { docVerso: true })
  }

  return (
    <PageTransition>
      <StepHeader step={3} total={5} title="Envie seu documento" subtitle="Escolha o documento e fotografe em um lugar bem iluminado, sem reflexos." backTo="/endereco" />
      <div className="px-5 pt-6 pb-6 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {documentosAceitos.map((d) => {
            const sel = data.documento === d.id
            return (
              <button key={d.id} type="button" onClick={() => update({ documento: d.id, docFrente: false, docVerso: false })} className={`card p-3 flex flex-col items-center gap-1.5 border-2 transition ${sel ? 'border-brand' : 'border-transparent'}`}>
                <IdIcon size={22} className={sel ? 'text-brand-dark dark:text-brand' : 'text-subtle'} />
                <span className="text-[14px] font-extrabold">{d.label}</span>
                <span className="text-[11px] text-subtle text-center leading-tight">{d.descricao}</span>
              </button>
            )
          })}
        </div>

        {data.documento && (
          <div className="space-y-3 fade-up">
            <Captura label="Frente" done={data.docFrente} busy={busy === 'frente'} onCapture={() => capturar('frente')} />
            <Captura label="Verso" done={data.docVerso} busy={busy === 'verso'} onCapture={() => capturar('verso')} />
          </div>
        )}

        <p className="flex items-start gap-2 text-[12.5px] text-subtle"><ShieldIcon size={18} className="shrink-0 text-brand-dark dark:text-brand" /> A captura e a validação são feitas pelo nosso parceiro de verificação de identidade. Nesta demonstração ela é simulada.</p>
        <button type="button" disabled={!pronto} onClick={() => navigate('/selfie')} className="btn-pill w-full disabled:opacity-40">Continuar</button>
      </div>
    </PageTransition>
  )
}
