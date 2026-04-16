import { useState, useEffect, type FC } from 'react';

const NOC_MESSAGES = [
  { icon: "🔌", text: "Connecting to AI matching engine..." },
  { icon: "📄", text: "Extracting job duties from your document..." },
  { icon: "🔍", text: "Scanning 516 NOC 2021 unit groups..." },
  { icon: "⚖️", text: "Evaluating TEER categories and skill levels..." },
  { icon: "🎯", text: "Ranking the strongest matches..." },
  { icon: "📊", text: "Compiling your results..." },
];

const AUDIT_MESSAGES = [
  { icon: "🔌", text: "Connecting to document analysis engine..." },
  { icon: "📄", text: "Reading document structure and formatting..." },
  { icon: "✅", text: "Checking 9 mandatory IRCC requirements..." },
  { icon: "⚖️", text: "Analyzing duties against NOC alignment..." },
  { icon: "⚠️", text: "Identifying red flags and rejection risks..." },
  { icon: "📊", text: "Finalizing your audit report..." },
];

const NOC_RETARGET_MESSAGES = [
  { icon: "🎯", text: "Locking target NOC code..." },
  { icon: "📄", text: "Re-reading your document duties..." },
  { icon: "⚖️", text: "Mapping duties against this specific NOC..." },
  { icon: "🔍", text: "Evaluating alignment strength..." },
  { icon: "📊", text: "Compiling targeted results..." },
];

const ITA_STRATEGY_MESSAGES = [
  { icon: "🧠", text: "Analyzing your CRS profile and score..." },
  { icon: "🔍", text: "Searching Provincial Nominee Program (PNP) pathways..." },
  { icon: "📈", text: "Calculating optimal language test targets..." },
  { icon: "⚖️", text: "Evaluating timeline and cost constraints..." },
  { icon: "🎯", text: "Ranking actions by highest point impact..." },
  { icon: "📊", text: "Compiling your personalized strategy..." },
];

const LETTER_DUTY_MESSAGES = [
  { icon: "📄", text: "Reading your duty statement..." },
  { icon: "🎯", text: "Matching against target NOC duties..." },
  { icon: "⚖️", text: "Evaluating alignment strength..." },
  { icon: "💡", text: "Generating coaching feedback..." },
];

interface DynamicLoaderProps {
  tool: 'noc' | 'audit' | 'noc_retarget' | 'letter_duty' | 'ita_strategy';
  targetNoc?: string;
}

export const DynamicLoader: FC<DynamicLoaderProps> = ({ tool, targetNoc }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const messages = tool === 'noc' ? NOC_MESSAGES : tool === 'audit' ? AUDIT_MESSAGES : tool === 'letter_duty' ? LETTER_DUTY_MESSAGES : tool === 'ita_strategy' ? ITA_STRATEGY_MESSAGES : NOC_RETARGET_MESSAGES;
  const title = tool === 'noc' 
    ? 'Detecting Your NOC Code' 
    : tool === 'audit' 
      ? 'Auditing Employment Letter' 
      : tool === 'letter_duty'
        ? 'Analyzing Your Duty'
        : tool === 'ita_strategy'
          ? 'Building PR Strategy'
          : `Re-evaluating Against NOC ${targetNoc || ''}`;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessageIndex(0);
    setProgress(0);
  }, [tool, targetNoc]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => prev < messages.length - 1 ? prev + 1 : prev);
    }, 5000);
    return () => clearInterval(interval);
  }, [messages.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95; // Never go to 100 until done
        // Slow down as we get closer to the end
        const increment = prev < 40 ? 3 : prev < 70 ? 1.5 : 0.5;
        return Math.min(prev + increment, 95);
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '40px 24px', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      background: 'linear-gradient(180deg, #F8FAFF 0%, #FFFFFF 100%)',
      borderRadius: '16px',
      border: '1px solid rgba(37, 99, 235, 0.08)',
    }}>
      {/* Modern Spinner */}
      <div style={{ position: 'relative', width: '64px', height: '64px', marginBottom: '24px' }}>
        {/* Outer ring */}
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ position: 'absolute', top: 0, left: 0 }}>
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(37, 99, 235, 0.08)" strokeWidth="4" />
          <circle 
            cx="32" cy="32" r="28" fill="none" 
            stroke="url(#spinnerGradient)" 
            strokeWidth="4" 
            strokeLinecap="round"
            strokeDasharray="176" 
            strokeDashoffset="88"
            style={{ animation: 'spinSmooth 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite', transformOrigin: 'center' }}
          />
          <defs>
            <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
        </svg>
        {/* Center icon */}
        <div style={{ 
          position: 'absolute', top: '50%', left: '50%', 
          transform: 'translate(-50%, -50%)', 
          fontSize: '1.4rem',
          animation: 'fadeInOut 5s ease-in-out infinite'
        }}>
          {messages[messageIndex].icon}
        </div>
      </div>

      {/* Title */}
      <h3 style={{ 
        fontSize: '1.15rem', fontWeight: 700, 
        color: '#111827', marginBottom: '16px',
        letterSpacing: '-0.01em'
      }}>
        {title}
      </h3>

      {/* Progress Bar */}
      <div style={{ 
        width: '100%', maxWidth: '320px', 
        height: '4px', background: 'rgba(37, 99, 235, 0.08)', 
        borderRadius: '2px', marginBottom: '20px',
        overflow: 'hidden'
      }}>
        <div style={{ 
          height: '100%', 
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #2563EB, #7C3AED)',
          borderRadius: '2px',
          transition: 'width 0.5s ease-out'
        }} />
      </div>
      
      {/* Step Messages */}
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {messages.map((msg, idx) => (
          <div 
            key={idx}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '6px 14px',
              marginBottom: '4px',
              borderRadius: '8px',
              opacity: idx < messageIndex ? 0.5 : idx === messageIndex ? 1 : 0.2,
              transition: 'all 0.5s ease',
              background: idx === messageIndex ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
            }}
          >
            <div style={{ 
              width: '20px', height: '20px', 
              borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem',
              background: idx < messageIndex ? '#10B981' : idx === messageIndex ? '#2563EB' : '#E5E7EB',
              color: 'white',
              transition: 'all 0.4s ease'
            }}>
              {idx < messageIndex ? '✓' : idx === messageIndex ? (
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ) : ''}
            </div>
            <span style={{ 
              fontSize: '0.88rem', 
              color: idx === messageIndex ? '#111827' : '#6B7280',
              fontWeight: idx === messageIndex ? 600 : 400,
              transition: 'all 0.4s ease'
            }}>
              {msg.text}
            </span>
          </div>
        ))}
      </div>

      <p style={{ 
        fontSize: '0.8rem', color: '#9CA3AF', lineHeight: 1.5, 
        maxWidth: '340px', marginTop: '20px', marginBottom: 0
      }}>
        Deep analysis against official IRCC standards takes <strong style={{ color: '#6B7280' }}>15–45 seconds</strong>.
      </p>

      <style>{`
        @keyframes spinSmooth {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeInOut {
          0%, 100% { opacity: 1; }
          45% { opacity: 1; }
          50% { opacity: 0.3; }
          55% { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
};
