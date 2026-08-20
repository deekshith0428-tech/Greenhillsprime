import React, { useState, useEffect } from 'react';
import { MessageSquare, User, Bot, Shield, PauseCircle, PlayCircle, Send, RefreshCw, Phone, Calendar, Search } from 'lucide-react';

export default function ConversationsManager() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyInput, setReplyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/conversations');
      const json = await res.json();
      if (json.success) {
        setConversations(json.data || []);
        if (json.data && json.data.length > 0 && !selectedConv) {
          setSelectedConv(json.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId) => {
    if (!convId) return;
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      const json = await res.json();
      if (json.success) {
        setMessages(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.conversation_id);
    }
  }, [selectedConv]);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const handleTakeover = async () => {
    if (!selectedConv) return;
    try {
      const res = await fetch(`/api/conversations/${selectedConv.conversation_id}/takeover`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        triggerToast('Human Takeover Activated! AI is now paused.');
        setSelectedConv({ ...selectedConv, state: 'HUMAN_ACTIVE' });
        fetchConversations();
        fetchMessages(selectedConv.conversation_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResume = async () => {
    if (!selectedConv) return;
    try {
      const res = await fetch(`/api/conversations/${selectedConv.conversation_id}/resume`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        triggerToast('AI Automated Responses Resumed.');
        setSelectedConv({ ...selectedConv, state: 'AI_ACTIVE' });
        fetchConversations();
        fetchMessages(selectedConv.conversation_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendManualReply = async (e) => {
    e.preventDefault();
    if (!replyInput.trim() || !selectedConv) return;

    try {
      const res = await fetch(`/api/conversations/${selectedConv.conversation_id}/human-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyInput })
      });
      const json = await res.json();
      if (json.success) {
        setReplyInput('');
        triggerToast('Human Agent message saved.');
        fetchMessages(selectedConv.conversation_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    (c.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.whatsapp_number || '').includes(search)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {toast && (
        <div style={{ background: '#10b981', color: '#042f2e', padding: '0.75rem 1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.875rem' }}>
          ✓ {toast}
        </div>
      )}

      {/* Main Split View */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', height: '680px' }}>
        {/* Left Side: Conversation List */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', height: '100%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <MessageSquare size={16} color="var(--primary)" /> Conversations ({filteredConversations.length})
            </h3>
            <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={fetchConversations}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: '2rem', fontSize: '0.78125rem' }}
              placeholder="Search phone or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredConversations.length > 0 ? (
              filteredConversations.map((c) => {
                const isSelected = selectedConv && selectedConv.conversation_id === c.conversation_id;
                const isHuman = c.state === 'HUMAN_ACTIVE' || c.state === 'AI_PAUSED';

                return (
                  <div
                    key={c.conversation_id}
                    onClick={() => setSelectedConv(c)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '0.875rem', color: isSelected ? '#38bdf8' : 'var(--text-main)' }}>
                        {c.customer_name || 'Customer'}
                      </strong>
                      <span className={`status-pill ${isHuman ? 'pending' : 'confirmed'}`} style={{ fontSize: '0.6875rem', padding: '0.125rem 0.375rem' }}>
                        {isHuman ? 'HUMAN' : 'AI ACTIVE'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {c.whatsapp_number}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem', fontSize: '0.6875rem' }}>
                      {c.budget && <span className="debug-tag">💰 {c.budget}</span>}
                      {c.interest_level && <span className="debug-tag warning">{c.interest_level}</span>}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.8125rem' }}>
                No active conversations yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Message Thread Viewer & Human Takeover Controls */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', height: '100%', overflow: 'hidden' }}>
          {selectedConv ? (
            <>
              {/* Thread Header */}
              <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <User size={18} color="var(--primary)" /> {selectedConv.customer_name} ({selectedConv.whatsapp_number})
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                    State: <strong>{selectedConv.state}</strong> • Budget: <strong>{selectedConv.budget || 'Unspecified'}</strong> • Purpose: <strong>{selectedConv.purpose || 'Unspecified'}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {selectedConv.state === 'HUMAN_ACTIVE' || selectedConv.state === 'AI_PAUSED' ? (
                    <button className="btn btn-primary btn-sm" onClick={handleResume}>
                      <PlayCircle size={14} /> Resume AI
                    </button>
                  ) : (
                    <button className="btn btn-secondary btn-sm" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #f87171' }} onClick={handleTakeover}>
                      <PauseCircle size={14} /> Take Over (Pause AI)
                    </button>
                  )}
                </div>
              </div>

              {/* Message Thread */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {messages.map((msg) => {
                  const isCust = msg.sender_type === 'CUSTOMER';
                  const isHuman = msg.sender_type === 'HUMAN';
                  const isSystem = msg.sender_type === 'SYSTEM';

                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isCust ? 'flex-start' : 'flex-end',
                        maxWidth: '75%',
                        background: isCust ? '#202c33' : isHuman ? '#065f46' : isSystem ? 'rgba(245, 158, 11, 0.2)' : '#005c4b',
                        color: '#e9edef',
                        padding: '0.625rem 0.875rem',
                        borderRadius: '10px',
                        border: isHuman ? '1px solid #10b981' : isSystem ? '1px solid #f59e0b' : 'none',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                      }}
                    >
                      <div style={{ fontSize: '0.6875rem', color: isCust ? '#8696a0' : '#a7f3d0', fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {isCust ? <User size={10} /> : isHuman ? <Shield size={10} color="#10b981" /> : <Bot size={10} />}
                        {msg.sender_type}
                      </div>

                      <div style={{ fontSize: '0.84375rem', whitespace: 'pre-line' }}>{msg.content}</div>

                      <div style={{ fontSize: '0.625rem', color: '#8696a0', marginTop: '0.25rem', textAlign: 'right' }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Manual Message Input Box */}
              <form onSubmit={handleSendManualReply} style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '0.5rem' }}>
                <input
                  className="form-input"
                  style={{ flex: 1, background: '#2a3942', border: 'none', color: '#e9edef' }}
                  placeholder={
                    selectedConv.state === 'HUMAN_ACTIVE'
                      ? 'Type manual response as Human Advisor...'
                      : 'Type message (Will auto-switch to Human Takeover)...'
                  }
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.625rem 1rem' }}>
                  <Send size={16} /> Send
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              Select a conversation on the left to view the stored message history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
