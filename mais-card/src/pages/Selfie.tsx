import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { StepHeader } from '../components/StepHeader'
import { CameraIcon, CheckIcon, UserIcon } from '../components/Icons'
import { useOnboarding } from '../hooks/useOnboarding'

const dicas = ['Tire óculos, boné e máscara', 'Fique em um lugar com boa luz', 'Centralize o rosto na moldura', 'Olhe direto para a câmera']

export function Selfie() {
  const navigate = useNavigate()
  const { data, update } = useOnboarding()
  const [capturando, setCapturando] = useState(false)

  const capturar = () => {
    setCapturando(true)
    setTimeout(() => {
      setCapturando(false)
      update({ selfie: true })
    }, 1400)
  }

  return (
    <PageTransition>
      <StepHeader step={3} total={4} title="Agora, uma selfie" subtitle="Usamos a selfie só para confirmar que é você no documento." backTo="/documento" />
      <div className="px-5 pt-6 pb-6 flex flex-col items-center">
        <div className="relative w-[230px] h-[300px] rounded-[115px/150px] bg-surface dark:bg-dark-card ring-1 ring-black/5 dark:ring-white/10 overflow-hidden grid place-items-center">
          <span className={`absolute inset-0 rounded-[115px/150px] border-[5px] transition-colors ${data.selfie ? 'border-brand' : capturando ? 'border-brand animate-pulse' : 'border-dashed border-neutral-300 dark:border-neutral-600'}`} />
          {data.selfie ? (
            <span className="w-20 h-20 rounded-full bg-brand text-ink grid place-items-center"><CheckIcon size={40} strokeWidth={3} /></span>
          ) : (
            <UserIcon size={120} className="text-neutral-300 dark:text-neutral-600" />
          )}
          {capturando && <span className="absolute inset-x-0 h-1 bg-brand/70 animate-[scan_1.4s_ease-in-out]" style={{ top: 0 }} />}
        </div>
        <style>{`@keyframes scan{from{top:0}to{top:100%}}`}</style>

        <p className="mt-4 text-[15px] font-extrabold">{data.selfie ? 'Selfie confirmada' : capturando ? 'Analisando...' : 'Posicione o rosto na moldura'}</p>

        <ul className="card w-full mt-5 p-4 space-y-2.5">
          {dicas.map((d) => (
            <li key={d} className="flex items-center gap-2.5 text-[13.5px]"><span className="w-5 h-5 rounded-full bg-brand/25 text-ink dark:text-brand grid place-items-center shrink-0"><CheckIcon size={12} strokeWidth={3} /></span>{d}</li>
          ))}
        </ul>

        {data.selfie ? (
          <button type="button" onClick={() => navigate('/garantia')} className="btn-pill w-full mt-5">Continuar</button>
        ) : (
          <button type="button" onClick={capturar} disabled={capturando} className="btn-pill w-full mt-5 gap-2 disabled:opacity-60"><CameraIcon size={18} /> Tirar selfie</button>
        )}
        <p className="mt-3 text-[12px] text-subtle text-center">Demonstração: a câmera não é aberta. No app real a biometria é validada por um provedor de identidade.</p>
      </div>
    </PageTransition>
  )
}
