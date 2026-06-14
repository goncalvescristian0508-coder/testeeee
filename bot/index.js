'use strict';

const express = require('express');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

puppeteerExtra.use(StealthPlugin());

const app = express();
app.use(express.json());

const BOT_SECRET = process.env.BOT_SECRET;
if (!BOT_SECRET) throw new Error('BOT_SECRET env var is required');
const DEFAULT_PROXY_USER = process.env.PROXY_USER || '';
const DEFAULT_PROXY_PASS = process.env.PROXY_PASS || '';

/** @type {Record<string, object>} */
const jobs = {};

// Últimos 100 códigos encontrados — exposto via GET /codes
const recentCodes = [];

// Contas criadas — persiste em disco
const ACCOUNTS_FILE = '/root/testeeee/created_accounts.json';
const savedAccounts = (() => {
  try { return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')); } catch { return []; }
})();

function saveAccount(job) {
  savedAccounts.push({
    email: job.email,
    emailPassword: job.emailPassword,
    instagramUrl: job.instagramUrl,
    createdAt: new Date().toISOString(),
  });
  try { fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(savedAccounts, null, 2)); } catch (e) { console.error('saveAccount err:', e.message); }
}

function log(jobId, msg) {
  const line = `${new Date().toISOString()} ${msg}`;
  console.log(`[${jobId.slice(0, 8)}] ${msg}`);
  if (jobs[jobId]) jobs[jobId].logs.push(line);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Outlook (contexto incógnito no mesmo browser) ─────────────────────────────

async function loginOutlook(jobId, page, email, password, proxyUser, proxyPass) {
  log(jobId, '[outlook] A fazer login...');
  // Autenticar proxy também para a página do Outlook (IP residencial em vez de IP do datacenter)
  if (proxyUser) await page.authenticate({ username: proxyUser, password: proxyPass });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 800, isMobile: false, hasTouch: false });

  await page.goto(
    'https://login.live.com/login.srf?wa=wsignin1.0&rpsnv=16&wreply=https%3A%2F%2Foutlook.live.com%2Fowa%2F',
    { waitUntil: 'domcontentloaded', timeout: 30000 }
  );

  // ── Campo de email ──
  log(jobId, `[outlook] URL após nav: ${page.url()}`);
  try {
    await page.waitForSelector(
      '#usernameEntry, input[type="email"], input[name="loginfmt"]',
      { visible: true, timeout: 30000 }
    );
  } catch (e) {
    const title = await page.title().catch(() => '?');
    const inputs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input')).map(i => `${i.type}#${i.id}`)
    ).catch(() => []);
    log(jobId, `[outlook] Selector timeout. title="${title}" inputs=[${inputs.join(',')}] url=${page.url()}`);
    throw e;
  }
  const emailEl = await page.$('#usernameEntry, input[type="email"], input[name="loginfmt"]');
  await emailEl.click({ clickCount: 3 });
  await emailEl.type(email, { delay: 60 });
  log(jobId, '[outlook] Email digitado');
  await page.keyboard.press('Enter');

  // ── Campo de senha ──
  await page.waitForSelector(
    'input[type="password"], input[name="passwd"], #passwordEntry',
    { visible: true, timeout: 15000 }
  );
  const passEl = await page.$('input[type="password"], input[name="passwd"], #passwordEntry');
  await passEl.click({ clickCount: 3 });
  await passEl.type(password, { delay: 60 });
  log(jobId, '[outlook] Senha digitada');
  await page.keyboard.press('Enter');

  // ── "Continuar conectado?" — clicar em Não para evitar redirect extra ──
  try {
    await page.waitForSelector(
      '#acceptButton, input[id="idSIButton9"], input[id="idBtn_Back"]',
      { visible: true, timeout: 10000 }
    );
    // Preferir "Não" (idBtn_Back) — menos redirects; se não existir, aceitar
    const noBtn = await page.$('input[id="idBtn_Back"]').catch(() => null);
    if (noBtn) { await noBtn.click().catch(() => {}); log(jobId, '[outlook] Clicou Não em stay-signed-in'); }
    else {
      const yesBtn = await page.$('#acceptButton, input[id="idSIButton9"]').catch(() => null);
      if (yesBtn) { await yesBtn.click().catch(() => {}); log(jobId, '[outlook] Clicou Sim em stay-signed-in'); }
    }
    await sleep(2000);
  } catch {}

  // ── Página de segurança / proofs — saltar (envolver em try/catch por cada iteração) ──
  for (let i = 0; i < 10; i++) {
    try {
      await sleep(2500);
      const url = page.url();
      log(jobId, `[outlook] post-login step=${i} url=${url.split('?')[0]}`);

      if (url.includes('outlook.live.com/mail')) {
        log(jobId, '[outlook] Inbox pronto!');
        await acceptOutlookCookies(page);
        return;
      }

      // Aceitar cookies se aparecer antes do inbox
      if (/optional cookies|we use cookies/i.test(await page.evaluate(() => document.body.innerText || '').catch(() => ''))) {
        await acceptOutlookCookies(page);
        await sleep(2000);
        continue;
      }

      if (/account\.live\.com\/(proofs|recover|resproof)/i.test(url)) {
        const els = await page.$$('a, button');
        for (const el of els) {
          const txt = await el.evaluate(e => (e.textContent || '').trim()).catch(() => '');
          if (/skip|cancel|later|5 day|não agora/i.test(txt)) {
            await el.click().catch(() => {});
            log(jobId, `[outlook] Saltou segurança ("${txt.slice(0, 25)}")`);
            // Aguardar navegação após o click
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
            break;
          }
        }
      }

      // Se ainda em login.live.com, forçar para inbox ao fim
      if (i >= 7 && url.includes('live.com')) {
        log(jobId, '[outlook] A forçar navegação para inbox...');
        await page.goto('https://outlook.live.com/mail/0/inbox', {
          waitUntil: 'domcontentloaded', timeout: 20000,
        }).catch(() => {});
      }
    } catch (e) {
      log(jobId, `[outlook] step=${i} (ignorado): ${e.message}`);
    }
  }

  log(jobId, `[outlook] Login concluído. URL: ${page.url().split('?')[0]}`);
}

