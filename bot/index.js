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

function authMiddleware(req, res, next) {
  if (req.headers['x-bot-secret'] !== BOT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function log(jobId, msg) {
  const line = `${new Date().toISOString()} ${msg}`;
  console.log(`[${jobId.slice(0, 8)}] ${msg}`);
  if (jobs[jobId]) jobs[jobId].logs.push(line);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Outlook helpers ────────────────────────────────────────────────────────────

async function loginOutlook(page, email, password) {
  log('outlook', `Logging in as ${email}...`);
  await page.goto('https://outlook.live.com/mail/0/', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  await sleep(1500);

  // Already logged in
  if (page.url().includes('/mail/0/')) {
    const body = await page.content();
    if (!body.includes('Sign in') && !body.includes('Entrar')) return;
  }

  // Click sign in if on landing page
  try {
    const signIn = await page.$('a[data-task="signin"], [aria-label="Sign in"], a[href*="login.live.com"]');
    if (signIn) { await signIn.click(); await sleep(2500); }
  } catch {}

  const emailInput = await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await emailInput.type(email, { delay: 70 });
  await page.keyboard.press('Enter');
  await sleep(2000);

  const passInput = await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await passInput.type(password, { delay: 70 });
  await page.keyboard.press('Enter');
  await sleep(4000);

  // "Stay signed in?" — click No
  try {
    const noBtn = await page.$('#idBtn_Back');
    if (noBtn) { await noBtn.click(); await sleep(2000); }
  } catch {}
}

async function scanOutlookForCode(page) {
  // Check Inbox, Other, Junk for a 6-digit Instagram code
  const folderSelectors = [
    '[aria-label="Inbox, Primary"], [title="Inbox"], [aria-label="Inbox"]',
    '[aria-label="Other"], [title="Other"]',
    '[aria-label="Junk Email"], [title="Junk Email"]',
  ];

  for (const folderSel of folderSelectors) {
    try {
      const folderBtn = await page.$(folderSel);
      if (folderBtn) {
        await folderBtn.click();
        await sleep(1500);
      }
    } catch {}

    const rows = await page.$$('[role="option"], [data-convid], [data-itemid]');
    for (const row of rows) {
      const text = await row.evaluate((el) => el.textContent).catch(() => '');
      if (/instagram/i.test(text)) {
        await row.click();
        await sleep(2000);

        const bodyText = await page.evaluate(() => document.body.innerText);
        const m = bodyText.match(/\b(\d{6})\b/);
        if (m) return m[1];
      }
    }
  }
  return null;
}

async function waitForEmailOtp(jobId, emailPage, maxWait = 180000) {
  log(jobId, 'Waiting for Instagram verification email in Outlook...');
  const deadline = Date.now() + maxWait;

  while (Date.now() < deadline) {
    await sleep(7000);
    try {
      await emailPage.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      const code = await scanOutlookForCode(emailPage);
      if (code) {
        log(jobId, `Email OTP found: ${code}`);
        return code;
      }
      log(jobId, 'OTP not found yet, retrying...');
    } catch (e) {
      log(jobId, `Outlook scan error: ${e.message}`);
    }
  }
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

// ── Main bot flow ──────────────────────────────────────────────────────────────

async function runJob(job) {
  const { id, email, emailPassword, proxyUser, proxyPass, noProxy } = job;

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--window-size=390,844',
  ];
  if (!noProxy) args.push('--proxy-server=http://gw.dataimpulse.com:823');

  const browser = await puppeteerExtra.launch({
    headless: true,
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });

  // Open Outlook in a separate browser (no proxy — direct access to read email)
  const emailBrowser = await puppeteerExtra.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  try {
    // ── Login to Outlook first (in background) ──
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
    await sleep(2500);

    // Accept cookies if shown
    try {
      const btns = await page.$$('button');
      for (const btn of btns) {
        const t = await btn.evaluate((el) => el.textContent);
        if (/allow|accept|aceitar/i.test(t)) { await btn.click(); await sleep(1000); break; }
      }
    } catch {}

    // ── Step 1: Fill signup form ──
    log(id, 'Filling signup form...');
    await page.waitForSelector('input[name="emailOrPhone"]', { timeout: 20000 });

    await typeInto(page, 'input[name="emailOrPhone"]', email);
    await sleep(500);
    await typeInto(page, 'input[name="fullName"]', deriveName(email));
    await sleep(400);
    await typeInto(page, 'input[name="username"]', deriveUsername(email));
    await sleep(400);
    await typeInto(page, 'input[name="password"]', emailPassword);
    await sleep(600);

    log(id, 'Submitting form...');
    await clickButton(page, 'button[type="submit"]');
    await sleep(4000);

    // ── Step 2: Birthday ──
    try {
      await page.waitForSelector('select[title="Month:"]', { timeout: 8000 });
      log(id, 'Filling birthday...');
      await page.select('select[title="Month:"]', '6');
      await page.select('select[title="Day:"]', '15');
      await page.select('select[title="Year:"]', '1995');
      await sleep(600);
      await clickButton(page, ['button[type="submit"]', 'button[type="button"]']);
      await sleep(3500);
    } catch {
      log(id, 'Birthday step not shown.');
    }

    // ── Step 3: Check what verification Instagram requires ──
    const content = await page.content();

    // If Instagram switched to phone number form
    if (/type="tel"|name="phoneNumber"|phone number|número de telefone|add.*phone/i.test(content)) {
      // Try to skip / use email instead
      log(id, 'Instagram asked for phone — trying to switch to email verification...');
      try {
        const switchLink = await page.$('a[href*="email"], button');
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
      log(id, 'Instagram requires email verification code...');
      const otp = await waitForEmailOtp(id, emailPage);

      log(id, `Entering OTP: ${otp}`);
      await typeInto(
        page,
        'input[name="confirmationCode"], input[name="verificationCode"], input[aria-label*="code"], input[aria-label*="código"]',
        otp
      );
      await sleep(500);
      await clickButton(page, ['button[type="submit"]']);
      await sleep(4000);
    }

    // ── Step 5: Terms / extra steps ──
    for (let i = 0; i < 3; i++) {
      const c = await page.content();
      if (/terms|termos|agree|concordo/i.test(c)) {
        log(id, 'Accepting terms...');
        await clickButton(page, ['button[type="submit"]', 'button[type="button"]']);
        await sleep(2500);
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
    await emailBrowser.close().catch(() => {});
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

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Bot listening on :${PORT}`));
