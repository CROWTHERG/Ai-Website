// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 0 * * *'; // daily at 00:00 UTC
const RUN_ON_START = (process.env.RUN_ON_START || 'true').toLowerCase() === 'true';

const SITE_DIR = path.join(process.cwd(), 'site');
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ai.log');
const AI_SCRIPT = path.join(process.cwd(), 'ai_brain.js');

if (!fs.existsSync(SITE_DIR)) fs.mkdirSync(SITE_DIR, { recursive: true });
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function appendLog(line) {
  const time = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${time}] ${line}\n`);
  console.log(line);
}

app.use(express.static(SITE_DIR));

app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/logs', (req, res) => {
  if (!fs.existsSync(LOG_FILE)) return res.status(200).send('No logs yet.');
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  res.type('text/plain').send(content.split('\n').slice(-500).join('\n'));
});

app.all(['/run-ai', '/run'], async (req, res) => {
  // token via header x-admin-token or ?token=
  const header = (req.headers['x-admin-token'] || '').toString();
  const token = header || (req.query && req.query.token ? req.query.token.toString() : '');
  if (!ADMIN_TOKEN) return res.status(403).json({ error: 'ADMIN_TOKEN not set on server.' });
  if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized - invalid token.' });

  appendLog('Manual AI run requested.');
  try {
    const result = await runAIProcess();
    appendLog('Manual run finished. exit=' + result.code);
    res.json({ ok: true, code: result.code, stdout_tail: result.stdout.slice(-2000) });
  } catch (err) {
    appendLog('Manual run failed: ' + String(err));
    res.status(500).json({ ok: false, error: String(err) });
  }
});

function runAIProcess() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(AI_SCRIPT)) return reject(new Error('ai_brain.js not found'));
    const child = spawn(process.execPath, [AI_SCRIPT], { env: process.env, cwd: process.cwd() });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => {
      const s = d.toString();
      stdout += s;
      appendLog('[ai] ' + s.replace(/\n/g, '\\n'));
    });
    child.stderr.on('data', d => {
      const s = d.toString();
      stderr += s;
      appendLog('[ai err] ' + s.replace(/\n/g, '\\n'));
    });
    child.on('error', err => reject(err));
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

app.listen(PORT, () => {
  appendLog(`Server started on port ${PORT}. Serving ./site`);
  // schedule
  try {
    cron.schedule(CRON_SCHEDULE, () => {
      appendLog('Scheduled AI run triggered.');
      runAIProcess().catch(e => appendLog('Scheduled run failed: ' + e));
    }, { scheduled: true, timezone: 'UTC' });
  } catch (e) {
    appendLog('Cron scheduling failed: ' + e + ' — you can call /run-ai manually.');
  }

  if (RUN_ON_START) {
    appendLog('RUN_ON_START enabled — launching initial AI run.');
    runAIProcess().catch(e => appendLog('Initial run error: ' + e));
  }
});

process.on('SIGINT', () => { appendLog('SIGINT'); process.exit(0); });
process.on('SIGTERM', () => { appendLog('SIGTERM'); process.exit(0); });