async function acceptOutlookCookies(page) {
  // Aceitar cookies se aparecer a página de consent
  try {
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    if (/optional cookies|we use cookies|cookie/i.test(bodyText)) {
      const btns = await page.$$('button');
      for (const btn of btns) {
        const t = await btn.evaluate(el => el.textContent || '');
        if (/accept all|accept optional|aceitar|allow/i.test(t)) {
          await btn.click();
          await sleep(2000);
          break;
        }
      }
    }
  } catch {}
}

async function scanFolder(jobId, page, email, folderUrl, triedCodes = new Set()) {
  const folder = folderUrl.split('/').pop();
  try {
    await page.goto(folderUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });

    // Aceitar cookies do Outlook se aparecer
    await acceptOutlookCookies(page);
    await sleep(1000);

    // Aguardar LISTA de emails renderizar
    await page.waitForFunction(() => {
      const items = [...document.querySelectorAll('[role="option"],[role="listitem"],[data-convid]')];
      if (items.length > 0 && items.some(el => (el.innerText || '').trim().length > 20)) return true;
      return (document.body.innerText || '').length > 1200;
    }, { timeout: 28000, polling: 700 }).catch(() => {});
    await sleep(3000);

    const pageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
    log(jobId, `[outlook] ${folder}: body=${pageText.replace(/\n/g,' ').slice(0,120)}`);

    // Tentativa rápida: código visível na lista (sujeito/preview)
    const listMatches = [];
    const re = /instagram[^\n]{0,200}(\d{6})|(\d{6})[^\n]{0,100}instagram/gi;
    let m;
    while ((m = re.exec(pageText)) !== null) listMatches.push(m[1] || m[2]);
    for (const code of listMatches) {
      if (!triedCodes.has(code)) {
        log(jobId, `[outlook] Código na lista (${folder}): ${code}`);
        triedCodes.add(code);
        recentCodes.unshift({ email, code, foundAt: new Date().toISOString() });
        if (recentCodes.length > 100) recentCodes.length = 100;
        return code;
      }
    }

    // Contar e logar itens da lista
    const itemCount = await page.evaluate(() =>
      document.querySelectorAll('[role="option"], [role="listitem"], [data-convid]').length
    ).catch(() => 0);
    log(jobId, `[outlook] ${folder}: ${itemCount} itens na lista`);

    // Recolher todos os emails do Instagram (mais recentes primeiro = ordem do DOM no Outlook)
    const igCount = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[role="option"], [role="listitem"], [data-convid]')];
      return els.filter(e => /instagram/i.test(e.title || e.innerText)).length;
    }).catch(() => 0);
    log(jobId, `[outlook] ${folder}: ${igCount} emails Instagram encontrados`);

    // Tentar cada email do Instagram (mais recente primeiro)
    for (let idx = 0; idx < igCount; idx++) {
      const clicked = await page.evaluate((i) => {
        const els = [...document.querySelectorAll('[role="option"], [role="listitem"], [data-convid]')];
        const igEls = els.filter(e => /instagram/i.test(e.title || e.innerText));
        if (igEls[i]) { igEls[i].click(); return true; }
        return false;
      }, idx);

      if (!clicked) break;

      log(jobId, `[outlook] ${folder}: email ${idx + 1}/${igCount} clicado, lendo corpo...`);
      await sleep(2500);

      const body = await page.evaluate(() => document.body.innerText || '');
      const near = body.match(/(?:c[oó]digo|code|verify|verification|confirmation)[^\d]{0,40}(\d{6})/i);
      const match = near || body.match(/\b(\d{6})\b/);
      if (!match) {
        log(jobId, `[outlook] ${folder}: email ${idx + 1} aberto mas sem código`);
        continue;
      }

      const code = match[1];
      if (triedCodes.has(code)) {
        log(jobId, `[outlook] ${folder}: código ${code} já tentado, ignorando email ${idx + 1}`);
        continue;
      }

      log(jobId, `[outlook] Código encontrado (${folder}, email ${idx + 1}): ${code}`);
      triedCodes.add(code);
      recentCodes.unshift({ email, code, foundAt: new Date().toISOString() });
      if (recentCodes.length > 100) recentCodes.length = 100;
      return code;
    }

    log(jobId, `[outlook] ${folder}: nenhum código novo encontrado`);
    return null;
  } catch (e) {
    log(jobId, `[outlook] scanFolder erro (${folder}): ${e.message}`);
    return null;
  }
}

// Scan de OTP com página Outlook já aberta (sem re-login)
async function scanForFreshOtp(jobId, emailPage, email, triedCodes) {
  const folders = [
    'https://outlook.live.com/mail/0/inbox',
    'https://outlook.live.com/mail/0/other',
    'https://outlook.live.com/mail/0/junkemail',
    'https://outlook.live.com/mail/0/inbox',   // 2.ª passagem no inbox
  ];

  // ── Fase 1: Scan automático (120s) ──
  const outlookDeadline = Date.now() + 120000;
  let fi = 0;
  while (Date.now() < outlookDeadline) {
    if (jobs[jobId].pendingOtp) {
      const code = jobs[jobId].pendingOtp;
      jobs[jobId].pendingOtp = null;
      log(jobId, `OTP recebido manualmente: ${code}`);
      return code;
    }

    const code = await scanFolder(jobId, emailPage, email, folders[fi % folders.length], triedCodes);
    fi++;
    if (code) return code;

    await sleep(5000);
  }

  // ── Fase 2: Fallback manual (5 min) ──
  log(jobId, 'Outlook timeout — modo manual activado. Use PATCH /submit-code ou o painel.');
  jobs[jobId].status = 'waiting_otp';

  const manualDeadline = Date.now() + 300000;
  while (Date.now() < manualDeadline) {
    if (jobs[jobId].pendingOtp) {
      const code = jobs[jobId].pendingOtp;
      jobs[jobId].pendingOtp = null;
      jobs[jobId].status = 'running';
      log(jobId, `OTP manual recebido: ${code}`);
      return code;
    }
    await sleep(2000);
  }

  throw new Error('Timeout a aguardar OTP (Outlook + manual)');
}

