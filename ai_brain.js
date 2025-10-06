// ai_brain.js - Cohere powered free-will AI that can overwrite site files
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Cohere = require('cohere-ai');

const COHERE_KEY = process.env.COHERE_API_KEY || '';
if(!COHERE_KEY){
  console.error('Missing COHERE_API_KEY in env. Exiting.');
  process.exit(1);
}
Cohere.init(COHERE_KEY);

const INDEX = path.join(process.cwd(),'index.html');
const CSS = path.join(process.cwd(),'style.css');
const PAGES_DIR = path.join(process.cwd(),'pages');
const ASSETS_DIR = path.join(process.cwd(),'assets');
const MEMORY = path.join(process.cwd(),'memory.json');
const BACKUP_DIR = path.join(process.cwd(),'.backups');

const PROTECTED_FOOTER = '© 2025 CrowtherTech. All rights reserved.\nCrowtherTech.name.ng';

// ensure memory exists
if(!fs.existsSync(MEMORY)) fs.writeFileSync(MEMORY, '[]', 'utf8');

function read(p){ return fs.existsSync(p) ? fs.readFileSync(p,'utf8') : ''; }
function write(p,c){ fs.writeFileSync(p,c,'utf8'); }
function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function backupFile(p){
  try{
    ensureDir(BACKUP_DIR);
    if(fs.existsSync(p)){
      const dest = path.join(BACKUP_DIR, path.basename(p) + '.' + Date.now() + '.bak');
      fs.copyFileSync(p, dest);
    }
  }catch(e){}
}

// Build prompt for Cohere: free reign but must include JSON
const systemPrompt = `
You are an autonomous website designer and developer. The site owner (CrowtherTech) gave you full freedom to generate or rewrite any HTML/CSS/pages/assets for the site.
You must output EXACTLY a single JSON object and nothing else. The object must have keys:
{
  "html": "<FULL_INDEX_HTML>",
  "css": "/* FULL CSS STRING */",
  "pages": [ { "name": "pages/about.html", "html": "<HTML STRING>" }, ... ], 
  "assets": [ { "name": "assets/favicon.ico", "b64": "BASE64_CONTENT_IF_APPLICABLE" }, ... ],
  "thinking": "A short description of what you are doing (1-2 sentences)."
}
Constraints:
- The string PROTECTED FOOTER must appear exactly in the produced HTML files (index and any page) as:
${PROTECTED_FOOTER}
and you must not remove or modify that footer.
- Be creative: change layout, header, sections, nav, style freely.
- All HTML should be valid and include a <head> with a <title>.
- CSS should be valid.
- Attach assets only as base64 strings in the "assets" array, if you choose to include images or favicon.
- Keep responses UTF-8 safe.
Return JSON only.
`;

// short memory summary to pass to the model
function memorySummary(){
  let mem = [];
  try{ mem = JSON.parse(read(MEMORY) || '[]'); }catch(e){ mem = []; }
  return mem.slice(-6).map(m => `${m.time || m.date}: ${m.action} ${m.note ? '- ' + m.note : ''}`).join('\n') || 'none';
}

async function askCohere(promptText){
  // cohere generate
  // using command-xlarge-nightly (trial-friendly) — adapt if needed
  const response = await Cohere.generate({
    model: 'command-xlarge-nightly',
    prompt: promptText,
    max_tokens: 1500,
    temperature: 0.9,
    stop_sequences: []
  });
  const out = response && response.body && response.body.generations && response.body.generations[0] && response.body.generations[0].text;
  if(!out) throw new Error('Empty Cohere response');
  return out;
}

function extractJSON(text){
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if(start === -1 || end === -1) throw new Error('No JSON found in model output');
  const jsonText = text.slice(start, end+1);
  return JSON.parse(jsonText);
}

async function run(){
  console.log('[AI-BRAIN] Starting Cohere-powered run...');
  const memSum = memorySummary();
  const userPrompt = `
${systemPrompt}

Memory summary:
${memSum}

Produce JSON now.
`;
  let raw;
  try{
    raw = await askCohere(userPrompt);
  }catch(err){
    console.error('Cohere generation failed:', err.message || err);
    process.exit(1);
  }

  // try to extract and parse JSON
  let plan;
  try{
    plan = extractJSON(raw);
  }catch(err){
    console.error('Failed to parse JSON from Cohere response:', err.message || err);
    console.error('Raw response:', raw);
    process.exit(1);
  }

  if(!plan.html || !plan.css){
    console.error('Model did not provide html/css in JSON:', plan);
    process.exit(1);
  }

  // Enforce protected footer in index and pages
  function ensureFooter(html){
    if(html.includes(PROTECTED_FOOTER)) return html;
    if(html.includes('</body>')){
      return html.replace('</body>', `\n<footer>${PROTECTED_FOOTER}</footer>\n</body>`);
    }
    return html + `\n<footer>${PROTECTED_FOOTER}</footer>`;
  }

  // Backups
  backupFile(INDEX);
  backupFile(CSS);

  // Write index and css
  const safeHtml = ensureFooter(plan.html);
  write(INDEX, safeHtml);
  write(CSS, plan.css);

  // write pages
  if(Array.isArray(plan.pages)){
    ensureDir(PAGES_DIR);
    for(const p of plan.pages){
      const name = p.name.replace(/^\/+/, '');
      const fp = path.join(process.cwd(), name);
      const content = ensureFooter(p.html || '');
      ensureDir(path.dirname(fp));
      write(fp, content);
    }
  }

  // write assets (if any)
  if(Array.isArray(plan.assets)){
    ensureDir(ASSETS_DIR);
    for(const a of plan.assets){
      const name = a.name.replace(/^\/+/, '');
      const fp = path.join(process.cwd(), name);
      if(a.b64){
        const buf = Buffer.from(a.b64, 'base64');
        ensureDir(path.dirname(fp));
        fs.writeFileSync(fp, buf);
      }
    }
  }

  // update memory
  let memoryArr = [];
  try{ memoryArr = JSON.parse(read(MEMORY) || '[]'); }catch(e){ memoryArr = []; }
  memoryArr.push({ time: (new Date()).toISOString(), action: 'cohere_update', note: plan.thinking || 'generated site' });
  write(MEMORY, JSON.stringify(memoryArr, null, 2));

  // Emit thinking word-by-word to stdout so server streams it live
  const thinking = (plan.thinking || 'Updating site...').trim();
  for(const w of thinking.split(' ')){
    process.stdout.write(w + ' ');
    // small delay to create typing effect
    await new Promise(r => setTimeout(r, 90));
  }
  process.stdout.write('\n');
  console.log('[AI-BRAIN] Completed run.');
}

run().catch(err => {
  console.error('Fatal ai_brain error:', err);
  process.exit(1);
});