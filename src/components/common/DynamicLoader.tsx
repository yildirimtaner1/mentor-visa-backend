import { useState, useEffect, type FC } from 'react';

const NOC_MESSAGES = [
  "Firing up the AI matching engine...",
  "Extracting your job duties...",
  "Comparing duties against the National Occupational Classification...",
  "Scanning 516 distinct NOC 2021 profiles...",
  "Evaluating TEER categories and skill levels...",
  "Finding the strongest match...",
  "Almost there, compiling results..."
];

const AUDIT_MESSAGES = [
  "Connecting securely to analysis engine...",
  "Reading document structure and contents...",
  "Checking for IRCC mandatory elements (salary, hours, dates)...",
  "Analyzing job duties against official guidelines...",
  "Identifying potential red flags and rejection risks...",
  "Cross-referencing NOC alignment...",
  "Finalizing your audit report..."
];

interface DynamicLoaderProps {
  tool: 'noc' | 'audit';
}

export const DynamicLoader: FC<DynamicLoaderProps> = ({ tool }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = tool === 'noc' ? NOC_MESSAGES : AUDIT_MESSAGES;

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => {
        // Keep cycling or stick to the last few? Let's cycle the middle ones if it takes super long.
        // Or just stop at the last message.
        return prev < messages.length - 1 ? prev + 1 : prev;
      });
    }, 5500); // Change message every 5.5 seconds (gives a good 40s track)
    
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ 
        width: '48px', 
        height: '48px', 
        border: '4px solid rgba(37, 99, 235, 0.1)', 
        borderTopColor: 'var(--primary-color)', 
        borderRadius: '50%', 
        animation: 'spin 1s linear infinite', 
        marginBottom: '20px'
      }} />
      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-color)', marginBottom: '12px' }}>
        {tool === 'noc' ? 'Detecting your NOC Code' : 'Auditing Employment Letter'}
      </h3>
      
      <div style={{ 
        background: 'var(--primary-light)', 
        padding: '10px 20px', 
        borderRadius: '20px',
        maxWidth: '90%',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.1)'
      }}>
        <p style={{ 
          fontSize: '0.95rem', 
          color: 'var(--primary-color)', 
          fontWeight: 600,
          margin: 0,
          lineHeight: 1.4,
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}>
          {messages[messageIndex]}
        </p>
      </div>
      
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '350px' }}>
        Our deep-learning model strictly evaluates every sentence against official IRCC manuals. This deep analysis takes <strong>15 to 45 seconds</strong> on our secure free servers.
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};
