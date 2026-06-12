'use strict';

const express = require('express');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { v4: uuidv4 } = require('uuid');

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

  // ── "Continuar conectado?" ──
  try {
    await page.waitForSelector(
      '#acceptButton, input[id="idSIButton9"], input[id="idBtn_Back"]',
      { visible: true, timeout: 10000 }
    );
    const accept = await page.$('#acceptButton, input[id="idSIButton9"]').catch(() => null);
    if (accept) { await accept.click(); log(jobId, '[outlook] Aceite stay-signed-in'); }
  } catch {}

  // ── Página de segurança / proofs — saltar ──
  for (let i = 0; i < 8; i++) {
    await sleep(2000);
    const url = page.url();
    if (url.includes('outlook.live.com/mail')) { log(jobId, `[outlook] Inbox pronto: ${url}`); return; }
    if (/account\.live\.com\/(proofs|recover|resproof)/i.test(url)) {
      const els = await page.$$('a, button');
      for (const el of els) {
        const txt = await el.evaluate(e => (e.textContent || '').trim()).catch(() => '');
        if (/skip|cancel|later|5 day|não agora/i.test(txt)) {
          await el.click().catch(() => {});
          log(jobId, `[outlook] Saltou página de segurança ("${txt.slice(0, 25)}")`);
          break;
        }
      }
    }
  }

  log(jobId, `[outlook] Login concluído. URL: ${page.url()}`);
}

async function scanFolder(jobId, page, email, folderUrl) {
  try {
    await page.goto(folderUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(3000);

    // Clica no email do Instagram na lista (se existir)
    const clicked = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[role="option"], [role="listitem"], [data-convid]')];
      const el = els.find(e => /instagram/i.test(e.title || e.innerText));
      if (el) { el.click(); return true; }
      return false;
    });

    if (!clicked) return null;
    await sleep(2000);

    const body = await page.evaluate(() => document.body.innerText || '');

    // 1.ª tentativa — código perto de palavras-chave
    const near = body.match(/(?:c[oó]digo|code|verify|verification|confirmation)[^\d]{0,40}(\d{6})/i);
    // 2.ª tentativa — qualquer número de 6 dígitos
    const match = near || body.match(/\b(\d{6})\b/);
    if (!match) return null;

    const code = match[1];
    log(jobId, `[outlook] Código encontrado (${folderUrl.split('/').pop()}): ${code}`);
    recentCodes.unshift({ email, code, foundAt: new Date().toISOString() });
    if (recentCodes.length > 100) recentCodes.length = 100;
    return code;
  } catch (e) {
    log(jobId, `[outlook] scanFolder erro (${folderUrl.split('/').pop()}): ${e.message}`);
    return null;
  }
}

async function waitForEmailOtp(jobId, email, password, browser, proxyUser, proxyPass) {
  log(jobId, '[outlook] Abrindo contexto incógnito...');
  const ctx = await browser.createIncognitoBrowserContext();
  const emailPage = await ctx.newPage();

  try {
    await loginOutlook(jobId, emailPage, email, password, proxyUser, proxyPass);

    const folders = [
      'https://outlook.live.com/mail/0/inbox',
      'https://outlook.live.com/mail/0/other',
      'https://outlook.live.com/mail/0/junkemail',
      'https://outlook.live.com/mail/0/inbox',   // 2.ª passagem no inbox
    ];

    // ── Fase 1: Outlook automático (120s) ──
    const outlookDeadline = Date.now() + 120000;
    let fi = 0;
    while (Date.now() < outlookDeadline) {
      if (jobs[jobId].pendingOtp) {
        const code = jobs[jobId].pendingOtp;
        jobs[jobId].pendingOtp = null;
        log(jobId, `OTP recebido manualmente: ${code}`);
        return code;
      }

      const code = await scanFolder(jobId, emailPage, email, folders[fi % folders.length]);
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
  } finally {
    await ctx.close().catch(() => {}); // liberta memória imediatamente
  }
}

// ── Instagram helpers ──────────────────────────────────────────────────────────

async function typeInto(page, selector, value, delay = 70) {
  const el = await page.$(selector);
  if (!el) return false;
  await el.click({ clickCount: 3 });
  await el.type(value, { delay });
  return true;
}

async function clickButton(page, selectors) {
  for (const sel of (Array.isArray(selectors) ? selectors : [selectors])) {
    const el = await page.$(sel);
    if (el) { await el.click(); return true; }
  }
  return false;
}

function deriveUsername(email) {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '');
  return base.slice(0, 20) + Math.floor(Math.random() * 9999);
}

