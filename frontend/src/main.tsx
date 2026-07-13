import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { Analytics } from '@vercel/analytics/react'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

import ReactGA from "react-ga4";

if (GA_MEASUREMENT_ID) {
  ReactGA.initialize(GA_MEASUREMENT_ID);
}

// Prerendered pages (scripts/prerender.mjs) ship static head tags for crawlers.
// Strip them before the app mounts so react-helmet-async's per-page tags are the
// only ones in the live DOM (Helmet appends rather than adopting foreign tags).
document.querySelectorAll('[data-prerender]').forEach((el) => el.remove());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
    >
      <HelmetProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HelmetProvider>
      <Analytics />
    </ClerkProvider>
  </StrictMode>,
)
