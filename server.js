import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import cron from 'node-cron';
import { WebSocketServer } from 'ws';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;
const AI_SCRIPT = path.join(process.cwd(), 'ai_brain.js');

app.use(express.static(process.cwd()));

// WebSocket for live AI Thinking
const wss = new WebSocketServer({ noServer: true });
let clients = [];
wss.on('connection', ws => {
  clients.push(ws);
  ws.on('close', () => { clients = clients.filter(c=>c!==ws); });
});

function broadcastThinking(text){
  const msg = JSON.stringify({ type:'thinking', text });
  clients.forEach(ws => ws.readyState===1 && ws.send(msg));
}

// Run AI process
function runAIProcess(){
  return new Promise((resolve,reject)=>{
    const child = spawn(process.execPath, [AI_SCRIPT], { cwd: process.cwd() });
    child.stdout.on('data', d => {
      const lines = d.toString().split('\n');
      lines.forEach(line=>{ if(line.trim()) broadcastThinking(line.trim()); });
    });
    child.stderr.on('data', d => console.error(d.toString()));
    child.on('close', code => resolve(code));
    child.on('error', err => reject(err));
  });
}

// Auto update every 3 hours
cron.schedule('0 */3 * * *', () => {
  console.log('Scheduled AI run started');
  runAIProcess().catch(console.error);
});

// Initial run
runAIProcess().catch(console.error);

const server = app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});