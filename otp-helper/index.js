'use strict';

/**
 * OTP Helper — on-demand, browser visível (LOCAL PC)
 * Poll ao VPS a cada 15s; quando há job em waiting_otp abre o Outlook,
 * lê o OTP do Instagram e entrega via API.
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

const POLL_INTERVAL_MS = 15000;
const MAX_CONCURRENT   = 3;

let ACCOUNTS;
try { ACCOUNTS = require('./accounts.json'); }
catch { console.error('ERROR: accounts.json not found'); process.exit(1); }

const accountMap = new Map(ACCOUNTS.map(a => [a.email.toLowerCase(), a]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(tag, msg) {
  console.log(`${new Date().toISOString().slice(11, 19)} [${tag}] ${msg}`);
}

const activeJobs = new Map();
const cooldown   = new Map();
const delivered  = new Set();
const COOLDOWN_MS = 90000;

// ── Outlook login ─────────────────────────────────────────────────────────────

async function loginOutlook(page, email, password) {
  const tag = email.split('@')[0].slice(0, 14);

  await page.goto(
    'https://go.microsoft.com/fwlink/p/?LinkID=2125442&deeplink=mail%2F0%2Finbox',
    { waitUntil: 'domcontentloaded', timeout: 40000 }
  ).catch(() => {});

  for (let step = 0; step < 25; step++) {
    await sleep(3500);
    const url = page.url();
    log(tag, `step=${step} ${url.split('?')[0].slice(-55)}`);

    // SUCCESS
    if (url.includes('outlook.live.com/mail') || url.includes('outlook.live.com/owa')) {
      log(tag, 'Inbox OK!');
      return true;
    }

    // Microsoft product page → find Sign In button
    if (/microsoft\.com.*outlook|microsoft\.com.*365|microsoft\.com\/en/i.test(url)) {
      const clicked = await page.evaluate(() => {
        const all = [...document.querySelectorAll('a, button')];
        const si = all.find(el => /sign.?in|entrar/i.test((el.textContent || '').trim()));
        if (si) { si.click(); return true; }
        return false;
      }).catch(() => false);
      if (!clicked) {
        await page.goto(
          'https://go.microsoft.com/fwlink/p/?LinkID=2125442&deeplink=mail%2F0%2Finbox',
          { waitUntil: 'domcontentloaded', timeout: 20000 }
        ).catch(() => {});
      }
      await sleep(2000); continue;
    }

    // Security / proofs page → skip
    if (/account\.live\.com\/(proofs|recover|resproof)/i.test(url)) {
      const els = await page.$$('a, button').catch(() => []);
      let skipped = false;
      for (const el of els) {
        const t = await el.evaluate(e => (e.textContent || '').trim()).catch(() => '');
        if (/skip|cancel|later|5 day|não agora|nao agora/i.test(t)) {
          await el.click().catch(() => {});
          log(tag, `Security page ignorada ("${t.slice(0, 25)}")`);
          skipped = true; break;
        }
      }
      if (!skipped) {
        await page.goto(
          'https://go.microsoft.com/fwlink/p/?LinkID=2125442&deeplink=mail%2F0%2Finbox',
          { waitUntil: 'domcontentloaded', timeout: 20000 }
        ).catch(() => {});
      }
      continue;
    }

    // "Stay signed in?" (new UI with Yes / No buttons)
    const stayClicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, input[type="button"]')];
      const no = btns.find(b => /^no$/i.test((b.textContent || b.value || '').trim()));
      if (no) { no.click(); return true; }
      // Fallback: old UI #idBtn_Back
      const back = document.querySelector('#idBtn_Back');
      if (back) { back.click(); return true; }
      return false;
    }).catch(() => false);
    if (stayClicked) { log(tag, 'Stay signed in: No'); await sleep(2500); continue; }

    // PASSWORD field — check BEFORE email to avoid typing email in password box
    const passIn = await page.$('input[name="passwd"], input[type="password"], #i0118').catch(() => null);
    if (passIn) {
      const vis = await passIn.evaluate(el => el.offsetParent !== null && !el.disabled).catch(() => false);
      if (vis) {
        await passIn.evaluate(e => { e.scrollIntoView({ block: 'center' }); e.focus(); }).catch(() => {});
        await sleep(400);
        await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await passIn.type(password, { delay: 90 });
        await sleep(400);
        const btn = await page.$('#idSIButton9, button[type="submit"]').catch(() => null);
        if (btn) await btn.click().catch(() => {}); else await page.keyboard.press('Enter');
        log(tag, 'Password submetida'); await sleep(4000); continue;
      }
    }

    // EMAIL field — only if NOT on password/ppsecure page
    if (!url.includes('ppsecure')) {
      const emailIn = await page.$('input[name="loginfmt"], input[type="email"], #i0116').catch(() => null);
      if (emailIn) {
        const vis = await emailIn.evaluate(el =>
          el.offsetParent !== null && !el.disabled && el.getAttribute('readonly') !== 'true'
        ).catch(() => false);
        if (vis) {
          await emailIn.evaluate(e => { e.scrollIntoView({ block: 'center' }); e.focus(); }).catch(() => {});
          await sleep(300);
          await emailIn.click({ clickCount: 3 }).catch(() => {});
          await emailIn.type(email, { delay: 80 });
          await sleep(400);
          const btn = await page.$('#idSIButton9, button[type="submit"]').catch(() => null);
          if (btn) await btn.click().catch(() => {}); else await page.keyboard.press('Enter');
          log(tag, 'Email submetido'); await sleep(3500); continue;
        }
      }
    }
  }

  log(tag, 'Login FALHOU');
  return false;
}

// ── Scan inbox + junk for Instagram OTP ──────────────────────────────────────

async function scanForCode(page, email) {
  const tag     = email.split('@')[0].slice(0, 14);
  const folders = [
    'https://outlook.live.com/mail/0/inbox',
    'https://outlook.live.com/mail/0/junkemail',
  ];

  for (const folderUrl of folders) {
    try {
      await page.goto(folderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(5000);

      // Fast path: code in subject/preview
      const pageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
      const quick = pageText.match(/instagram[^\n]{0,200}(\d{6})|(\d{6})[^\n]{0,100}instagram/i);
      if (quick) {
        const code = quick[1] || quick[2];
        log(tag, `Código na lista [${folderUrl.split('/').pop()}]: ${code}`);
        return code;
      }

      // Slow path: open each Instagram email
      const rows = await page.$$('[role="option"], [role="listitem"]');
      for (const row of rows.slice(0, 20)) {
        const rowText = await row.evaluate(el => el.textContent || '').catch(() => '');
        if (/instagram/i.test(rowText)) {
          await row.click().catch(() => {});
          await sleep(3000);
          const bodyText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
          const m = bodyText.match(/\b(\d{6})\b/);
          if (m) { log(tag, `Código no email: ${m[1]}`); return m[1]; }
        }
      }
      log(tag, `Sem código em ${folderUrl.split('/').pop()}`);
    } catch (e) {
      log(tag, `Erro scan: ${e.message.slice(0, 60)}`);
    }
  }
  return null;
}

// ── Deliver OTP to VPS ────────────────────────────────────────────────────────

async function deliverCode(jobId, code) {
  await axios.post(
    `${VPS_URL}/provide-otp/${jobId}`,
    { code },
    { headers: { 'x-bot-secret': BOT_SECRET }, timeout: 10000 }
  );
}

// ── Handle one waiting_otp job ────────────────────────────────────────────────

async function handleJob(job) {
  const { id: jobId, email } = job;
  const tag = email.split('@')[0].slice(0, 14);

  const acc = accountMap.get(email.toLowerCase());
  if (!acc) {
    log(tag, `ERRO: ${email} não em accounts.json`);
    cooldown.set(jobId, Date.now() + COOLDOWN_MS * 5);
    return;
  }

  log(tag, `Abrindo Outlook para job ${jobId.slice(0, 8)}`);

  let browser;
  try {
    browser = await puppeteerExtra.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1000,700',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const ok = await loginOutlook(page, acc.email, acc.password);
    if (!ok) {
      log(tag, 'Login falhou — cooldown 90s');
      cooldown.set(jobId, Date.now() + COOLDOWN_MS);
      return;
    }

    // Try up to 3 times with 20s wait
    let code = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      log(tag, `Scan ${attempt}/3`);
      code = await scanForCode(page, acc.email);
      if (code) break;

      if (attempt < 3) {
        try {
          const { data } = await axios.get(`${VPS_URL}/status/${jobId}`, {
            headers: { 'x-bot-secret': BOT_SECRET }, timeout: 8000,
          });
          if (data.status !== 'waiting_otp') { log(tag, `Job não espera mais OTP — abort`); return; }
        } catch {}
        log(tag, 'Sem código — aguardando 20s...');
        await sleep(20000);
      }
    }

    if (!code) {
      log(tag, 'Código não encontrado');
      cooldown.set(jobId, Date.now() + COOLDOWN_MS);
      return;
    }

    await deliverCode(jobId, code);
    delivered.add(jobId);
    log(tag, `OTP ${code} entregue ao VPS`);

  } catch (e) {
    log(tag, `Erro: ${e.message.slice(0, 100)}`);
    cooldown.set(jobId, Date.now() + COOLDOWN_MS);
  } finally {
    if (browser) await browser.close().catch(() => {});
    activeJobs.delete(jobId);
  }
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

async function pollOnce() {
  let jobList;
  try {
    const { data } = await axios.get(`${VPS_URL}/jobs`, {
      headers: { 'x-bot-secret': BOT_SECRET }, timeout: 10000,
    });
    jobList = data;
  } catch (e) { log('poll', `VPS inacessível: ${e.message}`); return; }

  const waiting = jobList.filter(j => j.status === 'waiting_otp');
  if (waiting.length === 0) { log('poll', `${jobList.length} job(s) — nenhum aguarda OTP`); return; }

  log('poll', `${waiting.length} aguardando OTP | active=${activeJobs.size}`);

  for (const job of waiting) {
    if (delivered.has(job.id))  continue;
    if (activeJobs.has(job.id)) continue;
    const cd = cooldown.get(job.id);
    if (cd && Date.now() < cd)  continue;
    if (activeJobs.size >= MAX_CONCURRENT) break;

    activeJobs.set(job.id, Date.now());
    handleJob(job).catch(e => {
      log('poll', `crash: ${e.message}`);
      activeJobs.delete(job.id);
      cooldown.set(job.id, Date.now() + COOLDOWN_MS);
    });
  }
}

async function main() {
  log('helper', `Iniciado — VPS: ${VPS_URL} | ${ACCOUNTS.length} contas`);
  log('helper', `Poll a cada ${POLL_INTERVAL_MS / 1000}s | MAX_CONCURRENT=${MAX_CONCURRENT}`);
  while (true) { await pollOnce(); await sleep(POLL_INTERVAL_MS); }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
