import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { StepHeader } from '../components/StepHeader'
import { CameraCapture } from '../components/CameraCapture'
import { CameraIcon, CheckIcon, ShieldIcon, UserIcon } from '../components/Icons'
import { useOnboarding } from '../hooks/useOnboarding'
import { identity } from '../services/identity'

const dicas = ['Tire óculos, boné e máscara', 'Fique em um lugar com boa luz', 'Centralize o rosto na moldura', 'Olhe direto para a câmera']

export function Selfie() {
  const navigate = useNavigate()
  const { data, update } = useOnboarding()
  const [camera, setCamera] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const enviar = async (imagem: Blob) => {
    setCamera(false)
    setEnviando(true)
    setErro(null)
    try {
      const sessaoId = data.identidadeSessao ?? (await identity.iniciarSessao(data.cpf))
      const r = await identity.enviarSelfie(sessaoId, imagem)
      if (!r.ok) return setErro(r.motivo ?? 'Não conseguimos confirmar. Tente de novo com mais luz.')
      const resultado = await identity.concluir(sessaoId, data.documento)
      update({ identidadeSessao: sessaoId, selfie: true, identidade: resultado })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar. Verifique sua conexão.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <PageTransition>
      <StepHeader step={4} total={4} title="Agora, uma selfie" subtitle="Comparamos a selfie com a foto do documento para confirmar que é você." backTo="/documento" />
      <div className="px-5 pt-6 pb-6 flex flex-col items-center">
        <div className="relative w-[230px] h-[300px] rounded-[115px/150px] bg-surface dark:bg-dark-card ring-1 ring-black/5 dark:ring-white/10 overflow-hidden grid place-items-center">
          <span className={`absolute inset-0 rounded-[115px/150px] border-[5px] transition-colors ${data.selfie ? 'border-brand' : enviando ? 'border-brand animate-pulse' : 'border-dashed border-neutral-300 dark:border-neutral-600'}`} />
          {data.selfie ? (
            <span className="w-20 h-20 rounded-full bg-brand text-ink grid place-items-center"><CheckIcon size={40} strokeWidth={3} /></span>
          ) : (
            <UserIcon size={120} className="text-neutral-300 dark:text-neutral-600" />
          )}
        </div>

        <p className="mt-4 text-[15px] font-extrabold">{data.selfie ? 'Identidade confirmada' : enviando ? 'Enviando e analisando…' : 'Vamos tirar a sua selfie'}</p>

        <ul className="card w-full mt-5 p-4 space-y-2.5">
          {dicas.map((d) => (
            <li key={d} className="flex items-center gap-2.5 text-[13.5px]"><span className="w-5 h-5 rounded-full bg-brand/25 text-ink dark:text-brand grid place-items-center shrink-0"><CheckIcon size={12} strokeWidth={3} /></span>{d}</li>
          ))}
        </ul>

        {erro && <p role="alert" className="mt-3 text-[13px] font-bold text-danger">{erro}</p>}
        {data.selfie ? (
          <>
            <button type="button" onClick={() => navigate('/conta-criada')} className="btn-pill w-full mt-5">Continuar</button>
            <button type="button" onClick={() => setCamera(true)} className="mt-3 text-[13.5px] font-bold text-subtle">Refazer selfie</button>
          </>
        ) : (
          <button type="button" onClick={() => setCamera(true)} disabled={enviando} className="btn-pill w-full mt-5 gap-2 disabled:opacity-60"><CameraIcon size={18} /> Tirar selfie</button>
        )}
        <p className="mt-3 flex items-start gap-2 text-[12px] text-subtle"><ShieldIcon size={16} className="shrink-0 text-brand-dark dark:text-brand" /> A selfie é enviada com segurança para a verificação e não fica salva no aparelho.{identity.nome === 'simulado' && ' Nesta demonstração a verificação é simulada.'}</p>
      </div>

      {camera && (
        <CameraCapture
          modo="selfie"
          titulo="Sua selfie"
          instrucao="Encaixe o rosto na moldura e olhe para a câmera."
          onCapture={enviar}
          onClose={() => setCamera(false)}
        />
      )}
    </PageTransition>
  )
}
