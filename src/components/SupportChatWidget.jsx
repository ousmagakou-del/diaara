// ════════════════════════════════════════════════════════════════════
// SupportChatWidget — Live support chat floating (style Intercom)
//   Bot FAQ + escalation vers WhatsApp humain.
//   Mount depuis App.jsx global. Hide sur admin/checkout/order/auth/etc.
// ════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNav, useUser } from '../App';
import { supabase } from '../lib/supabase/client';
import './SupportChatWidget.css';

const WHATSAPP_URL = 'https://wa.me/221777608983';
const NO_MATCH_THRESHOLD = 2; // apres 2 messages sans match, propose escalation

// ─── Routes ou le widget est CACHE ────────────────────────────────
// Idem logic FloatingCartBadge native: admin/checkout/order/auth/etc.
const HIDDEN_ROUTES = new Set([
  'admin', 'admin_login',
  'checkout', 'checkout_legacy', 'payment', 'payment_success',
  'order_tracking', 'order',
  'auth', 'signup', 'verify', 'onboarding',
  'pharma', 'pharmacy_dashboard', 'pharmacist',
  'livreur', 'driver', 'driver_app',
  'sign', 'sign_success',
  'delete_account', 'export_data',
  'help', 'support',
  'ai_chat',
]);

function isHidden(routeName) {
  if (!routeName) return false;
  if (HIDDEN_ROUTES.has(routeName)) return true;
  // prefix match
  return Array.from(HIDDEN_ROUTES).some((r) =>
    routeName === r || routeName.startsWith(r + '_') || routeName.startsWith(r + '/')
  );
}