// Mantido para compatibilidade — usado internamente se não houver sessão prévia
async function waitForEmailOtp(jobId, email, password, browser, proxyUser, proxyPass, triedCodes = new Set()) {
  log(jobId, '[outlook] Abrindo contexto incógnito...');
  const ctx = await browser.createIncognitoBrowserContext();
  const emailPage = await ctx.newPage();

  try {
    await loginOutlook(jobId, emailPage, email, password, proxyUser, proxyPass);
    return await scanForFreshOtp(jobId, emailPage, email, triedCodes);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ── Instagram helpers ──────────────────────────────────────────────────────────

async function typeInto(page, selector, value, delay = 70) {
  const el = await page.$(selector);
  if (!el) return false;
  try {
    await el.click({ clickCount: 3 });
  } catch {
    await el.evaluate(e => {
      e.scrollIntoView({ block: 'center' });
      e.focus();
      if (e.select) e.select();
    }).catch(() => {});
    await sleep(300);
  }
  try {
    await el.type(value, { delay });
  } catch {
    await page.keyboard.type(value, { delay });
  }
  return true;
}

// React-compatible: usa teclado real (Ctrl+A + type) — o mais confiável para inputs React
async function reactTypeInto(page, el, value) {
  // Scroll into view e focar
  await el.evaluate(e => {
    e.scrollIntoView({ block: 'center' });
    e.focus();
  }).catch(() => {});
  await sleep(150);

  // Click para garantir foco
  await el.click().catch(() => {});
  await sleep(150);

  // Selecionar tudo e apagar
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await sleep(80);
  await page.keyboard.press('Backspace');
  await sleep(80);

  // Digitar char por char com delay real (teclado físico simulado)
  for (const char of value) {
    await page.keyboard.type(char, { delay: 120 });
    await sleep(50);
  }

  await sleep(300);
}

async function clickButton(page, selectors) {
  for (const sel of (Array.isArray(selectors) ? selectors : [selectors])) {
    const el = await page.$(sel).catch(() => null);
    if (el) { await el.click(); return true; }
  }
  return false;
}

// Click a leaf element whose visible text matches the pattern (handles DIV buttons)
async function clickByText(page, pattern) {
  return page.evaluate((pat) => {
    const re = new RegExp(pat, 'i');
    const all = [...document.querySelectorAll('*')];
    const el = all.reverse().find(e => {
      const txt = (e.innerText || '').trim();
      return txt.length > 0 && txt.length < 40 && re.test(txt);
    });
    if (el) { el.click(); return (el.innerText || '').trim().slice(0, 30); }
    return null;
  }, pattern).catch(() => null);
}

// Submit the current form: try <button type=submit>, then text-based, then Enter
async function submitForm(page) {
  if (await clickButton(page, ['button[type="submit"]'])) return 'button[type=submit]';
  // Broader pattern — no anchors, covers PT/EN variants of "Sign up / Next / Continue"
  const txt = await clickByText(page, 'sign up|cadastr|criar conta|inscrever|next|avançar|continuar|seguinte|register|pr[oó]ximo');
  if (txt) return `text:"${txt}"`;
  // Try any [role="button"] that doesn't look like Log in / Forgot
  const roleClicked = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[role="button"]')];
    const el = els.find(e => {
      const txt = (e.innerText || '').trim();
      return txt.length > 0 && txt.length < 50 &&
        !/log in|entrar|esqueceu|forgot|facebook|with facebook|google/i.test(txt);
    });
    if (el) { el.click(); return (el.innerText || '').trim().slice(0, 30); }
    return null;
  }).catch(() => null);
  if (roleClicked) return `role-button:"${roleClicked}"`;
  await page.keyboard.press('Enter');
  return 'Enter';
}

// Identidade feminina brasileira por email (gerada uma vez por job)
const _identities = new Map();
const _FIRST = ['Ana','Maria','Julia','Beatriz','Gabriela','Amanda','Camila','Fernanda','Leticia','Mariana','Isabella','Larissa','Natalia','Patricia','Rafaela','Carolina','Vanessa','Priscila','Aline','Bruna','Claudia','Daniele','Elaine','Fabiana','Giovanna','Helena','Isabela','Jaqueline','Katia','Livia','Monica','Nathalia','Paula','Renata','Sabrina','Tatiane','Viviane','Yasmin','Andreia','Bianca','Carla','Debora','Erica','Flavia','Gisele','Heloisa','Ingrid','Jessica','Karen','Luciana','Michele','Nadia','Olivia','Pamela','Rebecca','Simone','Thais','Valeria','Wanessa'];
const _LAST = ['Silva','Santos','Oliveira','Costa','Ferreira','Alves','Rodrigues','Pereira','Gomes','Martins','Lima','Carvalho','Souza','Ribeiro','Araujo','Mendes','Barbosa','Rocha','Cardoso','Nascimento','Teixeira','Moreira','Correia','Dias','Nunes','Azevedo','Pinto','Ramos','Fonseca','Monteiro','Castro','Machado','Campos','Cruz','Freitas','Andrade','Lopes','Vieira','Cunha','Batista'];

function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function _getIdentity(email) {
  if (!_identities.has(email)) {
    const first = _pick(_FIRST);
    const last  = _pick(_LAST);
    const user  = (first + last).toLowerCase().replace(/[^a-z]/g, '') + Math.floor(1000 + Math.random() * 8999);
    _identities.set(email, { name: `${first} ${last}`, username: user.slice(0, 28) });
  }
  return _identities.get(email);
}

function deriveName(email)     { return _getIdentity(email).name; }
function deriveUsername(email) { return _getIdentity(email).username; }

