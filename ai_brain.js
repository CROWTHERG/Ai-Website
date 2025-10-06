// ai_brain.js  — Free-will AI (no template)
// Replaces previous brain. Uses Cohere generate to get a JSON mapping of files->content.
// Protects footer exactly, backs up files, streams "thinking" text word-by-word.
//
// Requirements:
// - COHERE_API_KEY in env
// - cohere-ai installed (package.json should include "cohere-ai")
// - server.js should spawn this script and broadcast stdout to clients

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const Cohere = require('cohere-ai');

const COHERE_KEY = process.env.COHERE_API_KEY || '';
if (!COHERE_KEY) {
  console.error('Missing COHERE_API_KEY in environment. Exiting.');
  process.exit(1);
}
Cohere.init(COHERE_KEY);

const MEMORY = path.join(process.cwd(), 'memory.json');
const BACKUP_DIR = path.join(process.cwd(), '.backups');
const PROTECTED_FOOTER = '© 2025 CrowtherTech. All rights reserved.\nCrowtherTech.name.ng';

// Helpers
function read(p){ return fs.existsSync(p) ? fs.readFileSync(p,'utf8') : ''; }
function write(p, content){ fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content, 'utf8'); }
function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function backupFile(p){
  try {
    ensureDir(BACKUP_DIR);
    if(fs.existsSync(p)){
      const dest = path.join(BACKUP_DIR, path.basename(p) + '.' + Date.now() + '.bak');
      fs.copyFileSync(p, dest);
    }
  } catch(e){ /* ignore */ }
}
function nowISO(){ return (new Date()).toISOString(); }

// Ensure memory exists
if(!fs.existsSync(MEMORY)) fs.writeFileSync(MEMORY, '[]', 'utf8');

// Build an unrestricted prompt — model may create any files it wants.
// We require it to return a single JSON object (no extra commentary) mapping filenames -> content.
// For binary assets (images, favicons) the model should include base64 (object with { "b64":"..." }).
// The model must include the protected footer EXACTLY in every HTML file it produces, but if it does not the script will insert it.
const systemInstruction = `
You are an autonomous website creator with full freedom. The site owner (CrowtherTech) wants you to create or rewrite any files under the website project directory — HTML, CSS, JS, pages, assets, anything — with no template or design constraints. 
Return EXACTLY a single JSON object (no surrounding text) where each key is a filename (relative path) and each value is either:
- a string containing file contents (for text files like .html, .css, .js, .xml, etc.), OR
- an object { "b64": "<BASE64_DATA>" } for binary assets (images, favicon, etc).

Example response shape:
{
  "index.html": "<!doctype html>... your full html ...",
  "style.css": "body { ... }",
  "pages/about.html": "<html>...</html>",
  "assets/favicon.ico": { "b64": "AAAB..." }
}

Requirements & constraints:
- You have COMPLETE creative freedom: choose filenames, structure, content, styling, scripts, pages, images. Do NOT follow any fixed template — invent the layout, components, text, and visuals yourself.
- You MUST ensure the protected ownership block appears **exactly** as the string:
${PROTECTED_FOOTER}
  inside every HTML file you generate (index.html and any pages). If it does not naturally fit the design, include it somewhere in the HTML (e.g., as the footer element). 
- Keep output UTF-8 safe. Avoid generating extremely large binary blobs; small images/favicons are fine if base64-encoded.
- Output only a single JSON object and nothing else (no commentary, no extra text).
`;

// Build a short memory summary to pass to the model
function memorySummary(){
  let mem = [];
  try { mem = JSON.parse(read(MEMORY) || '[]'); } catch(e){ mem = []; }
  return mem.slice(-10).map(m=>`${m.time || m.date}: ${m.action} ${m.note ? '- ' + m.note : ''}`).join('\n') || 'none';
}

// Call Cohere generate
async function askCohere(prompt){
  // We'll use a large model; you can adjust model name if unavailable.
  const fullPrompt = systemInstruction + '\n\nMemory summary:\n' + memorySummary() + '\n\nNow produce the JSON mapping of files to contents.\n';
  const resp = await Cohere.generate({
    model: 'command-xlarge-nightly', // trial-friendly powerful model; change if needed
    prompt: fullPrompt,
    max_tokens: 2500,
    temperature: 0.95,
    k: 0,
    p: 0.95,
    stop_sequences: []
  });
  const out = resp && resp.body && resp.body.generations && resp.body.generations[0] && resp.body.generations[0].text;
  if(!out) throw new Error('Empty Cohere response');
  return out;
}

// Try to extract the first JSON object from raw model text
function extractFirstJSON(text){
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if(start === -1 || end === -1 || end <= start) throw new Error('No JSON object found in model response');
  const jsonText = text.slice(start, end+1);
  return JSON.parse(jsonText);
}

