/**
 * ProfileBuilderPage — AI Concierge Chat for Express Entry Profile Creation
 * 
 * Graduated access funnel:
 * - Anonymous: 1 free question → sign-in gate
 * - Free tier: 5 questions → upgrade CTA (Starter $49)
 * - Optimize tier: 20 questions → upgrade CTA (Complete $99)
 * - Execute tier: Unlimited
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser, useClerk } from '@clerk/clerk-react';
import { useProfileChat, type ChatMessage } from '../hooks/useProfileChat';
import { useJourneyStore } from '../stores/journeyStore';
import { createCheckoutSession } from '../services/api';
import ReactMarkdown from 'react-markdown';
import { SEO } from './common/SEO';
import { CheckCircle2, X } from 'lucide-react';
import './ProfileBuilderPage.css';
import './PricingPage.css';

function Feature({ 
  children, 
  included = false, 
  highlight = false 
}: { 
  children: React.ReactNode; 
  included?: boolean;
  highlight?: boolean;
}) {
  return (
    <li className={`pricing-feature ${highlight ? 'highlight' : ''}`}>
      {included ? (
        <CheckCircle2 size={16} className="feature-check" />
      ) : (
        <X size={16} className="feature-x" />
      )}
      <span>{children}</span>
    </li>
  );
}

// ── Quick action chip suggestions ──
const QUICK_CHIPS = [
  "What's an ECA?",
  "How do part-time hours work?",
  "What language tests are accepted?",
  "Do I need proof of funds?",
  "What is a TEER category?",
  "How do I enter my NOC code?",
];

export default function ProfileBuilderPage() {
  const { isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const navigate = useNavigate();

  // Journey store data (for welcome message context)
  const { noc, crs, eligibility } = useJourneyStore();

  // Chat hook
  const {
    messages,
    isStreaming,
    conversationId,
    pastConversations,
    creditsRemaining,
    creditsTotal,
    error,
    anonymousUsed,
    creditsExhausted,
    upgradeTier,
    currentTier,
    sendMessage,
    loadConversation,
    startNewConversation,
    fetchConversations,
  } = useProfileChat();

  // Local UI state
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const messageListRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch conversations on mount
  useEffect(() => {
    if (isSignedIn) {
      fetchConversations();
    }
  }, [isSignedIn]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Auto-resize textarea
  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  // Handle send
  const handleSend = useCallback(async () => {
    if ((!inputText.trim() && !attachedImage) || isStreaming) return;
    const text = inputText;
    const image = attachedImage;
    setInputText('');
    setAttachedImage(null);
    setImagePreview(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(text, image || undefined);
  }, [inputText, attachedImage, isStreaming, sendMessage]);

  // Handle Enter key (Shift+Enter for newline)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Handle image attachment
  const handleAttachImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be under 5MB.');
        return;
      }
      setAttachedImage(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  // Handle paste (for screenshots)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setAttachedImage(file);
          const reader = new FileReader();
          reader.onload = () => setImagePreview(reader.result as string);
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  }, []);

  const handleRemoveImage = () => {
    setAttachedImage(null);
    setImagePreview(null);
  };

  // Quick chip click
  const handleChipClick = (text: string) => {
    setInputText(text);
    textareaRef.current?.focus();
  };

  // Upgrade handler — routes to the correct tier
  const handleUpgrade = async (targetTier: 'starter' | 'complete' = 'starter') => {
    try {
      const token = await getToken();
      if (!token) {
        clerk.openSignIn();
        return;
      }
      const result = await createCheckoutSession(targetTier, token, '/ai-profile-assistant');
      if (result.session_url) {
        window.location.href = result.session_url;
      }
    } catch (err) {
      console.error('Checkout failed:', err);
    }
  };

  // ── Determine input disabled state ──
  const isInputDisabled = isStreaming
    || (!isSignedIn && anonymousUsed)
    || (isSignedIn && creditsExhausted);

  // ── Build profile chips from journey store ──
  const profileChips: string[] = [];
  if (noc.code) profileChips.push(`NOC ${noc.code}`);
  if (crs.score) profileChips.push(`CRS ${crs.score}`);
  if (eligibility.cecEligible) profileChips.push('CEC ✓');
  if (eligibility.fswpEligible) profileChips.push('FSWP ✓');

  const isNewConversation = messages.length === 0;
  const showHero = isNewConversation && !isStreaming;

  return (
    <div>
      <SEO
        title="Express Entry AI Assistant — Mentor Visa"
        description="AI-powered assistant for creating your Express Entry profile on the IRCC portal."
      />

      {/* Hero — shown only in welcome state (no messages yet) */}
      {showHero && (
        <section className="page-hero">
          <div className="page-hero-content">
            <div className="page-hero-badge">🤖 AI-Powered Assistant</div>
            <h1>Your Personal<br /><span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>Express Entry Advisor</span></h1>
            <p style={{ maxWidth: '700px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
              Get expert AI guidance while creating your Express Entry profile on the IRCC portal. Ask any question, paste portal text, or upload screenshots — and get instant, personalized help.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>💬 <span style={{ color: 'var(--primary-light)' }}>Ask Anything</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📸 Screenshot Support</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🎯 IRCC-Specific Guidance</span>
            </div>
          </div>
        </section>
      )}

      {/* Chat container */}
      <div className={`pb-container ${showHero ? 'pb-with-hero' : ''}`}>
        {/* History panel — only for signed-in users */}
        {isSignedIn && showHistory && (
          <div className="pb-history-panel">
            <div className="pb-history-header">
              <h3>Past Conversations</h3>
              <button className="pb-history-close" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="pb-history-list">
              {pastConversations.length === 0 && (
                <p style={{ fontSize: 13, color: '#64748b', padding: '16px', textAlign: 'center' }}>
                  No past conversations yet.
                </p>
              )}
              {pastConversations.map((c) => (
                <div
                  key={c.conversation_id}
                  className={`pb-history-item ${c.conversation_id === conversationId ? 'active' : ''}`}
                  onClick={() => {
                    loadConversation(c.conversation_id);
                    setShowHistory(false);
                  }}
                >
                  <div className="pb-history-item-title">{c.title}</div>
                  <div className="pb-history-item-date">
                    {c.updated_at ? new Date(c.updated_at).toLocaleDateString() : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="pb-header">
          <div className="pb-header-left">
            <div className="pb-header-avatar">AI</div>
            <div>
              <div className="pb-header-title">Express Entry AI Assistant</div>
              <div className="pb-header-subtitle">
                {isStreaming ? 'Thinking...' : 'AI help for IRCC profile creation'}
              </div>
            </div>
          </div>
          <div className="pb-header-actions">
            {isSignedIn && (
              <>
                <button className="pb-btn-icon" onClick={() => { setShowHistory(true); fetchConversations(); }}>
                  History
                </button>
                <button className="pb-btn-icon" onClick={startNewConversation}>
                  + New Chat
                </button>
              </>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && error !== 'sign_in_required' && (
          <div className="pb-error">
            ⚠️ {error}
          </div>
        )}

        {/* Message list */}
        <div className="pb-message-list" ref={messageListRef}>
          {isNewConversation ? (
            <div className="pb-welcome">
              <div className="pb-welcome-icon">✦</div>
              <h2>How can I help with your profile?</h2>
              <p>
                I'll help you navigate the IRCC Express Entry portal. Ask me anything —
                or paste text and screenshots from canada.ca and I'll guide you through it.
              </p>
              {isSignedIn && profileChips.length > 0 && (
                <div className="pb-welcome-profile">
                  {profileChips.map((chip, i) => (
                    <span key={i} className="pb-profile-chip">{chip}</span>
                  ))}
                </div>
              )}
              {!isSignedIn && !anonymousUsed && (
                <p style={{ fontSize: '0.82rem', color: 'var(--primary-light)', fontWeight: 600, marginTop: '4px' }}>
                  ✨ Try 1 question free — no sign-up required
                </p>
              )}
              {!isSignedIn && anonymousUsed && (
                <div style={{ marginTop: '24px', background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', padding: '20px', borderRadius: '12px', border: '1px solid #BFDBFE' }}>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1E3A8A', margin: '0 0 8px 0' }}>Want to keep chatting?</p>
                  <p style={{ fontSize: '0.9rem', color: '#1E40AF', margin: '0 0 16px 0' }}>Create a free account to get <strong>5 more questions</strong> — plus access to all our free tools.</p>
                  <button className="pb-upgrade-btn" onClick={() => clerk.openSignIn()}>
                    Sign In — It's Free →
                  </button>
                </div>
              )}
              <div className="pb-quick-chips">
                {QUICK_CHIPS.map((chip) => (
                  <button key={chip} className="pb-chip" onClick={() => handleChipClick(chip)} disabled={isInputDisabled}>
                    {chip}
                  </button>
                ))}
              </div>
              {isSignedIn && creditsExhausted && (
                <div className="pricing-grid-2" style={{ marginTop: '2rem', marginBottom: '2rem', width: '100%' }}>
                  {upgradeTier === 'starter' && (
                    <div className="pricing-card" style={{ background: '#ffffff', maxWidth: '350px' }}>
                      <div className="pricing-card-header">
                        <h3>Optimize</h3>
                        <div className="pricing-price">$49 <span>CAD</span></div>
                        <p className="pricing-desc">Everything you need to perfect your profile.</p>
                      </div>
                      <ul className="pricing-features">
                        <Feature included>20 Question Credits - Express Entry AI Assistant</Feature>
                        <Feature included>Unlimited Employment Letter Audits</Feature>
                        <Feature included>Unlimited CRS Point Simulator (What-If Scenarios)</Feature>
                        <Feature included>Personalized Document Checklist</Feature>
                        <Feature included>Document Expiry Tracking</Feature>
                      </ul>
                      <div className="pricing-card-footer">
                        <button className="pricing-btn secondary" style={{ width: '100%' }} onClick={() => handleUpgrade('starter')}>
                          Get Optimize — $49 CAD
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className={`pricing-card featured animate-reveal delay-1 ${upgradeTier === 'complete' ? 'single-centered' : ''}`} style={{ maxWidth: '350px', margin: upgradeTier === 'complete' ? '0 auto' : '0' }}>
                    <div className="pricing-popular-badge">⭐ ULTIMATE</div>
                    <div className="pricing-card-header">
                      <h3>Execute</h3>
                      <div className="pricing-price">$99 <span>CAD</span></div>
                      <p className="pricing-desc">Your complete AI toolkit for absolute peace of mind.</p>
                    </div>
                    <ul className="pricing-features">
                      <Feature included>Everything in Optimize</Feature>
                      <Feature included>Unlimited Express Entry AI Assistant</Feature>
                      <Feature included>Priority Early Access to Features</Feature>
                    </ul>
                    <div className="pricing-card-footer">
                      <button className="pricing-btn primary" style={{ width: '100%' }} onClick={() => handleUpgrade('complete')}>
                        Get Execute — $99 CAD
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} isStreaming={isStreaming && msg === messages[messages.length - 1] && msg.role === 'assistant'} />
              ))}
              {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                <div className="pb-message assistant">
                  <div className="pb-avatar assistant">AI</div>
                  <div className="pb-bubble">
                    <div className="pb-typing">
                      <div className="pb-typing-dot" />
                      <div className="pb-typing-dot" />
                      <div className="pb-typing-dot" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Inline gate: Anonymous used ── */}
              {!isSignedIn && anonymousUsed && !isStreaming && (
                <div className="pb-gate-banner">
                  <div className="pb-gate-icon">🔓</div>
                  <div className="pb-gate-content">
                    <h3>Want to keep chatting?</h3>
                    <p>Create a free account to get <strong>5 more questions</strong> — plus access to all our free tools.</p>
                    <button className="pb-upgrade-btn" onClick={() => clerk.openSignIn()}>
                      Sign In — It's Free →
                    </button>
                  </div>
                </div>
              )}

              {/* ── Inline gate: Credits exhausted (signed in) ── */}
              {isSignedIn && creditsExhausted && !isStreaming && (
                <div className="pricing-grid-2" style={{ marginTop: '2rem', marginBottom: '2rem', width: '100%' }}>
                  {upgradeTier === 'starter' && (
                    <div className="pricing-card" style={{ background: '#ffffff', maxWidth: '350px' }}>
                      <div className="pricing-card-header">
                        <h3>Optimize</h3>
                        <div className="pricing-price">$49 <span>CAD</span></div>
                        <p className="pricing-desc">Everything you need to perfect your profile.</p>
                      </div>
                      <ul className="pricing-features">
                        <Feature included>20 Question Credits - Express Entry AI Assistant</Feature>
                        <Feature included>Unlimited Employment Letter Audits</Feature>
                        <Feature included>Unlimited CRS Point Simulator (What-If Scenarios)</Feature>
                        <Feature included>Personalized Document Checklist</Feature>
                        <Feature included>Document Expiry Tracking</Feature>
                      </ul>
                      <div className="pricing-card-footer">
                        <button className="pricing-btn secondary" style={{ width: '100%' }} onClick={() => handleUpgrade('starter')}>
                          Get Optimize — $49 CAD
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className={`pricing-card featured animate-reveal delay-1 ${upgradeTier === 'complete' ? 'single-centered' : ''}`} style={{ maxWidth: '350px', margin: upgradeTier === 'complete' ? '0 auto' : '0' }}>
                    <div className="pricing-popular-badge">⭐ ULTIMATE</div>
                    <div className="pricing-card-header">
                      <h3>Execute</h3>
                      <div className="pricing-price">$99 <span>CAD</span></div>
                      <p className="pricing-desc">Your complete AI toolkit for absolute peace of mind.</p>
                    </div>
                    <ul className="pricing-features">
                      <Feature included>Everything in Optimize</Feature>
                      <Feature included>Unlimited Express Entry AI Assistant</Feature>
                      <Feature included>Priority Early Access to Features</Feature>
                    </ul>
                    <div className="pricing-card-footer">
                      <button className="pricing-btn primary" style={{ width: '100%' }} onClick={() => handleUpgrade('complete')}>
                        Get Execute — $99 CAD
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="pb-image-preview">
            <img src={imagePreview} alt="Attached screenshot" />
            <button className="pb-image-remove" onClick={handleRemoveImage}>Remove</button>
          </div>
        )}

        {/* Input bar */}
        <div className="pb-input-bar">
          <div className={`pb-input-wrapper ${isInputDisabled ? 'disabled' : ''}`}>
            <button className="pb-attach-btn" onClick={handleAttachImage} title="Attach a screenshot of the IRCC portal" disabled={isInputDisabled}>
              Attach
            </button>
            <textarea
              ref={textareaRef}
              className="pb-text-input"
              placeholder={
                isInputDisabled
                  ? (anonymousUsed && !isSignedIn ? 'Sign in to continue chatting...' : 'No questions remaining — upgrade to continue')
                  : 'Ask about the IRCC portal... (paste screenshots with Ctrl+V)'
              }
              value={inputText}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              disabled={isInputDisabled}
            />
            <button
              className="pb-send-btn"
              onClick={handleSend}
              disabled={isInputDisabled || (!inputText.trim() && !attachedImage)}
            >
              Send →
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* Footer with credits */}
        <div className="pb-footer">
          <span>Powered by Mentor Visa AI</span>
          {isSignedIn && creditsRemaining !== null && creditsRemaining >= 0 && creditsTotal && (
            <span className={`pb-credit-count ${creditsRemaining <= 2 ? (creditsRemaining <= 0 ? 'empty' : 'low') : ''}`}>
              💬 {creditsRemaining} of {creditsTotal} questions remaining
            </span>
          )}
          {isSignedIn && creditsRemaining === -1 && (
            <span className="pb-credit-count">
              💬 Unlimited questions
            </span>
          )}
          {!isSignedIn && !anonymousUsed && (
            <span className="pb-credit-count">
              💬 1 free question available
            </span>
          )}
          {!isSignedIn && anonymousUsed && (
            <span className="pb-credit-count empty">
              💬 Sign in for 5 free questions
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Message Bubble Component ──
// Isolated to prevent re-rendering the entire list on streaming updates

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming: boolean }) {
  return (
    <div className={`pb-message ${message.role}`}>
      <div className={`pb-avatar ${message.role}`}>
        {message.role === 'assistant' ? 'AI' : 'You'}
      </div>
      <div>
        <div className="pb-bubble">
          {message.role === 'assistant' ? (
            message.content ? (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            ) : isStreaming ? (
              <div className="pb-typing">
                <div className="pb-typing-dot" />
                <div className="pb-typing-dot" />
                <div className="pb-typing-dot" />
              </div>
            ) : null
          ) : (
            <span>{message.content}</span>
          )}
        </div>
        {message.imageUrl && (
          <img
            className="pb-message-image"
            src={message.imageUrl}
            alt="Screenshot from IRCC portal"
            onClick={() => window.open(message.imageUrl, '_blank')}
          />
        )}
      </div>
    </div>
  );
}
