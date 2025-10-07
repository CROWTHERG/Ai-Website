// ai_brain.js
/**
 * ai_brain.js
 * - MODE=simulate => runs offline deterministic generator
 * - Otherwise reads COHERE_API_KEY from env and calls Cohere
 *
 * Expected model output: a JSON object (no extra text) with:
 * {
 *   files: [
 *     { path: "index.html", content_base64: "...", type: "html" },
 *     { path: "about.html", content_base64: "...", type: "html" },
 *     { path: "assets/img.png", content_base64: "..." , type: "binary" }
 *   ],
 *   summary: "short note about why it changed"
 * }
 *
 * Safety rules enforced below: ban external script src, ban iframe src, require footer present in HTML files,
 * limit per-file size and total site size, keep backups.
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const MODE = (process.env.MODE || process.argv[2] || '').toLowerCase();
const SIMULATE = MODE === 'simulate' || MODE === 'demo';
const COHERE_KEY = process.env.COHERE_API_KEY || '';

const SITE_DIR = path.join(process.cwd(), 'site');
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MEMORY_FILE = path.join(process.cwd(), 'memory.json');
const FOOTER_SNIPPET = 'Created by CrowtherTech';
const MAX_PER_FILE = 150 * 1024; // 150 KB per file
const MAX_TOTAL = 2 * 1024 * 1024; // 2 MB total for site
const TIMESTAMP = new Date().toISOString();

if (!fs.existsSync(SITE_DIR)) fs.mkdirSync(SITE_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function readMemory() {
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}
function writeMemory(mem) { fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2), 'utf8'); }

function backupSite() {
  const name = `site-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
  const out = path.join(BACKUP_DIR, name);
  // simple backup: tar-like single folder copy (zip might not be installed on host)
  const copyDir = path.join(BACKUP_DIR, `copy-${Date.now()}`);
  fs.mkdirSync(copyDir);
  // recursively copy site
  function copyRecursive(src, dst) {
    if (fs.statSync(src).isDirectory()) {
      if (!fs.existsSync(dst)) fs.mkdirSync(dst);
      for (const f of fs.readdirSync(src)) copyRecursive(path.join(src, f), path.join(dst, f));
    } else {
      fs.copyFileSync(src, dst);
    }
  }
  if (fs.existsSync(SITE_DIR)) copyRecursive(SITE_DIR, copyDir);
  return copyDir;
}

function safeDecodeBase64(s) {
  return Buffer.from(s, 'base64');
}

function validateAndWriteFiles(files) {
  // files: [{path, content_base64, type}]
  // 1) decode and check sizes
  let total = 0;
  for (const file of files) {
    const buf = safeDecodeBase64(file.content_base64);
    if (!buf || buf.length === 0) throw new Error(`Empty content for ${file.path}`);
    if (buf.length > MAX_PER_FILE) throw new Error(`File ${file.path} exceeds per-file size limit (${buf.length} bytes)`);
    total += buf.length;
    if (total > MAX_TOTAL) throw new Error(`Total size of generation exceeds limit (${total} bytes)`);
    // for HTML files, run extra sanitization and check footer presence
    if ((file.path.endsWith('.html') || file.type === 'html')) {
      const html = buf.toString('utf8');
      // check for external script src or iframe src
      const lower = html.toLowerCase();
      if (lower.includes('<script') && /<script[^>]*src\s*=/.test(lower)) throw new Error(`External <script src=> found in ${file.path} - blocked`);
      if (lower.includes('<iframe') && /<iframe[^>]*src\s*=/.test(lower)) throw new Error(`<iframe src=> found in ${file.path} - blocked`);
      // ensure footer snippet present somewhere
      if (!html.includes(FOOTER_SNIPPET)) throw new Error(`Protected footer not found in ${file.path}`);
      // optional: sanitize basic XSS by removing <script>...</script> blocks
      const sanitized = html.replace(/<script[\s\S]*?<\/script>/gi, '');
      fs.mkdirSync(path.dirname(path.join(SITE_DIR, file.path)), { recursive: true });
      fs.writeFileSync(path.join(SITE_DIR, file.path), sanitized, 'utf8');
    } else {
      // binary or other
      fs.mkdirSync(path.dirname(path.join(SITE_DIR, file.path)), { recursive: true });
      fs.writeFileSync(path.join(SITE_DIR, file.path), buf);
    }
  }
  return true;
}

function simulatedPlan() {
  // create a random simple site with freedom: multiple pages
  const name = `FreeWill-${Math.floor(Math.random() * 10000)}`;
  const now = new Date().toISOString();
  const indexHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>${name}</title></head><body>
<h1>${name}</h1>
<section><p>I am autonomous AI. I can create pages, files, and change style as I wish.</p></section>
<footer>${FOOTER_SNIPPET}</footer>
</body></html>`;
  const aboutHtml = `<!doctype html><html><head><meta charset="utf-8"><title>About ${name}</title></head><body>
<h1>About</h1><p>This site created on ${now} by autonomous AI (simulate).</p>
<footer>${FOOTER_SNIPPET}</footer>
</body></html>`;
  return {
    files: [
      { path: 'index.html', content_base64: Buffer.from(indexHtml, 'utf8').toString('base64'), type: 'html' },
      { path: 'about.html', content_base64: Buffer.from(aboutHtml, 'utf8').toString('base64'), type: 'html' }
    ],
    summary: `Simulated creation ${now}`
  };
}

async function callCohereForPlan(prompt) {
  if (!COHERE_KEY) throw new Error('COHERE_API_KEY not set');
  const resp = await fetch('https://api.cohere.ai/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `BEARER ${COHERE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'command-xlarge-nightly',
      prompt,
      max_tokens: 1200,
      temperature: 0.7
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Cohere error ${resp.status}: ${txt}`);
  }
  const data = await resp.json();
  const text = data.generations?.[0]?.text || '';
  // extract JSON object from response (the model should return JSON)
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON');
  const jsonText = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    throw new Error('Failed to parse JSON from model: ' + e.message + '\nRaw:' + jsonText);
  }
}

async function askModel(currentFilesList, memory) {
  // Build a careful prompt asking for a JSON object describing arbitrary files to create.
  // IMPORTANT: we ask the model to return ONLY the JSON object and to base64-encode file contents.
  const prompt = `
You are an autonomous website creator. You may create any files and folder structure you like for a website.
Return EXACTLY a JSON object (no commentary) with:
{
  "files": [
    {"path":"index.html","content_base64":"...","type":"html"},
    {"path":"pages/foo.html","content_base64":"...","type":"html"},
    {"path":"assets/img.png","content_base64":"...","type":"binary"}
  ],
  "summary": "short summary of what you created and why"
}

Rules:
1) Every HTML file you create MUST include the exact footer text: "${FOOTER_SNIPPET}" somewhere inside it. If not, the output will be rejected.
2) Do NOT include external script tags like <script src="..."> or <iframe src="...">. Inline <script> is allowed but will be stripped for safety.
3) Each file's content must be base64-encoded and placed in content_base64.
4) Keep sizes reasonable: prefer small pages (under 100 KB each).
5) You have full creative freedom: create any number of files, directories, pages, styles.
6) If you want to change site name or theme, include it in index.html.
7) The current site files: ${JSON.stringify(currentFilesList, null, 2)}
8) Recent memory: ${JSON.stringify(memory.slice(-5), null, 2)}

Produce the JSON now.
`;
  return await callCohereForPlan(prompt);
}

async function gatherCurrentFiles() {
  const list = [];
  function walk(dir, base = '') {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const rel = base ? base + '/' + f : f;
      if (fs.statSync(full).isDirectory()) walk(full, rel);
      else {
        list.push(rel);
      }
    }
  }
  walk(SITE_DIR);
  return list;
}

async function run() {
  const memory = readMemory();
  const currentFiles = await gatherCurrentFiles();

  const backup = backupSite();
  try {
    let plan;
    if (SIMULATE) {
      plan = simulatedPlan();
    } else {
      plan = await askModel(currentFiles, memory);
    }
    if (!plan || !plan.files || !Array.isArray(plan.files)) throw new Error('Invalid plan format from model');

    // validate and write files
    validateAndWriteFiles(plan.files);

    // record memory
    memory.push({ date: TIMESTAMP, summary: plan.summary || 'AI update', files: plan.files.map(f => f.path) });
    writeMemory(memory);
    console.log('AI generation successful:', plan.summary || 'no summary');
  } catch (err) {
    // on failure, restore backup
    console.error('AI generation failed:', err);
    // if backup exists, restore by copying backup copy folder into site (best-effort)
    if (fs.existsSync(backup)) {
      // remove current site and copy backup copy into site
      function rmrf(p) {
        if (!fs.existsSync(p)) return;
        if (fs.statSync(p).isDirectory()) {
          for (const c of fs.readdirSync(p)) rmrf(path.join(p, c));
          fs.rmdirSync(p);
        } else fs.unlinkSync(p);
      }
      rmrf(SITE_DIR);
      // copyRecursive backup to site
      function copyRecursive(src, dst) {
        if (fs.statSync(src).isDirectory()) {
          if (!fs.existsSync(dst)) fs.mkdirSync(dst);
          for (const f of fs.readdirSync(src)) copyRecursive(path.join(src, f), path.join(dst, f));
        } else {
          fs.copyFileSync(src, dst);
        }
      }
      copyRecursive(backup, SITE_DIR);
      console.log('Restored site from backup.');
    }
    // also write a minimal error page so site is not blank
    const errHtml = `<!doctype html><html><body><h1>AI generation failed</h1><p>${String(err)}</p><footer>${FOOTER_SNIPPET}</footer></body></html>`;
    fs.writeFileSync(path.join(SITE_DIR, 'index.html'), errHtml, 'utf8');
    memory.push({ date: TIMESTAMP, summary: 'AI generation failed: ' + String(err) });
    writeMemory(memory);
  }
}

run().catch(e => {
  console.error('Fatal ai_brain error:', e);
  process.exit(1);
});