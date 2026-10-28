/**
 * Modelos de domínio do MAIS Card.
 * Quando o backend existir, estas são as formas que a API deve devolver.
 */

export type CardStatus = 'emitido' | 'producao' | 'enviado' | 'a_caminho' | 'entregue'

export type Usuario = {
  id: string
  nome: string
  nomeCompleto: string
  nomeCartao: string
  email: string
  telefone: string
  cpf: string
  conta: string
  notificacoes: number
}

export type Carteira = {
  saldoDisponivel: number
  emProcessamento: number
  saldoReservado: number
}

export type Cartao = {
  ultimosDigitos: string
  status: CardStatus
  statusLabel: string
  limiteCompras: number
  utilizado: number
  limiteDisponivel: number
  bandeira: string
  validade: string
  bloqueado: boolean
}

export type Fatura = {
  melhorDiaCompra: number
  fechamento: string
  vencimento: string
  valorAtual: number
  status: string
}

export type Transacao = {
  id: string
  descricao: string
  categoria: string
  valor: number
  data: string
  tipo: 'debito' | 'credito'
}

export type EtapaEntrega = { id: CardStatus; titulo: string; descricao: string; data?: string }

export type Indicacao = {
  link: string
  codigo: string
  recompensaReais: number
  recompensaCoins: number
  concluidas: number
  pendentes: number
  ganhosReais: number
  ganhosCoins: number
}

export type Indicado = { nome: string; status: 'concluida' | 'pendente'; data: string }

export type Coins = { saldo: number; valorConversao: number }

/** Caixinha Garantia: o valor guardado vira o limite após o período de carência. */
export type Garantia = {
  valor: number
  /** ISO date em que o valor entrou na Caixinha */
  depositadoEm: string
  /** ISO date em que o limite é ativado (depositadoEm + carenciaDias) */
  liberaEm: string
  carenciaDias: number
  status: 'aguardando' | 'ativo' | 'resgatado'
  rendimento: string
}

export type Banner = {
  id: string
  titulo: string
  texto: string
  rotulo: string
  valor: number
  cta: string
  to: string
  variante: 'preto' | 'amarelo'
}

/** Dados enviados ao fim do onboarding. Arquivos chegam como File (ou URL após upload). */
export type AberturaConta = {
  respostasQuiz: Record<string, string>
  nome: string
  cpf: string
  email: string
  celular: string
  senha: string
  documentoTipo: string
  documentoFrente?: File | string
  documentoVerso?: File | string
  selfie?: File | string
  valorGarantia: number
}

export type ResultadoAbertura = {
  usuarioId: string
  garantia: Garantia
}
