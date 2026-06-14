'use strict';

/**
 * OTP Helper — on-demand mode (runs on LOCAL PC)
 *
 * Polls VPS for jobs in `waiting_otp` status, opens Outlook only for
 * the specific email that needs a code, delivers it, then closes the browser.
 *
 * Usage:
 *   cd otp-helper
 *   BOT_SECRET=<secret> node index.js
 */

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin   = require('puppeteer-extra-plugin-stealth');
const axios           = require('axios');

puppeteerExtra.use(StealthPlugin());

const VPS_URL    = process.env.VPS_URL    || 'http://147.182.218.81:3001';
const BOT_SECRET = process.env.BOT_SECRET;
if (!BOT_SECRET) { console.error('ERROR: set BOT_SECRET env var'); process.exit(1); }

const POLL_INTERVAL_MS = 15000; // check VPS every 15s
const MAX_CONCURRENT   = 3;     // max simultaneous Outlook sessions

let ACCOUNTS;
try {
  ACCOUNTS = require('./accounts.json');
} catch {
  console.error('ERROR: accounts.json not found');
  process.exit(1);
}

const accountMap = new Map(ACCOUNTS.map(a => [a.email.toLowerCase(), a]));

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(tag, msg) {
  console.log(`${new Date().toISOString().slice(11, 19)} [${tag}] ${msg}`);
}

// Jobs currently being handled — keyed by jobId, value = timestamp when started
const activeJobs  = new Map();
// Jobs that failed and can be retried after cooldown (keyed by jobId, value = retry-after timestamp)
const cooldown    = new Map();
// Jobs we already delivered to — never retry these
const delivered   = new Set();

const COOLDOWN_MS = 60000; // 60s before retrying a failed job

// ── Outlook login ──────────────────────────────────────────────────────────────

async function loginOutlook(page, email, password) {
  const tag = email.split('@')[0].slice(0, 14);

  await page.goto('https://outlook.live.com/mail/0/inbox', {
    waitUntil: 'domcontentloaded', timeout: 35000,
  }).catch(() => {});

  for (let step = 0; step < 25; step++) {
    await sleep(2500);
    const url = page.url();
    log(tag, `login step=${step} ${url.split('?')[0].slice(-40)}`);

    if (url.includes('outlook.live.com/mail')) {
      log(tag, 'Logged in OK');
      await sleep(4000);
      return true;
    }

    // Security / proofs page — try to skip
    if (/account\.live\.com\/(proofs|recover|resproof)/i.test(url)) {
      let skipped = false;
      try {
        const els = await page.$$('a, button');
        for (const el of els) {
          const txt = await el.evaluate(e => (e.textContent || '').trim()).catch(() => '');
          if (/skip|cancel|later|5 day|não agora/i.test(txt)) {
            await el.click().catch(() => {});
            log(tag, `Skipped security page ("${txt.slice(0, 25)}")`);
            skipped = true;
            await sleep(3000);
            break;
          }
        }
      } catch {}
      if (!skipped) {
        await page.goto('https://outlook.live.com/mail/0/inbox', {
          waitUntil: 'domcontentloaded', timeout: 20000,
        }).catch(() => {});
      }
      continue;
    }

    if (url.includes('login.live.com/login.srf')) { await sleep(2500); continue; }

    // Email field
    const emailIn = await page.$('input[name="loginfmt"], input[type="email"]').catch(() => null);
    if (emailIn) {
      await emailIn.click({ clickCount: 3 });
      await emailIn.type(email, { delay: 60 });
      await sleep(400);
      const btn = await page.$('input[id="idSIButton9"], button[type="submit"]').catch(() => null);
      if (btn) await btn.click().catch(() => {});
      else await page.keyboard.press('Enter');
      log(tag, 'Submitted email');
      await sleep(3000);
      continue;
    }

    // Password field
    const passIn = await page.$('input[name="passwd"], input[type="password"]').catch(() => null);
    if (passIn) {
      await passIn.click({ clickCount: 3 });
      await passIn.type(password, { delay: 60 });
      await sleep(400);
      const btn = await page.$('input[id="idSIButton9"], button[type="submit"]').catch(() => null);
      if (btn) await btn.click().catch(() => {});
      else await page.keyboard.press('Enter');
      log(tag, 'Submitted password');
      await sleep(4500);
      continue;
    }

    // "Stay signed in?" — click No
    const noBtn = await page.$('input[id="idBtn_Back"]').catch(() => null);
    if (noBtn) {
      await noBtn.click().catch(() => {});
      log(tag, 'Dismissed stay-signed-in');
      await sleep(3000);
      continue;
    }

    if (step >= 14) {
      log(tag, 'Forcing nav to inbox...');
      await page.goto('https://outlook.live.com/mail/0/inbox', {
        waitUntil: 'domcontentloaded', timeout: 25000,
      }).catch(() => {});
      await sleep(5000);
      if (page.url().includes('outlook.live.com/mail')) return true;
    }
  }

  log(tag, 'Login FAILED');
  return false;
}

// ── Scan inbox + junk for Instagram OTP ───────────────────────────────────────

