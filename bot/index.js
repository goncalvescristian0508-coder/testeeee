'use strict';

const express = require('express');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { ImapFlow } = require('imapflow');
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

// ── IMAP email OTP reader ──────────────────────────────────────────────────────

async function waitForEmailOtp(jobId, email, password, maxWait = 180000) {
  log(jobId, 'Waiting for Instagram OTP via IMAP...');
  const deadline = Date.now() + maxWait;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    // First attempt: wait 15s for email to arrive; after that 8s between tries
    await sleep(attempt === 1 ? 15000 : 8000);
    log(jobId, `IMAP scan attempt #${attempt}...`);

    const client = new ImapFlow({
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });

    try {
      await client.connect();

      const folders = ['INBOX', 'Junk'];
      for (const folder of folders) {
        try {
          await client.mailboxOpen(folder, { readOnly: true });
        } catch {
          continue;
        }

        // Search Instagram emails in the last 20 minutes
        const since = new Date(Date.now() - 20 * 60 * 1000);
        const uids = await client.search({ from: 'instagram', since }).catch(() => []);
        log(jobId, `IMAP ${folder}: ${uids.length} Instagram messages`);

        for (const uid of uids.slice(-5)) {
          let source = '';
          try {
            for await (const msg of client.fetch([uid], { source: true })) {
              source = msg.source.toString();
            }
          } catch {}
          const m = source.match(/\b(\d{6})\b/);
          if (m) {
            log(jobId, `OTP found via IMAP: ${m[1]}`);
            await client.logout().catch(() => {});
            return m[1];
          }
        }
      }

      await client.logout().catch(() => {});
      log(jobId, 'OTP not found yet, retrying...');
    } catch (e) {
      log(jobId, `IMAP error: ${e.message}`);
      await client.logout().catch(() => {});
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
  ];
  if (!noProxy) args.push('--proxy-server=http://gw.dataimpulse.com:823');

  const browser = await puppeteerExtra.launch({
    headless: true,
    args,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });

  try {
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

    // ── Step 1: Find the signup input (email or phone/email combined field) ──
    // Instagram uses a single input that accepts both email and phone
    log(id, `Page URL: ${page.url()}`);
    const EMAIL_SELS = [
      'input[name="emailOrPhone"]',
      'input[type="email"]',
      'input[name="email"]',
      'input[aria-label*="email" i]',
      'input[placeholder*="email" i]',
      'input[placeholder*="e-mail" i]',
      'input[type="tel"]',   // phone/email combined field
      'input[type="text"]',
    ];
    let emailEl = null;
    for (const sel of EMAIL_SELS) {
      emailEl = await page.$(sel).catch(() => null);
      if (emailEl) { log(id, `Signup input found: ${sel}`); break; }
    }

    if (!emailEl) {
      const inputsInfo = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input')).map(i =>
          `type=${i.type} name=${i.name} ph=${i.placeholder}`
        )
      ).catch(() => []);
      log(id, `No input found. All inputs: ${inputsInfo.join(' | ')}`);
      emailEl = await page.$('input:not([type="hidden"])').catch(() => null);
      if (!emailEl) throw new Error('Could not find signup input');
    }

    log(id, 'Typing email into signup input...');
    await emailEl.click({ clickCount: 3 });
    await emailEl.type(email, { delay: 70 });
    await sleep(500);

    // Fill name/username/password if visible (classic all-in-one form)
    await typeInto(page, 'input[name="fullName"], input[placeholder*="Full name" i], input[aria-label*="Full name" i]', deriveName(email));
    await sleep(400);
    await typeInto(page, 'input[name="username"], input[placeholder*="username" i], input[aria-label*="username" i]', deriveUsername(email));
    await sleep(400);
    await typeInto(page, 'input[name="password"], input[type="password"]', emailPassword);
    await sleep(600);

    log(id, 'Submitting signup form...');
    await clickButton(page, 'button[type="submit"]');
    await sleep(4000);

    // ── Step 3: Birthday ──
    await handleBirthday(id, page);

    // ── Step 4: Email OTP ──
    const otpContent = await page.content();
    const needsOtp = /confirmationCode|verificationCode|enter.*code|código|verification code/i.test(otpContent);

    if (needsOtp) {
      log(id, 'Instagram requires email OTP...');
      const otp = await waitForEmailOtp(id, email, emailPassword);

      log(id, `Entering OTP: ${otp}`);
      const otpSelectors = 'input[name="confirmationCode"], input[name="verificationCode"], input[aria-label*="code" i], input[aria-label*="código" i], input[autocomplete="one-time-code"]';
      const otpTyped = await typeInto(page, otpSelectors, otp);

      if (!otpTyped) {
        // Try any text/tel/number input — OTP fields often have maxLength 6 or no type restriction
        const inputs = await page.$$('input[type="text"], input[type="tel"], input[type="number"], input:not([type="hidden"])');
        for (const inp of inputs) {
          const info = await inp.evaluate((el) => ({ maxLen: el.maxLength, type: el.type, name: el.name }));
          if (info.maxLen === 6 || /code|verification|confirm/i.test(info.name)) {
            await inp.click({ clickCount: 3 });
            await inp.type(otp, { delay: 100 });
            log(id, `OTP entered via fallback (maxLen=${info.maxLen} name=${info.name})`);
            break;
          }
        }
        // Last resort: first visible non-hidden input
        if (!otpTyped) {
          const firstInp = await page.$('input:not([type="hidden"])');
          if (firstInp) {
            await firstInp.click({ clickCount: 3 });
            await firstInp.type(otp, { delay: 100 });
            log(id, 'OTP entered via first-input last-resort');
          }
        }
      }

      await sleep(500);
      await clickButton(page, ['button[type="submit"]']);
      await sleep(4000);
      log(id, `Post-OTP URL: ${page.url()}`);
    }

    // ── Step 5: Profile fields after OTP (some flows show them here) ──
    for (let i = 0; i < 3; i++) {
      const filled = await fillProfileFields(id, page, email, emailPassword);
      if (!filled) break;
      log(id, `Post-OTP profile fill ${i + 1} done. URL: ${page.url()}`);
      await handleBirthday(id, page);
    }

    // ── Step 6: Terms / extra screens (only if NOT on signup pages) ──
    for (let i = 0; i < 5; i++) {
      const stepUrl = page.url();
      const stepContent = await page.content();
      log(id, `Extra step ${i + 1}: URL=${stepUrl}`);

      // Don't loop on signup pages — we can't progress from there
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

    // ── Determine result ──
    const finalUrl = page.url();
    const finalContent = await page.content();
    log(id, `Finished. URL: ${finalUrl}`);

    // Check for actual account suspension (not just HTML "disabled" attribute)
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