async function handleBirthday(jobId, page) {
  try {
    // Instagram desktop: birthday usa DIV[role="combobox"] — não é <select> nativo
    const monthCombo = await page.$(
      'div[role="combobox"][aria-label*="Month" i], div[role="combobox"][aria-label*="Mês" i]'
    ).catch(() => null);

    if (monthCombo) {
      log(jobId, 'Aniversário via combobox (desktop)...');

      // Helper: click combobox → wait → click matching option
      const pickOption = async (combo, matchText, fallbackIdx) => {
        await combo.click();
        await sleep(1200);
        const picked = await page.evaluate((text, idx) => {
          // Tentar scrollIntoView para tornar o item visível se for lista virtual
          const opts = [...document.querySelectorAll('[role="option"]')];
          let opt = opts.find(o => {
            const t = (o.innerText || '').trim();
            return t === text || new RegExp('^' + text + '$', 'i').test(t);
          });
          if (!opt && idx >= 0 && opts[idx]) opt = opts[idx];
          if (opt) {
            try { opt.scrollIntoView({ block: 'center' }); } catch {}
            opt.click();
            return (opt.innerText || '').trim().slice(0, 10);
          }
          return null;
        }, matchText, fallbackIdx).catch(() => null);
        await sleep(800);
        return picked;
      };

      const mPicked = await pickOption(monthCombo, 'June', 5);
      log(jobId, `Mês: ${mPicked}`);

      const dayCombo = await page.$(
        'div[role="combobox"][aria-label*="Day" i], div[role="combobox"][aria-label*="Dia" i]'
      ).catch(() => null);
      if (dayCombo) {
        const dPicked = await pickOption(dayCombo, '15', 14);
        log(jobId, `Dia: ${dPicked}`);
      }

      const yearCombo = await page.$(
        'div[role="combobox"][aria-label*="Year" i], div[role="combobox"][aria-label*="Ano" i]'
      ).catch(() => null);
      if (yearCombo) {
        // evaluate click nativo — evita hang do Puppeteer em mudanças de estado React
        await yearCombo.evaluate(el => el.click());
        await sleep(2500); // year list can take time to fully render

        let yPicked = null;
        const TARGET_YEAR = '2000'; // 26 anos
        for (let pass = 0; pass < 8 && !yPicked; pass++) {
          yPicked = await page.evaluate((yr, pass) => {
            const opts = [...document.querySelectorAll('[role="option"]')];
            const target = opts.find(el => el.textContent.trim() === yr);
            if (target) {
              target.scrollIntoView({ block: 'nearest' }); // scrollIntoView antes de clicar
              target.click();
              return target.textContent.trim();
            }
            const lb = document.querySelector('[role="listbox"]');
            if (lb) lb.scrollTop += 350 * (pass + 1);
            return null;
          }, TARGET_YEAR, pass).catch(() => null);
          if (!yPicked) await sleep(400);
        }

        // Fallback: teclado
        if (!yPicked) {
          log(jobId, 'Ano: usando ArrowDown fallback');
          await yearCombo.evaluate(el => el.focus()).catch(() => {});
          for (let i = 0; i < 26; i++) { await page.keyboard.press('ArrowDown'); await sleep(50); }
          await page.keyboard.press('Enter');
          yPicked = 'ArrowDown*26';
        }
        log(jobId, `Ano: ${yPicked}`);
        await sleep(800);
      }
      return true;
    }

    // Fallback: <select> nativo (mobile ou versão antiga)
    const monthSel = await page.$('select[title="Month:"], select[aria-label*="Month" i]').catch(() => null);
    if (!monthSel) return false;
    log(jobId, 'Aniversário via select nativo');
    for (const s of ['select[title="Month:"]', 'select[aria-label*="Month" i]']) { try { await page.select(s, '6'); break; } catch {} }
    for (const s of ['select[title="Day:"]',   'select[aria-label*="Day" i]'])   { try { await page.select(s, '15'); break; } catch {} }
    for (const s of ['select[title="Year:"]',  'select[aria-label*="Year" i]'])  { try { await page.select(s, '1995'); break; } catch {} }
    await sleep(600);
    return true;
  } catch (e) {
    log(jobId, `handleBirthday erro: ${e.message}`);
    return false;
  }
}

async function fillProfileFields(jobId, page, email, emailPassword) {
  const hasName = await typeInto(
    page,
    'input[name="fullName"], input[aria-label*="Full name" i], input[placeholder*="Full name" i], input[placeholder*="nome" i]',
    deriveName(email)
  );
  if (hasName) log(jobId, 'fillProfile: nome preenchido');
  await sleep(300);

  const hasUser = await typeInto(
    page,
    'input[name="username"], input[aria-label*="username" i], input[placeholder*="username" i], input[placeholder*="usuário" i]',
    deriveUsername(email)
  );
  if (hasUser) log(jobId, 'fillProfile: username preenchido');
  await sleep(300);

  const hasPass = await typeInto(page, 'input[name="password"], input[type="password"]', emailPassword);
  if (hasPass) log(jobId, 'fillProfile: senha preenchida');
  await sleep(300);

  if (hasName || hasUser || hasPass) {
    log(jobId, 'fillProfile: submetendo...');
    await clickButton(page, 'button[type="submit"]');
    await sleep(3500);
    return true;
  }
  return false;
}

// ── Fluxo principal ────────────────────────────────────────────────────────────

