const d = require('./noc_index.json');
const codes = Object.keys(d).map(k => d[k].code);
const fs = require('fs');

const today = '2026-04-15';

function addUrl(loc, prio, freq) {
  return `  <url>
    <loc>https://mentorvisa.com${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${prio}</priority>
  </url>\n`;
}

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

// Core pages
xml += addUrl('/', 1.0, 'weekly');
xml += addUrl('/audit-employment-letter', 0.9, 'monthly');
xml += addUrl('/find-my-noc', 0.9, 'monthly');
xml += addUrl('/build-employment-letter', 0.9, 'monthly');
xml += addUrl('/crs-calculator', 0.9, 'monthly');
xml += addUrl('/draw-results', 0.9, 'weekly');
xml += addUrl('/express-entry-cec-guide', 0.8, 'monthly');
xml += addUrl('/cec-checklist', 0.8, 'monthly');
xml += addUrl('/glossary', 0.8, 'weekly');

// NOC Directory
xml += addUrl('/noc-codes', 0.8, 'weekly');
codes.forEach(c => {
  xml += addUrl('/noc-codes/' + c, 0.6, 'monthly');
});

// Legal pages
xml += addUrl('/privacy-policy', 0.3, 'yearly');
xml += addUrl('/terms-of-service', 0.3, 'yearly');
xml += addUrl('/refund-policy', 0.3, 'yearly');

xml += '</urlset>\n';

fs.writeFileSync('../frontend/public/sitemap.xml', xml);
console.log('Sitemap written with ' + (11 + codes.length) + ' URLs');
