// validator.js
const fs = require('fs');
const path = require('path');

const SITE_DIR = path.join(process.cwd(), 'site');
const FOOTER_SNIPPET = 'Created by CrowtherTech';

function walk(dir, base = '') {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const rel = base ? base + '/' + f : f;
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full, rel));
    else files.push(rel);
  }
  return files;
}

const files = walk(SITE_DIR);
if (files.length === 0) console.log('No files in site/ yet.');

let ok = true;
for (const f of files) {
  const full = path.join(SITE_DIR, f);
  const content = fs.readFileSync(full, 'utf8');
  if (f.endsWith('.html')) {
    if (!content.includes(FOOTER_SNIPPET)) {
      console.error('ERROR: footer missing in', f);
      ok = false;
    }
    if (/src\s*=\s*["']https?:\/\//i.test(content) && /<script/i.test(content)) {
      console.error('ERROR: external script tag detected in', f);
      ok = false;
    }
    if (/src\s*=\s*["']https?:\/\//i.test(content) && /<iframe/i.test(content)) {
      console.error('ERROR: external iframe detected in', f);
      ok = false;
    }
  }
  // size check
  const stat = fs.statSync(full);
  if (stat.size > 150 * 1024) {
    console.error('ERROR: file too large', f, stat.size);
    ok = false;
  }
}
if (ok) console.log('Validator: all checks passed.');
else process.exit(1);