const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

const MEMORY_FILE = path.join(__dirname,'data/memory.json');
const AI_SCRIPT = path.join(__dirname,'ai_brain.js');

// Real-time AI content
app.get('/ai-content', (req,res)=>{
  try{
    const memory = JSON.parse(fs.readFileSync(MEMORY_FILE,'utf8'));
    const latest = memory[memory.length-1] || {};
    res.json({
      htmlFragment: latest.lastHtml || 'AI is generating content...',
      thinking: latest.lastThinking || 'AI is thinking...',
      pages: latest.pages || ['index.html']
    });
  } catch(e){
    res.json({htmlFragment:'', thinking:'AI error', pages:['index.html']});
  }
});

// Manual AI run
app.get('/run-ai', (req,res)=>{
  const child = spawn(process.execPath,[AI_SCRIPT],{cwd: __dirname});
  child.on('close', code=>res.json({status:'AI run finished', code}));
});

// Scheduled AI run every 3 hours
cron.schedule('0 */3 * * *', ()=>{
  const child = spawn(process.execPath,[AI_SCRIPT],{cwd: __dirname});
  child.on('close', code=>console.log('Scheduled AI run finished', code));
});

app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));