// Sanitize filename to avoid path escape
function safeFilename(fn){
  // remove leading slashes, collapse ".."
  let p = fn.replace(/^\/+/, '');
  if(p.includes('..')) p = p.replace(/\.\.+/g, '.'); // basic
  return p;
}

// Ensure protected footer inside HTML contents
function ensureProtectedFooterInHtml(html){
  if(typeof html !== 'string') return html;
  if(html.includes(PROTECTED_FOOTER)) return html;
  // attempt to insert before closing </body> or at end
  if(html.includes('</body>')){
    return html.replace('</body>', `<footer>${PROTECTED_FOOTER}</footer>\n</body>`);
  } else {
    return html + `\n<footer>${PROTECTED_FOOTER}</footer>`;
  }
}

// Main run
(async function main(){
  console.log('[AI-BRAIN] Starting free-will run (Cohere) — generating files...');
  let raw;
  try {
    raw = await askCohere();
  } catch(err){
    console.error('[AI-BRAIN] Cohere generate failed:', err.message || err);
    process.exit(1);
  }

  // Parse JSON mapping
  let mapping;
  try {
    mapping = extractFirstJSON(raw);
  } catch(err){
    console.error('[AI-BRAIN] Failed to extract JSON from model output:', err.message);
    console.error('Raw model output (truncated):', raw ? raw.slice(0,2000) : raw);
    process.exit(1);
  }

  if(typeof mapping !== 'object' || Array.isArray(mapping) || Object.keys(mapping).length === 0){
    console.error('[AI-BRAIN] Model returned invalid mapping:', mapping);
    process.exit(1);
  }

  // Backup existing files the model will overwrite (only if exist)
  try {
    ensureDir(BACKUP_DIR);
    for(const key of Object.keys(mapping)){
      const fn = safeFilename(key);
      const fp = path.join(process.cwd(), fn);
      if(fs.existsSync(fp)){
        backupFile(fp);
      }
    }
  } catch(e){ /* ignore backup errors */ }

  // Write all files
  const written = [];
  for(const [key, val] of Object.entries(mapping)){
    const fn = safeFilename(key);
    const fp = path.join(process.cwd(), fn);
    try {
      // If value is object and has b64, treat as binary
      if(val && typeof val === 'object' && typeof val.b64 === 'string'){
        const buf = Buffer.from(val.b64, 'base64');
        ensureDir(path.dirname(fp));
        fs.writeFileSync(fp, buf);
        written.push(fn);
        console.log(`[AI-BRAIN] Wrote binary asset: ${fn} (${buf.length} bytes)`);
        continue;
      }

      // else treat as text file
      let content = String(val || '');
      // If file looks like HTML (ends with .html or starts with <!doctype or <html), ensure footer
      const lower = fn.toLowerCase();
      if(lower.endsWith('.html') || content.trim().toLowerCase().startsWith('<!doctype') || content.trim().toLowerCase().startsWith('<html') || content.includes('<body')){
        content = ensureProtectedFooterInHtml(content);
      }
      ensureDir(path.dirname(fp));
      fs.writeFileSync(fp, content, 'utf8');
      written.push(fn);
      console.log(`[AI-BRAIN] Wrote file: ${fn}`);
    } catch(err){
      console.error(`[AI-BRAIN] Failed to write ${fn}:`, err.message || err);
    }
  }

  // Update memory.json
  try{
    const mem = JSON.parse(read(MEMORY) || '[]');
    mem.push({ time: nowISO(), action: 'cohere_freewrite', files_written: written.slice(0,50), note: 'Free-will run' });
    write(MEMORY, JSON.stringify(mem, null, 2));
  }catch(e){
    console.error('[AI-BRAIN] Failed to update memory:', e.message || e);
  }

  // Ask model for a short "thinking" line if it included one in original output
  // The model could include an optional "thinking" key in the JSON mapping; if present, stream it
  let thinkingText = '';
  if(mapping && mapping.thinking && typeof mapping.thinking === 'string') thinkingText = mapping.thinking.trim();
  // fallback: derive a short summary
  if(!thinkingText){
    thinkingText = 'Aurora AI updated site freely.';
  }

  // Stream thinking word-by-word to stdout so server broadcasts it live
  const words = thinkingText.split(/\s+/).filter(Boolean);
  for(const w of words){
    process.stdout.write(w + ' ');
    // small delay to create typing effect
    await new Promise(r => setTimeout(r, 90));
  }
  process.stdout.write('\n');
  console.log('[AI-BRAIN] Free-will run complete. Files written:', written.length);
  process.exit(0);
})();
