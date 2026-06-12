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

function log(jobId, msg) {
  const line = `${new Date().toISOString()} ${msg}`;
  console.log(`[${jobId.slice(0, 8)}] ${msg}`);
  if (jobs[jobId]) jobs[jobId].logs.push(line);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Outlook helpers ────────────────────────────────────────────────────────────

async function loginOutlook(page, email, password) {
  log('outlook', `Logging in as ${email}...`);

  await page.goto(
    `https://login.live.com/login.srf?wa=wsignin1.0&rpsnv=13&ct=1&rver=7.0.6737.0&wp=MBI_SSL&wreply=https%3A%2F%2Foutlook.live.com%2Fowa%2F&id=292841`,
    { waitUntil: 'networkidle2', timeout: 60000 }
  );
  await sleep(2000);

  if (page.url().includes('outlook.live.com/mail') || page.url().includes('outlook.live.com/owa')) {
    log('outlook', 'Already logged in.');
    return;
  }

  const emailInput = await page.waitForSelector('input[type="email"], input[name="loginfmt"]', { timeout: 20000 });
  await emailInput.click({ clickCount: 3 });
  await emailInput.type(email, { delay: 70 });
  await page.keyboard.press('Enter');
  await sleep(2500);

  const passInput = await page.waitForSelector('input[type="password"], input[name="passwd"]', { timeout: 15000 });
  await passInput.click({ clickCount: 3 });
  await passInput.type(password, { delay: 70 });
  await page.keyboard.press('Enter');
  await sleep(4000);

  // "Stay signed in?" → click No
  try {
    const noBtn = await page.$('#idBtn_Back');
    if (noBtn) { await noBtn.click(); await sleep(2000); }
  } catch {}

  // Skip any Microsoft security/proofs pages (add phone, add email, etc.)
  for (let i = 0; i < 4; i++) {
    await sleep(1500);
    const url = page.url();
    if (url.includes('outlook.live.com')) break;
    if (url.includes('account.live.com/proofs') || url.includes('account.live.com/security') || url.includes('login.live.com')) {
      log('outlook', `Skipping security page: ${url}`);
      // Try "Skip for now" / "I'll add it later" / "Cancel" links or buttons
      const skipped = await page.evaluate(() => {
        const texts = ['skip', 'later', 'cancel', 'not now', 'maybe later'];
        const els = Array.from(document.querySelectorAll('a, button, input[type="button"]'));
        for (const el of els) {
          if (texts.some(t => el.textContent.toLowerCase().includes(t))) {
            el.click();
            return el.textContent.trim();
          }
        }
        return null;
      });
      if (skipped) {
        log('outlook', `Clicked skip: "${skipped}"`);
      } else {
        // Navigate directly to inbox
        log('outlook', 'No skip button found — navigating directly to inbox');
        await page.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        break;
      }
    }
  }

  // Final fallback: go to inbox directly
  if (!page.url().includes('outlook.live.com')) {
    log('outlook', 'Forcing navigation to Outlook inbox');
    await page.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await sleep(3000);
  }

  log('outlook', `Outlook ready. URL: ${page.url()}`);
}

async function scanOutlookForCode(jobId, page) {
  log(jobId, 'scanOutlook: starting...');

  const folderSelectors = [
    '[aria-label="Inbox, Primary"], [title="Inbox"], [aria-label="Inbox"]',
    '[aria-label="Other"], [title="Other"]',
    '[aria-label="Junk Email"], [title="Junk Email"], [aria-label="Spam"]',
  ];

  for (const folderSel of folderSelectors) {
    log(jobId, `scanOutlook: trying folder "${folderSel}"...`);
    try {
      const folderBtn = await page.$(folderSel);
      if (!folderBtn) {
        log(jobId, 'scanOutlook: folder button not found, skipping');
        continue;
      }
      await folderBtn.click();
      await sleep(1500);
    } catch (e) {
      log(jobId, `scanOutlook: folder click error: ${e.message}`);
    }

    const rows = await page.$$('[role="option"], [data-convid], [data-itemid]');
    log(jobId, `scanOutlook: found ${rows.length} email rows`);

    for (const row of rows) {
      const text = await row.evaluate((el) => el.textContent).catch(() => '');
      if (/instagram/i.test(text)) {
        log(jobId, 'scanOutlook: found Instagram email, opening...');
        await row.click();
        await sleep(2000);

        const bodyText = await page.evaluate(() => document.body.innerText);
        const m = bodyText.match(/\b(\d{6})\b/);
        if (m) {
          log(jobId, `scanOutlook: OTP found: ${m[1]}`);
          return m[1];
        }
        log(jobId, 'scanOutlook: no 6-digit code in email body');
      }
    }
  }

  log(jobId, 'scanOutlook: no OTP found in any folder');
  return null;
}

async function waitForEmailOtp(jobId, emailPage, emailBrowser, maxWait = 180000) {
  log(jobId, 'Waiting for OTP in Outlook...');
  const deadline = Date.now() + maxWait;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    await sleep(7000);
    log(jobId, `OTP scan attempt #${attempt}...`);
    try {
      // Use domcontentloaded — faster than networkidle2 and avoids hanging
      await emailPage.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(2000);
      const code = await scanOutlookForCode(jobId, emailPage);
      if (code) {
        log(jobId, `OTP found: ${code} — closing email browser`);
        await emailBrowser.close().catch(() => {});
        return code;
      }
      log(jobId, 'OTP not found yet, retrying...');
    } catch (e) {
      log(jobId, `Outlook scan error: ${e.message}`);
    }
  }

  await emailBrowser.close().catch(() => {});
  throw new Error('Timeout waiting for email OTP');
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
    log(jobId, 'Filling birthday...');
    await page.select('select[title="Month:"]', '6');
    await page.select('select[title="Day:"]', '15');
    await page.select('select[title="Year:"]', '1995');
    await sleep(600);
    await clickButton(page, ['button[type="submit"]', 'button[type="button"]']);
    await sleep(3000);
    return true;
  } catch {
    return false;
  }
}

