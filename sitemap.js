// sitemap.js
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.BASE_URL || 'https://your-ai-site.example'; // set your URL
const pagesDir = path.join(process.cwd(),'pages');
const outDir = path.join(process.cwd(),'data');
if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});

function listPages(){
  const pages = ['index.html'];
  if(fs.existsSync(pagesDir)){
    const items = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
    items.forEach(i => pages.push(`pages/${i}`));
  }
  return pages;
}

function generate(){
  const pages = listPages();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p=>`  <url>
    <loc>${baseUrl}/${p}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
  </url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(outDir,'sitemap.xml'), xml, 'utf8');
  console.log('Sitemap generated with pages:', pages);
}

if(require.main === module) generate();
module.exports = generate;