import { type FC } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SEO } from './common/SEO';

const POPULAR_NOCS: Record<string, { title: string, teer: string, duties: string[], description: string }> = {
  '21231': {
    title: 'Software engineers and designers',
    teer: '1',
    description: 'Software engineers and designers research, design, evaluate, integrate and maintain software applications, technical environments, operating systems, embedded software, information data warehouses and telecommunications software.',
    duties: [
      'Collect and document users\' requirements and develop logical and physical specifications',
      'Research, evaluate and synthesize technical information to design, develop and test computer-based systems',
      'Develop data, process and network models to optimize architecture and to evaluate the performance and reliability of designs'
    ]
  },
  '11202': {
    title: 'Professional occupations in advertising, marketing and public relations',
    teer: '1',
    description: 'This unit group includes specialists in advertising, marketing and public relations who analyze, develop and implement communication and promotion strategies.',
    duties: [
      'Assess characteristics of products or services to be promoted and advise on the advertising needs of an establishment',
      'Develop and implement advertising campaigns appropriate for print or electronic media',
      'Develop, implement and evaluate communication strategies and programs'
    ]
  },
  '10011': {
    title: 'Financial managers',
    teer: '0',
    description: 'Financial managers plan, organize, direct, control and evaluate the operation of financial and accounting departments.',
    duties: [
      'Plan, organize, direct, control and evaluate the operation of an accounting, audit or other financial department',
      'Develop and implement the financial policies, systems and procedures of an establishment',
      'Evaluate financial reporting systems, accounting procedures and investment activities'
    ]
  }
};

export const NOCDetailsPage: FC = () => {
  const { code } = useParams<{ code: string }>();
  const noc = code ? POPULAR_NOCS[code] : undefined;

  if (!noc) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2>NOC Not Found</h2>
        <p>Return to the <Link to="/find-my-noc">NOC Finder tool</Link>.</p>
      </div>
    );
  }

  return (
    <div>
      <SEO 
        title={`NOC ${code} ${noc.title} | Express Entry CEC Guide`}
        description={`Learn the exact duties, TEER category, and Express Entry requirements for NOC ${code} (${noc.title}). Get your employment letter audited against these official duties.`}
        canonical={`/noc-codes/${code}`}
      />
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">📖 Official NOC 2021 Guide</div>
          <h1>NOC {code}<br /><span className="hero-highlight">{noc.title}</span></h1>
          <p>TEER Category {noc.teer} — Eligible for Canadian Experience Class (CEC)</p>
        </div>
      </section>
      
      <div className="page-container">
        <section className="page-section">
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '16px' }}>Overview of NOC {code}</h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-color)', lineHeight: 1.7, marginBottom: '40px' }}>
              {noc.description}
            </p>

            <h2 style={{ marginBottom: '16px' }}>Main Duties</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              To successfully claim NOC {code} for your Express Entry application, your employment reference letter must demonstrate that you performed a substantial number of the following main duties:
            </p>
            <ul style={{ background: '#F8FAFC', padding: '24px 24px 24px 40px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '40px' }}>
              {noc.duties.map((duty, idx) => (
                <li key={idx} style={{ marginBottom: '12px', lineHeight: 1.6, fontSize: '0.95rem' }}>{duty}</li>
              ))}
            </ul>

            <div className="highlight-box highlight-box-blue" style={{ marginBottom: '40px' }}>
              <h3 style={{ marginTop: 0, color: '#1E40AF', fontSize: '1.1rem' }}>⚠️ Critical Warning for Express Entry</h3>
              <p style={{ margin: 0 }}>
                Do NOT copy and paste these duties exactly word-for-word into your employment letter. Immigration officers regularly reject applications that plagiarize the NOC directory. Your letter must describe these duties in your own words.
              </p>
            </div>

            <h2 style={{ marginBottom: '20px' }}>Verify Your Employment Letter</h2>
            <p style={{ marginBottom: '24px', lineHeight: 1.6 }}>
              Not sure if the duties written by your manager align well enough with NOC {code}? 
              Use our AI Auditor to scan your letter and check the similarity match against the official IRCC database.
            </p>
            <Link to="/audit-employment-letter" className="btn btn-primary btn-lg">
              📄 Audit Employment Letter Now
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};
