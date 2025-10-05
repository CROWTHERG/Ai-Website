// validator.js
const fs = require('fs');
const path = require('path');

const INDEX = path.join(process.cwd(),'index.html');
const START = '<!-- AI-START -->';
const END = '<!-- AI-END -->';
const CSS_START = '/* AI-CSS-START */';
const CSS_END = '/* AI-CSS-END */';
const PROTECTED_SNIPPET = 'Created by CrowtherTech';

function abort(msg){
  console.error(msg);
  process.exit(1);
}

if(!fs.existsSync(INDEX)) abort('index.html missing.');
const html = fs.readFileSync(INDEX,'utf8');
if(!html.includes(START) || !html.includes(END)) abort('AI HTML markers missing.');
if(!html.includes(PROTECTED_SNIPPET)) abort('Protected creator info missing or modified!');
const cssPath = path.join(process.cwd(),'style.css');
if(!fs.existsSync(cssPath)) abort('style.css missing.');
const css = fs.readFileSync(cssPath,'utf8');
if(!css.includes(CSS_START) || !css.includes(CSS_END)) abort('AI CSS markers missing.');
console.log('Validator OK: markers and protected info present.');