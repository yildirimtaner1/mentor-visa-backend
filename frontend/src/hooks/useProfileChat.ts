/**
 * useProfileChat — Custom hook for the Profile Builder agent chat.
 * 
 * Handles:
 * - SSE streaming (token-by-token rendering)
 * - Conversation persistence (load/create/resume)
 * - Image upload (base64 encoding)
 * - Graduated credit tracking (anonymous → free → starter → complete)
 * - Credit exhaustion detection with upgrade tier info
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  chatProfileBuilder,
  getProfileBuilderConversations,
  getProfileBuilderConversation,
  fetchUserCredits,
  type ChatMessagePayload,
  type ConversationSummary,
} from '../services/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;  // Data URL for display in the UI
  timestamp: Date;
}

interface UseProfileChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  conversationId: string | null;
  pastConversations: ConversationSummary[];
  creditsRemaining: number | null;
  creditsTotal: number | null;
  error: string | null;
  anonymousUsed: boolean;
  creditsExhausted: boolean;
  upgradeTier: 'starter' | 'complete' | null;
  currentTier: string;
  sendMessage: (content: string, image?: File) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  fetchConversations: () => Promise<void>;
}

const ANON_STORAGE_KEY = 'pb_anon_used';

let messageIdCounter = 0;
function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageIdCounter}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useProfileChat(): UseProfileChatReturn {
  const { getToken, isSignedIn } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pastConversations, setPastConversations] = useState<ConversationSummary[]>([]);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [creditsTotal, setCreditsTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anonymousUsed, setAnonymousUsed] = useState(() => {
    try { return localStorage.getItem(ANON_STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [creditsExhausted, setCreditsExhausted] = useState(false);
  const [upgradeTier, setUpgradeTier] = useState<'starter' | 'complete' | null>(null);
  const [currentTier, setCurrentTier] = useState('free');

  // Ref to accumulate streaming content without re-rendering per token
  const streamingContentRef = useRef('');
  const throttleTimerRef = useRef<number | null>(null);

  // ── Fetch credits on mount for authenticated users ──
  useEffect(() => {
    if (!isSignedIn) return;
    const fetchInitialCredits = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const credits = await fetchUserCredits(token);
        const tier = credits.subscription_tier || 'free';
        setCurrentTier(tier);
        
        if (tier === 'complete') {
          setCreditsRemaining(-1); // unlimited
          setCreditsTotal(null);
        } else {
          setCreditsRemaining(credits.profile_builder_credits ?? 0);
          // Calculate total based on tier for "X of Y remaining" display
          setCreditsTotal(tier === 'starter' ? 20 : 5);
          if ((credits.profile_builder_credits ?? 0) <= 0) {
            setCreditsExhausted(true);
            setUpgradeTier(tier === 'free' ? 'starter' : 'complete');
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial credits:', err);
      }
    };
    fetchInitialCredits();
  }, [isSignedIn, getToken]);

  const sendMessage = useCallback(async (content: string, image?: File) => {
    if (!content.trim() && !image) return;
    if (isStreaming) return;

    // ── Anonymous gating ──
    if (!isSignedIn && anonymousUsed) {
      setError('sign_in_required');
      return;
    }

    setError(null);
    setCreditsExhausted(false);
    setIsStreaming(true);

    // Encode image if present
    let imageDataUrl: string | undefined;
    if (image) {
      try {
        imageDataUrl = await fileToDataUrl(image);
      } catch {
        setError('Failed to read image file.');
        setIsStreaming(false);
        return;
      }
    }

    // Add user message to state
    const userMsg: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
      imageUrl: imageDataUrl,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // Build payload for the API (full history)
    const payload: ChatMessagePayload[] = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.imageUrl && m.role === 'user' ? { image_data: m.imageUrl } : {}),
    }));

    // Only include image_data on the LATEST user message to avoid re-sending old images
    for (let i = 0; i < payload.length - 1; i++) {
      delete payload[i].image_data;
    }

    // Add placeholder assistant message
    const assistantMsgId = generateMessageId();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages([...updatedMessages, assistantMsg]);

    // Stream response
    streamingContentRef.current = '';

    try {
      // Get token (null for anonymous)
      const token = isSignedIn ? await getToken() : null;

      const response = await chatProfileBuilder(payload, conversationId, token);

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'token') {
              streamingContentRef.current += event.content;

              // Throttled state update (~80ms) to prevent excessive re-renders
              if (!throttleTimerRef.current) {
                throttleTimerRef.current = window.setTimeout(() => {
                  const currentContent = streamingContentRef.current;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: currentContent } : m
                    )
                  );
                  throttleTimerRef.current = null;
                }, 80);
              }
            } else if (event.type === 'done') {
              // Final update with complete content
              const finalContent = streamingContentRef.current;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: finalContent } : m
                )
              );
              if (event.conversation_id) {
                setConversationId(event.conversation_id);
              }
              if (event.credits_remaining !== undefined) {
                setCreditsRemaining(event.credits_remaining);
                // If credits hit 0 after this message, mark exhausted
                if (event.credits_remaining === 0 && isSignedIn) {
                  setCreditsExhausted(true);
                  setUpgradeTier(currentTier === 'free' ? 'starter' : 'complete');
                }
              }

              // Mark anonymous as used
              if (!isSignedIn) {
                setAnonymousUsed(true);
                try { localStorage.setItem(ANON_STORAGE_KEY, 'true'); } catch {}
              }
            } else if (event.type === 'error') {
              setError(event.message || 'An error occurred.');
              if (event.credit_refunded) {
                // Credit was refunded — update count
                setCreditsRemaining((prev) => prev !== null && prev >= 0 ? prev + 1 : prev);
              }
              // Remove the empty assistant message
              setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Final flush — ensure the last content is rendered
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      const finalContent = streamingContentRef.current;
      if (finalContent) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: finalContent } : m
          )
        );
      }
    } catch (err: any) {
      console.error('Profile Builder chat error:', err);

      // Handle credit exhaustion 403
      const errMsg = err.message || '';
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed.code === 'credits_exhausted') {
          setCreditsExhausted(true);
          setCreditsRemaining(0);
          setUpgradeTier(parsed.upgrade_to || 'starter');
          setError(null); // Not a real error — it's a gate
          // Remove the user message we just added (they shouldn't lose it visually)
          setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
          return;
        }
      } catch {
        // Not JSON — regular error
      }

      setError(errMsg || 'Failed to send message.');
      // Remove empty assistant message on error
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId || m.content));
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, conversationId, getToken, isSignedIn, anonymousUsed, currentTier]);

  const loadConversation = useCallback(async (id: string) => {
    try {
      setError(null);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const data = await getProfileBuilderConversation(id, token);
      setConversationId(data.conversation_id);
      setMessages(
        (data.messages || []).map((m: any) => ({
          id: generateMessageId(),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          imageUrl: m.image_url,
          timestamp: new Date(),
        }))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load conversation.');
    }
  }, [getToken]);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setCreditsExhausted(false);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const convos = await getProfileBuilderConversations(token);
      setPastConversations(convos);
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    }
  }, [getToken]);

  return {
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
  };
}
