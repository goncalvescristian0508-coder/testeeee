#!/bin/bash
# Run as root on Ubuntu/Debian VPS to install everything and start the bot
set -e

echo "==> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "==> Installing Chromium + dependencies..."
apt-get install -y \
  chromium-browser \
  ca-certificates fonts-liberation libappindicator3-1 libasound2 \
  libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 \
  libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 \
  libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
  libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
  libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
  libxss1 libxtst6 lsb-release wget xdg-utils

echo "==> Setting up /root/instagram-bot..."
mkdir -p /root/instagram-bot
cp index.js package.json /root/instagram-bot/
cd /root/instagram-bot

if [ ! -f .env ]; then
  cat > .env << 'EOF'
BOT_SECRET=6cd233b9cf07f198ed526d86e9fa1b5f317c69ab530069fc
PROXY_USER=12a9e3073948b23797f4
PROXY_PASS=e6d27cc95521bf9a
PORT=3001
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
EOF
  echo "==> Created .env"
fi

export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install

cat > /etc/systemd/system/instagram-bot.service << 'EOF'
[Unit]
Description=Instagram Account Creator Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/instagram-bot
EnvironmentFile=/root/instagram-bot/.env
ExecStart=/usr/bin/node /root/instagram-bot/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable instagram-bot
systemctl restart instagram-bot

echo ""
echo "==> Done!"
echo "==> Logs: journalctl -u instagram-bot -f"
echo "==> Test: curl http://localhost:3001/health"
