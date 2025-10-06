import fs from 'fs';
import path from 'path';

const INDEX = path.join(process.cwd(),'index.html');
const MEMORY = path.join(process.cwd(),'memory.json');
const PAGES_DIR = path.join(process.cwd(),'pages');
const START = '<!-- AI-START -->';
const END = '<!-- AI-END -->';

function read(p){ return fs.existsSync(p)?fs.readFileSync(p,'utf8'):""; }
function write(p,c){ fs.writeFileSync(p,c,'utf8'); }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function generateContent(memory){
  const names = ['Aurora','Nova','Lumen','Echo','Pulse'];
  const types = ['microblog','portfolio','gallery','tools-portal'];
  const name = `${names[memory.length%names.length]}-${Math.floor(Math.random()*900+100)}`;
  const type = types[memory.length%types.length];
  const htmlFragment = `<article>
<h2>Welcome to ${name}</h2>
<p>Type: ${type}. AI evolving site autonomously.</p>
<p>Generated at: ${new Date().toLocaleString()}</p>
</article>`;
  const textLines = [
    `Generating site: ${name}`,
    `Type: ${type}`,
    `Creating layout and content...`,
    `Updating pages and styles...`,
    `Saving to memory.json...`
  ];
  return { htmlFragment, textLines, name, type };
}

async function run(){
  if(!fs.existsSync(PAGES_DIR)) fs.mkdirSync(PAGES_DIR);
  let memory = [];
  try{ memory = JSON.parse(read(MEMORY)||'[]'); }catch{}
  const plan = generateContent(memory);

  // Stream thinking
  for(const line of plan.textLines){
    for(const word of line.split(' ')){
      process.stdout.write(word+' ');
      await sleep(80);
    }
    process.stdout.write('\n');
    await sleep(150);
  }

  // Update index.html
  let html = read(INDEX);
  const s = html.indexOf(START);
  const e = html.indexOf(END);
  const before = html.slice(0,s+START.length);
  const after = html.slice(e);
  write(INDEX, before+'\n'+plan.htmlFragment+'\n'+after);

  // Optionally create a new page
  const pageName = `page-${memory.length+1}.html`;
  const pagePath = path.join(PAGES_DIR,pageName);
  write(pagePath, `<html><head><title>${plan.name}</title></head><body>${plan.htmlFragment}</body></html>`);

  // Update memory
  memory.push({ date: new Date().toISOString(), siteName: plan.name, siteType: plan.type, page: pageName });
  write(MEMORY, JSON.stringify(memory,null,2));

  console.log(`AI update applied: ${plan.name}`);
}

run().catch(err=>{ console.error(err); process.exit(1); });