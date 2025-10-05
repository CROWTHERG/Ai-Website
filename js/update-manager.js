import fs from 'fs';

export function generateSitemap(pages) {
  const baseUrl = "https://your-ai-site.com";
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `
  <url>
    <loc>${baseUrl}/${p}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
  </url>`).join('')}
</urlset>`;
  fs.writeFileSync('./data/sitemap.xml', sitemap);
  console.log("🗺️ Sitemap updated");
}