// ─── Icones SVG inline ────────────────────────────────────────────
function ChatIcon({ size = 24, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CloseIcon({ size = 18, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}
function SendIcon({ size = 18, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function WhatsAppIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
    </svg>
  );
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function SupportChatWidget() {
  const { route } = useNav();
  const { user } = useUser();

  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [noMatchStreak, setNoMatchStreak] = useState(0);
  const bodyRef = useRef(null);

  const hidden = isHidden(route?.name);

  // Auto-scroll to bottom
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, typing]);

  // Ouverture -> demarrer conversation si connecte
  const startConversation = useCallback(async () => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.rpc('support_start_conversation', {
        p_category: null,
      });
      if (error) throw error;
      const convId = data;
      setConversationId(convId);
      // Load conversation
      const { data: convData } = await supabase.rpc('support_get_conversation', {
        p_conversation_id: convId,
      });
      if (convData?.messages) {
        setMessages(convData.messages);
        if (convData.conv?.status === 'escalated') setEscalated(true);
      }
      return convId;
    } catch (e) {
      console.warn('[support-chat] start failed', e?.message);
      return null;
    }
  }, [user]);

  const openPanel = useCallback(async () => {
    setOpen(true);
    if (!conversationId && user) {
      await startConversation();
    }
  }, [conversationId, user, startConversation]);

  const sendMessage = useCallback(async (txt) => {
    const clean = (txt || '').trim();
    if (!clean || !conversationId || sending) return;
    setSending(true);
    setInput('');
    // Optimistic
    const nowIso = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: 'tmp-' + Math.random(), conversation_id: conversationId, sender_type: 'user', text: clean, created_at: nowIso },
    ]);
    setTyping(true);
    try {
      const { data, error } = await supabase.rpc('support_send_message', {
        p_conversation_id: conversationId,
        p_text: clean,
      });
      if (error) throw error;
      const userMsg = data?.user_msg;
      const botMsg = data?.bot_msg;
      // Replace optimistic + append bot
      setMessages((prev) => {
        const filtered = prev.filter((m) => !String(m.id).startsWith('tmp-'));
        const next = [...filtered];
        if (userMsg) next.push(userMsg);
        if (botMsg) next.push(botMsg);
        return next;
      });
      // Track no-match streak (bot fallback text starts with "Je ne suis pas sur")
      if (botMsg && /je ne suis pas sur/i.test(botMsg.text || '')) {
        setNoMatchStreak((n) => n + 1);
      } else {
        setNoMatchStreak(0);
      }
    } catch (e) {
      console.warn('[support-chat] send failed', e?.message);
      setMessages((prev) => [
        ...prev,
        { id: 'err-' + Math.random(), sender_type: 'bot', text: 'Impossible d envoyer. Reessayez ou passez sur WhatsApp.', created_at: new Date().toISOString() },
      ]);
    } finally {
      setTyping(false);
      setSending(false);
    }
  }, [conversationId, sending]);

  const handleQuickReply = useCallback((reply) => {
    const lower = (reply || '').toLowerCase();
    if (lower.includes('whatsapp')) {
      window.open(WHATSAPP_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    if (/humain|parler a un humain/.test(lower)) {
      escalateToHuman();
      return;
    }
    sendMessage(reply);
  }, [sendMessage]); // eslint-disable-line

  const escalateToHuman = useCallback(async () => {
    if (!conversationId) return;
    try {
      const { data, error } = await supabase.rpc('support_escalate_to_human', {
        p_conversation_id: conversationId,
      });
      if (error) throw error;
      setEscalated(true);
      if (data?.bot_msg) {
        setMessages((prev) => [...prev, data.bot_msg]);
      }
      // Open WhatsApp
      const wa = data?.whatsapp_url || WHATSAPP_URL;
      setTimeout(() => window.open(wa, '_blank', 'noopener,noreferrer'), 600);
    } catch (e) {
      console.warn('[support-chat] escalate failed', e?.message);
      window.open(WHATSAPP_URL, '_blank', 'noopener,noreferrer');
    }
  }, [conversationId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Auto-propose escalation apres N no-match
  useEffect(() => {
    if (noMatchStreak >= NO_MATCH_THRESHOLD && !escalated && conversationId) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'auto-esc-' + Math.random(),
          sender_type: 'bot',
          text: 'Je n arrive pas a repondre precisement. Voulez-vous que je vous mette en relation avec un conseiller humain sur WhatsApp ?',
          quick_replies: ['Oui, parler a un humain', 'Non merci'],
          created_at: new Date().toISOString(),
        },
      ]);
      setNoMatchStreak(0);
    }
  }, [noMatchStreak, escalated, conversationId]);

  if (hidden) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          className="support-chat-fab"
          aria-label="Ouvrir le chat support YARAM"
          onClick={openPanel}
        >
          <ChatIcon />
        </button>
      )}

      {open && (
        <div className="support-chat-panel" role="dialog" aria-label="Chat support">
          <div className="support-chat-panel__header">
            <div className="support-chat-panel__header-info">
              <div className="support-chat-panel__title">YARAM Support</div>
              <div className="support-chat-panel__subtitle">
                <span className="support-chat-panel__dot" />
                Reponses en moins de 30 sec
              </div>
            </div>
            <button
              type="button"
              className="support-chat-panel__close"
              aria-label="Fermer le chat"
              onClick={() => setOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="support-chat-panel__body" ref={bodyRef}>
            {!user && (
              <div className="support-chat-status">
                Connectez-vous pour demarrer une discussion, ou contactez-nous directement sur WhatsApp.
              </div>
            )}

            {user && !conversationId && (
              <div className="support-chat-status">Chargement...</div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`support-chat-msg support-chat-msg--${m.sender_type}`}>
                <div className="support-chat-msg__bubble">{m.text}</div>
                <div className="support-chat-msg__time">{formatTime(m.created_at)}</div>
                {Array.isArray(m.quick_replies) && m.quick_replies.length > 0 && (
                  <div className="support-chat-quick-replies">
                    {m.quick_replies.map((qr, i) => (
                      <button
                        key={i}
                        type="button"
                        className="support-chat-quick-chip"
                        disabled={sending}
                        onClick={() => handleQuickReply(qr)}
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {typing && (
              <div className="support-chat-msg support-chat-msg--bot">
                <div className="support-chat-msg__bubble" style={{ padding: 0 }}>
                  <div className="support-chat-typing"><span /><span /><span /></div>
                </div>
              </div>
            )}
          </div>

          <div className="support-chat-panel__footer">
            {user ? (
              <>
                <form className="support-chat-input-row" onSubmit={handleSubmit}>
                  <input
                    type="text"
                    className="support-chat-input"
                    placeholder={escalated ? 'Continuez sur WhatsApp' : 'Votre message...'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={sending || !conversationId}
                  />
                  <button
                    type="submit"
                    className="support-chat-send"
                    aria-label="Envoyer"
                    disabled={sending || !input.trim() || !conversationId}
                  >
                    <SendIcon />
                  </button>
                </form>
                <button
                  type="button"
                  className="support-chat-whatsapp-btn"
                  onClick={escalateToHuman}
                >
                  <WhatsAppIcon /> Passer a un humain sur WhatsApp
                </button>
              </>
            ) : (
              <button
                type="button"
                className="support-chat-whatsapp-btn"
                onClick={() => window.open(WHATSAPP_URL, '_blank', 'noopener,noreferrer')}
              >
                <WhatsAppIcon /> Nous contacter sur WhatsApp
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