async function runJob(job) {
  const { id, email, emailPassword, proxyUser, proxyPass, noProxy } = job;

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,800',
    '--disable-gpu',
    '--disable-quic',                  // evita ERR_QUIC_PROTOCOL_ERROR via proxy
    '--disable-features=NetworkService', // mais compatível com proxies
  ];
  if (!noProxy) {
    args.push('--proxy-server=http://gw.dataimpulse.com:823');
    // Outlook vai pelo IP direto do VPS (proxy residencial redireciona para página de marketing da Microsoft)
    args.push('--proxy-bypass-list=*.live.com,*.microsoft.com,*.hotmail.com,*.outlook.com,*.microsoftonline.com');
  }

  const browser = await puppeteerExtra.launch({
    headless: true,
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    defaultViewport: { width: 1280, height: 800 }, // desktop — Instagram mobile bloqueia headless
  });

  try {
    // ── Iniciar Outlook em paralelo com o Instagram ──────────────────────────────
    log(id, '[outlook-early] A iniciar login em paralelo...');
    const outlookInitPromise = (async () => {
      const ctx = await browser.createIncognitoBrowserContext();
      const pg = await ctx.newPage();
      const triedCodes = new Set();
      try {
        await loginOutlook(id, pg, email, emailPassword, proxyUser, proxyPass);
        // SEM pre-scan — o Instagram pode reenviar o mesmo código de sessões anteriores.
        // Se pré-escaneamos e adicionamos a triedCodes, o código fresco seria pulado.
        // O bot tenta cada código encontrado; rejeitados entram em triedCodes na fase OTP.
        log(id, '[outlook-early] Login concluído, aguardando OTP...');
      } catch (e) {
        log(id, `[outlook-early] Erro no pre-scan (continuando): ${e.message}`);
      }
      return { ctx, page: pg, triedCodes };
    })();

    // ── Página do Instagram (contexto principal, DESKTOP) ──
    // Desktop UA → Instagram redireciona para /accounts/emailsignup/ com formulário all-in-one.
    // UA mobile → redireciona para /accounts/signup/phone/ (multi-passo) que falha em headless.
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    if (!noProxy) await page.authenticate({ username: proxyUser, password: proxyPass });

    // Interceptar e logar erros de console para diagnóstico
    page.on('console', msg => {
      if (msg.type() === 'error') log(id, `[browser console] ${msg.text().slice(0, 120)}`);
    });

    log(id, 'Navegando para o signup do Instagram...');
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'domcontentloaded', timeout: 60000,
    });

    // Aguardar React hidratação — esperar até aparecer pelo menos 1 input
    log(id, 'Aguardando React hidratação...');
    try {
      await page.waitForFunction(() => document.querySelectorAll('input').length > 0, { timeout: 25000, polling: 500 });
    } catch {
      // Guardar screenshot para diagnóstico
      await page.screenshot({ path: `/root/ig_${id.slice(0, 8)}.png`, fullPage: false }).catch(() => {});
      const bodyText = await page.evaluate(() => (document.body.innerText || '').slice(0, 400)).catch(() => '');
      log(id, `Sem inputs após 25s. URL: ${page.url()} | Body: ${bodyText.replace(/\n/g, ' ')}`);
    }

    await sleep(1000);
    log(id, `Página: "${await page.title()}" | URL: ${page.url()}`);

    // Aceitar cookies
    try {
      for (const btn of await page.$$('button')) {
        const t = await btn.evaluate(el => el.textContent);
        if (/allow|accept|aceitar/i.test(t)) { await btn.click(); await sleep(1500); break; }
      }
    } catch {}

    // Encontrar campo de email/telefone
    const EMAIL_SELS = [
      'input[name="emailOrPhone"]', 'input[type="email"]', 'input[name="email"]',
      'input[aria-label*="email" i]', 'input[placeholder*="email" i]', 'input[placeholder*="e-mail" i]',
      'input[type="tel"]', 'input[type="text"]',
    ];
    let emailEl = null;
    for (const sel of EMAIL_SELS) {
      emailEl = await page.$(sel).catch(() => null);
      if (emailEl) { log(id, `Campo signup: ${sel}`); break; }
    }
    if (!emailEl) {
      // Retry até 4x com 4s de espera — Instagram SPA pode demorar a renderizar
      for (let retry = 0; retry < 4 && !emailEl; retry++) {
        const bodySnippet = await page.evaluate(() => (document.body.innerText || '').slice(0, 200)).catch(() => '');
        const allInputs = await page.evaluate(() =>
          Array.from(document.querySelectorAll('input')).map(i => `type=${i.type} name=${i.name} ph=${i.placeholder}`)
        ).catch(() => []);
        log(id, `[signup retry ${retry}] Inputs: [${allInputs.join(' | ')}] | Body: ${bodySnippet.replace(/\n/g, ' ').slice(0, 150)}`);
        await sleep(4000);
        for (const sel of EMAIL_SELS) {
          emailEl = await page.$(sel).catch(() => null);
          if (emailEl) { log(id, `Campo encontrado (retry ${retry}): ${sel}`); break; }
        }
      }
      if (!emailEl) {
        const bodyFull = await page.evaluate(() => (document.body.innerText || '').slice(0, 400)).catch(() => '');
        log(id, `Falha total. URL: ${page.url()} | Body: ${bodyFull.replace(/\n/g, ' ')}`);
        throw new Error('Não foi possível encontrar o campo de signup');
      }
    }

    // Preencher campos por POSIÇÃO (Instagram ofusca os nomes — labels variam por locale)
    // Ordem típica no DOM: email, nome completo, username, password
    const allTextInputs = await page.$$('input[type="text"], input[type="tel"]');

    // index 0 = email (já vamos preencher abaixo via emailEl)
    // index 1 = nome completo
    // index 2 = username (se existir)
    const nameInput = allTextInputs[1] || null;
    const userInput = allTextInputs[2] || null;
    const passInput = await page.$('input[type="password"]').catch(() => null);

    log(id, 'Digitando email...');
    await emailEl.click({ clickCount: 3 });
    await emailEl.type(email, { delay: 70 });
    await sleep(400);

    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.type(deriveName(email), { delay: 70 });
      log(id, 'Nome preenchido (posicional idx=1)');
      await sleep(400);
    } else {
      log(id, 'AVISO: campo nome não encontrado (só 1 text input)');
    }

    // Username field: Instagram usa type="search" com aria-label="Username" (não type="text")
    // Não está no allTextInputs — encontrar por aria-label
    const usernameEl = await page.$(
      'input[aria-label*="Username" i], input[aria-label*="nome de usu" i], input[aria-label*="usuário" i]'
    ).catch(() => null) || userInput || null;
    if (usernameEl) {
      await usernameEl.click({ clickCount: 3 });
      await usernameEl.type(deriveUsername(email), { delay: 70 });
      log(id, 'Username preenchido (aria-label / posicional)');
      await sleep(400);
    } else {
      log(id, 'Username não encontrado — pode aparecer após submit');
    }

    if (passInput) {
      await passInput.click({ clickCount: 3 });
      await passInput.type(emailPassword, { delay: 70 });
      log(id, 'Password preenchida');
      await sleep(600);
    }

    // Preencher aniversário ANTES do submit — é parte do form inicial no desktop!
    await handleBirthday(id, page);
    await sleep(1000);

    // Aguardar check de disponibilidade do username (API call assíncrono do Instagram ~2-3s)
    await sleep(3500);

    log(id, 'Submetendo formulário...');

    // Método 1: click no botão
    const submitHow = await submitForm(page);
    log(id, `Submit via: ${submitHow}`);
    await sleep(3000);
    log(id, `URL após método 1: ${page.url().split('/').slice(-2).join('/')}`);

    // Método 2: requestSubmit() no form
    await page.evaluate(() => { const f = document.querySelector('form'); if (f) f.requestSubmit(); }).catch(() => {});
    await sleep(2000);
    log(id, `URL após método 2: ${page.url().split('/').slice(-2).join('/')}`);

    // Método 3: Enter no campo de senha
    const passElForSubmit = await page.$('input[type="password"]').catch(() => null);
    if (passElForSubmit) { await passElForSubmit.focus().catch(() => {}); await page.keyboard.press('Enter'); }
    await sleep(4000);

    const postSubmitUrl = page.url();
    log(id, `Pós-submit: URL=${postSubmitUrl.split('/').slice(-2).join('/')}`);

    // ── Wizard para passos subsequentes (aniversário, username extra, etc.) ──
    let otpDetected = false;

    const getVisibleInputs = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('input:not([type="hidden"])'))
        .filter(i => i.offsetParent !== null || i.getBoundingClientRect().width > 0)
        .map(i => ({ type: i.type, name: i.name, id: i.id, maxLen: i.maxLength, ph: i.placeholder, ac: i.autocomplete }))
    ).catch(() => []);

    for (let wizStep = 0; wizStep < 12; wizStep++) {
      await sleep(800);
      const visInputs = await getVisibleInputs();
      const url = page.url();
      const wizBody = await page.evaluate(() => (document.body.innerText||'').replace(/\n/g,' ').slice(0,400)).catch(()=>'');
      log(id, `[wizard] step=${wizStep} url=${url.split('/').slice(-2).join('/')} inputs(${visInputs.length}) body: ${wizBody}`);

      if (!/accounts\/signup|accounts\/emailsignup/i.test(url)) {
        log(id, '[wizard] Saiu do signup — conta criada!');
        break;
      }

      // OTP real — verificar por body text (mais confiável que campos ofuscados do Instagram)
      const isOtpBody = /confirmation code|6.?digit code|verify your email|enter the code|c[oó]digo de confirma/i.test(wizBody);
      const isRealOtpInput =
        isOtpBody ||
        visInputs.some(i => i.ac === 'one-time-code') ||
        visInputs.some(i => /confirmationCode|verificationCode|security_code/i.test(i.name + i.id)) ||
        visInputs.filter(x => x.maxLen === 1 && x.type !== 'hidden').length >= 6;
      if (isRealOtpInput) {
        log(id, `[wizard] OTP detectado (body="${wizBody.slice(0,80)}" inputs=${visInputs.length})`);
        otpDetected = true;
        break;
      }

      // Birthday
      const hasBirthdaySelect = await page.$('select[title="Month:"], select[aria-label*="Month" i], select[aria-label*="Mês" i]').catch(() => null);
      if (hasBirthdaySelect) {
        await handleBirthday(id, page);
        await sleep(2000);
        continue;
      }

      // Preencher campos por posição (locale-agnostic)
      // text/tel inputs: idx 0 = email, idx 1 = full name
      // username: tipo "search" com aria-label="Username" (separado!)
      // password: tipo "password"
      const wizTextInputs = await page.$$('input[type="text"], input[type="tel"]');
      const wizUsernameEl = await page.$('input[aria-label*="Username" i], input[aria-label*="nome de usu" i], input[aria-label*="usuário" i]').catch(() => null);
      const wizPassInput = await page.$('input[type="password"]').catch(() => null);

      let anyFilled = false;
      for (let ti = 0; ti < wizTextInputs.length; ti++) {
        try {
          const visible = await wizTextInputs[ti].evaluate(el =>
            el.offsetParent !== null && !el.disabled && el.getAttribute('aria-hidden') !== 'true'
          ).catch(() => false);
          if (!visible) continue;
          const val = await wizTextInputs[ti].evaluate(el => el.value || '');
          if (!val) {
            const fill = ti === 0 ? deriveName(email) : deriveUsername(email);
            await wizTextInputs[ti].click({ clickCount: 3 });
            await wizTextInputs[ti].type(fill, { delay: 70 });
            log(id, `[wizard] text[${ti}] preenchido: ${fill.slice(0, 20)}`);
            anyFilled = true;
          }
        } catch (e) { log(id, `[wizard] text[${ti}] skip: ${e.message.slice(0,40)}`); }
      }
      if (wizUsernameEl) {
        try {
          const val = await wizUsernameEl.evaluate(el => el.value || '');
          if (!val) {
            await wizUsernameEl.click({ clickCount: 3 });
            await wizUsernameEl.type(deriveUsername(email), { delay: 70 });
            log(id, '[wizard] username preenchido (aria-label)');
            anyFilled = true;
          }
        } catch (e) { log(id, `[wizard] username skip: ${e.message.slice(0,40)}`); }
      }
      if (wizPassInput) {
        try {
          const val = await wizPassInput.evaluate(el => el.value || '');
          if (!val) {
            await wizPassInput.click({ clickCount: 3 });
            await wizPassInput.type(emailPassword, { delay: 70 });
            log(id, '[wizard] password preenchida');
            anyFilled = true;
          }
        } catch (e) { log(id, `[wizard] pass skip: ${e.message.slice(0,40)}`); }
      }

      const how = await submitForm(page).catch(e => `error:${e.message.slice(0,40)}`);
      log(id, `[wizard] Submit via: ${how}`);
      await sleep(3500);
    }

    // ── OTP ────────────────────────────────────────────────────────────────────
    if (otpDetected) {
      log(id, 'Instagram pede verificação por email...');

      const visInputsOtp = await getVisibleInputs();
      log(id, `Inputs na página OTP: ${JSON.stringify(visInputsOtp)}`);

      const otpSel = [
        'input[name="confirmationCode"]',
        'input[name="verificationCode"]',
        'input[name="security_code"]',
        'input[aria-label*="code" i]',
        'input[aria-label*="código" i]',
        'input[autocomplete="one-time-code"]',
        'input[type="tel"][maxlength="6"]',
        'input[type="number"][maxlength="6"]',
        'input[type="text"][maxlength="6"]',
        // Instagram define maxlength via JS property, não atributo HTML — usar selector genérico
        'input:not([type="hidden"]):not([type="submit"]):not([type="password"]):not([type="search"])',
      ].join(', ');

      // Aguardar Outlook já iniciado em paralelo
      log(id, '[outlook-early] Aguardando sessão Outlook (pré-scan)...');
      const { ctx: outlookCtx, page: outlookPage, triedCodes } = await outlookInitPromise;

      for (let attempt = 0; attempt < 8; attempt++) {
        log(id, `[otp] Tentativa ${attempt + 1} — ${triedCodes.size} código(s) já tentado(s): ${[...triedCodes].join(',')}`);
        const otp = await scanForFreshOtp(id, outlookPage, email, triedCodes);

        log(id, `Inserindo OTP (tentativa ${attempt + 1}): ${otp}`);

        // Recolher todos os inputs visíveis e classificar
        const allVisInputs = [];
        for (const h of await page.$$('input:not([type="hidden"]):not([type="submit"])')) {
          const info = await h.evaluate(el => ({
            ml: el.maxLength, vis: el.offsetParent !== null && !el.disabled,
            type: el.type, name: el.name, id: el.id, ac: el.autocomplete,
          })).catch(() => null);
          if (info?.vis) allVisInputs.push({ h, info });
        }
        log(id, `[otp] Inputs visíveis: ${allVisInputs.map(x => `${x.info.type}[ml=${x.info.ml},name=${x.info.name},ac=${x.info.ac}]`).join(' | ')}`);

        // Instagram usa ora 6 caixas individuais (maxLength=1) ora 1 campo único (maxLength=6)
        const sixBox = allVisInputs.filter(x => x.info.ml === 1);
        let fieldInfo = null;

        if (sixBox.length >= 6) {
          // Modo 6 caixas: clicar na primeira e digitar dígito a dígito
          log(id, `[otp] Modo 6-caixas detectado`);
          fieldInfo = { mode: '6-box', count: sixBox.length };
          await sixBox[0].h.click();
          await sleep(250);
          for (let ci = 0; ci < otp.length; ci++) {
            await page.keyboard.type(otp[ci], { delay: 120 });
            await sleep(80);
          }
        } else {
          // Modo campo único: localizar por atributos semânticos → maxLength=6 → fallback
          let otpHandle = await page.$([
            'input[autocomplete="one-time-code"]',
            'input[name="confirmationCode"]',
            'input[name="verificationCode"]',
            'input[name="security_code"]',
          ].join(', ')).catch(() => null);

          if (!otpHandle) {
            const found = allVisInputs.find(x => x.info.ml === 6);
            if (found) otpHandle = found.h;
          }
          if (!otpHandle && allVisInputs.length > 0) otpHandle = allVisInputs[0].h;

          if (otpHandle) {
            fieldInfo = await otpHandle.evaluate(el => ({ id: el.id, name: el.name, maxLen: el.maxLength, type: el.type })).catch(() => null);
            await reactTypeInto(page, otpHandle, otp);
            // Forçar React state via native setter (keyboard events às vezes não chegam ao state React)
            await page.evaluate((val) => {
              const inp = [...document.querySelectorAll('input')].find(el => el.maxLength === 6 && el.offsetParent !== null);
              if (!inp) return;
              const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
              setter.call(inp, val);
              inp.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: val }));
              inp.dispatchEvent(new Event('change', { bubbles: true }));
            }, otp).catch(() => {});
          } else {
            log(id, '[otp] Nenhum input localizado — digitando no foco atual');
            await page.keyboard.type(otp, { delay: 130 });
          }
        }

        const fieldVal = await page.evaluate(() => {
          const inp = [...document.querySelectorAll('input')]
            .find(el => (el.maxLength === 6 || el.maxLength === 1) && el.offsetParent !== null);
          return inp ? inp.value : '';
        }).catch(() => '');
        log(id, `[otp] Campo: ${JSON.stringify(fieldInfo)} | Valor: "${fieldVal}"`);

        await sleep(600);

        await sleep(800);

        // Submeter OTP: procurar "Continue" especificamente (não "Submit" do form inicial que ainda está no DOM)
        // Estratégia: form pai do campo OTP → botão dentro dele → fallback Enter
        const submitHow = await page.evaluate(() => {
          const otpInp = [...document.querySelectorAll('input')]
            .find(el => el.maxLength === 6 && el.offsetParent !== null);
          // 1. Botão dentro do form do campo OTP
          if (otpInp) {
            const form = otpInp.closest('form, [role="main"], section, div');
            if (form) {
              const formBtn = [...form.querySelectorAll('button, [role="button"]')]
                .find(b => b.offsetParent !== null && !b.disabled &&
                  !/back|cancel|voltar|cancelar|didn.t get|i didn/i.test(b.textContent || ''));
              if (formBtn) { formBtn.click(); return (formBtn.textContent || '').trim().slice(0, 20); }
            }
          }
          // 2. Continue/Confirmar explícito em qualquer lugar
          const btns = [...document.querySelectorAll('button, [role="button"]')];
          const cont = btns.find(b => /^(continue|continuar|confirm|confirmar)$/i.test((b.textContent || '').trim()) && b.offsetParent !== null);
          if (cont) { cont.click(); return (cont.textContent || '').trim().slice(0, 20); }
          return null;
        }).catch(() => null);
        // Sempre pressionar Enter após o click (garante submit mesmo que o click não funcionou)
        await page.keyboard.press('Enter');
        log(id, `[otp] Submit via: ${submitHow || '(só Enter)'}`);
        await sleep(15000); // proxy residencial pode ser lento

        const postOtpUrl = page.url();
        // Usar innerText (não HTML) para evitar falso positivo com palavras no código JS da página
        const postBodyText = await page.evaluate(() => (document.body.innerText || '').slice(0, 500)).catch(() => '');
        log(id, `URL após OTP tentativa ${attempt + 1}: ${postOtpUrl.split('/').slice(-2).join('/')}`);
        log(id, `[otp] Resposta Instagram: ${postBodyText.replace(/\n/g,' ').slice(0, 200)}`);

        if (!/accounts\/signup|accounts\/emailsignup/i.test(postOtpUrl)) {
          break;
        }

        // Verificar rejeição no texto visível (innerText, não HTML completo)
        const rejected = /invalid|expired|incorrect|inv[aá]lid|expirou|expirad|incorreto|código.*errado|wrong.*code|please.*check/i.test(postBodyText);
        if (!rejected) {
          triedCodes.delete(otp);
          log(id, `OTP ${otp}: sem rejeição explícita — liberando para retry`);
        } else {
          log(id, `OTP ${otp} rejeitado explicitamente. Texto: "${postBodyText.slice(0, 100)}"`);
          await sleep(30000); // aguardar novo código antes de escanear
        }
      }

      log(id, `URL final pós-OTP: ${page.url()}`);
      await outlookCtx.close().catch(() => {});
    } else {
      outlookInitPromise.then(({ ctx }) => ctx && ctx.close().catch(() => {})).catch(() => {});
    }

    // ── Passos pós-OTP (username, termos, etc.) ──────────────────────────────
    for (let i = 0; i < 8; i++) {
      const stepUrl = page.url();
      if (!/accounts\/signup|accounts\/emailsignup/i.test(stepUrl)) break;
      const visInputs = await getVisibleInputs();
      log(id, `Pós-OTP step ${i + 1}: ${stepUrl.split('/').pop()} | inputs: ${visInputs.map(i => `${i.type}[${i.name || i.ph}]`).join(', ')}`);

      // Se ainda estiver na tela OTP, não tentar preencher campos de texto normais
      const stepBodyChk = await page.evaluate(() => (document.body.innerText||'').slice(0,200)).catch(()=>'');
      if (/confirmation code|c[oó]digo de confirma/i.test(stepBodyChk)) {
        log(id, 'Pós-OTP: ainda na tela OTP — parando loop pós-OTP.');
        break;
      }

      const posTextInputs = await page.$$('input[type="text"], input[type="tel"]');
      const posPassInput = await page.$('input[type="password"]').catch(() => null);
      let posAnyFilled = false;
      for (let ti = 0; ti < posTextInputs.length; ti++) {
        try {
          const visible = await posTextInputs[ti].evaluate(el => el.offsetParent !== null && !el.disabled).catch(()=>false);
          if (!visible) continue;
          const val = await posTextInputs[ti].evaluate(el => el.value || '');
          if (!val) {
            const fill = ti === 0 ? deriveName(email) : deriveUsername(email);
            await posTextInputs[ti].click({ clickCount: 3 });
            await posTextInputs[ti].type(fill, { delay: 70 });
            log(id, `Pós-OTP: text[${ti}] preenchido`);
            posAnyFilled = true;
          }
        } catch (e) { log(id, `Pós-OTP: text[${ti}] skip: ${e.message.slice(0,40)}`); }
      }
      if (posPassInput) {
        try {
          const val = await posPassInput.evaluate(el => el.value || '');
          if (!val) { await posPassInput.click({ clickCount: 3 }); await posPassInput.type(emailPassword, { delay: 70 }); posAnyFilled = true; }
        } catch (e) { log(id, `Pós-OTP: pass skip: ${e.message.slice(0,40)}`); }
      }
      if (posAnyFilled) { const h = await submitForm(page).catch(e=>`err:${e.message.slice(0,30)}`); log(id, `Pós-OTP submit: ${h}`); await sleep(3500); continue; }

      const hasBirthday = await handleBirthday(id, page);
      if (hasBirthday) { await sleep(2000); continue; }

      const stepContent = await page.content();
      if (/\bterms\b|\btermos\b|\bagree\b|\bconcordo\b/i.test(stepContent)) {
        await clickButton(page, ['button[type="submit"]', 'button[type="button"]']); await sleep(2500); continue;
      }

      break;
    }

    // ── Resultado ──
    const finalUrl = page.url();
    const finalContent = await page.content();
    log(id, `Terminado. URL: ${finalUrl}`);

    if (/accounts\/suspended/i.test(finalUrl) || /your account has been (suspended|disabled)|conta.*suspensa|conta.*desativad/i.test(finalContent)) {
      job.status = 'suspended';
      log(id, 'Conta suspensa pelo Instagram (email provavelmente reutilizado demais)');
    } else if (/accounts\/signup|accounts\/emailsignup/i.test(finalUrl)) {
      job.status = 'error';
      job.error = 'Ainda na página de signup — criação pode ter falhado';
    } else {
      job.status = 'done';
      log(id, 'Conta criada com sucesso!');
      saveAccount(job);
    }
    job.instagramUrl = finalUrl;

  } catch (err) {
    log(id, `FATAL: ${err.message}`);
    job.status = 'error';
    job.error = err.message;
  } finally {
    await browser.close().catch(() => {});
  }
}

