import type { CardStatus, EtapaEntrega, Garantia, Indicado, Transacao } from '../services/types'

export type { CardStatus, EtapaEntrega, Transacao }

export const user = {
  id: 'u_demo',
  nome: 'Carlos',
  nomeCompleto: 'Carlos Silva',
  nomeCartao: 'JOÃO SILVA',
  email: 'carlos.silva@email.com',
  telefone: '(11) 98765-4321',
  cpf: '***.456.789-**',
  conta: '0001 / 12345-6',
  notificacoes: 22,
}

export const carteira = {
  saldoDisponivel: 170,
  emProcessamento: 190,
  saldoReservado: 0,
}

export const cartao = {
  ultimosDigitos: '6718',
  status: 'producao' as CardStatus,
  statusLabel: 'Em produção',
  limiteCompras: 400,
  utilizado: 42.63,
  limiteDisponivel: 357.37,
  limiteBanner: 800,
  bandeira: 'Mastercard',
  validade: '10/31',
  bloqueado: false,
}

export const fatura = {
  melhorDiaCompra: 6,
  fechamento: '05/11/2026',
  vencimento: '15/11/2026',
  valorAtual: 42.63,
  status: 'Aberta',
}

export const coins = {
  saldo: 6300,
  valorConversao: 0.01,
}

export const indicacao = {
  link: 'https://maiscard.app/convite/CARLOS2026',
  codigo: 'CARLOS2026',
  recompensaReais: 10,
  recompensaCoins: 1000,
  concluidas: 3,
  pendentes: 2,
  ganhosReais: 30,
  ganhosCoins: 3000,
}

export const transacoes: Transacao[] = [
  { id: 't1', descricao: 'iFood', categoria: 'Alimentação', valor: -32.9, data: '27/10', tipo: 'debito' },
  { id: 't2', descricao: 'Pix recebido · Ana', categoria: 'Transferência', valor: 150, data: '26/10', tipo: 'credito' },
  { id: 't3', descricao: 'Spotify', categoria: 'Assinatura', valor: -9.73, data: '25/10', tipo: 'debito' },
  { id: 't4', descricao: 'Uber', categoria: 'Transporte', valor: -18.4, data: '24/10', tipo: 'debito' },
  { id: 't5', descricao: 'Adicionar saldo · Pix', categoria: 'Depósito', valor: 200, data: '22/10', tipo: 'credito' },
]

export const etapasEntrega: EtapaEntrega[] = [
  { id: 'emitido', titulo: 'Emitido', descricao: 'Seu MAIS Card foi aprovado e emitido.', data: '20/10/2026' },
  { id: 'producao', titulo: 'Em produção', descricao: 'Seu cartão está sendo personalizado.', data: '23/10/2026' },
  { id: 'enviado', titulo: 'Enviado', descricao: 'Cartão entregue à transportadora.' },
  { id: 'a_caminho', titulo: 'A caminho', descricao: 'Saiu para entrega no seu endereço.' },
  { id: 'entregue', titulo: 'Entregue', descricao: 'Cartão nas suas mãos. Ative no app!' },
]

export const indicados: Indicado[] = [
  { nome: 'Ana Paula', status: 'concluida', data: '15/10' },
  { nome: 'Bruno M.', status: 'concluida', data: '09/10' },
  { nome: 'Carla R.', status: 'concluida', data: '02/10' },
  { nome: 'Diego S.', status: 'pendente', data: '25/10' },
  { nome: 'Elaine F.', status: 'pendente', data: '27/10' },
]

export const atalhos = [
  { id: 'parcela', titulo: 'MAIS Parcela', descricao: 'Crédito na Carteira em até 12x', icon: 'parcela' },
  { id: 'transferir', titulo: 'Transferir', descricao: 'Entre Conta+ ou Pix', icon: 'transferir' },
  { id: 'extrato', titulo: 'Extrato da Carteira', descricao: 'Veja todas as movimentações', icon: 'extrato' },
  { id: 'coins', titulo: '+Coins', descricao: 'Suas moedas e benefícios', icon: 'coins' },
  { id: 'trocar', titulo: 'Trocar +Coins', descricao: 'Troque suas moedas por dinheiro', icon: 'trocar' },
  { id: 'saldo', titulo: 'Adicionar saldo', descricao: 'Via Pix ou Open Finance', icon: 'saldo' },
] as const

