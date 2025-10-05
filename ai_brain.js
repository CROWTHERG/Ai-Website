// ai_brain.js - Autonomous AI brain
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const { generateMetaFromFragment, writeMeta } = require('./seo');
const generateSitemap = require('./sitemap');

const MODE = (process.env.MODE || '').toLowerCase();
const SIMULATE = MODE === 'simulate' || MODE === 'demo' || MODE === 'dry';
const COHERE_KEY = process.env.COHERE_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

const INDEX = path.join(process.cwd(),'index.html');
const CSS = path.join(process.cwd(),'style.css');
const MEMORY = path.join(process.cwd(),'memory.json');
const BACKUP_DIR = path.join(process.cwd(),'.backups');
const START = '<!-- AI-START -->';
const END = '<!-- AI-END -->';
const CSS_START = '/* AI-CSS-START */';
const CSS_END = '/* AI-CSS-END */';
const PROTECTED_SNIPPET = 'Created by CrowtherTech';
const MAX_BYTES = 40 * 1024; // 40 KB per fragment

function log(msg){ console.log('[AI-BRAIN] '+msg); }
function read(p){ return fs.existsSync(p) ? fs.readFileSync(p,'utf8') : null; }
function write(p,c){ fs.writeFileSync(p,c,'utf8'); }
function ensureBackupDir(){ if(!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR); }
function backupFile(p){ ensureBackupDir(); const now = new Date().toISOString().replace(/[:.]/g,'-'); const dest = path.join(BACKUP_DIR, path.basename(p)+'.'+now+'.bak'); fs.copyFileSync(p,dest); return dest; }

// --- Simulation fallback ---
function simulatePlan(currentFragment, cssFragment, memory){
  const types = ['microblog','portfolio','gallery','journal','tools-portal','idea-lab'];
  const choice = types[(memory.length + (new Date()).getDate()) % types.length];
  const nameBases = ['Nova','Aurora','Lumen','Echo','Pulse','Node','Atlas','Horizon'];
  const name = `${nameBases[memory.length % nameBases.length]}-${Math.floor(Math.random()*900+100)}`;
  const css = `
/* AI-generated CSS: ${choice} theme */
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

// --- Optional AI calls ---
async function callCohere(prompt){
  const Cohere = require('cohere-ai');
  Cohere.init(COHERE_KEY);
  const resp = await Cohere.generate({
    model: 'command-xlarge-nightly',
    prompt,
    max_tokens: 900,
    temperature: 0.6
  });
  return (resp?.body?.generations?.[0]?.text) || '';
}

async function callOpenAI(prompt){
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey: OPENAI_KEY });
  const res = await client.chat.completions.create({
    model: 'gpt-5',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1200,
    temperature: 0.7
  });
  return (res?.choices?.[0]?.message?.content) || '';
}

// --- Decide site plan ---
async function askModelForPlan(currentFragment, cssFragment, memory){
  if(SIMULATE || (!COHERE_KEY && !OPENAI_KEY)){
    log('Using simulation mode for plan.');
    return simulatePlan(currentFragment, cssFragment, memory);
  }

  const recent = memory.slice(-6).map(m=>`- ${m.date}: ${m.note}`).join('\n') || '- none';
  const prompt = `
You are an autonomous website designer. Output strictly a JSON object:
{
  "site_name": string,
  "site_type": string,
  "html_fragment": "<...>",
  "css_fragment": "/* ... */",
  "meta": { "title": "...", "description": "...", "keywords": "a,b,c" }
}
Current HTML region:
${currentFragment}
Current CSS region:
${cssFragment}
Recent memory:
${recent}
`;

  if(COHERE_KEY){
    const raw = await callCohere(prompt);
    const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}')+1);
    return JSON.parse(jsonText);
  } else if(OPENAI_KEY){
    const raw = await callOpenAI(prompt);
    const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}')+1);
    return JSON.parse(jsonText);
  } else {
    log('No AI keys set; falling back to simulation.');
    return simulatePlan(currentFragment, cssFragment, memory);
  }
}

// --- Main run ---
async function run(){
  log('Starting AI brain run...');
  const html = read(INDEX);
  if(!html){ log('index.html not found. Creating default.'); write(INDEX, `<!DOCTYPE html><html><head><title>Autonomous AI</title></head><body><!-- AI-START --><!-- AI-END --></body></html>`); }

  const htmlContent = read(INDEX);
  if(!htmlContent.includes(PROTECTED_SNIPPET)){
    log('Protected snippet missing; adding it.');
    write(INDEX, `<!-- ${PROTECTED_SNIPPET} -->\n${htmlContent}`);
  }

  const s = htmlContent.indexOf(START);
  const e = htmlContent.indexOf(END);
  const before = htmlContent.slice(0, s + START.length);
  const currentFragment = htmlContent.slice(s + START.length, e);
  const after = htmlContent.slice(e);

  const css = read(CSS) || `${CSS_START}${CSS_END}`;
  const csStart = css.indexOf(CSS_START);
  const csEnd = css.indexOf(CSS_END);
  const cssBefore = css.slice(0, csStart + CSS_START.length);
  const cssFragment = css.slice(csStart + CSS_START.length, csEnd);
  const cssAfter = css.slice(csEnd);

  let memory = [];
  try{ memory = JSON.parse(read(MEMORY) || '[]'); } catch(e){ memory=[]; }

  backupFile(INDEX);
  backupFile(CSS);

  const plan = await askModelForPlan(currentFragment, cssFragment, memory);

  const htmlFrag = plan.html_fragment.trim();
  const cssFrag = plan.css_fragment.trim();
  const siteName = String(plan.name || plan.site_name).trim();
  const meta = plan.meta || {};

  const newHtml = before + '\n' + htmlFrag + '\n' + after;
  const newCss = cssBefore + '\n' + cssFrag + '\n' + cssAfter;

  write(INDEX, newHtml);
  write(CSS, newCss);

  const metaObj = {
    title: meta.title || `${siteName} — Autonomous AI Site`,
    description: meta.description || '',
    keywords: meta.keywords || ''
  };
  writeMeta(metaObj);

  try{ generateSitemap(); } catch(e){ log('Sitemap generation failed: '+e.message); }

  memory.push({ date: new Date().toISOString(), note:`AI update: ${siteName}`, detail:{ site_name: siteName, meta: metaObj }});
  write(MEMORY, JSON.stringify(memory,null,2));

  log('AI update applied. Site name: '+siteName);
}

run().catch(err => { console.error('Fatal AI brain error:', err); process.exit(1); });
