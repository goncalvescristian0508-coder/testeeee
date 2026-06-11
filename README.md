# Instagram Account Creator

Dois componentes:
- **`bot/`** — serviço Node.js rodando no VPS (Puppeteer + Express)
- **`dashboard/`** — interface Next.js para disparar jobs e ver status

## Instalar o bot no VPS

```bash
ssh root@147.182.218.81
# senha: R00t@ig2026!vps

git clone https://github.com/goncalvescristian0508-coder/testeeee.git /root/testeeee
cd /root/testeeee/bot
bash setup.sh
```

Ou manualmente:
```bash
mkdir -p /root/instagram-bot
cp /root/testeeee/bot/index.js /root/testeeee/bot/package.json /root/instagram-bot/
cd /root/instagram-bot

# Definir variáveis
cat > .env << 'EOF'
BOT_SECRET=6cd233b9cf07f198ed526d86e9fa1b5f317c69ab530069fc
PROXY_USER=12a9e3073948b23797f4
PROXY_PASS=e6d27cc95521bf9a
PORT=3001
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
EOF

PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install
source .env && node index.js
```

## Testar o bot

```bash
# Health
curl http://147.182.218.81:3001/health

# Criar conta
curl -X POST http://147.182.218.81:3001/create-account \
  -H "x-bot-secret: 6cd233b9cf07f198ed526d86e9fa1b5f317c69ab530069fc" \
  -H "Content-Type: application/json" \
  -d '{"email":"GoldieLangenfeld490@hotmail.com","emailPassword":"kteBlMD4d7VN"}'

# Ver status do job
curl http://147.182.218.81:3001/status/JOB_ID \
  -H "x-bot-secret: 6cd233b9cf07f198ed526d86e9fa1b5f317c69ab530069fc"

# Listar jobs
curl http://147.182.218.81:3001/jobs \
  -H "x-bot-secret: 6cd233b9cf07f198ed526d86e9fa1b5f317c69ab530069fc"
```

## Dashboard (Next.js)

```bash
cd dashboard
npm install
cp .env.local.example .env.local
npm run dev
# Abrir http://localhost:3000
```

Para deploy no Vercel:
```bash
cd dashboard
npx vercel
# Configurar: BOT_URL=http://147.182.218.81:3001 e BOT_SECRET=...
```

## Fluxo do bot

1. Loga no Outlook automaticamente com email + senha fornecidos
2. Abre Instagram signup em mobile (iPhone UA) via proxy DataImpulse
3. Preenche email, nome, username, senha
4. Se precisar confirmar data de nascimento → preenche automaticamente
5. Quando Instagram enviar código de verificação por email → bot lê no Outlook e insere
6. Completa cadastro
