/**
 * Camada de acesso a dados.
 *
 * As telas só conhecem a interface `Api`. Hoje a implementação é `mockApi`
 * (dados de src/data/mock.ts com um pequeno atraso para simular rede).
 * Para ligar um backend, implemente `Api` em outro arquivo (ex.: httpApi.ts
 * com fetch, ou supabaseApi.ts) e troque a escolha no final deste arquivo
 * ou via VITE_API_MODE.
 */
import * as mock from '../data/mock'
import type {
  AberturaConta,
  Banner,
  Carteira,
  Cartao,
  Coins,
  EtapaEntrega,
  Fatura,
  Garantia,
  Indicacao,
  Indicado,
  ResultadoAbertura,
  StatusConta,
  Transacao,
  Usuario,
} from './types'

export interface Api {
  getUsuario(): Promise<Usuario>
  getCarteira(): Promise<Carteira>
  getCartao(): Promise<Cartao>
  setCartaoBloqueado(bloqueado: boolean): Promise<Cartao>
  getFatura(): Promise<Fatura>
  pagarFatura(): Promise<void>
  getTransacoes(): Promise<Transacao[]>
  getEtapasEntrega(): Promise<EtapaEntrega[]>
  getIndicacao(): Promise<Indicacao>
  getIndicados(): Promise<Indicado[]>
  getCoins(): Promise<Coins>
  trocarCoins(): Promise<Carteira>
  getBanners(): Promise<Banner[]>
  getGarantia(): Promise<Garantia | null>
  enviarPix(chave: string, valor: number): Promise<void>
  /** Cria a conta e inicia a análise. Não envolve depósito. */
  abrirConta(dados: AberturaConta): Promise<ResultadoAbertura>
  /** Situação atual da conta (o app consulta enquanto estiver em análise). */
  getStatusConta(): Promise<StatusConta>
  /** Depois da aprovação: guarda o valor na Caixinha e define o vencimento. */
  ativarGarantia(valor: number, diaVencimento: number): Promise<Garantia>
}

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

/** Tempo da análise simulada (VITE_ANALISE_MINUTOS, padrão 5). */
export const ANALISE_MINUTOS = Number(import.meta.env.VITE_ANALISE_MINUTOS ?? 5)

const CHAVE_CONTA = 'mais-card-conta'
type ContaLocal = { criadaEm: string; garantia: Garantia | null; diaVencimento?: number }

function lerConta(): ContaLocal | null {
  try {
    const raw = localStorage.getItem(CHAVE_CONTA)
    return raw ? (JSON.parse(raw) as ContaLocal) : null
  } catch {
    return null
  }
}
function salvarConta(c: ContaLocal | null) {
  try {
    if (c) localStorage.setItem(CHAVE_CONTA, JSON.stringify(c))
    else localStorage.removeItem(CHAVE_CONTA)
  } catch {
    /* ignore */
  }
}

/** Estado em memória da sessão mockada. A conta criada no onboarding fica no localStorage. */
const contaLocal = lerConta()
const estado = {
  cartaoBloqueado: false,
  carteira: { ...mock.carteira },
  coins: { ...mock.coins },
  // Sem conta criada no onboarding, o usuário demo já tem uma Caixinha em andamento.
  garantia: (contaLocal ? contaLocal.garantia : { ...mock.garantiaAtual }) as Garantia | null,
}

function statusDe(c: ContaLocal): StatusConta {
  const criada = new Date(c.criadaEm)
  const previsao = new Date(criada.getTime() + ANALISE_MINUTOS * 60_000)
  const aprovada = Date.now() >= previsao.getTime()
  return { status: aprovada ? 'aprovada' : 'em_analise', criadaEm: c.criadaEm, previsaoEm: previsao.toISOString(), aprovadaEm: aprovada ? previsao.toISOString() : undefined }
}