function deriveName(email) {
  const raw = email.split('@')[0].replace(/[0-9_\-.]/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  return raw || 'User';
}

async function handleBirthday(jobId, page) {
  try {
    await page.waitForSelector('select[title="Month:"]', { timeout: 6000 });
    log(jobId, 'Preenchendo data de nascimento...');
    await page.select('select[title="Month:"]', '6');
    await page.select('select[title="Day:"]', '15');
    await page.select('select[title="Year:"]', '1995');
    await sleep(600);
    await clickButton(page, ['button[type="submit"]', 'button[type="button"]']);
    await sleep(3000);
    return true;
  } catch { return false; }
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
    '--window-size=390,844',
    '--disable-gpu',
  ];
  if (!noProxy) {
    args.push('--proxy-server=http://gw.dataimpulse.com:823');
    // Sem bypass — Outlook também passa pelo proxy residencial (evita bloqueio do IP do datacenter)
  }

  const browser = await puppeteerExtra.launch({
    headless: true,
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });

  try {
    // ── Página do Instagram (contexto principal, mobile) ──
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    );
    if (!noProxy) await page.authenticate({ username: proxyUser, password: proxyPass });

    log(id, 'Navegando para o signup do Instagram...');
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2', timeout: 60000,
    });
    await sleep(3000);
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
      const info = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input')).map(i => `type=${i.type} name=${i.name} ph=${i.placeholder}`)
      ).catch(() => []);
      log(id, `Nenhum campo encontrado. Inputs: ${info.join(' | ')}`);
      emailEl = await page.$('input:not([type="hidden"])').catch(() => null);
      if (!emailEl) throw new Error('Não foi possível encontrar o campo de signup');
    }

    log(id, 'Digitando email...');
    await emailEl.click({ clickCount: 3 });
    await emailEl.type(email, { delay: 70 });
    await sleep(500);

    // Preencher campos visíveis (formulário all-in-one)
    await typeInto(page, 'input[name="fullName"], input[placeholder*="Full name" i], input[aria-label*="Full name" i]', deriveName(email));
    await sleep(400);
    await typeInto(page, 'input[name="username"], input[placeholder*="username" i], input[aria-label*="username" i]', deriveUsername(email));
    await sleep(400);
    await typeInto(page, 'input[name="password"], input[type="password"]', emailPassword);
    await sleep(600);

    log(id, 'Submetendo formulário...');
    await clickButton(page, 'button[type="submit"]');
    await sleep(4000);

    await handleBirthday(id, page);

    // ── OTP ──
    const content = await page.content();
    const needsOtp = /confirmationCode|verificationCode|enter.*code|código|verification code/i.test(content);

    if (needsOtp) {
      log(id, 'Instagram pede verificação por email...');
      const otp = await waitForEmailOtp(id, email, emailPassword, browser, proxyUser, proxyPass);

      log(id, `Inserindo OTP: ${otp}`);
      const otpSel = 'input[name="confirmationCode"], input[name="verificationCode"], input[aria-label*="code" i], input[aria-label*="código" i], input[autocomplete="one-time-code"]';
      const typed = await typeInto(page, otpSel, otp);

      if (!typed) {
        // Fallback: campo com maxLength=6 ou nome com "code"
        for (const inp of await page.$$('input[type="text"], input[type="tel"], input[type="number"], input:not([type="hidden"])')) {
          const info = await inp.evaluate(el => ({ maxLen: el.maxLength, name: el.name }));
          if (info.maxLen === 6 || /code|verification|confirm/i.test(info.name)) {
            await inp.click({ clickCount: 3 });
            await inp.type(otp, { delay: 100 });
            log(id, `OTP via fallback (name=${info.name})`);
            break;
          }
        }
      }

      await sleep(500);
      await clickButton(page, ['button[type="submit"]']);
      await sleep(4000);
      log(id, `URL após OTP: ${page.url()}`);
    }

    // ── Campos de perfil pós-OTP ──
    for (let i = 0; i < 3; i++) {
      const filled = await fillProfileFields(id, page, email, emailPassword);
      if (!filled) break;
      log(id, `Preenchimento de perfil ${i + 1}. URL: ${page.url()}`);
      await handleBirthday(id, page);
    }

    // ── Ecrãs extra (termos, etc.) ──
    for (let i = 0; i < 5; i++) {
      const stepUrl = page.url();
      const stepContent = await page.content();
      log(id, `Ecrã extra ${i + 1}: ${stepUrl}`);
      if (/accounts\/signup|accounts\/emailsignup/i.test(stepUrl)) break;
      if (/\bterms\b|\btermos\b|\bagree\b|\bconcordo\b/i.test(stepContent)) {
        await clickButton(page, ['button[type="submit"]', 'button[type="button"]']);
        await sleep(2500);
      } else if (/birthday|aniversário|birth date/i.test(stepContent)) {
        await handleBirthday(id, page);
      } else { break; }
    }

    // ── Resultado ──
    const finalUrl = page.url();
    const finalContent = await page.content();
    log(id, `Terminado. URL: ${finalUrl}`);

    if (/your account has been (suspended|disabled)|conta.*suspensa|conta.*desativad/i.test(finalContent)) {
      job.status = 'suspended';
    } else if (/accounts\/signup|accounts\/emailsignup/i.test(finalUrl)) {
      job.status = 'error';
      job.error = 'Ainda na página de signup — criação pode ter falhado';
    } else {
      job.status = 'done';
      log(id, 'Conta criada com sucesso!');
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

app.get('/health', (_req, res) => res.json({ ok: true, activeJobs: Object.values(jobs).filter(j => j.status === 'running' || j.status === 'waiting_otp').length }));

function authMiddleware(req, res, next) {
  if (req.headers['x-bot-secret'] !== BOT_SECRET) return res.status(401).json({ error: 'Não autorizado' });
  next();
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Bot a ouvir na porta :${PORT}`));
