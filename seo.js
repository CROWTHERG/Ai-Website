// seo.js
const fs = require('fs');
const path = require('path');

function extractText(htmlFragment){
  return htmlFragment.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}

function generateMetaFromFragment(fragment, siteName){
  const text = extractText(fragment);
  const description = text.slice(0,160) || `Autonomous site ${siteName}`;
  // simple keyword harvest (non-exhaustive)
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const freq = {};
  words.forEach(w => freq[w] = (freq[w]||0)+1);
  const keywords = Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,12).join(',');
  return {
    title: `${siteName} — An Autonomous AI Site`,
    description,
    keywords
  };
}

function writeMeta(meta){
  const outDir = path.join(process.cwd(),'data');
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'meta.json'), JSON.stringify(meta,null,2),'utf8');
}

module.exports = { generateMetaFromFragment, writeMeta };