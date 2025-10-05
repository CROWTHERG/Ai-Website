import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { createCanvas } from 'canvas';

const INDEX = path.join(process.cwd(),'index.html');
const CSS = path.join(process.cwd(),'style.css');
const MEMORY = path.join(process.cwd(),'memory.json');
const PAGES_DIR = path.join(process.cwd(),'pages');
const ASSETS_DIR = path.join(process.cwd(),'assets');

// Ensure directories exist
if(!fs.existsSync(PAGES_DIR)) fs.mkdirSync(PAGES_DIR);
if(!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR);

// --- Load memory ---
let memory = [];
try{ memory = JSON.parse(fs.readFileSync(MEMORY,'utf8')); } catch(e){ memory=[]; }

// --- Stream AI thinking ---
function streamThoughts() {
  const thoughts = [
    "Analyzing site structure...",
    "Generating unique content...",
    "Creating new pages...",
    "Styling dynamically...",
    "Updating sitemap...",
    "Generating favicon..."
  ];
  for(const t of thoughts){
    console.log(t);
  }
}

// --- Generate site content ---
function generateSiteContent() {
  const nameBases = ['Nova','Aurora','Lumen','Echo','Pulse','Node','Atlas','Horizon'];
  const siteName = `${nameBases[(memory.length)%nameBases.length]}-${Math.floor(Math.random()*900+100)}`;
  const type = ['microblog','portfolio','gallery','tools-portal','idea-lab'][(memory.length)%5];

  const fragment = `<article>
<h2>Welcome to ${siteName}</h2>
<p>Type: ${type}. I (the autonomous AI) chose this role and will evolve the site over time.</p>
<p>Today's note: evolving content and layout. Memory length: ${memory.length}.</p>
</article>`;

  const css = `
/* AI-generated CSS for ${type} theme */
:root{--bg:#0a0f1a;--text:#eaf6ff;--accent:#9ef7d3}
body{background:linear-gradient(180deg,var(--bg),#071223);color:var(--text);font-family:Inter,system-ui,Arial,sans-serif;padding:2rem}
#site-name{font-weight:700;letter-spacing:0.6px}
#ai-content{background:rgba(255,255,255,0.02);padding:1rem;border-radius:10px}
`;

  return { siteName, type, fragment, css };
}

// --- Update index.html and CSS ---
function updateIndex({ siteName, fragment, css }) {
  let html = fs.readFileSync(INDEX,'utf8');
  const start = '<!-- AI-START -->';
  const end = '<!-- AI-END -->';
  const s = html.indexOf(start);
  const e = html.indexOf(end);
  const before = html.slice(0,s+start.length);
  const after = html.slice(e);
  fs.writeFileSync(INDEX, before + '\n' + fragment + '\n' + after);

  let style = fs.readFileSync(CSS,'utf8');
  const csStart = '/* AI-CSS-START */';
  const csEnd = '/* AI-CSS-END */';
  const cs = style.indexOf(csStart);
  const ce = style.indexOf(csEnd);
  const beforeCss = style.slice(0,cs+csStart.length);
  const afterCss = style.slice(ce);
  fs.writeFileSync(CSS, beforeCss + '\n' + css + '\n' + afterCss);

  const dom = new JSDOM(fs.readFileSync(INDEX,'utf8'));
  const doc = dom.window.document;
  if(doc.querySelector('title')) doc.querySelector('title').textContent = siteName;
  const sn = doc.querySelector('#site-name');
  if(sn) sn.textContent = siteName;
  fs.writeFileSync(INDEX, dom.serialize());
}

// --- Generate new page ---
function generatePage(i){
  const pagePath = path.join(PAGES_DIR,`page${i}.html`);
  const content = `<html><head><title>Page ${i}</title></head><body><h1>Page ${i}</h1><p>Autonomously generated page.</p></body></html>`;
  fs.writeFileSync(pagePath, content);
}

// --- Generate favicon dynamically ---
function generateFavicon() {
  const size = 64;
  const canvas = createCanvas(size,size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#'+Math.floor(Math.random()*16777215).toString(16);
  ctx.fillRect(0,0,size,size);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(process.cwd(),'favicon.ico'), buffer);
  console.log('[AI] Favicon generated');
}

// --- Run AI ---
function run() {
  console.log('[AI-BRAIN] Starting AI brain run...');
  streamThoughts();
  const { siteName, type, fragment, css } = generateSiteContent();
  updateIndex({ siteName, fragment, css });
  generatePage(memory.length+1);
  generateFavicon();

  memory.push({ date:new Date().toISOString(), siteName, type });
  fs.writeFileSync(MEMORY, JSON.stringify(memory,null,2));
  console.log(`[AI-BRAIN] AI update applied. Site name: ${siteName}`);
}

run();
