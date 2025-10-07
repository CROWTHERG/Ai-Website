const fs = require('fs');
const path = require('path');
const Cohere = require('cohere-ai');
require('dotenv').config();

const COHERE_KEY = process.env.COHERE_API_KEY || 'LzCV9YuZ22dQpW1xlt2EiKK6YcYdSDMKexGFUpn7';
Cohere.init(COHERE_KEY);

const INDEX = path.join(__dirname,'index.html');
const CSS = path.join(__dirname,'style.css');
const MEMORY_FILE = path.join(__dirname,'memory.json');
const PROTECTED_FOOTER = '© 2025 CrowtherTech. All rights reserved.\nCrowtherTech.name.ng';

if(!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE,'[]','utf8');

async function runAI() {
  const memory = JSON.parse(fs.readFileSync(MEMORY_FILE,'utf8'));
  const prompt = `
You are a fully autonomous website AI with free will. Generate a complete homepage and CSS.
- Homepage must include: header, navigation, main sections with content, footer.
- You are free to create all content, styles, and sections, no templates.
- Footer must include exactly: "${PROTECTED_FOOTER}"
- Provide JSON output exactly like:
{
  "index.html": "<!DOCTYPE html>...</html>",
  "style.css": "CSS content here"
}
- Include links, headings, text, anything you want.
`;

  const resp = await Cohere.generate({
    model: 'command-xlarge-nightly',
    prompt,
    max_tokens: 2500,
    temperature: 0.95
  });

  const text = resp.body.generations[0].text;
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}') + 1;
  let mapping;
  try {
    mapping = JSON.parse(text.slice(jsonStart,jsonEnd));
  } catch(e) {
    console.error('Failed to parse AI output:', e.message);
    process.exit(1);
  }

  for(const [file, content] of Object.entries(mapping)){
    const safeFile = path.join(__dirname, file);
    let data = content;
    if(file.endsWith('.html') && !content.includes(PROTECTED_FOOTER)) {
      data += `\n<footer>${PROTECTED_FOOTER}</footer>`;
    }
    fs.writeFileSync(safeFile, data, 'utf8');
  }

  memory.push({time:new Date().toISOString(), action:'AI update', files:Object.keys(mapping)});
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory,null,2));

  console.log('AI update applied. Files written:', Object.keys(mapping).join(', '));
}

runAI().then(()=>process.exit(0)).catch(err=>{console.error(err); process.exit(1);});