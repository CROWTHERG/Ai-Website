// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');
const cron = require('node-cron');

const PORT = process.env.PORT || 3000;
const AI_SCRIPT = path.join(process.cwd(), 'ai_brain.js');
const LOG_FILE = path.join(process.cwd(), 'logs.txt');

function log(msg){
  const t = new Date().toISOString();
  try { fs.appendFileSync(LOG_FILE, `[${t}] ${msg}\n`); } catch {}
  console.log(msg);
}

const app = express();
app.use(express.static(process.cwd()));

// start server
const server = app.listen(PORT, () => {
  log(`Server listening on port ${PORT}`);
});

// WebSocket server for live AI thinking
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'info', text: 'Connected to Aurora AI' }));
  ws.on('close', ()=> clients.delete(ws));
});

// broadcast helper
function broadcast(type, text){
  const msg = JSON.stringify({ type, text });
  for(const c of clients){
    if(c.readyState === 1) c.send(msg);
  }
}

// Run AI child process and stream stdout lines as thinking
function runAIProcess(){
  return new Promise((resolve, reject) => {
    if(!fs.existsSync(AI_SCRIPT)) return reject(new Error('ai_brain.js missing'));
    const child = spawn(process.execPath, [AI_SCRIPT], { cwd: process.cwd(), env: process.env });

    child.stdout.on('data', chunk => {
      const s = chunk.toString();
      // break into lines and broadcast each non-empty
      s.split(/\r?\n/).filter(Boolean).forEach(line=>{
        log('[AI] ' + line);
        broadcast('thinking', line);
      });
    });

    child.stderr.on('data', chunk => {
      const s = chunk.toString();
      log('[AI-ERR] ' + s.trim());
      broadcast('thinking', `[AI-ERR] ${s.trim()}`);
    });

    child.on('close', code => {
      log(`AI process exited with code ${code}`);
      broadcast('update', 'AI finished update');
      resolve(code);
    });

    child.on('error', err => {
      log('AI spawn error: ' + err.message);
      reject(err);
    });
  });
}

// Manual run endpoint (POST) with optional ADMIN_TOKEN header 'x-admin-token'
app.post('/run-ai', (req, res) => {
  const token = req.headers['x-admin-token'] || req.query.token || '';
  if(process.env.ADMIN_TOKEN && token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  log('Manual AI run requested');
  runAIProcess().then(code => res.json({ ok: true, code })).catch(err => res.status(500).json({ ok: false, error: err.message }));
});

// Schedule: every 3 hours at minute 0 (UTC)
const CRON = process.env.CRON_SCHEDULE || '0 */3 * * *';
cron.schedule(CRON, () => {
  log('Scheduled AI run triggered (every 3 hours)');
  runAIProcess().catch(e => log('Scheduled run error: ' + e.message));
}, { timezone: 'UTC' });

// initial run on startup
runAIProcess().catch(err => log('Initial AI run failed: ' + (err.message || err)));