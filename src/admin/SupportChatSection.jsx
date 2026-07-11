// ════════════════════════════════════════════════════════════════════
// SupportChatSection — chat live in-app (support_chat_conversations)
// Liste les conversations open/escalated + fil complet + reponse admin.
// ════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

function fmtRel(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "a l'instant";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}j`;
}
function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export default function SupportChatSection() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_support_list_conversations', { p_limit: 200 });
      if (error) throw error;
      setConversations(Array.isArray(data) ? data : []);
    } catch (e) {
      toast('Erreur chargement conversations : ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId) => {
    setMsgLoading(true);
    try {
      const { data, error } = await supabase.rpc('support_get_conversation', { p_conversation_id: convId });
      if (error) throw error;
      setMessages(data?.messages || []);
    } catch (e) {
      toast('Erreur chargement messages : ' + (e?.message || e));
    } finally {
      setMsgLoading(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    loadMessages(selectedId);
    const t = setInterval(() => loadMessages(selectedId), 15000);
    return () => clearInterval(t);
  }, [selectedId, loadMessages]);
  useEffect(() => {
    const t = setInterval(loadConversations, 30000);
    return () => clearInterval(t);
  }, [loadConversations]);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedId),
    [conversations, selectedId]
  );

  const sendReply = async () => {
    const t = reply.trim();
    if (!t || !selectedId || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc('admin_support_reply', {
        p_conversation_id: selectedId,
        p_text: t,
      });
      if (error) throw error;
      setReply('');
      await loadMessages(selectedId);
    } catch (e) {
      toast('Erreur envoi : ' + (e?.message || e));
    } finally {
      setSending(false);
    }
  };

  const markResolved = async () => {
    if (!selectedId) return;
    if (!window.confirm('Marquer cette conversation comme resolue ?')) return;
    try {
      const { error } = await supabase.rpc('admin_support_close', { p_conversation_id: selectedId });
      if (error) throw error;
      toast('Conversation cloturee');
      setSelectedId(null);
      loadConversations();
    } catch (e) {
      toast('Erreur : ' + (e?.message || e));
    }
  };

  const escalateWA = async () => {
    if (!selectedId) return;
    try {
      const { error } = await supabase.rpc('admin_support_escalate_whatsapp', { p_conversation_id: selectedId });
      if (error) throw error;
      toast('Escaladee vers WhatsApp');
      loadMessages(selectedId);
      loadConversations();
    } catch (e) {
      toast('Erreur : ' + (e?.message || e));
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 16, minHeight: 500 }}>
      {/* Liste conversations */}
      <div style={{
        background: '#fff', border: '1px solid #eaeaea', borderRadius: 12,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '12px 14px', borderBottom: '1px solid #eaeaea',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#F7F9F8',
        }}>
          <strong style={{ fontSize: 14 }}>Chat live ({conversations.length})</strong>
          <button
            onClick={loadConversations}
            style={{
              border: '1px solid #d0d5d3', background: '#fff',
              padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
            }}
          >Refresh</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Chargement...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Aucune conversation ouverte.</div>
          ) : (
            conversations.map((c) => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: 12, border: 'none',
                    background: active ? '#EAF7F0' : '#fff',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ fontSize: 13, color: '#1a1a1a' }}>
                      {c.user_email || (c.user_id ? c.user_id.slice(0, 8) : 'Invite')}
                    </strong>
                    <span style={{ fontSize: 11, color: '#888' }}>{fmtRel(c.last_message_at)}</span>
                  </div>
                  <div style={{
                    fontSize: 12, color: '#666', marginBottom: 6,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.last_message_text || 'Nouvelle conversation'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 999,
                      background: c.status === 'escalated' ? '#FFF4E0' : '#E7F5EC',
                      color: c.status === 'escalated' ? '#B95F00' : '#0B7A5B',
                    }}>{c.status.toUpperCase()}</span>
                    {c.category && (
                      <span style={{
                        fontSize: 10, padding: '2px 8px',
                        borderRadius: 999, background: '#F1F3F2', color: '#4A5652',
                      }}>{c.category}</span>
                    )}
                    {c.escalated_to === 'whatsapp' && (
                      <span style={{
                        fontSize: 10, padding: '2px 8px',
                        borderRadius: 999, background: '#25D36622', color: '#128C7E',
                      }}>WhatsApp</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Fil */}
      <div style={{
        background: '#fff', border: '1px solid #eaeaea', borderRadius: 12,
        display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 500,
      }}>
        {!selectedId ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888', margin: 'auto' }}>
            Selectionnez une conversation pour l ouvrir.
          </div>
        ) : (
          <>
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid #eaeaea',
              background: '#F7F9F8', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {selectedConv?.user_email || 'Utilisateur'}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Statut : {selectedConv?.status} {selectedConv?.category ? ` | ${selectedConv.category}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={escalateWA}
                  style={{
                    padding: '6px 12px', border: '1px solid #128C7E', color: '#128C7E',
                    background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}
                >Escalade WhatsApp</button>
                <button
                  onClick={markResolved}
                  style={{
                    padding: '6px 12px', border: 'none',
                    background: '#0B7A5B', color: '#fff',
                    borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}
                >Marquer resolu</button>
              </div>
            </div>

            <div ref={bodyRef} style={{
              flex: 1, overflowY: 'auto', padding: 16,
              display: 'flex', flexDirection: 'column', gap: 8, background: '#F7F9F8',
            }}>
              {msgLoading && messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#888' }}>Chargement...</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} style={{
                    alignSelf: m.sender_type === 'user' ? 'flex-start' : 'flex-end',
                    maxWidth: '75%',
                  }}>
                    <div style={{
                      background:
                        m.sender_type === 'user' ? '#fff'
                        : m.sender_type === 'admin' ? '#0B7A5B'
                        : m.sender_type === 'bot' ? '#F0F4F2' : '#EEE',
                      color:
                        m.sender_type === 'admin' ? '#fff' : '#1a1a1a',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: m.sender_type === 'user' ? '1px solid #eaeaea' : 'none',
                      fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap',
                    }}>
                      {m.text}
                    </div>
                    <div style={{
                      fontSize: 10, color: '#8A9490', marginTop: 3,
                      textAlign: m.sender_type === 'user' ? 'left' : 'right',
                    }}>
                      {m.sender_type} | {fmtTime(m.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{
              borderTop: '1px solid #eaeaea', padding: 12,
              display: 'flex', gap: 8, background: '#fff',
            }}>
              <input
                type="text"
                placeholder="Reponse admin..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
                disabled={sending}
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid #d0d5d3',
                  borderRadius: 20, fontSize: 14, outline: 'none',
                }}
              />
              <button
                onClick={sendReply}
                disabled={!reply.trim() || sending}
                style={{
                  padding: '10px 20px', background: '#0B7A5B', color: '#fff',
                  border: 'none', borderRadius: 20, cursor: 'pointer',
                  fontWeight: 700, fontSize: 13,
                  opacity: !reply.trim() || sending ? 0.5 : 1,
                }}
              >Envoyer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