// ── Rotas ──────────────────────────────────────────────────────────────────────

app.post('/create-account', authMiddleware, (req, res) => {
  const { email, emailPassword, proxyUser, proxyPass, noProxy } = req.body;
  if (!email || !emailPassword)
    return res.status(400).json({ error: 'email e emailPassword são obrigatórios' });

  const id = uuidv4();
  const job = {
    id, email, emailPassword,
    proxyUser: proxyUser || DEFAULT_PROXY_USER,
    proxyPass: proxyPass || DEFAULT_PROXY_PASS,
    noProxy: Boolean(noProxy),
    status: 'running',
    pendingOtp: null,
    instagramUrl: null,
    error: null,
    logs: [],
    createdAt: new Date().toISOString(),
  };
  jobs[id] = job;
  runJob(job).catch(console.error);
  res.json({ jobId: id, statusUrl: `/status/${id}` });
});

// Submissão manual de código (painel admin / fallback)
app.patch('/submit-code', authMiddleware, (req, res) => {
  const { jobId, code } = req.body;
  if (!jobId || !code) return res.status(400).json({ error: 'jobId e code são obrigatórios' });

  const job = jobs[jobId];
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });

  const clean = String(code).replace(/\D/g, '');
  if (clean.length !== 6) return res.status(400).json({ error: 'Código inválido — deve ter 6 dígitos' });

  job.pendingOtp = clean;
  log(jobId, `OTP submetido manualmente: ${clean}`);
  res.json({ ok: true, jobId, code: clean });
});