export const mockApi: Api = {
  async getUsuario() {
    await delay()
    return mock.user
  },
  async getCarteira() {
    await delay()
    return { ...estado.carteira }
  },
  async getCartao() {
    await delay()
    return { ...mock.cartao, bloqueado: estado.cartaoBloqueado }
  },
  async setCartaoBloqueado(bloqueado) {
    await delay(150)
    estado.cartaoBloqueado = bloqueado
    return { ...mock.cartao, bloqueado }
  },
  async getFatura() {
    await delay()
    return mock.fatura
  },
  async pagarFatura() {
    await delay(400)
  },
  async getTransacoes() {
    await delay()
    return mock.transacoes
  },
  async getEtapasEntrega() {
    await delay()
    return mock.etapasEntrega
  },
  async getIndicacao() {
    await delay()
    return mock.indicacao
  },
  async getIndicados() {
    await delay()
    return [...mock.indicados]
  },
  async getCoins() {
    await delay()
    return { ...estado.coins }
  },
  async trocarCoins() {
    await delay(400)
    const valor = estado.coins.saldo * estado.coins.valorConversao
    estado.coins = { ...estado.coins, saldo: 0 }
    estado.carteira = { ...estado.carteira, saldoDisponivel: estado.carteira.saldoDisponivel + valor }
    return { ...estado.carteira }
  },
  async getBanners() {
    await delay(100)
    return mock.banners
  },
  async getGarantia() {
    await delay()
    return estado.garantia ? { ...estado.garantia } : null
  },
  async enviarPix(_chave, valor) {
    await delay(500)
    estado.carteira = { ...estado.carteira, saldoDisponivel: Math.max(0, estado.carteira.saldoDisponivel - valor) }
  },
  async abrirConta() {
    await delay(800)
    const conta: ContaLocal = { criadaEm: new Date().toISOString(), garantia: null }
    salvarConta(conta)
    estado.garantia = null
    return { usuarioId: 'u_' + Math.random().toString(36).slice(2, 8), conta: statusDe(conta) }
  },
  async getStatusConta() {
    await delay(100)
    const c = lerConta()
    // Usuário demo sem onboarding: conta antiga, já aprovada.
    if (!c) return { status: 'aprovada', criadaEm: '2026-10-20T12:00:00.000Z', previsaoEm: '2026-10-20T12:05:00.000Z', aprovadaEm: '2026-10-20T12:05:00.000Z' }
    return statusDe(c)
  },
  async ativarGarantia(valor, diaVencimento) {
    await delay(700)
    const total = (estado.garantia?.valor ?? 0) + valor
    if (total > mock.garantia.maximo) throw new Error(`O limite máximo é ${mock.formatBRL(mock.garantia.maximo)}.`)
    const hoje = new Date()
    const garantia: Garantia = {
      valor: total,
      depositadoEm: hoje.toISOString(),
      liberaEm: addDays(hoje, mock.garantia.carenciaDias).toISOString(),
      carenciaDias: mock.garantia.carenciaDias,
      status: 'aguardando',
      rendimento: mock.garantia.rendimento,
    }
    estado.garantia = garantia
    const c = lerConta()
    if (c) salvarConta({ ...c, garantia, diaVencimento })
    return garantia
  },
}

/**
 * Esqueleto para a implementação com backend HTTP.
 * Cada método deve bater em VITE_API_URL e devolver os tipos de ./types.
 */
export function createHttpApi(baseUrl: string): Api {
  const naoImplementado = (nome: string) => async (): Promise<never> => {
    throw new Error(`${nome}: endpoint ainda não implementado em ${baseUrl}`)
  }
  return {
    getUsuario: naoImplementado('getUsuario'),
    getCarteira: naoImplementado('getCarteira'),
    getCartao: naoImplementado('getCartao'),
    setCartaoBloqueado: naoImplementado('setCartaoBloqueado'),
    getFatura: naoImplementado('getFatura'),
    pagarFatura: naoImplementado('pagarFatura'),
    getTransacoes: naoImplementado('getTransacoes'),
    getEtapasEntrega: naoImplementado('getEtapasEntrega'),
    getIndicacao: naoImplementado('getIndicacao'),
    getIndicados: naoImplementado('getIndicados'),
    getCoins: naoImplementado('getCoins'),
    trocarCoins: naoImplementado('trocarCoins'),
    getBanners: naoImplementado('getBanners'),
    getGarantia: naoImplementado('getGarantia'),
    enviarPix: naoImplementado('enviarPix'),
    abrirConta: naoImplementado('abrirConta'),
    getStatusConta: naoImplementado('getStatusConta'),
    ativarGarantia: naoImplementado('ativarGarantia'),
  }
}

const modo = import.meta.env.VITE_API_MODE ?? 'mock'
export const api: Api = modo === 'http' ? createHttpApi(import.meta.env.VITE_API_URL ?? '/api') : mockApi
