// server.js - Autonomous AI full deployment
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''; // optional
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 0 * * *'; // daily UTC

// API keys: pick up from environment variables
const COHERE_KEY = process.env.COHERE_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

// Paths
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ai.log');
const AI_SCRIPT = path.join(process.cwd(), 'ai_brain.js');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// --- Logging ---
function appendLog(text){
  const stamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${stamp}] ${text}\n`);
  console.log(`[${stamp}] ${text}`);
}

// --- Serve static site ---
app.use(express.static(process.cwd()));

// --- Health check ---
app.get('/health', (req,res) => res.json({status:'ok', timestamp:new Date().toISOString()}));

// --- Log viewer ---
app.get('/logs', (req,res)=>{
  if(!fs.existsSync(LOG_FILE)) return res.send('No logs yet.');
  const data = fs.readFileSync(LOG_FILE,'utf8');
  const lines = data.trim().split('\n');
  res.type('text/plain').send(lines.slice(-200).join('\n'));
});

// --- Trigger AI run manually ---
app.all(['/run-ai','/run'], async (req,res)=>{
  const token = (req.headers['x-admin-token'] || req.query.token || '').toString();
  if(ADMIN_TOKEN && token !== ADMIN_TOKEN) return res.status(401).json({error:'Unauthorized'});

  appendLog('Manual AI run triggered.');
  try{
    const result = await runAIProcess();
    res.json({ok:true, output: result.stdout.slice(-10000), exitCode: result.code});
  }catch(e){
    appendLog('Manual run error: '+e.message);
    res.status(500).json({ok:false, error:e.message});
  }
});

// --- Run ai_brain.js as child process ---
function runAIProcess(){
  return new Promise((resolve,reject)=>{
    if(!fs.existsSync(AI_SCRIPT)) return reject(new Error('ai_brain.js missing'));

    // Pass API keys and MODE to child
    const env = {
      ...process.env,
      COHERE_API_KEY: COHERE_KEY,
      OPENAI_API_KEY: OPENAI_KEY,
      MODE: process.env.MODE || 'simulate' // fallback to simulate
    };

    const child = spawn(process.execPath, [AI_SCRIPT], { env, cwd: process.cwd() });

    let stdout=''; let stderr='';

    child.stdout.on('data', d=>{
      stdout+=d.toString();
      appendLog('[stdout] '+d.toString().replace(/\n/g,'\\n'));
    });

    child.stderr.on('data', d=>{
      stderr+=d.toString();
      appendLog('[stderr] '+d.toString().replace(/\n/g,'\\n'));
    });

    child.on('close', code=>{
      appendLog('AI process exited with code '+code);
      resolve({code, stdout, stderr});
    });

    child.on('error', err => reject(err));
  });
}

// --- Server start ---
const server = app.listen(PORT, ()=>{
  appendLog(`Server running on port ${PORT}`);

  // --- Scheduled daily AI run ---
  cron.schedule(CRON_SCHEDULE, ()=>{
    appendLog('Scheduled AI run started');
    runAIProcess().catch(e => appendLog('Scheduled AI run error: '+e.message));
  }, { scheduled:true, timezone:'UTC' });

  // --- First-run AI initialization ---
  appendLog('Starting first-run AI initialization...');
  runAIProcess().catch(e => appendLog('Initial AI run error: '+e.message));
});

// --- Graceful shutdown ---
process.on('SIGINT', ()=>server.close(()=>process.exit(0)));
process.on('SIGTERM', ()=>server.close(()=>process.exit(0)));
