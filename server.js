import express from 'express';
import session from 'express-session';
import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import cron from 'node-cron';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';
const AI_SCRIPT = path.join(__dirname,'ai_brain.js');
const LOG_DIR = path.join(__dirname,'logs');
if(!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR,{recursive:true});
const LOG_FILE = path.join(LOG_DIR,'ai.log');

// ----------------- Redis session setup -----------------
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const redisStore = new RedisStore({ client: redisClient });
app.use(session({
  store: redisStore,
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24*60*60*1000 } // 1 day
}));

// ----------------- Visitor tracking -----------------
async function getVisitorStats() {
  const keys = await redisClient.keys('sess:*');
  const total = await redisClient.get('total_visitors') || 0;
  return { online: keys.length, total };
}

app.get('/api/visitors', async (req,res)=>{
  try{
    // increment total visitor if first time
    if(!req.session.counted){
      let total = parseInt(await redisClient.get('total_visitors')||0);
      total += 1;
      await redisClient.set('total_visitors', total);
      req.session.counted = true;
    }
    const stats = await getVisitorStats();
    res.json(stats);
  }catch(e){
    res.json({online:0,total:0});
  }
});

// ----------------- WebSocket for AI thinking -----------------
const server = app.listen(PORT, ()=>{
  console.log(`Server running on port ${PORT}`);
});
const wss = new WebSocketServer({ server });

function broadcastThinking(text){
  const msg = JSON.stringify({ type:'thinking', text });
  wss.clients.forEach(c=>{
    if(c.readyState===c.OPEN) c.send(msg);
  });
}

// ----------------- Logging -----------------
function appendLog(text){
  const stamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${stamp}] ${text}\n`);
}

// ----------------- Run AI brain -----------------
function runAIProcess() {
  return new Promise((resolve,reject)=>{
    if(!fs.existsSync(AI_SCRIPT)) return reject(new Error('ai_brain.js missing'));
    const child = spawn('node',[AI_SCRIPT],{cwd: __dirname, env: process.env});

    child.stdout.on('data', d=>{
      const line = d.toString();
      appendLog('[stdout] '+line.replace(/\n/g,'\\n'));
      broadcastThinking(line.trim());
    });
    child.stderr.on('data', d=>{
      const line = d.toString();
      appendLog('[stderr] '+line.replace(/\n/g,'\\n'));
    });

    child.on('close', code=>{
      appendLog('AI process exited '+code);
      resolve({code});
    });
    child.on('error', err=>reject(err));
  });
}

// ----------------- Manual trigger -----------------
app.all(['/run-ai','/run'], async (req,res)=>{
  const token = (req.headers['x-admin-token'] || req.query.token || '');
  if(token!==ADMIN_TOKEN) return res.status(401).json({error:'Unauthorized'});
  appendLog('Manual AI run triggered');
  try{
    const result = await runAIProcess();
    res.json({ok:true, exitCode: result.code});
  }catch(e){
    appendLog('Manual run error: '+e);
    res.status(500).json({ok:false,error:e.message});
  }
});

// ----------------- Schedule daily AI run -----------------
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 0 * * *';
cron.schedule(CRON_SCHEDULE, ()=>{
  appendLog('Scheduled AI run started');
  runAIProcess().catch(e=>appendLog('Scheduled AI run error: '+e));
},{timezone:'UTC'});

// ----------------- Serve static site -----------------
app.use(express.static(__dirname));

// ----------------- Health check -----------------
app.get('/health', (req,res)=>res.json({status:'ok', timestamp:new Date().toISOString()}));

// ----------------- Log viewer -----------------
app.get('/logs', (req,res)=>{
  if(!fs.existsSync(LOG_FILE)) return res.send('No logs yet.');
  const data = fs.readFileSync(LOG_FILE,'utf8');
  res.type('text/plain').send(data.split('\n').slice(-200).join('\n'));
});

// ----------------- Shutdown handlers -----------------
process.on('SIGINT', ()=>server.close(()=>process.exit(0)));
process.on('SIGTERM', ()=>server.close(()=>process.exit(0)));
