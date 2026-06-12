'use strict';

/**
 * OTP Helper — runs on your LOCAL PC
 * Logs into Outlook for each email account, watches for Instagram OTP emails,
 * and automatically delivers the code to the VPS bot via API.
 *
 * Usage:
 *   cd otp-helper && npm install && node index.js
 */

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

puppeteerExtra.use(StealthPlugin());

const VPS_URL = process.env.VPS_URL || 'http://147.182.218.81:3001';
const BOT_SECRET = process.env.BOT_SECRET;
if (!BOT_SECRET) { console.error('ERROR: set BOT_SECRET env var'); process.exit(1); }
const SCAN_INTERVAL_MS = 20000; // scan every 20s

// ── Load accounts from accounts.json (never commit that file) ─────────────────
let ACCOUNTS;
try {
  ACCOUNTS = require('./accounts.json');
} catch {
  console.error('ERROR: accounts.json not found. Copy accounts.example.json to accounts.json and fill in your credentials.');
  process.exit(1);
}
// ──────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deliveredKeys = new Set(); // "jobId:code" — prevent double-delivery

function log(prefix, msg) {
  console.log(`${new Date().toISOString().slice(11, 19)} [${prefix}] ${msg}`);
}

// ── Outlook login ──────────────────────────────────────────────────────────────

async function loginOutlook(page, email, password) {
  const tag = email.split('@')[0].slice(0, 12);
  log(tag, 'Logging into Outlook...');

  await page.goto('https://outlook.live.com/mail/0/inbox', {
    waitUntil: 'domcontentloaded', timeout: 35000,
  }).catch(() => {});

  for (let step = 0; step < 22; step++) {
    await sleep(2500);
    const url = page.url();
    log(tag, `step=${step} ${url.split('?')[0]}`);

    if (url.includes('outlook.live.com/mail')) {
      log(tag, 'Logged in OK');
      await sleep(5000);
      return true;
    }

    // Security / proofs page
    if (/account\.live\.com\/(proofs|recover|resproof)/i.test(url)) {
      let skipped = false;
      try {
        const els = await page.$$('a, button');
        for (const el of els) {
          const txt = await el.evaluate((e) => (e.textContent || '').trim()).catch(() => '');
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

    if (step >= 12) {
      log(tag, 'Forcing navigation to inbox...');
      await page.goto('https://outlook.live.com/mail/0/inbox', {
        waitUntil: 'domcontentloaded', timeout: 25000,
      }).catch(() => {});
      await sleep(5000);
      if (page.url().includes('outlook.live.com/mail')) return true;
    }
  }

  log(tag, 'Login failed — will skip this account');
  return false;
}

// ── Scan inbox / junk for Instagram OTP ───────────────────────────────────────

async function scanForCode(page, email) {
  const tag = email.split('@')[0].slice(0, 12);
  const folders = [
    'https://outlook.live.com/mail/0/inbox',
    'https://outlook.live.com/mail/0/junkemail',
  ];

  for (const folderUrl of folders) {
    try {
      await page.goto(folderUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(5000); // let SPA render email list

      // Fast path: OTP visible in subject/preview lines
      const pageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
      const quick = pageText.match(/instagram[^\n]{0,200}(\d{6})|(\d{6})[^\n]{0,100}instagram/i);
      if (quick) {
        const code = quick[1] || quick[2];
        log(tag, `Code in list view (${folderUrl.split('/').pop()}): ${code}`);
        return code;
      }

      // Slow path: open each Instagram email row
      const rows = await page.$$('[role="option"], [role="listitem"]');
      for (const row of rows.slice(0, 15)) {
        const rowText = await row.evaluate((el) => el.textContent || '').catch(() => '');
        if (/instagram/i.test(rowText)) {
          await row.click().catch(() => {});
          await sleep(3000);
          const bodyText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
          const m = bodyText.match(/\b(\d{6})\b/);
          if (m) { log(tag, `Code in email body: ${m[1]}`); return m[1]; }
        }
      }
    } catch (e) {
      log(tag, `Scan error (${folderUrl.split('/').pop()}): ${e.message}`);
    }
  }
  return null;
}

// ── Deliver OTP to VPS ─────────────────────────────────────────────────────────

async function deliverCode(email, code) {
  const tag = email.split('@')[0].slice(0, 12);
  try {
    // Find the waiting job for this email
    const { data: jobList } = await axios.get(`${VPS_URL}/jobs`, {
      headers: { 'x-bot-secret': BOT_SECRET },
      timeout: 10000,
    });

    const job = jobList.find((j) => j.email === email && j.status === 'waiting_otp');
    if (!job) {
      log(tag, `Code ${code} found but no waiting_otp job for this email`);
      return;
    }

    const key = `${job.id}:${code}`;
    if (deliveredKeys.has(key)) return; // already sent
    deliveredKeys.add(key);

    await axios.post(
      `${VPS_URL}/provide-otp/${job.id}`,
      { code },
      { headers: { 'x-bot-secret': BOT_SECRET, 'Content-Type': 'application/json' }, timeout: 10000 }
    );

    log(tag, `Delivered OTP ${code} to job ${job.id.slice(0, 8)}`);
  } catch (e) {
    log(tag, `Delivery error: ${e.message}`);
  }
}

// ── Main loop ──────────────────────────────────────────────────────────────────

async function main() {
  log('helper', `Starting — VPS: ${VPS_URL} | ${ACCOUNTS.length} accounts`);

  const browser = await puppeteerExtra.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  // Login to all accounts upfront, keep pages open
  const sessions = [];
  for (const acc of ACCOUNTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    const ok = await loginOutlook(page, acc.email, acc.password);
    sessions.push({ ...acc, page, loggedIn: ok });
    await sleep(1500); // stagger logins
  }

  const ready = sessions.filter((s) => s.loggedIn).length;
  log('helper', `Ready. ${ready}/${ACCOUNTS.length} accounts logged in. Scanning every ${SCAN_INTERVAL_MS / 1000}s...`);

  if (ready === 0) {
    log('helper', 'No accounts logged in — check credentials or run headless: false to debug');
    await browser.close();
    process.exit(1);
  }

  // Continuous scan loop
  while (true) {
    for (const session of sessions) {
      if (!session.loggedIn) continue;
      try {
        const code = await scanForCode(session.page, session.email);
        if (code) await deliverCode(session.email, code);
      } catch (e) {
        log(session.email.split('@')[0].slice(0, 12), `Loop error: ${e.message}`);
      }
    }
    log('helper', `Scan done. Next in ${SCAN_INTERVAL_MS / 1000}s...`);
    await sleep(SCAN_INTERVAL_MS);
  }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
