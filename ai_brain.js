import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX = path.join(__dirname,'index.html');
const CSS = path.join(__dirname,'style.css');
const MEMORY = path.join(__dirname,'memory.json');
const BACKUP_DIR = path.join(__dirname,'.backups');

const START = '<!-- AI-START -->';
const END = '<!-- AI-END -->';
const CSS_START = '/* AI-CSS-START */';
const CSS_END = '/* AI-CSS-END */';
const PROTECTED_SNIPPET = 'CrowtherTech';
const MAX_BYTES = 40*1024;

// ----------------- Helpers -----------------
function read(p){ return fs.existsSync(p) ? fs.readFileSync(p,'utf8') : ''; }
function write(p,c){ fs.writeFileSync(p,c,'utf8'); }
function ensureBackupDir(){ if(!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR); }
function backupFile(p){
  ensureBackupDir();
  const dest = path.join(BACKUP_DIR, path.basename(p)+'.bak');
  fs.copyFileSync(p,dest);
}

// ----------------- Simple AI content generator -----------------
function generateAIContent(memory){
  const types = ['microblog','portfolio','gallery','journal','tools-portal','idea-lab'];
  const choice = types[memory.length % types.length];
  const nameBases = ['Nova','Aurora','Lumen','Echo','Pulse','Node','Atlas','Horizon'];
  const name = `${nameBases[memory.length % nameBases.length]}-${Math.floor(Math.random()*900+100)}`;

  const htmlFragment = `<article>
  <h2>Welcome to ${name}</h2>
  <p>Type: ${choice}. I (the autonomous AI) chose this role and will evolve the site over time.</p>
  <p>Today's note: evolving content and layout. Memory length: ${memory.length}.</p>
</article>`;

  const cssFragment = `
/* AI-generated CSS: ${choice} theme */
:root{--bg:#0a0f1a;--text:#eaf6ff;--accent:#9ef7d3}
body{background:linear-gradient(180deg,var(--bg),#071223);color:var(--text);font-family:Inter,system-ui,Arial,sans-serif;padding:2rem}
#site-name{font-weight:700;letter-spacing:0.6px}
#ai-content{background:rgba(255,255,255,0.02);padding:1rem;border-radius:10px}
`;

  return { htmlFragment, cssFragment, siteName: name, siteType: choice };
}

// ----------------- Main run -----------------
async function run(){
  console.log('[AI-BRAIN] Starting AI brain run...');

  // Backup originals
  backupFile(INDEX);
  backupFile(CSS);

  // Load memory
  let memory = [];
  try{ memory = JSON.parse(read(MEMORY)||'[]'); }catch{}

  const plan = generateAIContent(memory);

  // Update HTML
  let html = read(INDEX);
  const s = html.indexOf(START);
  const e = html.indexOf(END);
  if(s===-1 || e===-1 || e<s) throw new Error('AI HTML markers missing');
  const before = html.slice(0, s+START.length);
  const after = html.slice(e);
  const newHtml = before + '\n' + plan.htmlFragment + '\n' + after;
  write(INDEX,newHtml);

  // Update CSS
  let css = read(CSS);
  const cs = css.indexOf(CSS_START);
  const ce = css.indexOf(CSS_END);
  if(cs===-1 || ce===-1 || ce<cs) throw new Error('AI CSS markers missing');
  const cssBefore = css.slice(0, cs+CSS_START.length);
  const cssAfter = css.slice(ce);
  const newCss = cssBefore + '\n' + plan.cssFragment + '\n' + cssAfter;
  write(CSS,newCss);

  // Update memory
  memory.push({ date: new Date().toISOString(), siteName: plan.siteName, siteType: plan.siteType });
  write(MEMORY, JSON.stringify(memory,null,2));

  console.log(`[AI-BRAIN] AI update applied. Site name: ${plan.siteName}`);
}

run().catch(err=>{
  console.error('Fatal AI brain error:', err);
  process.exit(1);
});
