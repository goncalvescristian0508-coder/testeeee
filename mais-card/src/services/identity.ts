/**
 * Verificação de identidade.
 *
 * O app só CAPTURA as imagens (componente CameraCapture) e as envia para o
 * backend por esta interface. Quem verifica (OCR, comparação facial e prova
 * de vida) é o backend. O contrato dos endpoints está em docs/API-IDENTIDADE.md.
 *
 * VITE_IDENTITY_MODE=mock   -> simulação (padrão): aceita qualquer imagem após um atraso.
 * VITE_IDENTITY_MODE=http   -> envia para VITE_API_URL (createHttpIdentityProvider).
 */
import type { VerificacaoIdentidade } from './types'

export type LadoDocumento = 'frente' | 'verso'

export type ResultadoEnvio = {
  ok: boolean
  /** Mensagem para o usuário quando ok=false (ex.: "Foto tremida, tente de novo"). */
  motivo?: string
}

export interface IdentityProvider {
  nome: string
  /** Abre uma sessão de verificação para o CPF informado e devolve o id. */
  iniciarSessao(cpf: string): Promise<string>
  /** Envia uma face do documento. O backend faz OCR e checa qualidade. */
  enviarDocumento(sessaoId: string, tipo: string, lado: LadoDocumento, imagem: Blob): Promise<ResultadoEnvio>
  /** Envia a selfie. O backend compara com o documento e faz a prova de vida. */
  enviarSelfie(sessaoId: string, imagem: Blob): Promise<ResultadoEnvio>
  /** Fecha a sessão e devolve o resumo que vai para o cadastro. */
  concluir(sessaoId: string, tipo: string): Promise<VerificacaoIdentidade>
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Simulação: nada é verificado. Usada enquanto o backend não existe. */
export const mockIdentityProvider: IdentityProvider = {
  nome: 'simulado',
  async iniciarSessao() {
    await delay(200)
    return 'sess_' + Math.random().toString(36).slice(2, 10)
  },
  async enviarDocumento(_s, _t, _l, imagem) {
    await delay(900)
    if (imagem.size < 1024) return { ok: false, motivo: 'Imagem muito pequena. Tente de novo.' }
    return { ok: true }
  },
  async enviarSelfie(_s, imagem) {
    await delay(1400)
    if (imagem.size < 1024) return { ok: false, motivo: 'Imagem muito pequena. Tente de novo.' }
    return { ok: true }
  },
  async concluir(sessaoId, tipo) {
    await delay(200)
    return { provedor: 'simulado', sessaoId, documentoTipo: tipo, documentoOk: true, provaDeVidaOk: true }
  },
}

/** Implementação HTTP: multipart/form-data para o backend próprio. */
export function createHttpIdentityProvider(baseUrl: string): IdentityProvider {
  const url = (p: string) => `${baseUrl.replace(/\/$/, '')}/identity${p}`
  const json = async <T>(res: Response): Promise<T> => {
    if (!res.ok) throw new Error(`Verificação de identidade: HTTP ${res.status}`)
    return (await res.json()) as T
  }
  const enviar = async (path: string, campos: Record<string, string>, imagem: Blob): Promise<ResultadoEnvio> => {
    const fd = new FormData()
    Object.entries(campos).forEach(([k, v]) => fd.append(k, v))
    fd.append('imagem', imagem, 'captura.jpg')
    return json<ResultadoEnvio>(await fetch(url(path), { method: 'POST', body: fd, credentials: 'include' }))
  }
  return {
    nome: 'proprio',
    async iniciarSessao(cpf) {
      const r = await json<{ sessaoId: string }>(
        await fetch(url('/sessions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ cpf }) }),
      )
      return r.sessaoId
    },
    enviarDocumento: (sessaoId, tipo, lado, imagem) => enviar(`/sessions/${sessaoId}/document`, { tipo, lado }, imagem),
    enviarSelfie: (sessaoId, imagem) => enviar(`/sessions/${sessaoId}/selfie`, {}, imagem),
    async concluir(sessaoId, tipo) {
      return json<VerificacaoIdentidade>(
        await fetch(url(`/sessions/${sessaoId}/finish`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ tipo }) }),
      )
    },
  }
}

const modo = import.meta.env.VITE_IDENTITY_MODE ?? 'mock'
export const identity: IdentityProvider = modo === 'http' ? createHttpIdentityProvider(import.meta.env.VITE_API_URL ?? '/api') : mockIdentityProvider
