import { type FC } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SEO } from './common/SEO';
import { ALL_DRAWS, findDrawBySlug, drawSlug, DRAW_TYPE_COLORS } from '../data/drawResults';

/**
 * One page per Express Entry draw (e.g. /draw-results/2026-07-10-senior-managers).
 * Captures the news-query spike after every IRCC round; each page is prerendered
 * to static HTML at build time (scripts/prerender.mjs shares the slug formula).
 */

const DRAW_TYPE_LABELS: Record<string, string> = {
  CEC: 'Canadian Experience Class',
  PNP: 'Provincial Nominee Program',
  French: 'French-Language Proficiency',
  Healthcare: 'Healthcare & Social Services',
  Trades: 'Trades',
  Education: 'Education',
  General: 'No Program Specified',
  Physicians: 'Physicians',
  'Senior Managers': 'Senior Managers',
  STEM: 'STEM',
  Transport: 'Transport',
  Agriculture: 'Agriculture & Agri-Food',
};

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

const fmtNum = (n: number) => n.toLocaleString('en-CA');

export const DrawDetailPage: FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const draw = slug ? findDrawBySlug(slug) : undefined;

  if (!draw) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <SEO title="Draw Not Found | Mentor Visa" description="This Express Entry draw could not be found." noindex />
        <h1 style={{ fontSize: '1.4rem' }}>Draw not found</h1>
        <p style={{ color: 'var(--text-muted)' }}>We couldn't find that Express Entry draw.</p>
        <Link to="/draw-results" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '12px' }}>
          View all draw results →
        </Link>
      </div>
    );
  }

  const label = DRAW_TYPE_LABELS[draw.drawType] || draw.drawType;
  const color = DRAW_TYPE_COLORS[draw.drawType] || '#64748b';
  const sameType = ALL_DRAWS.filter(d => d.drawType === draw.drawType);
  const idx = sameType.findIndex(d => drawSlug(d) === slug);
  const prev = idx >= 0 ? sameType[idx + 1] : undefined; // draws are sorted newest-first
  const delta = prev ? draw.crsScore - prev.crsScore : null;
  const yearDraws = sameType.filter(d => d.date.startsWith(draw.date.slice(0, 4)));
  const yearItas = yearDraws.reduce((s, d) => s + d.itasIssued, 0);
  const related = sameType.filter(d => drawSlug(d) !== slug).slice(0, 5);

  const title = `Express Entry Draw ${fmtDate(draw.date)}: ${label} — CRS ${draw.crsScore} | Mentor Visa`;
  const description = `IRCC issued ${fmtNum(draw.itasIssued)} ITAs to ${label} candidates on ${fmtDate(draw.date)} with a CRS cut-off of ${draw.crsScore}${
    delta !== null ? ` (${delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged'}${delta !== 0 ? ` ${Math.abs(delta)} points` : ''} vs the previous ${draw.drawType} draw)` : ''
  }. Full details and CRS trend.`;

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Express Entry ${label} draw — ${fmtDate(draw.date)}`,
    datePublished: draw.date,
    description,
    author: { '@type': 'Organization', name: 'Mentor Visa', url: 'https://mentorvisa.com' },
    publisher: { '@type': 'Organization', name: 'Mentor Visa', logo: { '@type': 'ImageObject', url: 'https://mentorvisa.com/logo.png' } },
    mainEntityOfPage: `https://mentorvisa.com/draw-results/${slug}`,
  });

  return (
    <div>
      <SEO title={title} description={description} canonical={`/draw-results/${slug}`} schema={schema}
        keywords={`Express Entry draw ${draw.date}, ${label} draw, CRS cutoff ${draw.crsScore}, ITA ${draw.date}, IRCC draw results`} />

      <div className="page-container">
        <section className="page-section" style={{ maxWidth: '760px', margin: '0 auto' }}>
          <p style={{ fontSize: '0.85rem', marginBottom: '14px' }}>
            <Link to="/draw-results" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>← All draw results</Link>
          </p>

          <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '999px', background: `${color}18`, color, fontWeight: 700, fontSize: '0.8rem', marginBottom: '10px' }}>
            {label}
          </span>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, lineHeight: 1.3, marginBottom: '8px' }}>
            Express Entry Draw — {fmtDate(draw.date)}
          </h1>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '22px' }}>
            IRCC invited <strong>{fmtNum(draw.itasIssued)}</strong> {label} candidates to apply for permanent residence.
            The lowest-ranked candidate invited had a CRS score of <strong>{draw.crsScore}</strong>.
            {draw.notes ? ` ${draw.notes}` : ''}
          </p>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'CRS cut-off', value: String(draw.crsScore) },
              { label: 'ITAs issued', value: fmtNum(draw.itasIssued) },
              { label: `vs previous ${draw.drawType} draw`, value: delta === null ? '—' : delta === 0 ? '±0' : `${delta > 0 ? '▲ +' : '▼ '}${delta}` },
              { label: `${draw.drawType} ITAs in ${draw.date.slice(0, 4)}`, value: fmtNum(yearItas) },
            ].map((s, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* What it means */}
          <div style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '22px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '10px' }}>What this draw means for you</h2>
            <p style={{ fontSize: '0.92rem', lineHeight: 1.7, marginBottom: '12px' }}>
              {delta !== null && delta < 0 && `The cut-off dropped ${Math.abs(delta)} points from the previous ${label} draw — good news if your score sits just below recent cut-offs. `}
              {delta !== null && delta > 0 && `The cut-off rose ${delta} points from the previous ${label} draw — competition in this category is tightening. `}
              {delta === null && `This is the first ${label} draw in our dataset. `}
              If your CRS score is at or above <strong>{draw.crsScore}</strong>, you would have received an ITA in this round.
              Below it? A few points often come from fixable factors — language retests, sibling points, or a better-documented NOC.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link to="/crs-calculator" className="btn btn-primary" style={{ textDecoration: 'none' }}>Calculate my CRS score</Link>
              <Link to="/find-my-noc" className="btn btn-outline" style={{ textDecoration: 'none' }}>Verify my NOC code</Link>
            </div>
          </div>

          {/* Related draws */}
          {related.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px' }}>Recent {label} draws</h2>
              {related.map(d => (
                <Link key={drawSlug(d)} to={`/draw-results/${drawSlug(d)}`}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '11px 16px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '8px', textDecoration: 'none', color: 'inherit', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                  <span>{fmtDate(d.date)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{fmtNum(d.itasIssued)} ITAs · CRS <strong style={{ color: 'var(--primary-color)' }}>{d.crsScore}</strong></span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DrawDetailPage;
