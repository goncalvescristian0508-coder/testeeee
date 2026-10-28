import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { StepHeader } from '../components/StepHeader'
import { CameraIcon, CheckIcon, ShieldIcon, UserIcon } from '../components/Icons'
import { useOnboarding } from '../hooks/useOnboarding'
import { identity } from '../services/identity'

const dicas = ['Tire óculos, boné e máscara', 'Fique em um lugar com boa luz', 'Centralize o rosto na moldura', 'Siga as instruções na tela']

export function Selfie() {
  const navigate = useNavigate()
  const { data, update } = useOnboarding()
  const [capturando, setCapturando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const capturar = async () => {
    setCapturando(true)
    setErro(null)
    const ok = await identity.provaDeVida()
    if (ok) {
      const resultado = await identity.concluir(data.documento)
      update({ selfie: true, identidade: resultado })
    } else {
      setErro('Não conseguimos confirmar. Tente de novo com mais luz.')
    }
    setCapturando(false)
  }

  return (
    <PageTransition>
      <StepHeader step={4} total={5} title="Agora, a prova de vida" subtitle="Uma selfie guiada confirma que é você no documento. Leva menos de um minuto." backTo="/documento" />
      <div className="px-5 pt-6 pb-6 flex flex-col items-center">
        <div className="relative w-[230px] h-[300px] rounded-[115px/150px] bg-surface dark:bg-dark-card ring-1 ring-black/5 dark:ring-white/10 overflow-hidden grid place-items-center">
          <span className={`absolute inset-0 rounded-[115px/150px] border-[5px] transition-colors ${data.selfie ? 'border-brand' : capturando ? 'border-brand animate-pulse' : 'border-dashed border-neutral-300 dark:border-neutral-600'}`} />
          {data.selfie ? (
            <span className="w-20 h-20 rounded-full bg-brand text-ink grid place-items-center"><CheckIcon size={40} strokeWidth={3} /></span>
          ) : (
            <UserIcon size={120} className="text-neutral-300 dark:text-neutral-600" />
          )}
        </div>

        <p className="mt-4 text-[15px] font-extrabold">{data.selfie ? 'Identidade confirmada' : capturando ? 'Aguardando o verificador…' : 'Posicione o rosto na moldura'}</p>

        <ul className="card w-full mt-5 p-4 space-y-2.5">
          {dicas.map((d) => (
            <li key={d} className="flex items-center gap-2.5 text-[13.5px]"><span className="w-5 h-5 rounded-full bg-brand/25 text-ink dark:text-brand grid place-items-center shrink-0"><CheckIcon size={12} strokeWidth={3} /></span>{d}</li>
          ))}
        </ul>

        {erro && <p role="alert" className="mt-3 text-[13px] font-bold text-danger">{erro}</p>}
        {data.selfie ? (
          <button type="button" onClick={() => navigate('/garantia')} className="btn-pill w-full mt-5">Continuar</button>
        ) : (
          <button type="button" onClick={capturar} disabled={capturando} className="btn-pill w-full mt-5 gap-2 disabled:opacity-60"><CameraIcon size={18} /> Iniciar verificação</button>
        )}
        <p className="mt-3 flex items-start gap-2 text-[12px] text-subtle"><ShieldIcon size={16} className="shrink-0 text-brand-dark dark:text-brand" /> A prova de vida é feita pelo SDK do nosso parceiro de identidade. O app não guarda suas imagens. Nesta demonstração ela é simulada.</p>
      </div>
    </PageTransition>
  )
}
