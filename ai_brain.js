const fs = require('fs');
const path = require('path');
const Cohere = require('cohere-ai');
require('dotenv').config();

const COHERE_KEY = process.env.COHERE_API_KEY || 'LzCV9YuZ22dQpW1xlt2EiKK6YcYdSDMKexGFUpn7';
Cohere.init(COHERE_KEY);

const MEMORY_FILE = path.join(__dirname, 'memory.json');
const PROTECTED_FOOTER = '© 2025 CrowtherTech. All rights reserved.\nCrowtherTech.name.ng';

if(!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE,'[]','utf8');

async function runAI(){
  const prompt = `
You are a fully autonomous website AI. Create a complete website from scratch.
Return a JSON mapping of filenames to contents (HTML, CSS, JS, images as base64).
Each HTML file must include the footer: "${PROTECTED_FOOTER}" exactly.
Do not follow any template. You are free to create anything: pages, styles, assets.
`;

  const resp = await Cohere.generate({
    model: 'command-xlarge-nightly',
    prompt,
    max_tokens: 2500,
    temperature: 0.95
  });

  const text = resp.body.generations[0].text;
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}')+1;
  const mapping = JSON.parse(text.slice(jsonStart,jsonEnd));

  const filesWritten = [];
  for(const [file, content] of Object.entries(mapping)){
    const safeFile = path.join(__dirname, file);
    let data = content;
    if(typeof content === 'object' && content.b64) {
      fs.writeFileSync(safeFile, Buffer.from(content.b64,'base64'));
    } else {
      if(file.endsWith('.html') && !content.includes(PROTECTED_FOOTER)){
        data += `\n<footer>${PROTECTED_FOOTER}</footer>`;
      }
      fs.writeFileSync(safeFile, data, 'utf8');
    }
    filesWritten.push(file);
  }

  // Update memory
  const mem = JSON.parse(fs.readFileSync(MEMORY_FILE,'utf8'));
  mem.push({time:new Date().toISOString(),action:'AI run',files:filesWritten});
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem,null,2));
  
  // Simulate AI thinking output
  process.stdout.write('AI Thinking: Aurora AI is updating the site...\n');
}

runAI().then(()=>process.exit(0)).catch(err=>{console.error(err); process.exit(1);});