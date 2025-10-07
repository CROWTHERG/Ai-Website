// server.js — serves site, websockets for live AI thinking, scheduled runs
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');
const cron = require('node-cron');

const PORT = process.env.PORT || 3000;
const AI_SCRIPT = path.join(process.cwd(), 'ai_brain.js');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const app = express();
app.use(express.static(process.cwd()));

// simple health
app.get('/health', (req,res)=> res.json({status:'ok', timestamp: new Date().toISOString()}));

// manual run (POST recommended) — provide x-admin-token header or ?token=
app.post('/run-ai', (req,res)=>{
  const token = (req.headers['x-admin-token'] || req.query.token || '');
  if(ADMIN_TOKEN && token !== ADMIN_TOKEN) return res.status(401).json({error:'Unauthorized'});
  runAIProcess().then(o=>res.json({ok:true, code:o.code})).catch(e=>res.status(500).json({ok:false, error:e.message}));
});

// websocket server for live thinking
const server = app.listen(PORT, ()=> console.log(`Server listening on port ${PORT}`));
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);
  ws.send(JSON.stringify({type:'info', text:'Connected to Aurora AI'}));
  ws.on('close', ()=> clients.delete(ws));
});

function broadcast(type, text){
  const msg = JSON.stringify({type, text});
  for(const c of clients){ if(c.readyState === 1) c.send(msg); }
}

// spawn ai_brain.js and stream stdout lines as 'thinking' events; on close broadcast 'update'
function runAIProcess(){
  return new Promise((resolve,reject)=>{
    if(!fs.existsSync(AI_SCRIPT)) return reject(new Error('ai_brain.js missing'));
    const child = spawn(process.execPath, [AI_SCRIPT], { env: process.env, cwd: process.cwd() });

    child.stdout.on('data', chunk => {
      const s = String(chunk);
      // break into lines, broadcast each non-empty
      s.split(/\r?\n/).filter(Boolean).forEach(line=>{
        console.log('[AI]', line);
        broadcast('thinking', line);
      });
    });
    child.stderr.on('data', chunk => {
      const s = String(chunk).trim();
      console.error('[AI-ERR]', s);
      broadcast('thinking', `[AI-ERR] ${s}`);
    });
    child.on('close', code => {
      console.log('AI process exited', code);
      broadcast('update', 'AI finished update');
      resolve({code});
    });
    child.on('error', err => reject(err));
  });
}

// schedule cron: default every 3 hours; respect CRON_SCHEDULE env var
const CRON = process.env.CRON_SCHEDULE || '0 */3 * * *';
cron.schedule(CRON, ()=>{
  console.log('Scheduled AI run triggered');
  runAIProcess().catch(e=>console.error('Scheduled run failed:', e));
},{timezone:'UTC'});

// initial run at startup
runAIProcess().catch(e=>console.error('Initial AI run failed:', e));