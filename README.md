# Instagram Account Creator

Dois componentes:
- **`bot/`** — serviço Node.js para o VPS (Puppeteer + Express)
- **`dashboard/`** — interface Next.js para criar contas e ver status

## 1. Instalar o bot no VPS

```bash
ssh root@<VPS_IP>

git clone https://github.com/goncalvescristian0508-coder/testeeee.git /root/testeeee
cd /root/testeeee/bot

# Criar .env com suas credenciais
cp .env.example .env
nano .env   # preencher BOT_SECRET, PROXY_USER, PROXY_PASS

# Instalar e subir como serviço
bash setup.sh
```

## 2. Testar o bot via curl

```bash
# Health check
curl http://<VPS_IP>:3001/health

# Criar conta (substituir email e senha)
curl -X POST http://<VPS_IP>:3001/create-account \
  -H "x-bot-secret: <BOT_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@hotmail.com","emailPassword":"senha_do_email"}'

# Ver status do job
curl http://<VPS_IP>:3001/status/<JOB_ID> \
  -H "x-bot-secret: <BOT_SECRET>"

# Listar todos os jobs
curl http://<VPS_IP>:3001/jobs \
  -H "x-bot-secret: <BOT_SECRET>"
```

## 3. Dashboard

```bash
cd dashboard
npm install
cp .env.local.example .env.local
# Editar .env.local com BOT_URL e BOT_SECRET
npm run dev
# Abrir http://localhost:3000
```

Deploy no Vercel: adicione as env vars `BOT_URL` e `BOT_SECRET` nas configurações do projeto.

## Variáveis de ambiente do bot

| Variável | Descrição |
|---|---|
| `BOT_SECRET` | Senha de autenticação da API |
| `PROXY_USER` | Usuário do proxy (DataImpulse) |
| `PROXY_PASS` | Senha do proxy |
| `PORT` | Porta do servidor (padrão: 3001) |
| `PUPPETEER_EXECUTABLE_PATH` | Caminho do Chromium (ex: `/usr/bin/chromium-browser`) |

## Fluxo do bot

1. Loga no Outlook com o email+senha fornecidos (browser separado, sem proxy)
2. Abre Instagram signup em mobile (iPhone UA) via proxy
3. Preenche email, nome, username, senha
4. Preenche data de nascimento se pedida
5. Quando Instagram exige código de verificação por email → bot lê no Outlook e insere automaticamente
6. Conclui cadastro
