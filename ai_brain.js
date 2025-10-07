const fs = require('fs');
const path = require('path');
const Cohere = require('cohere-ai');
require('dotenv').config();

const COHERE_KEY = process.env.COHERE_API_KEY || 'LzCV9YuZ22dQpW1xlt2EiKK6YcYdSDMKexGFUpn7';
Cohere.init(COHERE_KEY);

const MEMORY_FILE = path.join(__dirname,'data/memory.json');
const PROTECTED_FOOTER = '© 2025 CrowtherTech. All rights reserved.\nCrowtherTech.name.ng';

if(!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE,'[]','utf8');

async function runAI() {
  const memory = JSON.parse(fs.readFileSync(MEMORY_FILE,'utf8'));

  const prompt = `
You are a fully autonomous website AI with free will. Generate:
- Multiple HTML pages (e.g., index.html, about.html) with content and sections.
- CSS styling for the pages.
- Navigation links automatically.
- Optional assets in assets/images/ (names only, no binary).
- Footer must exactly be: "${PROTECTED_FOOTER}"
- No templates. Create freely.
Respond strictly with JSON like:
{
  "pages": ["index.html","about.html"],
  "files": {
    "index.html":"<html>...</html>",
    "about.html":"<html>...</html>",
    "style.css":"CSS content"
  },
  "thinking":"Descriptive AI thoughts here..."
}
`;

  const resp = await Cohere.generate({
    model: 'command-xlarge-nightly',
    prompt,
    max_tokens: 2500,
    temperature: 0.95
  });

  const text = resp.body.generations[0].text;
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}')+1;

  let mapping;
  try {
    mapping = JSON.parse(text.slice(jsonStart,jsonEnd));
  } catch(e) {
    console.error('AI output parse failed:', e.message);
    process.exit(1);
  }

  // Write files
  for(const [file, content] of Object.entries(mapping.files)){
    const filePath = path.join(__dirname, file);
    let data = content;
    if(file.endsWith('.html') && !content.includes(PROTECTED_FOOTER)) {
      data += `\n<footer>${PROTECTED_FOOTER}</footer>`;
    }
    fs.writeFileSync(filePath,data,'utf8');
  }

  const latestHtml = mapping.files['index.html'] || '';
  memory.push({
    time: new Date().toISOString(),
    action:'AI update',
    pages: mapping.pages || ['index.html'],
    lastHtml: latestHtml,
    lastThinking: mapping.thinking || "Creating layout, writing content, designing sections..."
  });

  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory,null,2));
  console.log('AI update applied:', mapping.pages.join(', '));
}

runAI().then(()=>process.exit(0)).catch(err=>{console.error(err); process.exit(1);});