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
        return;
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

async function scanFolder(jobId, page, email, folderUrl, triedCodes = new Set()) {
  const folder = folderUrl.split('/').pop();
  try {
    await page.goto(folderUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(3000);

    const pageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');

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
    // ── Iniciar Outlook em paralelo com o Instagram ──────────────────────────────
    // Enquanto o Instagram carrega, fazemos login no Outlook e pré-scaneamos todos
    // os emails Instagram já existentes → triedCodes fica pré-populado com códigos
    // antigos antes de precisarmos do OTP da sessão actual.
    log(id, '[outlook-early] A iniciar login em paralelo...');
    const outlookInitPromise = (async () => {
      const ctx = await browser.createIncognitoBrowserContext();
      const pg = await ctx.newPage();
      const triedCodes = new Set();
      try {
        await loginOutlook(id, pg, email, emailPassword, proxyUser, proxyPass);
        for (const folder of [
          'https://outlook.live.com/mail/0/inbox',
          'https://outlook.live.com/mail/0/other',
          'https://outlook.live.com/mail/0/junkemail',
        ]) {
          await scanFolder(id, pg, email, folder, triedCodes);
        }
        log(id, `[outlook-early] Pre-scan completo. Códigos pré-existentes (${triedCodes.size}): ${[...triedCodes].join(', ') || 'nenhum'}`);
      } catch (e) {
        log(id, `[outlook-early] Erro no pre-scan (continuando): ${e.message}`);
      }
      return { ctx, page: pg, triedCodes };
    })();
    // Não await aqui — corre em paralelo com a navegação Instagram

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

    // ── Mudar para o modo de registo por email (se estiver no modo telefone) ──
    // Instagram mobile mostra o formulário de telefone por padrão.
    // Clicar em "Sign up with email" / "Use email address" muda para o modo email.
    const switchedToEmail = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"], a, span, div'));
      const btn = btns.find(b => /sign up with email|use email|usar email|usar e-mail|email address|endereço de email/i.test((b.textContent || '').trim()));
      if (btn) { btn.click(); return (btn.textContent || '').trim().slice(0, 40); }
      return null;
    });
    if (switchedToEmail) {
      log(id, `Clicou em modo email: "${switchedToEmail}"`);
      await sleep(3000);
      // Re-encontrar o campo de email agora que o formulário mudou
      for (const sel of EMAIL_SELS) {
        const newEl = await page.$(sel).catch(() => null);
        if (newEl) { emailEl = newEl; log(id, `Campo email (pós-switch): ${sel}`); break; }
      }
    }

    log(id, 'Digitando email...');
    await emailEl.click({ clickCount: 3 });
    await emailEl.type(email, { delay: 70 });
    await sleep(1000);

    // Dump botões antes de submeter (diagnóstico)
    const btnsAtStart = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, [role="button"]'))
        .map(b => `${b.tagName}|txt="${(b.textContent || '').trim().slice(0, 30)}"`)
    ).catch(() => []);
    log(id, `Botões antes do submit: ${btnsAtStart.join(' :: ')}`);

    log(id, 'Avançando passo 1 via Enter...');
    await page.keyboard.press('Enter');
    await sleep(7000);

    // ── Wizard multi-passo do Instagram ──────────────────────────────────────────
    // O Instagram mobile mostra os campos passo-a-passo no mesmo URL.
    // Percorremos os passos: nome/senha → aniversário → username → OTP
    let otpDetected = false;

    const getVisibleInputs = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('input:not([type="hidden"])'))
        .filter(i => i.offsetParent !== null)
        .map(i => ({ type: i.type, name: i.name, id: i.id, maxLen: i.maxLength, ph: i.placeholder, ac: i.autocomplete }))
    ).catch(() => []);

    for (let wizStep = 0; wizStep < 15; wizStep++) {
      await sleep(500);
      const visInputs = await getVisibleInputs();
      const url = page.url();
      log(id, `[wizard] step=${wizStep} url=${url.split('/').pop()} inputs(${visInputs.length}): ${visInputs.map(i => `${i.type}[${i.name || i.id || i.ac || i.ph || '?'}|ml:${i.maxLen}]`).join(' ')}`);

      // ── Saiu das páginas de signup → sucesso ──
      if (!/accounts\/signup|accounts\/emailsignup/i.test(url)) {
        log(id, '[wizard] Saiu do signup — conta criada!');
        break;
      }

      // ── Página OTP: input real (não falso positivo do bundle JS) ──
      const isRealOtpInput = visInputs.some(i =>
        i.ac === 'one-time-code' ||
        /confirmationCode|verificationCode|security_code/i.test(i.name + i.id) ||
        (i.maxLen === 6 && i.type !== 'hidden') ||
        visInputs.filter(x => x.maxLen === 1).length >= 6
      );
      if (isRealOtpInput) {
        log(id, '[wizard] Página de OTP detectada (input real)');
        otpDetected = true;
        break;
      }

      // ── Aniversário ──
      const hasBirthdaySelect = await page.$('select[title="Month:"], select[aria-label*="Month" i], select[aria-label*="Mês" i]').catch(() => null);
      if (hasBirthdaySelect) {
        log(id, '[wizard] Passo birthday');
        await handleBirthday(id, page);
        await sleep(2000);
        continue;
      }

      // ── Nome completo ──
      const nameFilled = await typeInto(page, 'input[name="fullName"], input[aria-label*="Full name" i], input[placeholder*="Full name" i], input[placeholder*="nome" i]', deriveName(email));
      if (nameFilled) log(id, '[wizard] nome preenchido');
      await sleep(300);

      // ── Senha ──
      const passFilled = await typeInto(page, 'input[name="password"], input[type="password"]', emailPassword);
      if (passFilled) log(id, '[wizard] senha preenchida');
      await sleep(300);

      // ── Username ──
      const userFilled = await typeInto(page, 'input[name="username"], input[aria-label*="username" i], input[placeholder*="username" i], input[placeholder*="usuário" i]', deriveUsername(email));
      if (userFilled) log(id, '[wizard] username preenchido');
      await sleep(300);

      if (nameFilled || passFilled || userFilled) {
        log(id, '[wizard] Submetendo passo...');
        await clickButton(page, ['button[type="submit"]', 'button']);
        await sleep(4000);
        continue;
      }

      // Nenhum campo reconhecido — dump todos os botões para diagnóstico
      const allBtns = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button, [role="button"]'))
          .map(b => `${b.tagName}|type=${b.type}|txt="${(b.textContent || '').trim().slice(0, 25)}"`)
      ).catch(() => []);
      log(id, `[wizard] step=${wizStep} botões(${allBtns.length}): ${allBtns.join(' :: ')}`);

      // Tentar clicar em botão com texto reconhecido
      const nextClicked = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('button, [role="button"]'));
        const b = els.find(e => /next|avançar|continue|próximo|seguinte|ok\b/i.test((e.textContent || '').trim()));
        if (b) { b.click(); return (b.textContent || '').trim().slice(0, 20); }
        // Fallback: primeiro button[type="submit"] ou button
        const sub = document.querySelector('button[type="submit"]');
        if (sub) { sub.click(); return 'submit'; }
        const any = document.querySelector('button');
        if (any) { any.click(); return (any.textContent || '').trim().slice(0, 20) || 'button'; }
        return null;
      });

      if (nextClicked) {
        log(id, `[wizard] Clicou "${nextClicked}"`);
        await sleep(4000);
        continue;
      }

      // Sem botão — pressionar Enter como fallback
      log(id, '[wizard] Sem botão — Enter');
      await page.keyboard.press('Enter');
      await sleep(4000);
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
      ].join(', ');

      // Aguardar Outlook já iniciado em paralelo
      log(id, '[outlook-early] Aguardando sessão Outlook (pré-scan)...');
      const { ctx: outlookCtx, page: outlookPage, triedCodes } = await outlookInitPromise;

      for (let attempt = 0; attempt < 3; attempt++) {
        log(id, `[otp] Tentativa ${attempt + 1} — ${triedCodes.size} código(s) já tentado(s): ${[...triedCodes].join(',')}`);
        const otp = await scanForFreshOtp(id, outlookPage, email, triedCodes);

        log(id, `Inserindo OTP (tentativa ${attempt + 1}): ${otp}`);

        let typed = await typeInto(page, otpSel, otp);

        if (!typed) {
          // Fallback 1: 6 inputs individuais (um por dígito)
          const digitInputs = await page.$$('input[maxlength="1"]');
          if (digitInputs.length >= 6) {
            log(id, `OTP via ${digitInputs.length} campos individuais`);
            for (let di = 0; di < 6 && di < otp.length; di++) {
              await digitInputs[di].click({ clickCount: 3 });
              await digitInputs[di].type(otp[di], { delay: 80 });
            }
            typed = true;
          }
        }

        if (!typed) {
          // Fallback 2: qualquer input com name/id ou maxLen=6
          for (const inp of await page.$$('input[type="text"], input[type="tel"], input[type="number"], input:not([type="hidden"])')) {
            const info = await inp.evaluate(el => ({ maxLen: el.maxLength, name: el.name, id: el.id }));
            if (info.maxLen === 6 || /code|verification|confirm/i.test(info.name + info.id)) {
              await inp.click({ clickCount: 3 });
              await inp.type(otp, { delay: 100 });
              log(id, `OTP via fallback2 (name=${info.name} id=${info.id})`);
              typed = true;
              break;
            }
          }
        }

        if (!typed) {
          log(id, 'OTP via keyboard.type (fallback3)');
          await page.evaluate(() => {
            const inp = document.querySelector('input:not([type="hidden"]):not([type="submit"])');
            if (inp) inp.focus();
          });
          await page.keyboard.type(otp, { delay: 100 });
        }

        await sleep(500);
        const submitted = await clickButton(page, ['button[type="submit"]', 'button']);
        if (!submitted) await page.keyboard.press('Enter');
        await sleep(7000);

        const postOtpUrl = page.url();
        const postContent = await page.content();
        log(id, `URL após OTP tentativa ${attempt + 1}: ${postOtpUrl}`);

        if (!/accounts\/signup|accounts\/emailsignup/i.test(postOtpUrl)) {
          break;
        }

        const rejected = /invalid|expired|incorrect|inv[aá]lid|expirou|expirad|incorreto/i.test(postContent);
        log(id, `OTP ${otp} ${rejected ? 'rejeitado pelo Instagram' : 'URL não mudou'}. Tentando novo código...`);
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

      const userFilled = await typeInto(page, 'input[name="username"], input[aria-label*="username" i], input[placeholder*="username" i]', deriveUsername(email));
      if (userFilled) { log(id, 'Pós-OTP: username preenchido'); await clickButton(page, ['button[type="submit"]', 'button']); await sleep(3500); continue; }

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