// Listar códigos lidos recentemente (útil para o painel)
app.get('/codes', authMiddleware, (req, res) => {
  const minutes = Math.min(Number(req.query.minutes) || 10, 60);
  const since = Date.now() - minutes * 60 * 1000;
  const filtered = recentCodes.filter(c => new Date(c.foundAt).getTime() >= since);
  res.json(filtered);
});

app.get('/status/:id', authMiddleware, (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job não encontrado' });
  const { emailPassword, pendingOtp, ...safe } = job;
  res.json(safe);
});

app.get('/jobs', authMiddleware, (req, res) => {
  res.json(
    Object.values(jobs).map(({ id, email, status, createdAt, instagramUrl, error }) => ({
      id, email, status, createdAt, instagramUrl, error,
    }))
  );
});

app.get('/created-accounts', authMiddleware, (_req, res) => {
  res.json(savedAccounts);
});

app.get('/health', (_req, res) => res.json({ ok: true, activeJobs: Object.values(jobs).filter(j => j.status === 'running' || j.status === 'waiting_otp').length }));

function authMiddleware(req, res, next) {
  if (req.headers['x-bot-secret'] !== BOT_SECRET) return res.status(401).json({ error: 'Não autorizado' });
  next();
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Bot a ouvir na porta :${PORT}`));