async function scanForCode(page, email) {
  const tag     = email.split('@')[0].slice(0, 14);
  const folders = [
    'https://outlook.live.com/mail/0/inbox',
    'https://outlook.live.com/mail/0/junkemail',
  ];

  for (const folderUrl of folders) {
    try {
      await page.goto(folderUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(5000);

      // Fast path: code visible in subject/preview list
      const pageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
      const quick = pageText.match(/instagram[^\n]{0,200}(\d{6})|(\d{6})[^\n]{0,100}instagram/i);
      if (quick) {
        const code = quick[1] || quick[2];
        log(tag, `Code in list view [${folderUrl.split('/').pop()}]: ${code}`);
        return code;
      }

      // Slow path: open each Instagram email row
      const rows = await page.$$('[role="option"], [role="listitem"]');
      for (const row of rows.slice(0, 20)) {
        const rowText = await row.evaluate(el => el.textContent || '').catch(() => '');
        if (/instagram/i.test(rowText)) {
          await row.click().catch(() => {});
          await sleep(3000);
          const bodyText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
          const m = bodyText.match(/\b(\d{6})\b/);
          if (m) { log(tag, `Code in email body: ${m[1]}`); return m[1]; }
        }
      }
    } catch (e) {
      log(tag, `Scan error [${folderUrl.split('/').pop()}]: ${e.message}`);
    }
  }
  return null;
}

// ── Deliver OTP to VPS ─────────────────────────────────────────────────────────

async function deliverCode(jobId, code) {
  await axios.post(
    `${VPS_URL}/provide-otp/${jobId}`,
    { code },
    { headers: { 'x-bot-secret': BOT_SECRET, 'Content-Type': 'application/json' }, timeout: 10000 }
  );
}

// ── Handle one waiting_otp job ─────────────────────────────────────────────────

async function handleJob(job) {
  const { id: jobId, email } = job;
  const tag = email.split('@')[0].slice(0, 14);

  log(tag, `Iniciando sessão Outlook para job ${jobId.slice(0, 8)}`);

  const acc = accountMap.get(email.toLowerCase());
  if (!acc) {
    log(tag, `ERRO: email ${email} não encontrado em accounts.json`);
    cooldown.set(jobId, Date.now() + COOLDOWN_MS * 10); // long cooldown — won't help
    return;
  }

  let browser;
  try {
    browser = await puppeteerExtra.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const ok = await loginOutlook(page, acc.email, acc.password);
    if (!ok) {
      log(tag, 'Login falhou — adicionando cooldown');
      cooldown.set(jobId, Date.now() + COOLDOWN_MS * 3);
      return;
    }

    // Try scanning up to 3 times over 1 minute (email may arrive late)
    let code = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      log(tag, `Scan tentativa ${attempt}/3...`);
      code = await scanForCode(page, acc.email);
      if (code) break;
      if (attempt < 3) {
        log(tag, 'Código não encontrado — aguardando 20s e repetindo...');
        await sleep(20000);
        // Double-check job is still waiting
        try {
          const { data: status } = await axios.get(`${VPS_URL}/status/${jobId}`, {
            headers: { 'x-bot-secret': BOT_SECRET }, timeout: 8000,
          });
          if (status.status !== 'waiting_otp') {
            log(tag, `Job ${jobId.slice(0, 8)} já não espera OTP (status=${status.status}) — abortando`);
            return;
          }
        } catch {}
      }
    }

    if (!code) {
      log(tag, 'Código não encontrado após 3 tentativas');
      cooldown.set(jobId, Date.now() + COOLDOWN_MS);
      return;
    }

    await deliverCode(jobId, code);
    delivered.add(jobId);
    log(tag, `OTP ${code} entregue ao VPS para job ${jobId.slice(0, 8)}`);

  } catch (e) {
    log(tag, `Erro no handleJob: ${e.message}`);
    cooldown.set(jobId, Date.now() + COOLDOWN_MS);
  } finally {
    if (browser) await browser.close().catch(() => {});
    activeJobs.delete(jobId);
  }
}

// ── Main poll loop ─────────────────────────────────────────────────────────────

async function pollOnce() {
  let jobList;
  try {
    const { data } = await axios.get(`${VPS_URL}/jobs`, {
      headers: { 'x-bot-secret': BOT_SECRET }, timeout: 10000,
    });
    jobList = data;
  } catch (e) {
    log('poll', `VPS unreachable: ${e.message}`);
    return;
  }

  const waiting = jobList.filter(j => j.status === 'waiting_otp');
  if (waiting.length === 0) {
    log('poll', `${jobList.length} job(s) — nenhum aguarda OTP`);
    return;
  }

  log('poll', `${waiting.length} job(s) aguardando OTP | active=${activeJobs.size}`);

  for (const job of waiting) {
    if (delivered.has(job.id)) continue;
    if (activeJobs.has(job.id)) continue;

    const cd = cooldown.get(job.id);
    if (cd && Date.now() < cd) continue;

    if (activeJobs.size >= MAX_CONCURRENT) {
      log('poll', `MAX_CONCURRENT atingido (${MAX_CONCURRENT}) — aguardando`);
      break;
    }

    activeJobs.set(job.id, Date.now());
    handleJob(job).catch(e => {
      log('poll', `handleJob crash: ${e.message}`);
      activeJobs.delete(job.id);
      cooldown.set(job.id, Date.now() + COOLDOWN_MS);
    });
  }
}

async function main() {
  log('helper', `Iniciado — VPS: ${VPS_URL} | ${ACCOUNTS.length} contas carregadas`);
  log('helper', `Poll a cada ${POLL_INTERVAL_MS / 1000}s | MAX_CONCURRENT=${MAX_CONCURRENT}`);

  while (true) {
    await pollOnce();
    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
