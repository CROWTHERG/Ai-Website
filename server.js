const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const cron = require('node-cron');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const AI_SCRIPT = path.join(__dirname, 'ai_brain.js');

// Serve static files
app.use(express.static(__dirname));

// Simple health check
app.get('/health', (req,res)=> res.json({status:'ok'}));

// Manual AI run endpoint
app.get('/run-ai', async (req,res)=>{
  try{
    const output = await runAI();
    res.send(`<pre>${output.stdout}</pre>`);
  } catch(e){
    res.status(500).send(e.message);
  }
});

// Run ai_brain.js as a child process
function runAI(){
  return new Promise((resolve,reject)=>{
    const child = spawn('node', [AI_SCRIPT], { env: process.env });
    let stdout='', stderr='';

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.on('error', err => reject(err));
  });
}

// Schedule AI run every 3 hours
cron.schedule('0 */3 * * *', ()=>{
  console.log('[CRON] Running AI brain...');
  runAI().then(r=>console.log('[CRON] AI run finished')).catch(e=>console.error(e));
});

app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));