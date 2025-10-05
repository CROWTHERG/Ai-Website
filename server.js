import express from 'express';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import { createClient } from 'redis';
import connectRedis from 'connect-redis';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import cron from 'node-cron';

const __dirname = path.resolve();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Redis session setup ---
const RedisStore = connectRedis(session);
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
await redisClient.connect().catch(console.error);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || 'autonomous-ai-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600 * 1000 }
}));

// --- Serve static files ---
app.use(express.static(__dirname));

// --- Visitor tracking ---
app.get('/api/visitors', async (req,res)=>{
  try {
    // increment total visitors if new session
    if(!req.session.visited){
      req.session.visited = true;
      await redisClient.incr('totalVisitors');
    }

    // Count online sessions (approximation)
    const total = await redisClient.get('totalVisitors') || 0;
    const online = await redisClient.keys('sess:*').then(keys => keys.length);

    res.json({ total, online });
  } catch(e){ res.json({ total:0, online:0 }); }
});

// --- WebSocket for AI thinking ---
const wss = new WebSocketServer({ noServer: true });
wss.on('connection', ws => {
  console.log('Client connected to AI WebSocket');
});

// --- Trigger AI ---
const AI_SCRIPT = path.join(__dirname,'ai_brain.js');
async function runAI() {
  if(!fs.existsSync(AI_SCRIPT)) return console.error('ai_brain.js missing');
  const child = spawn('node',[AI_SCRIPT],{cwd:__dirname});
  child.stdout.on('data', data => {
    const text = data.toString();
    // Broadcast to all websocket clients
    wss.clients.forEach(client => {
      if(client.readyState === 1) client.send(JSON.stringify({ type:'thinking', text }));
    });
    console.log('[AI]', text.trim());
  });
  child.stderr.on('data', data => console.error('[AI ERR]', data.toString()));
  child.on('exit', code => console.log('[AI] exited with', code));
}

// --- Cron for autonomous updates ---
cron.schedule('0 0 * * *', () => { runAI(); }, { timezone:'UTC' });

// --- First AI run ---
runAI();

// --- Upgrade HTTP server for WebSocket ---
const server = app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
server.on('upgrade', (request, socket, head)=>{
  wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
});

// Graceful shutdown
process.on('SIGINT', ()=>server.close(()=>process.exit(0)));
process.on('SIGTERM', ()=>server.close(()=>process.exit(0)));
