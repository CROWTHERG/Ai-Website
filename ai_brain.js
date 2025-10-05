import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { createCanvas } from 'canvas';

const INDEX = path.join(process.cwd(),'index.html');
const CSS = path.join(process.cwd(),'style.css');
const MEMORY = path.join(process.cwd(),'memory.json');
const PAGES_DIR = path.join(process.cwd(),'pages');
const ASSETS_DIR = path.join(process.cwd(),'assets');

// Ensure directories
if(!fs.existsSync(PAGES_DIR)) fs.mkdirSync(PAGES_DIR);
if(!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR);

// --- Load memory ---
let memory = [];
try { memory = JSON.parse(fs.readFileSync(MEMORY,'utf8')); } catch(e) { memory=[]; }

// --- Stream AI thinking ---
function streamThoughts() {
  const thoughts = [
    "Analyzing site structure...",
    "Generating unique content...",
    "Creating new pages with images...",
    "Styling dynamically...",
    "Updating sitemap...",
    "Generating favicon..."
  ];
  for(const t of thoughts) console.log(t);
}

// --- Generate site content ---
function generateSiteContent() {
  const nameBases = ['Nova','Aurora','Lumen','Echo','Pulse','Node','Atlas','Horizon'];
  const siteName = `${nameBases[(memory.length)%nameBases.length]}-${Math.floor(Math.random()*900+100)}`;
  const types = ['microblog','portfolio','gallery','tools-portal','idea-lab'];
  const type = types[(memory.length)%types.length];

  const fragment = `<article>
<h2>Welcome to ${siteName}</h2>
<p>Type: ${type}. I (the autonomous AI) chose this role and will evolve the site over time.</p>
<p>Today's note: evolving content and layout. Memory length: ${memory.length}.</p>
</article>`;

  const css = `
/* AI-generated CSS for ${type} theme */
:root{--bg:#0a0f1a;--text:#eaf6ff;--accent:#9ef7d3}
body{background:linear-gradient(180deg,var(--bg),#071223);color:var(--text);font-family:Inter,system-ui,Arial,sans-serif;padding:2rem;margin:0}
header, footer{padding:1rem; text-align:center;}
#site-name{font-weight:700;letter-spacing:0.6px}
#ai-content{background:rgba(255,255,255,0.02);padding:1rem;border-radius:10px; margin:1rem 0}
article img{max-width:100%;border-radius:10px;margin-top:1rem}
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

// --- Generate multiple pages with images ---
function generatePages(num=3) {
  for(let i=1;i<=num;i++){
    const pagePath = path.join(PAGES_DIR,`page${i}.html`);
    const imgFile = path.join(ASSETS_DIR,`image${i}.png`);
    if(!fs.existsSync(imgFile)){
      // Create placeholder image
      const canvas = createCanvas(400,200);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#'+Math.floor(Math.random()*16777215).toString(16);
      ctx.fillRect(0,0,400,200);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`Image ${i}`,120,120);
      fs.writeFileSync(imgFile, canvas.toBuffer('image/png'));
    }
    const content = `<html>
<head>
<title>Page ${i}</title>
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header><h1>Page ${i}</h1></header>
<article>
<p>This page was autonomously generated.</p>
<img src="/assets/image${i}.png" alt="Image ${i}">
</article>
<footer>© 2025 CrowtherTech</footer>
</body>
</html>`;
    fs.writeFileSync(pagePath, content);
  }
}

// --- Generate dynamic favicon ---
function generateFavicon() {
  const canvas = createCanvas(64,64);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#'+Math.floor(Math.random()*16777215).toString(16);
  ctx.fillRect(0,0,64,64);
  fs.writeFileSync(path.join(process.cwd(),'favicon.ico'), canvas.toBuffer('image/png'));
}

// --- Generate sitemap ---
function generateSitemap() {
  const pages = fs.readdirSync(PAGES_DIR).filter(f=>f.endsWith('.html'));
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>./index.html</loc></url>`;
  pages.forEach(p=> xml+=`<url><loc>./pages/${p}</loc></url>`);
  xml += `</urlset>`;
  fs.writeFileSync(path.join(process.cwd(),'data','sitemap.xml'), xml);
}

// --- Run AI ---
function run() {
  console.log('[AI-BRAIN] Starting AI brain run...');
  streamThoughts();
  const { siteName, type, fragment, css } = generateSiteContent();
  updateIndex({ siteName, fragment, css });
  generatePages(3);
  generateFavicon();
  generateSitemap();

  memory.push({ date:new Date().toISOString(), siteName, type });
  fs.writeFileSync(MEMORY, JSON.stringify(memory,null,2));
  console.log(`[AI-BRAIN] AI update applied. Site name: ${siteName}`);
}

run();
