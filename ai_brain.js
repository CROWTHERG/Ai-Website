// ai_brain.js
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const { generateMetaFromFragment, writeMeta } = require('./seo');
const generateSitemap = require('./sitemap');

const MODE = (process.env.MODE || process.argv[2] || '').toLowerCase();
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

function read(p){ return fs.existsSync(p) ? fs.readFileSync(p,'utf8') : null; }
function write(p,c){ fs.writeFileSync(p,c,'utf8'); }
function ensureBackupDir(){ if(!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR); }

function backupFile(p){
  ensureBackupDir();
  const now = new Date().toISOString().replace(/[:.]/g,'-');
  const dest = path.join(BACKUP_DIR, path.basename(p) + '.' + now + '.bak');
  fs.copyFileSync(p, dest);
  return dest;
}

// Simulated generator: decides site type, name, fragment and CSS
function simulatePlan(currentFragment, cssFragment, memory){
  const types = ['microblog','portfolio','gallery','journal','tools-portal','idea-lab'];
  const choice = types[(memory.length + (new Date()).getDate()) % types.length];
  const nameBases = ['Nova','Aurora','Lumen','Echo','Pulse','Node','Atlas','Horizon'];
  const name = `${nameBases[(memory.length)%nameBases.length]}-${Math.floor(Math.random()*900+100)}`;
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

// Helper: call Cohere
async function callCohere(prompt){
  const Cohere = require('cohere-ai');
  Cohere.init(COHERE_KEY);
  const resp = await Cohere.generate({
    model: 'command-xlarge-nightly',
    prompt,
    max_tokens: 900,
    temperature: 0.6
  });
  return (resp && resp.body && resp.body.generations && resp.body.generations[0] && resp.body.generations[0].text) || '';
}

// Helper: call OpenAI (chat completions)
async function callOpenAI(prompt){
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey: OPENAI_KEY });
  const res = await client.chat.completions.create({
    model: 'gpt-5',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1200,
    temperature: 0.7
  });
  return (res && res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) || '';
}

async function askModelForPlan(currentFragment, cssFragment, memory){
  if(SIMULATE) return simulatePlan(currentFragment, cssFragment, memory);
  // Build prompt requesting a JSON response with explicit fields
  const recent = memory.slice(-6).map(m=>`- ${m.date}: ${m.note}`).join('\n') || '- none';
  const prompt = `
You are an autonomous website designer and writer. Output strictly a JSON object (no surrounding text) with keys:
{
  "site_name": string,
  "site_type": string, // e.g. "microblog","portfolio","gallery","tool-site"
  "html_fragment": "<...>", // HTML string to place between <!-- AI-START --> and <!-- AI-END -->
  "css_fragment": "/* ... */", // CSS to replace the AI-CSS region (only content between markers)
  "meta": { "title": "...", "description": "...", "keywords": "a,b,c" }
}
Constraints:
- Do NOT modify or reference the protected creator info.
- html_fragment must be <= ${MAX_BYTES} bytes; css_fragment must be <= ${MAX_BYTES} bytes.
- html_fragment must NOT contain the markers <!-- AI-START --> or <!-- AI-END -->.
- css_fragment must NOT contain the markers /* AI-CSS-START */ or /* AI-CSS-END */.
- Keep content non-identifying and non-sensitive.

Current HTML region (context):
${currentFragment}

Current CSS region (context):
${cssFragment}

Recent memory:
${recent}

Return the JSON exactly.
`;
  // prefer Cohere if key set; else OpenAI if key set
  if(COHERE_KEY){
    const raw = await callCohere(prompt);
    // cohere sometimes returns with extra text — try to extract JSON substring
    const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}')+1);
    try { return JSON.parse(jsonText); } catch(e){ throw new Error('Failed to parse Cohere JSON response: ' + e.message + '\nRaw:' + raw); }
  } else if(OPENAI_KEY){
    const raw = await callOpenAI(prompt);
    const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}')+1);
    try { return JSON.parse(jsonText); } catch(e){ throw new Error('Failed to parse OpenAI JSON response: ' + e.message + '\nRaw:' + raw); }
  } else {
    throw new Error('No model keys set and not in simulate mode.');
  }
}