export const banners = [
  {
    id: 'b1',
    titulo: 'Seu MAIS Card foi emitido!',
    texto: 'Acompanhe cada etapa até seu cartão chegar nas suas mãos.',
    rotulo: 'Seu limite disponível:',
    valor: cartao.limiteBanner,
    cta: 'Acompanhar Agora',
    to: '/entrega',
    variante: 'preto' as const,
  },
  {
    id: 'b2',
    titulo: 'Indique e ganhe!',
    texto: 'Ganhe R$ 10 + 1.000 +Coins por cada amigo que concluir o cadastro.',
    rotulo: 'Você já ganhou:',
    valor: indicacao.ganhosReais,
    cta: 'Indicar agora',
    to: '/indicar',
    variante: 'amarelo' as const,
  },
  {
    id: 'b3',
    titulo: 'Limite garantido',
    texto: 'Guarde na Caixinha Garantia e o valor vira seu limite, rendendo 100% do CDI.',
    rotulo: 'A partir de:',
    valor: 25,
    cta: 'Começar quiz',
    to: '/quiz',
    variante: 'amarelo' as const,
  },
]

export function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatNumber(value: number) {
  return value.toLocaleString('pt-BR')
}

/* ---------- Onboarding: quiz, cadastro e Caixinha Garantia ---------- */

export type QuizOption = { id: string; label: string; hint?: string }
export type QuizQuestion = { id: string; titulo: string; subtitulo?: string; opcoes: QuizOption[] }

export const quizPerguntas: QuizQuestion[] = [
  {
    id: 'objetivo',
    titulo: 'O que você mais quer agora?',
    opcoes: [
      { id: 'organizar', label: 'Organizar minhas finanças' },
      { id: 'construir', label: 'Construir ou recuperar meu crédito' },
      { id: 'limite', label: 'Ter um cartão com limite garantido' },
      { id: 'render', label: 'Fazer meu dinheiro render' },
    ],
  },
  {
    id: 'situacao',
    titulo: 'Como está seu nome hoje?',
    subtitulo: 'Isso não muda sua aprovação: no cartão garantido o limite é o seu próprio investimento.',
    opcoes: [
      { id: 'limpo', label: 'Sem restrições' },
      { id: 'negativado', label: 'Com restrição (negativado)' },
      { id: 'naosei', label: 'Não sei dizer' },
    ],
  },
  {
    id: 'renda',
    titulo: 'Qual a sua renda mensal aproximada?',
    subtitulo: 'Usamos só para sugerir um valor de investimento confortável.',
    opcoes: [
      { id: 'ate1500', label: 'Até R$ 1.500' },
      { id: 'ate3000', label: 'R$ 1.500 a R$ 3.000' },
      { id: 'ate6000', label: 'R$ 3.000 a R$ 6.000' },
      { id: 'mais6000', label: 'Acima de R$ 6.000' },
    ],
  },
  {
    id: 'garantia',
    titulo: 'Quanto você quer guardar na Caixinha Garantia?',
    subtitulo: 'O valor vira seu limite após 7 dias na Caixinha. Você resgata quando quiser.',
    opcoes: [
      { id: '25', label: 'R$ 25', hint: 'Limite de R$ 25' },
      { id: '100', label: 'R$ 100', hint: 'Limite de R$ 100' },
      { id: '300', label: 'R$ 300', hint: 'Limite de R$ 300' },
      { id: '500', label: 'R$ 500', hint: 'Limite de R$ 500' },
    ],
  },
]

export const garantia = {
  valoresSugeridos: [25, 50, 100, 200, 300, 500],
  minimo: 25,
  maximo: 5000,
  rendimento: '100% do CDI',
  carenciaDias: 7,
  regras: [
    'Seu limite é exatamente o valor guardado na Caixinha Garantia.',
    'O limite é ativado depois que o valor completa 7 dias na Caixinha.',
    'O dinheiro continua seu e rende 100% do CDI desde o primeiro dia.',
    'Você pode resgatar quando quiser, inclusive antes dos 7 dias. Se resgatar, o limite não é ativado ou diminui junto.',
    'Não consultamos restrições de crédito para liberar o cartão garantido.',
    'Sem taxa de adesão e sem anuidade.',
  ],
}

/** Caixinha do usuário demo: depositou há 3 dias, limite ativa em 4. */
const hoje = new Date()
const diasAtras = (n: number) => new Date(hoje.getTime() - n * 86_400_000)
export const garantiaAtual: Garantia = {
  valor: 400,
  depositadoEm: diasAtras(3).toISOString(),
  liberaEm: diasAtras(-4).toISOString(),
  carenciaDias: garantia.carenciaDias,
  status: 'aguardando',
  rendimento: garantia.rendimento,
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

/** Dias inteiros desde o depósito (limitado à carência). */
export function diasNaCaixinha(g: Garantia) {
  const dias = Math.floor((Date.now() - new Date(g.depositadoEm).getTime()) / 86_400_000)
  return Math.max(0, Math.min(g.carenciaDias, dias))
}

export const documentosAceitos = [
  { id: 'rg', label: 'RG', descricao: 'Frente e verso' },
  { id: 'cnh', label: 'CNH', descricao: 'Física ou digital' },
  { id: 'rne', label: 'RNE / CRNM', descricao: 'Para estrangeiros' },
]
