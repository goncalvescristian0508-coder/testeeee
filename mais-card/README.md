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

O fluxo segue o modelo de cartão com limite garantido usado por fintechs reguladas: o limite é
exatamente o valor guardado na Caixinha, o dinheiro continua do cliente, rende e pode ser
resgatado a qualquer momento (o limite diminui junto). Não há taxa de adesão, prazo mínimo de
retenção nem limite acima do valor investido. As telas de documento e selfie são placeholders
de interface; no app real entram câmera e um provedor de validação de identidade.

## Estrutura

- `src/data/mock.ts` — usuário, saldos, cartão, fatura, transações, indicações, banners e atalhos.
- `src/components/` — `Header`, `CardVirtual`, `BannerCarousel`, `ShortcutGrid`, `BottomNav`, `StatCard`, `Timeline`, `TopBar`, `StepHeader`, `Logo`, `Toast`, `Icons`.
- `src/hooks/` — `useTheme` (tema claro/escuro persistido), `useHideBalance`, `useToast`, `useOnboarding` (estado do cadastro).
- `src/pages/` — uma pasta por tela.

## Identidade visual

Amarelo `#F5C21B`, preto `#0F0F0F`, cinza `#F4F4F4`, bege `#FBF6E4`, vermelho `#E5484D`; tema escuro com fundo `#121212`, cards `#1E1E1E` e destaque `#2A2410`. Fonte Nunito. A logo e o cartão são desenhados em SVG/CSS, sem assets de terceiros (a bandeira é um placeholder genérico de dois círculos).

Screenshots em `docs/screenshots/`.
