import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CameraIcon, CheckIcon, RefreshIcon } from './Icons'

type Props = {
  /** documento = câmera traseira, moldura retangular; selfie = frontal, moldura oval */
  modo: 'documento' | 'selfie'
  titulo: string
  instrucao: string
  onCapture: (imagem: Blob) => void
  onClose: () => void
}

/**
 * Captura de foto pela câmera do aparelho (getUserMedia). Se a câmera não
 * estiver disponível (permissão negada, desktop sem câmera, demo hospedada),
 * cai para um input de arquivo, que no celular abre a câmera nativa.
 */
export function CameraCapture({ modo, titulo, instrucao, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null)
  const [semCamera, setSemCamera] = useState(false)
  const [pronta, setPronta] = useState(false)

  useEffect(() => {
    let cancelado = false
    const abrir = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setSemCamera(true)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: modo === 'selfie' ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelado) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setPronta(true)
        }
      } catch {
        setSemCamera(true)
      }
    }
    abrir()
    return () => {
      cancelado = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [modo])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  const fotografar = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')!
    if (modo === 'selfie') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, 0, 0)
    canvas.toBlob((blob) => blob && setPreview({ url: URL.createObjectURL(blob), blob }), 'image/jpeg', 0.92)
  }

  const arquivoEscolhido = (f: File | undefined) => {
    if (!f) return
    setPreview({ url: URL.createObjectURL(f), blob: f })
  }

  const confirmar = () => {
    if (!preview) return
    streamRef.current?.getTracks().forEach((t) => t.stop())
    onCapture(preview.blob)
  }

  const moldura = modo === 'selfie' ? 'w-[64%] aspect-[3/4] rounded-[50%]' : 'w-[88%] aspect-[1.58] rounded-2xl'

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <button type="button" onClick={onClose} className="text-[14px] font-bold text-white/80">Cancelar</button>
        <p className="font-extrabold">{titulo}</p>
        <span className="w-16" />
      </div>

      <div className="relative flex-1 overflow-hidden grid place-items-center bg-neutral-900">
        {preview ? (
          <img src={preview.url} alt="Pré-visualização da captura" className="max-h-full max-w-full object-contain" />
        ) : semCamera ? (
          <div className="px-8 text-center">
            <CameraIcon size={48} className="mx-auto text-white/60" />
            <p className="mt-3 font-bold">Câmera indisponível aqui</p>
            <p className="mt-1 text-[13px] text-white/70">Use o botão abaixo para tirar a foto com a câmera do aparelho ou escolher uma imagem.</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${modo === 'selfie' ? '-scale-x-100' : ''}`} />
            <div className={`absolute ${moldura} border-[3px] border-brand/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none`} />
            {!pronta && <p className="absolute text-[13px] text-white/80">Abrindo a câmera…</p>}
          </>
        )}
      </div>

      <div className="px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)] bg-black">
        <p className="text-center text-[13.5px] text-white/80 mb-4">{preview ? 'A foto está nítida e sem reflexos?' : instrucao}</p>
        {preview ? (
          <div className="flex gap-3">
            <button type="button" onClick={() => setPreview(null)} className="flex-1 rounded-full border-2 border-white/70 py-3 font-bold flex items-center justify-center gap-2"><RefreshIcon size={18} /> Refazer</button>
            <button type="button" onClick={confirmar} className="flex-1 rounded-full bg-brand text-ink py-3 font-extrabold flex items-center justify-center gap-2"><CheckIcon size={18} strokeWidth={3} /> Usar foto</button>
          </div>
        ) : semCamera ? (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture={modo === 'selfie' ? 'user' : 'environment'} className="hidden" onChange={(e) => arquivoEscolhido(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-full bg-brand text-ink py-3 font-extrabold flex items-center justify-center gap-2"><CameraIcon size={18} /> Tirar foto</button>
          </>
        ) : (
          <button type="button" onClick={fotografar} disabled={!pronta} aria-label="Fotografar" className="mx-auto block w-[72px] h-[72px] rounded-full bg-white border-[6px] border-white/40 disabled:opacity-40 active:scale-95 transition" />
        )}
      </div>
    </div>,
    document.body,
  )
}
