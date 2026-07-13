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

// Routes with a dedicated OG card (public/og/<route>.png, from backend/gen_og_images.py).
const OG_ROUTES = new Set([
  '/crs-calculator', '/find-my-noc', '/audit-employment-letter', '/track-my-application',
  '/order-gcms-notes', '/how-to-read-gcms-notes', '/draw-results', '/express-entry-processing-times',
  '/noc-codes', '/get-started', '/pricing',
]);

function ogFor(pathname: string): string {
  if (OG_ROUTES.has(pathname)) return `https://mentorvisa.com/og${pathname}.png`;
  if (pathname.startsWith('/noc-codes/')) return 'https://mentorvisa.com/og/noc-codes.png';
  if (pathname.startsWith('/draw-results/')) return 'https://mentorvisa.com/og/draw-results.png';
  return OG_IMAGE;
}

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
  '/track-my-application': {
    title: 'Express Entry Application Tracker & Timeline Predictions | Mentor Visa',
    description: 'Track every Express Entry PR milestone and get processing-time predictions tailored to your stream, country and category from 700+ real recent applications.',
  },
  '/express-entry-processing-times': {
    title: 'Express Entry Processing Times 2026 — AOR to eCOPR | Mentor Visa',
    description: 'How long does each Express Entry milestone actually take? Median timelines from 700+ real recent PR applications, by stream and milestone.',
  },
  '/get-started': {
    title: 'Am I Eligible for Canada PR? Free Express Entry Check | Mentor Visa',
    description: 'Free eligibility assessment for Express Entry (FSWP, CEC, FSTP). Find out if you qualify for Canada Permanent Residence in under 3 minutes.',
  },
  '/ai-profile-assistant': {
    title: 'Express Entry AI Assistant — Instant IRCC Application Help | Mentor Visa',
    description: 'Ask anything about your Express Entry profile or e-APR and get instant, accurate answers. AI help for IRCC portal questions.',
  },
  '/gckey-setup-guide': {
    title: 'GCKey Setup Guide — Create Your IRCC Account | Mentor Visa',
    description: 'Step-by-step guide to creating your GCKey and IRCC secure account for Express Entry. Screenshots, common errors, and fixes.',
  },
  '/documents': {
    title: '12 Mistakes That Get PR Applications Refused | Mentor Visa',
    description: "Don't let a preventable mistake cost you your Canada PR. Learn the 12 most common errors and how to avoid them.",
  },
  '/pricing': {
    title: 'Pricing — Mentor Visa Canada PR Platform',
    description: 'Choose the plan that fits your PR journey. Free tools, Optimize bundle ($49), or Execute package ($99). One-time payments, no subscription.',
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
  '/order-gcms-notes': {
    title: 'Order Your GCMS Notes — Full IRCC File in 30-40 Days | Mentor Visa',
    description: 'See exactly why your application is delayed or was refused. We file your ATIP request and email you the complete GCMS notes. $19.90 CAD flat.',
  },
  '/how-to-read-gcms-notes': {
    title: 'How to Read Your GCMS Notes: Codes, Stages & Red Flags Explained | Mentor Visa',
    description: 'A plain-English guide to interpreting GCMS notes: the AOR-to-PPR pipeline, what R10, A11.2, RFV, ADR and PFL mean, and the red flags that predict delays or refusals.',
  },
};

function isBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_AGENTS.some(bot => lower.includes(bot.toLowerCase()));
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildMetaPage(title: string, description: string, url: string, image: string): string {
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
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${image}">
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
  return new Response(buildMetaPage(meta.title, meta.description, fullUrl, ogFor(pathname)), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
