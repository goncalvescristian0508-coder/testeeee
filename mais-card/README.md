# MAIS Card — frontend (demo)

App de fintech (banco digital) **mobile-first**, somente frontend, com dados mockados.
Feito com **React 18 + Vite 5 + Tailwind CSS 4 + react-router + framer-motion**.

## Rodando

```bash
cd mais-card
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + build de produção em dist/
npm run preview  # serve o build
```

No desktop o app aparece numa "moldura" de celular com 430px de largura; no celular ocupa a tela toda.

## Telas (react-router)

| Rota | Tela |
|---|---|
| `/` | Início: header amarelo, Carteira+, carrossel de banners, atalhos, cards +Coins e Indique e Ganhe |
| `/card` | Meu MAIS Card: cartão virtual, limites, fatura, bloquear / ver fatura / pagar fatura |
| `/entrega` | Acompanhar entrega: timeline Emitido → Em produção → Enviado → A caminho → Entregue |
| `/indicar` | Indicar: link com copiar/compartilhar, contadores e lista de indicados |
| `/perfil` | Perfil: dados, tema claro/escuro, segurança, sair |
| `/transferir` | Pix e transferências (botão central da bottom bar) |
| `/extrato` | Extrato da Carteira |
| `/coins` | +Coins e troca de moedas |
| `/quiz` | Quiz de perfil (4 perguntas) que direciona para o MAIS Card Garantido |
| `/cadastro` | Abertura de conta: nome, CPF, e-mail, celular, senha e aceite |
| `/documento` | Envio de documento (RG, CNH ou RNE), frente e verso simulados |
| `/selfie` | Selfie de confirmação de identidade (simulada) |
| `/garantia` | Caixinha Garantia: o valor guardado vira o limite, rende e pode ser resgatado |
| `/conta-criada` | Confirmação da conta e do limite liberado |

## Modelo do cartão garantido

O limite é exatamente o valor guardado na Caixinha Garantia e é ativado depois que o valor
completa 7 dias lá (carência). O dinheiro continua do cliente, rende desde o primeiro dia e
pode ser resgatado a qualquer momento, inclusive antes dos 7 dias; nesse caso o limite não é
ativado ou diminui junto. Não há taxa de adesão nem limite acima do valor guardado. As telas
de documento e selfie são placeholders de interface; no app real entram câmera e um provedor
de validação de identidade.

## Conectando um backend

As telas não leem `mock.ts` diretamente: elas chamam `api` (em `src/services/api.ts`) por meio
do hook `useAsync`, que cuida de loading e erro. Para ligar um banco de dados:

1. Os tipos que a API deve devolver estão em `src/services/types.ts`.
2. Implemente a interface `Api` (há um esqueleto em `createHttpApi`, ou crie um
   `supabaseApi.ts`, por exemplo). Cada método corresponde a uma tela ou ação:
   `getUsuario`, `getCarteira`, `getCartao`, `setCartaoBloqueado`, `getFatura`, `pagarFatura`,
   `getTransacoes`, `getEtapasEntrega`, `getIndicacao`, `getIndicados`, `getCoins`,
   `trocarCoins`, `getBanners`, `getGarantia`, `enviarPix` e `abrirConta`.
3. Copie `.env.example` para `.env` e troque `VITE_API_MODE` para `http`
   (ou aponte a constante `api` para a sua implementação).

`abrirConta` recebe tudo que o onboarding coleta (quiz, dados pessoais, tipo de documento,
arquivos de documento e selfie, valor da Caixinha) e devolve a `Garantia` com as datas de
depósito e de ativação do limite.

## Estrutura

- `src/data/mock.ts` — usuário, saldos, cartão, fatura, transações, indicações, banners e atalhos.
- `src/components/` — `Header`, `CardVirtual`, `BannerCarousel`, `ShortcutGrid`, `BottomNav`, `StatCard`, `Timeline`, `TopBar`, `StepHeader`, `GarantiaCard`, `Skeleton`, `Logo`, `Toast`, `Icons`.
- `src/services/` — `types.ts` (modelos) e `api.ts` (interface `Api`, `mockApi` e esqueleto `createHttpApi`).
- `src/hooks/` — `useAsync` (dados da API com loading/erro), `useTheme`, `useHideBalance`, `useToast`, `useOnboarding` (estado do cadastro).
- `src/pages/` — uma pasta por tela.

## Identidade visual

Amarelo `#F5C21B`, preto `#0F0F0F`, cinza `#F4F4F4`, bege `#FBF6E4`, vermelho `#E5484D`; tema escuro com fundo `#121212`, cards `#1E1E1E` e destaque `#2A2410`. Fonte Nunito. A logo e o cartão são desenhados em SVG/CSS, sem assets de terceiros (a bandeira é um placeholder genérico de dois círculos).

Screenshots em `docs/screenshots/`.
