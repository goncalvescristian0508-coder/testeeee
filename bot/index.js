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

// ── Wait for OTP delivered externally (by otp-helper running on local PC) ─────

async function waitForOtp(jobId, maxWait = 300000) {
  log(jobId, 'Waiting for OTP — ensure otp-helper.js is running on your PC');
  jobs[jobId].status = 'waiting_otp';

  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    if (jobs[jobId].pendingOtp) {
      const code = jobs[jobId].pendingOtp;
      jobs[jobId].pendingOtp = null;
      jobs[jobId].status = 'running';
      log(jobId, `OTP received: ${code}`);
      return code;
    }
    await sleep(2000);
  }

  throw new Error('Timeout waiting for OTP (5 min). Is otp-helper running?');
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
  ];
  if (!noProxy) args.push('--proxy-server=http://gw.dataimpulse.com:823');

  const browser = await puppeteerExtra.launch({
    headless: true,
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    );
    if (!noProxy) await page.authenticate({ username: proxyUser, password: proxyPass });

    // ── Instagram signup ──
    log(id, 'Navigating to Instagram signup...');
    await page.goto('https://www.instagram.com/accounts/emailsignup/', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    await sleep(3000);

    log(id, `Page loaded: "${await page.title()}" | URL: ${page.url()}`);

    // Accept cookies
    try {
      const btns = await page.$$('button');
      for (const btn of btns) {
        const t = await btn.evaluate((el) => el.textContent);
        if (/allow|accept|aceitar/i.test(t)) { await btn.click(); await sleep(1500); break; }
      }
    } catch {}

    // Find signup input (Instagram uses type="tel" that also accepts email)
    const EMAIL_SELS = [
      'input[name="emailOrPhone"]',
      'input[type="email"]',
      'input[name="email"]',
      'input[aria-label*="email" i]',
      'input[placeholder*="email" i]',
      'input[placeholder*="e-mail" i]',
      'input[type="tel"]',
      'input[type="text"]',
    ];
    let emailEl = null;
    for (const sel of EMAIL_SELS) {
      emailEl = await page.$(sel).catch(() => null);
      if (emailEl) { log(id, `Signup input: ${sel}`); break; }
    }
    if (!emailEl) {
      const allInputs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input')).map((i) =>
          `type=${i.type} name=${i.name} ph=${i.placeholder}`
        )
      ).catch(() => []);
      log(id, `No input found. Inputs: ${allInputs.join(' | ')}`);
      emailEl = await page.$('input:not([type="hidden"])').catch(() => null);
      if (!emailEl) throw new Error('Could not find signup input');
    }

    log(id, 'Typing email...');
    await emailEl.click({ clickCount: 3 });
    await emailEl.type(email, { delay: 70 });
    await sleep(500);

    // Fill other fields if already visible
    await typeInto(page, 'input[name="fullName"], input[placeholder*="Full name" i], input[aria-label*="Full name" i]', deriveName(email));
    await sleep(400);
    await typeInto(page, 'input[name="username"], input[placeholder*="username" i], input[aria-label*="username" i]', deriveUsername(email));
    await sleep(400);
    await typeInto(page, 'input[name="password"], input[type="password"]', emailPassword);
    await sleep(600);

    log(id, 'Submitting signup form...');
    await clickButton(page, 'button[type="submit"]');
    await sleep(4000);

    await handleBirthday(id, page);

    // ── OTP ──
    const otpContent = await page.content();
    const needsOtp = /confirmationCode|verificationCode|enter.*code|código|verification code/i.test(otpContent);

    if (needsOtp) {
      log(id, 'Instagram requires email OTP...');
      const otp = await waitForOtp(id);

      log(id, `Entering OTP: ${otp}`);
      const otpSel = 'input[name="confirmationCode"], input[name="verificationCode"], input[aria-label*="code" i], input[aria-label*="código" i], input[autocomplete="one-time-code"]';
      const typed = await typeInto(page, otpSel, otp);

      if (!typed) {
        const inputs = await page.$$('input[type="text"], input[type="tel"], input[type="number"], input:not([type="hidden"])');
        for (const inp of inputs) {
          const info = await inp.evaluate((el) => ({ maxLen: el.maxLength, name: el.name }));
          if (info.maxLen === 6 || /code|verification|confirm/i.test(info.name)) {
            await inp.click({ clickCount: 3 });
            await inp.type(otp, { delay: 100 });
            log(id, `OTP via fallback (name=${info.name})`);
            break;
          }
        }
        if (!typed) {
          const first = await page.$('input:not([type="hidden"])');
          if (first) { await first.click({ clickCount: 3 }); await first.type(otp, { delay: 100 }); }
        }
      }

      await sleep(500);
      await clickButton(page, ['button[type="submit"]']);
      await sleep(4000);
      log(id, `Post-OTP URL: ${page.url()}`);
    }

    // ── Post-OTP profile fields ──
    for (let i = 0; i < 3; i++) {
      const filled = await fillProfileFields(id, page, email, emailPassword);
      if (!filled) break;
      log(id, `Profile fill ${i + 1} done. URL: ${page.url()}`);
      await handleBirthday(id, page);
    }

    // ── Extra screens (terms, etc.) ──
    for (let i = 0; i < 5; i++) {
      const stepUrl = page.url();
      const stepContent = await page.content();
      log(id, `Extra step ${i + 1}: URL=${stepUrl}`);
      if (/accounts\/signup|accounts\/emailsignup/i.test(stepUrl)) break;
      if (/\bterms\b|\btermos\b|\bagree\b|\bconcordo\b/i.test(stepContent)) {
        log(id, 'Accepting terms...');
        await clickButton(page, ['button[type="submit"]', 'button[type="button"]']);
        await sleep(2500);
      } else if (/birthday|aniversário|birth date/i.test(stepContent)) {
        await handleBirthday(id, page);
      } else {
        break;
      }
    }

    // ── Result ──
    const finalUrl = page.url();
    const finalContent = await page.content();
    log(id, `Finished. URL: ${finalUrl}`);

    if (/your account has been (suspended|disabled)|conta.*suspensa|conta.*desativad/i.test(finalContent)) {
      job.status = 'suspended';
    } else if (/accounts\/signup|accounts\/emailsignup/i.test(finalUrl)) {
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

// Called by otp-helper.js running on local PC
app.post('/provide-otp/:id', authMiddleware, (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'waiting_otp') return res.status(409).json({ error: `Job not waiting for OTP (status: ${job.status})` });

  const { code } = req.body;
  if (!code || !/^\d{6}$/.test(String(code))) {
    return res.status(400).json({ error: 'Invalid code — must be 6 digits' });
  }

  job.pendingOtp = String(code);
  log(job.id, `OTP provided via API: ${code}`);
  res.json({ ok: true, jobId: job.id });
});

app.get('/status/:id', authMiddleware, (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job not found' });
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

app.get('/health', (_req, res) => res.json({ ok: true, activeJobs: Object.keys(jobs).length }));

function authMiddleware(req, res, next) {
  if (req.headers['x-bot-secret'] !== BOT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Bot listening on :${PORT}`));
