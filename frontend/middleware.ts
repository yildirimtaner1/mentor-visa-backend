// Vercel Edge Middleware — serves pre-rendered OG meta tags to social media bots
// while passing regular users through to the SPA.
//
// Why: Vite SPAs use client-side rendering, so social crawlers (WhatsApp, LinkedIn, 
// Twitter, etc.) see a blank page. This middleware intercepts bot requests and returns 
// a lightweight HTML page with correct meta tags for rich link previews.

const BOT_AGENTS = [
  'facebookexternalhit', 'Facebot', 'Twitterbot', 'LinkedInBot',
  'WhatsApp', 'Slackbot', 'TelegramBot', 'Discordbot', 'Pinterest',
];

const OG_IMAGE = 'https://mentorvisa.com/og-image.png';
const SITE_NAME = 'Mentor Visa';

// Static page meta data for known routes
const PAGE_META: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Mentor Visa — AI-Powered Tools for Canadian Express Entry',
    description: 'Free CRS Calculator, NOC Finder, Employment Letter Auditor, and 70+ term Immigration Glossary. Navigate Canadian Express Entry with confidence.',
  },
  '/audit-employment-letter': {
    title: 'AI Employment Letter Auditor | Mentor Visa',
    description: 'Upload your employment letter and get an instant AI audit against IRCC NOC duty requirements. Catch missing duties before IRCC does.',
  },
  '/find-my-noc': {
    title: 'AI NOC Code Finder | Mentor Visa',
    description: 'Paste your job duties and our AI instantly matches them to the correct 2021 NOC code for Express Entry.',
  },
  '/crs-calculator': {
    title: 'Free CRS Score Calculator 2026 | Mentor Visa',
    description: 'Calculate your Comprehensive Ranking System score for Express Entry. Get your exact CRS points breakdown in 2 minutes.',
  },
  '/build-employment-letter': {
    title: 'AI Employment Letter Builder | Mentor Visa',
    description: 'Generate an IRCC-aligned employment reference letter from your job details. AI-powered to match NOC duty requirements.',
  },
  '/glossary': {
    title: 'Canadian Immigration Glossary — 70+ Terms | Mentor Visa',
    description: 'Comprehensive glossary of 70+ Canadian immigration terms. Understand CRS, IRCC, NOC, LMIA, PNP, and more.',
  },
  '/noc-codes': {
    title: 'Complete NOC 2021 Code Directory — All 516 Occupations | Mentor Visa',
    description: 'Browse all 516 NOC 2021 occupation codes. Filter by TEER, search by job title, and check CEC eligibility.',
  },
  '/express-entry-cec-guide': {
    title: 'Express Entry CEC Guide 2026 | Mentor Visa',
    description: 'Complete guide to the Canadian Experience Class. Eligibility, requirements, CRS points, and how to apply.',
  },
  '/cec-checklist': {
    title: 'CEC Application Checklist 2026 | Mentor Visa',
    description: 'Step-by-step checklist for your Canadian Experience Class application. Never miss a required document.',
  },
  '/draw-results': {
    title: 'Express Entry Draw Results & CRS Scores 2026 | Mentor Visa',
    description: 'Track all Express Entry draw results for 2025-2026. View CRS cutoff scores, ITAs issued, CEC/PNP/category-based draws, and CRS score trends.',
  },
};

function isBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_AGENTS.some(bot => lower.includes(bot.toLowerCase()));
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildMetaPage(title: string, description: string, url: string): string {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${OG_IMAGE}">
<link rel="canonical" href="${escapeHtml(url)}">
</head>
<body><h1>${t}</h1><p>${d}</p></body>
</html>`;
}

export default function middleware(request: Request): Response | undefined {
  const ua = request.headers.get('user-agent') || '';

  // Only intercept social media bots
  if (!isBot(ua)) return undefined;

  const url = new URL(request.url);
  const pathname = url.pathname;

  // Look up meta for this path
  let meta = PAGE_META[pathname];

  // Dynamic: NOC detail pages
  if (!meta && pathname.startsWith('/noc-codes/')) {
    const code = pathname.split('/').pop();
    if (code && /^\d{5}$/.test(code)) {
      meta = {
        title: `NOC ${code} — Express Entry Occupation Guide | Mentor Visa`,
        description: `View official duties, TEER category, immigration eligibility, and related occupations for NOC ${code}. Check CEC qualification.`,
      };
    }
  }

  // No match — let it fall through to index.html
  if (!meta) return undefined;

  const fullUrl = `https://mentorvisa.com${pathname}`;
  return new Response(buildMetaPage(meta.title, meta.description, fullUrl), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
