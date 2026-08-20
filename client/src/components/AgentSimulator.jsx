import React, { useState } from 'react';
import { Send, Bot, User, Shield, AlertTriangle, CheckCircle, Info, Sparkles, Terminal, Phone, UserCheck, Calendar } from 'lucide-react';

const PRESET_QUERIES = [
  "Hi",
  "Where is Green Hills Prime?",
  "Is the project in Nagalagidda Mandal?",
  "How far is Bidar?",
  "How far is Narayankhed?",
  "How far is the nearby municipality?",
  "How far is NIMZ?",
  "Will my plot price double in 2 years?",
  "Is spot registration available?",
  "Does registration cost ₹2 lakh?",
  "Is Patta and Passbook provided?",
  "Is Rythu Bandhu applicable?",
  "Is Rythu Bima available?",
  "Can you provide legal approval advice?",
  "Is this fully developed land?",
  "I have around ₹5 lakh budget.",
  "I want to build a house.",
  "Yes, I would like to schedule a free site visit.",
  "Can I come this Sunday at 11 AM from Miyapur?",
  "Can I come Monday instead?",
  "I can't come, please cancel visit."
];

export default function AgentSimulator({ onSendMessage }) {
  const [whatsappNumber, setWhatsappNumber] = useState('+919876543210');
  const [customerName, setCustomerName] = useState('Ramesh Kumar');

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'agent',
      text: 'Namaste! Welcome to Royal Kingdom – Green Hills Prime AI Assistant. Send "Hi" to experience our proactive onboarding or ask any location, land, or site-visit question!',
      debug: {
        matched_intent: 'WELCOME',
        facts_used: ['system_welcome'],
        distance_status_evaluated: 'N/A',
        guardrails_triggered: [],
        approved_for_customer: true
      }
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDebug, setSelectedDebug] = useState(messages[0].debug);

  const handleSend = async (queryText) => {
    const textToSend = queryText || input;
    if (!textToSend.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: textToSend
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      const res = await onSendMessage(textToSend, whatsappNumber, customerName);
      if (res && res.success) {
        const agentMsg = {
          id: Date.now() + 1,
          sender: 'agent',
          text: res.response.answer,
          debug: res.response.debug
        };
        setMessages((prev) => [...prev, agentMsg]);
        setSelectedDebug(res.response.debug);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="simulator-container">
      {/* Left Chat UI */}
      <div>
        {/* Phone & Session Bar */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserCheck size={16} color="var(--primary)" />
            <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Customer Session:</span>
          </div>
          <input
            className="form-input"
            style={{ width: '180px', padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer Name"
          />
          <input
            className="form-input"
            style={{ width: '160px', padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="WhatsApp Phone"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
            Quick Preset Test Queries (Click to Send):
          </h3>
          <div className="presets-grid">
            {PRESET_QUERIES.map((q, idx) => (
              <button key={idx} className="preset-chip" onClick={() => handleSend(q)}>
                {q === 'Hi' ? '🌟 Say "Hi" (Proactive Sequence)' : q}
              </button>
            ))}
          </div>
        </div>

        <div className="whatsapp-box">
          <div className="whatsapp-header">
            <div className="whatsapp-avatar">GH</div>
            <div>
              <h4 style={{ color: '#e9edef', fontSize: '0.9375rem', fontWeight: 700 }}>Green Hills Prime Proactive Sales AI</h4>
              <p style={{ color: '#8696a0', fontSize: '0.75rem' }}>WhatsApp Business Bot • Google Calendar & Sheets Sync Active</p>
            </div>
          </div>

          <div className="whatsapp-body">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble ${msg.sender}`}
                onClick={() => msg.debug && setSelectedDebug(msg.debug)}
                style={{ cursor: msg.debug ? 'pointer' : 'default' }}
              >
                <div style={{ whitespace: 'pre-line' }}>{msg.text}</div>
                {msg.sender === 'agent' && msg.debug && (
                  <div style={{ fontSize: '0.6875rem', color: '#8696a0', marginTop: '0.375rem', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                    <Shield size={10} color="#10b981" /> Click to inspect safety & memory log
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble agent" style={{ color: '#8696a0' }}>
                <Sparkles size={14} className="animate-spin" /> Processing AI engine & Google sync...
              </div>
            )}
          </div>

          <form
            className="whatsapp-footer"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              className="form-input"
              style={{ background: '#2a3942', border: 'none', color: '#e9edef' }}
              placeholder="Send 'Hi', ask plot size, spot registration, or schedule visit..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', borderRadius: '50%' }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* Right Inspector Debug Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="glass-card">
          <div className="card-header">
            <h3 className="card-title"><Terminal size={18} color="var(--primary)" /> Real-Time Debug & Memory Inspector</h3>
          </div>

          {selectedDebug ? (
            <div className="debug-panel">
              <div style={{ marginBottom: '0.875rem' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', display: 'block' }}>MATCHED INTENT</span>
                <strong style={{ color: 'var(--primary)', fontSize: '0.9375rem' }}>{selectedDebug.matched_intent}</strong>
              </div>

              {/* Customer memory profile */}
              {selectedDebug.customer_memory && (
                <div style={{ marginBottom: '0.875rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>CUSTOMER MEMORY (PERSISTED)</span>
                  <div style={{ fontSize: '0.78125rem' }}>💰 Budget: <strong>{selectedDebug.customer_memory.budget || 'Unspecified'}</strong></div>
                  <div style={{ fontSize: '0.78125rem' }}>🎯 Purpose: <strong>{selectedDebug.customer_memory.purpose || 'Unspecified'}</strong></div>
                  <div style={{ fontSize: '0.78125rem' }}>🔥 Interest Level: <span className="status-pill confirmed">{selectedDebug.customer_memory.interest_level}</span></div>
                  <div style={{ fontSize: '0.78125rem' }}>📅 Site Visit: {selectedDebug.customer_memory.site_visit_interested ? `Scheduled (${selectedDebug.customer_memory.site_visit_date})` : 'None'}</div>
                </div>
              )}

              {/* Proactive steps */}
              {selectedDebug.proactive_steps && (
                <div style={{ marginBottom: '0.875rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>PROACTIVE ONBOARDING SEQUENCE (PART B)</span>
                  {selectedDebug.proactive_steps.map((step) => (
                    <div key={step.step} style={{ fontSize: '0.75rem', color: '#e2e8f0', marginTop: '0.25rem' }}>
                      Step {step.step}: <strong>{step.title}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirmed appointment */}
              {selectedDebug.appointment_details && (
                <div style={{ marginBottom: '0.875rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38bdf8', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>CONFIRMED APPOINTMENT & GOOGLE CALENDAR</span>
                  <div style={{ fontSize: '0.78125rem' }}>Status: <strong>{selectedDebug.appointment_details.status}</strong></div>
                  <div style={{ fontSize: '0.78125rem' }}>Event ID: <code style={{ fontSize: '0.71875rem' }}>{selectedDebug.appointment_details.google_calendar_event_id}</code></div>
                </div>
              )}

              <div style={{ marginBottom: '0.875rem' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', display: 'block' }}>GUARDRAILS TRIGGERED</span>
                {selectedDebug.guardrails_triggered && selectedDebug.guardrails_triggered.length > 0 ? (
                  selectedDebug.guardrails_triggered.map((g, i) => (
                    <span key={i} className="debug-tag warning" style={{ display: 'inline-block', margin: '0.125rem' }}>
                      ⚠️ {g}
                    </span>
                  ))
                ) : (
                  <span className="debug-tag">No Guardrail Alerts</span>
                )}
              </div>

              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', display: 'block' }}>FACTS RETRIEVED FROM KB</span>
                {selectedDebug.facts_used && selectedDebug.facts_used.map((f, i) => (
                  <span key={i} className="debug-tag" style={{ display: 'inline-block', margin: '0.125rem' }}>
                    📄 {f}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Click any agent bubble to inspect details.</p>
          )}
        </div>

        {/* Safety Rule Reference Box */}
        <div className="glass-card" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
          <h4 style={{ color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={16} /> Active Guardrails Enforced
          </h4>
          <ul style={{ fontSize: '0.78125rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <li><strong>Part A1:</strong> Nagalagidda Mandal unverified protection.</li>
            <li><strong>Part A7:</strong> ₹2 Lakh registration interpretation guardrail.</li>
            <li><strong>Part A9-11:</strong> Conditional language for Patta, Rythu Bandhu & Bima.</li>
            <li><strong>Part G:</strong> Google Calendar double-booking protection.</li>
            <li><strong>Part M:</strong> Google Sheets lead upsert by WhatsApp Number.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
