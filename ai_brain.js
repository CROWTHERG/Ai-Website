// ai_brain.js — free-will AI brain (Cohere)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Cohere = require('cohere-ai');

const COHERE_KEY = process.env.COHERE_API_KEY;
if(!COHERE_KEY){
  console.error('Missing COHERE_API_KEY in environment. Exiting.');
  process.exit(1);
}
Cohere.init(COHERE_KEY);

const MEMORY_FILE = path.join(process.cwd(),'data','memory.json');
const BACKUP_DIR = path.join(process.cwd(), '.backups');
const PROTECTED_FOOTER = '© 2025 CrowtherTech. All rights reserved.\nCrowtherTech.name.ng';

// ensure folders
if(!fs.existsSync(path.join(process.cwd(),'data'))) fs.mkdirSync(path.join(process.cwd(),'data'), { recursive: true });
if(!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE, '[]', 'utf8');

function nowISO(){ return new Date().toISOString(); }
function read(p){ return fs.existsSync(p) ? fs.readFileSync(p,'utf8') : ''; }
function write(p,c){ fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p,c, 'utf8'); }
function backup(p){
  try {
    if(!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    if(fs.existsSync(p)){
      const dest = path.join(BACKUP_DIR, path.basename(p) + '.' + Date.now() + '.bak');
      fs.copyFileSync(p, dest);
    }
  } catch(e){ /* ignore */ }
}
function safeName(fn){
  let p = fn.replace(/^\/+/, '');
  p = p.replace(/\.\.(\/|\\)/g, '');
  return p;
}
function ensureFooter(html){
  if(typeof html !== 'string') return html;
  if(html.includes(PROTECTED_FOOTER)) return html;
  if(html.toLowerCase().includes('</body>')) return html.replace(/<\/body>/i, `<footer>${PROTECTED_FOOTER}</footer>\n</body>`);
  return html + `\n<footer>${PROTECTED_FOOTER}</footer>`;
}

// build prompt — free will, return JSON mapping filename->content or base64 object for binaries
const systemPrompt = `
You are an autonomous website creator with total freedom. Produce EXACTLY a single JSON object and nothing else.
Each key is a filename (relative path), each value is either:
- a string (text content for .html, .css, .js, .xml etc.), or
- an object { "b64": "<BASE64_PAYLOAD>" } for binary files (images, favicon).
You MAY create any files and directories you want (index.html, pages/about.html, assets/...).
Constraint: every HTML file you output MUST include the following footer string somewhere exactly as shown:
${PROTECTED_FOOTER}
That footer must not be changed.
Return the JSON only (no commentary). Keep content UTF-8 safe.
`;

// brief memory for context
function memorySummary(){
  try {
    const mem = JSON.parse(read(MEMORY_FILE) || '[]');
    return mem.slice(-8).map(m=>`${m.time||m.date}: ${m.action} ${m.note||''}`).join('\n') || 'none';
  } catch(e){ return 'none'; }
}

async function askCohere(fullPrompt){
  const response = await Cohere.generate({
    model: 'command-xlarge-nightly',
    prompt: fullPrompt,
    max_tokens: 2500,
    temperature: 0.95
  });
  const out = response && response.body && response.body.generations && response.body.generations[0] && response.body.generations[0].text;
  if(!out) throw new Error('Empty Cohere response');
  return out;
}

function extractJSON(text){
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if(start === -1 || end === -1 || end <= start) throw new Error('No JSON object found');
  const jsonText = text.slice(start, end+1);
  return JSON.parse(jsonText);
}

(async function main(){
  console.log('[AI-BRAIN] Starting free-will generation...');
  const memSum = memorySummary();
  const prompt = systemPrompt + '\n\nMemory summary:\n' + memSum + '\n\nProduce JSON now.';
  let raw;
  try { raw = await askCohere(prompt); } catch(e){ console.error('[AI] Cohere error:', e.message || e); process.exit(1); }

  let mapping;
  try { mapping = extractJSON(raw); } catch(e){
    console.error('[AI] Failed to parse JSON output:', e.message);
    console.error('Raw output (first 4000 chars):\n', String(raw).slice(0,4000));
    process.exit(1);
  }

  // Back up overwritten files listed in mapping
  Object.keys(mapping).forEach(k=>{
    const safe = safeName(k);
    const fp = path.join(process.cwd(), safe);
    if(fs.existsSync(fp)) backup(fp);
  });

  const written = [];
  for(const [key, val] of Object.entries(mapping)){
    const safe = safeName(key);
    const fp = path.join(process.cwd(), safe);
    try {
      if(val && typeof val === 'object' && typeof val.b64 === 'string'){
        // binary file
        const buf = Buffer.from(val.b64, 'base64');
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, buf);
        written.push(safe);
        console.log('[AI] Wrote binary', safe, `${buf.length} bytes`);
        continue;
      }
      // text file
      let content = String(val || '');
      if(safe.toLowerCase().endsWith('.html') || content.trim().toLowerCase().startsWith('<!doctype') || content.includes('<body')){
        content = ensureFooter(content);
      }
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, content, 'utf8');
      written.push(safe);
      console.log('[AI] Wrote file', safe);
    } catch(err){
      console.error('[AI] Failed to write', safe, err.message || err);
    }
  }

  // update memory
  try {
    const mem = JSON.parse(read(MEMORY_FILE) || '[]');
    mem.push({ time: nowISO(), action:'cohere_freewrite', files: written.slice(0,100), note: 'free-will run' });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2), 'utf8');
  } catch(e){ console.error('[AI] memory write failed:', e.message); }

  // If mapping includes "thinking" field, use it; otherwise craft short thinking
  let thinking = '';
  if(mapping && typeof mapping.thinking === 'string') thinking = mapping.thinking.trim();
  if(!thinking) thinking = `Aurora updated ${written.length} files.`;

  // stream thinking word-by-word on stdout so server broadcasts it live
  thinking.split(/\s+/).filter(Boolean).forEach((w, i)=>{
    process.stdout.write(w + (i === thinking.split(/\s+/).filter(Boolean).length -1 ? '\n' : ' '));
  });

  console.log('[AI-BRAIN] Free-will run complete. Files written:', written.length);
  process.exit(0);
})();