async function run(){
  // read files
  const html = read(INDEX);
  if(!html) throw new Error('index.html not found.');
  if(!html.includes(PROTECTED_SNIPPET)) throw new Error('Protected creator info missing or modified.');

  const s = html.indexOf(START);
  const e = html.indexOf(END);
  if(s===-1 || e===-1 || e<s) throw new Error('AI HTML markers missing or malformed.');

  const before = html.slice(0, s + START.length);
  const currentFragment = html.slice(s + START.length, e);
  const after = html.slice(e);

  const css = read(CSS);
  if(!css) throw new Error('style.css missing.');
  const csStart = css.indexOf(CSS_START);
  const csEnd = css.indexOf(CSS_END);
  if(csStart===-1 || csEnd===-1 || csEnd<csStart) throw new Error('AI CSS markers missing or malformed.');
  const cssBefore = css.slice(0, csStart + CSS_START.length);
  const cssFragment = css.slice(csStart + CSS_START.length, csEnd);
  const cssAfter = css.slice(csEnd);

  // load memory
  let memory = [];
  try{ memory = JSON.parse(read(MEMORY) || '[]'); }catch(e){ memory=[]; }

  // backup originals
  backupFile(INDEX);
  backupFile(CSS);

  // ask model
  let plan;
  try{
    plan = await askModelForPlan(currentFragment, cssFragment, memory);
  }catch(err){
    console.error('Model planning error:', err.message || err);
    process.exit(1);
  }

  // validate plan structure
  if(!plan || !plan.html_fragment || !plan.css_fragment || !plan.site_name) {
    console.error('Invalid plan produced by model:', plan);
    process.exit(1);
  }

  // Basic safety checks
  const htmlFrag = plan.html_fragment.trim();
  const cssFrag = plan.css_fragment.trim();
  const siteName = String(plan.site_name).trim();
  const meta = plan.meta || {};
  if(Buffer.byteLength(htmlFrag,'utf8') === 0) { console.error('Empty html_fragment'); process.exit(1); }
  if(Buffer.byteLength(htmlFrag,'utf8') > MAX_BYTES){ console.error('html_fragment too large'); process.exit(1); }
  if(Buffer.byteLength(cssFrag,'utf8') > MAX_BYTES){ console.error('css_fragment too large'); process.exit(1); }
  if(htmlFrag.includes(START) || htmlFrag.includes(END) || cssFrag.includes(CSS_START) || cssFrag.includes(CSS_END)) {
    console.error('Fragments contain reserved markers. Aborting.'); process.exit(1);
  }
  if(htmlFrag.includes(PROTECTED_SNIPPET) || cssFrag.includes(PROTECTED_SNIPPET)) {
    console.error('Attempt to modify protected creator info. Aborting.'); process.exit(1);
  }

  // Compose new files
  const newHtml = before + '\n' + htmlFrag + '\n' + after;
  const newCss = cssBefore + '\n' + cssFrag + '\n' + cssAfter;

  // extra safety: ensure protected snippet still present
  if(!newHtml.includes(PROTECTED_SNIPPET)) { console.error('Protected snippet missing after replacement. Aborting.'); process.exit(1); }

  // Write files
  write(INDEX, newHtml);
  write(CSS, newCss);

  // update meta
  const metaObj = {
    title: meta.title || `${siteName} — Autonomous AI Site`,
    description: meta.description || (generateMetaFromFragment ? generateMetaFromFragment(htmlFrag, siteName).description : ''),
    keywords: meta.keywords || ''
  };
  writeMeta(metaObj);

  // update sitemap
  try{ generateSitemap(); } catch(x){ console.warn('Sitemap generation failed:', x.message || x); }

  // update memory
  memory.push({
    date: new Date().toISOString(),
    note: `AI update: site_name=${siteName} site_type=${plan.site_type || 'unknown'}`,
    detail: { site_name: siteName, site_type: plan.site_type || '', meta: metaObj }
  });
  write(MEMORY, JSON.stringify(memory,null,2));

  console.log('AI update applied. Site name:', siteName);

  // Update index title and header site-name if present
  try{
    // quick DOM post-processing using jsdom to set <title> and #site-name
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(newHtml);
    if(dom && dom.window && dom.window.document){
      const doc = dom.window.document;
      if(doc.querySelector('title')) doc.querySelector('title').textContent = metaObj.title;
      const sn = doc.querySelector('#site-name');
      if(sn) sn.textContent = siteName;
      write(INDEX, dom.serialize());
    }
  }catch(e){ console.warn('Post-processing failed:', e.message); }

  // best-effort git commit
  try{
    child_process.execSync('git rev-parse --is-inside-work-tree', { stdio:'ignore' });
    child_process.execSync('git add index.html style.css memory.json data/meta.json data/sitemap.xml || true', { stdio:'ignore' });
    const msg = `AI update: ${new Date().toISOString()} - ${siteName}`;
    child_process.execSync(`git commit -m "${msg}" || true`, { stdio:'ignore' });
    console.log('Committed changes locally (if repo).');
  }catch(e){
    console.log('No git or commit skipped.');
  }
}

run().catch(err => {
  console.error('Fatal error in ai_brain:', err);
  process.exit(1);
});