// Fill name/username/password if Instagram shows those fields (happens after OTP on some flows)
async function fillProfileFields(jobId, page, email, emailPassword) {
  const hasName = await typeInto(
    page,
    'input[name="fullName"], input[aria-label*="Full name" i], input[placeholder*="Full name" i], input[placeholder*="nome" i]',
    deriveName(email)
  );
  if (hasName) log(jobId, 'fillProfile: filled name');
  await sleep(300);

  const hasUser = await typeInto(
    page,
    'input[name="username"], input[aria-label*="username" i], input[placeholder*="username" i], input[placeholder*="usuário" i]',
    deriveUsername(email)
  );
  if (hasUser) log(jobId, 'fillProfile: filled username');
  await sleep(300);

  const hasPass = await typeInto(page, 'input[name="password"], input[type="password"]', emailPassword);
  if (hasPass) log(jobId, 'fillProfile: filled password');
  await sleep(300);

  if (hasName || hasUser || hasPass) {
    log(jobId, 'fillProfile: submitting...');
    await clickButton(page, 'button[type="submit"]');
    await sleep(3500);
    return true;
  }
  return false;
}

// ── Main bot flow ──────────────────────────────────────────────────────────────

async function runJob(job) {
  const { id, email, emailPassword, proxyUser, proxyPass, noProxy } = job;

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--window-size=390,844',
    '--disable-gpu',
    '--js-flags=--max-old-space-size=256',
  ];
  if (!noProxy) args.push('--proxy-server=http://gw.dataimpulse.com:823');

  const emailArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--js-flags=--max-old-space-size=256',
  ];

  const browser = await puppeteerExtra.launch({
    headless: true,
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });

  const emailBrowser = await puppeteerExtra.launch({
    headless: true,
    args: emailArgs,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  let emailBrowserClosed = false;

  try {
    // ── Login to Outlook ──
    log(id, 'Opening Outlook...');
    const emailPage = await emailBrowser.newPage();
    await emailPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await loginOutlook(emailPage, email, emailPassword);
    log(id, 'Outlook logged in.');

    // ── Open Instagram signup ──
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    );
    if (!noProxy) await page.authenticate({ username: proxyUser, password: proxyPass });

    log(id, 'Navigating to Instagram signup...');
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    await sleep(3000);

    log(id, `Page loaded: "${await page.title()}" | URL: ${page.url()}`);

    // Accept cookies if shown
    try {
      const btns = await page.$$('button');
      for (const btn of btns) {
        const t = await btn.evaluate((el) => el.textContent);
        if (/allow|accept|aceitar/i.test(t)) { await btn.click(); await sleep(1500); break; }
      }
    } catch {}

    // ── Step 1: Fill email field ──
    log(id, 'Looking for email field...');
    const emailFieldSelector = await page.evaluate(() => {
      const candidates = [
        'input[name="emailOrPhone"]',
        'input[type="email"]',
        'input[name="email"]',
        'input[aria-label*="email" i]',
        'input[placeholder*="email" i]',
        'input[placeholder*="Phone" i]',
        'input[placeholder*="celular" i]',
        'input[placeholder*="e-mail" i]',
      ];
      for (const sel of candidates) {
        if (document.querySelector(sel)) return sel;
      }
      return null;
    });

    log(id, `Email field: ${emailFieldSelector}`);

    if (emailFieldSelector) {
      await typeInto(page, emailFieldSelector, email);
    } else {
      await sleep(3000);
      const firstInput = await page.$('input:not([type="hidden"])');
      if (firstInput) {
        await firstInput.click({ clickCount: 3 });
        await firstInput.type(email, { delay: 70 });
      } else {
        throw new Error('Could not find email input on Instagram signup page');
      }
    }

    await sleep(500);

    // Fill profile fields if shown upfront (classic flow)
    await typeInto(page, 'input[name="fullName"], input[placeholder*="Full name" i], input[aria-label*="Full name" i]', deriveName(email));
    await sleep(400);
    await typeInto(page, 'input[name="username"], input[placeholder*="username" i], input[aria-label*="username" i]', deriveUsername(email));
    await sleep(400);
    await typeInto(page, 'input[name="password"], input[type="password"]', emailPassword);
    await sleep(600);

    log(id, 'Submitting initial form...');
    await clickButton(page, 'button[type="submit"]');
    await sleep(4000);

    // ── Step 2: Birthday ──
    await handleBirthday(id, page);

    // ── Step 3: Phone → switch to email ──
    const content = await page.content();
    if (/type="tel"|name="phoneNumber"|phone number|número de telefone/i.test(content)) {
      log(id, 'Phone asked — trying to switch to email verification...');
      try {
        const links = await page.$$('a, button');
        for (const link of links) {
          const t = await link.evaluate((el) => el.textContent);
          if (/email|e-mail/i.test(t)) { await link.click(); await sleep(2000); break; }
        }
      } catch {}
    }

    // ── Step 4: Email OTP ──
    const content2 = await page.content();
    const needsOtp = /confirmationCode|verificationCode|enter.*code|código|verification code/i.test(content2);

    if (needsOtp) {
      log(id, 'Instagram requires email OTP...');
      const otp = await waitForEmailOtp(id, emailPage, emailBrowser);
      emailBrowserClosed = true;

      log(id, `Entering OTP: ${otp}`);
      const otpTyped = await typeInto(
        page,
        'input[name="confirmationCode"], input[name="verificationCode"], input[aria-label*="code" i], input[aria-label*="código" i], input[autocomplete="one-time-code"]',
        otp
      );

      // Fallback: try any input with maxLength=6
      if (!otpTyped) {
        const inputs = await page.$$('input');
        for (const inp of inputs) {
          const maxLen = await inp.evaluate((el) => el.maxLength);
          if (maxLen === 6) {
            await inp.click({ clickCount: 3 });
            await inp.type(otp, { delay: 100 });
            log(id, 'OTP entered via maxLength=6 fallback');
            break;
          }
        }
      }

      await sleep(500);
      await clickButton(page, ['button[type="submit"]']);
      await sleep(4000);
      log(id, `Post-OTP URL: ${page.url()}`);
    }

    // ── Step 5: Profile fields that may appear AFTER OTP ──
    // Instagram sometimes shows name/username/password after email confirmation
    for (let i = 0; i < 3; i++) {
      const filled = await fillProfileFields(id, page, email, emailPassword);
      if (!filled) break;
      log(id, `Post-OTP profile fill round ${i + 1} done. URL: ${page.url()}`);
      await handleBirthday(id, page);
    }

    // ── Step 6: Terms / extra screens ──
    for (let i = 0; i < 5; i++) {
      const c = await page.content();
      log(id, `Extra step ${i + 1}: URL=${page.url()}`);
      if (/terms|termos|agree|concordo/i.test(c)) {
        log(id, 'Accepting terms...');
        await clickButton(page, ['button[type="submit"]', 'button[type="button"]']);
        await sleep(2500);
      } else if (/birthday|aniversário|birth date/i.test(c)) {
        await handleBirthday(id, page);
      } else {
        break;
      }
    }

    // ── Determine result ──
    const finalUrl = page.url();
    const finalContent = await page.content();
    log(id, `Finished. URL: ${finalUrl}`);

    if (/suspended|disabled|violated|desativad/i.test(finalContent)) {
      job.status = 'suspended';
    } else if (/signup|emailsignup|error/i.test(finalUrl)) {
      job.status = 'error';
      job.error = 'Still on signup page — creation may have failed';
    } else {
      job.status = 'done';
      log(id, 'Account created successfully!');
    }
    job.instagramUrl = finalUrl;

  } catch (err) {
    log(id, `FATAL: ${err.message}`);
    job.status = 'error';
    job.error = err.message;
  } finally {
    await browser.close().catch(() => {});
    if (!emailBrowserClosed) await emailBrowser.close().catch(() => {});
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────────

app.post('/create-account', authMiddleware, (req, res) => {
  const { email, emailPassword, proxyUser, proxyPass, noProxy } = req.body;
  if (!email || !emailPassword) {
    return res.status(400).json({ error: 'email and emailPassword are required' });
  }

  const id = uuidv4();
  const job = {
    id,
    email,
    emailPassword,
    proxyUser: proxyUser || DEFAULT_PROXY_USER,
    proxyPass: proxyPass || DEFAULT_PROXY_PASS,
    noProxy: Boolean(noProxy),
    status: 'running',
    instagramUrl: null,
    error: null,
    logs: [],
    createdAt: new Date().toISOString(),
  };
  jobs[id] = job;

  runJob(job).catch(console.error);

  res.json({ jobId: id, statusUrl: `/status/${id}` });
});

app.get('/status/:id', authMiddleware, (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const { emailPassword, ...safe } = job;
  res.json(safe);
});

app.get('/jobs', authMiddleware, (req, res) => {
  res.json(
    Object.values(jobs).map(({ id, email, status, createdAt, instagramUrl, error }) => ({
      id, email, status, createdAt, instagramUrl, error,
    }))
  );
});

app.get('/health', (_req, res) => res.json({ ok: true, activeJobs: Object.keys(jobs).length }));

function authMiddleware(req, res, next) {
  if (req.headers['x-bot-secret'] !== BOT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Bot listening on :${PORT}`));
