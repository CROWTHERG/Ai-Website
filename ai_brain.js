import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX = path.join(__dirname,'index.html');
const CSS = path.join(__dirname,'style.css');
const MEMORY = path.join(__dirname,'memory.json');
const MAX_BYTES = 40*1024;
const PROTECTED_SNIPPET = 'Created by CrowtherTech';
const START = '<!-- AI-START -->';
const END = '<!-- AI-END -->';
const CSS_START = '/* AI-CSS-START */';
const CSS_END = '/* AI-CSS-END */';

function read(p){ return fs.existsSync(p) ? fs.readFileSync(p,'utf8') : null; }
function write(p,c){ fs.writeFileSync(p,c,'utf8'); }

// ----------------- Simulated AI plan -----------------
function simulatePlan(memory){
  const types = ['microblog','portfolio','gallery','journal','tools-portal','idea-lab'];
  const choice = types[(memory.length + (new Date()).getDate()) % types.length];
  const nameBases = ['Nova','Aurora','Lumen','Echo','Pulse','Node','Atlas','Horizon'];
  const name = `${nameBases[(memory.length)%nameBases.length]}-${Math.floor(Math.random()*900+100)}`;
  const css = `
:root{--bg:#0a0f1a;--text:#eaf6ff;--accent:#9ef7d3}
body{background:linear-gradient(180deg,var(--bg),#071223);color:var(--text);font-family:Inter,system-ui,Arial,sans-serif;padding:2rem}
#site-name{font-weight:700;letter-spacing:0.6px}
#ai-content{background:rgba(255,255,255,0.02);padding:1rem;border-radius:10px}
`;
  const fragment = `<article>
<h2>Welcome to ${name}</h2>
<p>Type: ${choice}. I (the autonomous AI) chose this role and will evolve the site over time.</p>
<p>Today's note: evolving content and layout. Memory length: ${memory.length}.</p>
</article>`;
  return { name, type: choice, css, fragment };
}

function run(){
  console.log('[AI-BRAIN] Starting AI brain run...');
  let memory = [];
  try{ memory = JSON.parse(read(MEMORY)||'[]'); }catch(e){ memory=[]; }

  const plan = simulatePlan(memory);

  // ----------------- Update index.html -----------------
  let html = read(INDEX);
  if(!html) html = `<!DOCTYPE html><html><head><title>${plan.name}</title></head><body>
<h1 id="site-name">${plan.name}</h1>
<!-- AI-START --><!-- AI-END -->
<footer>© 2025 CrowtherTech. All rights reserved.</footer>
</body></html>`;
  const s = html.indexOf(START);
  const e = html.indexOf(END);
  if(s!==-1 && e!==-1 && e>s){
    html = html.slice(0,s+START.length) + '\n' + plan.fragment + '\n' + html.slice(e);
  }

  write(INDEX, html);

  // ----------------- Update style.css -----------------
  let css = read(CSS) || '';
  const csStart = css.indexOf(CSS_START);
  const csEnd = css.indexOf(CSS_END);
  if(csStart!==-1 && csEnd!==-1 && csEnd>csStart){
    css = css.slice(0,csStart+CSS_START.length) + '\n' + plan.css + '\n' + css.slice(csEnd);
  } else {
    css = `/* AI-CSS-START */\n${plan.css}\n/* AI-CSS-END */`;
  }
  write(CSS, css);

  // ----------------- Update memory -----------------
  memory.push({ date: new Date().toISOString(), note: `AI update: ${plan.name}` });
  write(MEMORY, JSON.stringify(memory,null,2));

  console.log('[AI-BRAIN] AI update applied. Site name:', plan.name);
}

run();
