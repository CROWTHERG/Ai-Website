const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cron = require('node-cron');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 0 * * *';
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ai.log');
const AI_SCRIPT = path.join(process.cwd(), 'ai_brain.js');
const VISITS_FILE = path.join(process.cwd(),'data','visits.json');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(VISITS_FILE))) fs.mkdirSync(path.dirname(VISITS_FILE), { recursive:true });

function appendLog(text){
  const stamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${stamp}] ${text}\n`);
}

// --- Middleware for sessions ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'autonomous-ai-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 5 * 60 * 1000 } // 5 minutes = "online"
}));

// Track visits
let totalVisits = 0;
try{
  const data = fs.readFileSync(VISITS_FILE,'utf8');
  totalVisits = JSON.parse(data).total || 0;
}catch(e){ totalVisits = 0; }

const onlineUsers = new Set();

// Middleware to track visits
app.use((req,res,next)=>{
  if(req.session){
    onlineUsers.add(req.session.id);
    req.session.touch();
  }
  if(req.session && !req.session.hasVisited){
    req.session.hasVisited = true;
    totalVisits++;
    fs.writeFileSync(VISITS_FILE, JSON.stringify({ total: totalVisits }, null, 2));
  }
  next();
});

// Serve static files
app.use(express.static(process.cwd()));

// Health check
app.get('/health', (req,res)=> res.json({status:'ok', timestamp:new Date().toISOString()}));

// Visitor stats API
app.get('/api/visitors', (req,res)=>{
  res.json({
    online: onlineUsers.size,
    total: totalVisits
  });
});

// Log viewer
app.get('/logs', (req,res)=>{
  if(!fs.existsSync(LOG_FILE)) return res.send('No logs yet.');
  const data = fs.readFileSync(LOG_FILE,'utf8');
  const lines = data.trim().split('\n');
  res.type('text/plain').send(lines.slice(-200).join('\n'));
});

// Trigger AI run (GET or POST)
app.all(['/run-ai','/run'], async (req,res)=>{
  const token = (req.headers['x-admin-token'] || req.query.token || '').toString();
  if(!ADMIN_TOKEN || token !== ADMIN_TOKEN) return res.status(401).json({error:'Unauthorized'});
  appendLog('Manual AI run triggered.');
  try{
    const result = await runAIProcess();
    res.json({ok:true, output: result.stdout.slice(-10000), exitCode: result.code});
  }catch(e){
    appendLog('Manual run error: '+e);
    res.status(500).json({ok:false, error:e.message});
  }
});

// Run ai_brain.js
function runAIProcess(){
  return new Promise((resolve,reject)=>{
    if(!fs.existsSync(AI_SCRIPT)) return reject(new Error('ai_brain.js missing'));
    const child = spawn(process.execPath,[AI_SCRIPT],{env:process.env,cwd:process.cwd()});
    let stdout=''; let stderr='';
    child.stdout.on('data', d=>{stdout+=d.toString(); appendLog('[stdout] '+d.toString().replace(/\n/g,'\\n'));});
    child.stderr.on('data', d=>{stderr+=d.toString(); appendLog('[stderr] '+d.toString().replace(/\n/g,'\\n'));});
    child.on('close', code=>{appendLog('AI process exited '+code); resolve({code, stdout, stderr});});
    child.on('error', err=>reject(err));
  });
}

// Start server
const server = app.listen(PORT, ()=>{
  appendLog(`Server running on port ${PORT}`);
  // schedule daily AI run
  cron.schedule(CRON_SCHEDULE, ()=>{
    appendLog('Scheduled AI run started');
    runAIProcess().catch(e=>appendLog('Scheduled AI run error: '+e));
  },{scheduled:true, timezone:'UTC'});
  // optional first run
  runAIProcess().catch(e=>appendLog('Initial AI run error: '+e));
});

process.on('SIGINT', ()=>server.close(()=>process.exit(0)));
process.on('SIGTERM', ()=>server.close(()=>process.exit(0)));
