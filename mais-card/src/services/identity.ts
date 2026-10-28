/**
 * Ponto de integração com o provedor de verificação de identidade.
 *
 * Em produção, cada método abre o SDK do provedor (Unico, idwall, Caf, Serpro...),
 * que faz a captura do documento e a prova de vida e devolve o resultado.
 * O app nunca processa as imagens: só recebe o id da sessão e o status.
 */
import type { VerificacaoIdentidade } from './types'

export interface IdentityProvider {
  nome: string
  /** Abre a captura do documento (frente e verso) e devolve se foi aceito. */
  capturarDocumento(tipo: string, lado: 'frente' | 'verso'): Promise<boolean>
  /** Abre a prova de vida (selfie com movimentos guiados pelo SDK). */
  provaDeVida(): Promise<boolean>
  /** Fecha a sessão e devolve o resumo para enviar ao backend. */
  concluir(tipo: string): Promise<VerificacaoIdentidade>
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Simulação para a demo: aprova tudo após um pequeno atraso. */
export const mockIdentityProvider: IdentityProvider = {
  nome: 'demo',
  async capturarDocumento() {
    await delay(600)
    return true
  },
  async provaDeVida() {
    await delay(1400)
    return true
  },
  async concluir(tipo) {
    await delay(200)
    return { provedor: 'demo', sessaoId: 'sess_' + Math.random().toString(36).slice(2, 10), documentoTipo: tipo, documentoOk: true, provaDeVidaOk: true }
  },
}

export const identity: IdentityProvider = mockIdentityProvider
