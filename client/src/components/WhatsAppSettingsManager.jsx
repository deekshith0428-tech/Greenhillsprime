import React, { useState, useEffect } from 'react';
import { Shield, Zap, CheckCircle2, AlertTriangle, Lock, RefreshCw, Send, Trash2, Key, Server, PhoneCall } from 'lucide-react';

export default function WhatsAppSettingsManager() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simText, setSimText] = useState('Hi');
  const [simPhone, setSimPhone] = useState('+919876543210');
  const [simResult, setSimResult] = useState(null);
  const [toast, setToast] = useState('');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/status');
      const json = await res.json();
      if (json.success) {
        setStatus(json.status);
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const handleTestWebhook = async (e) => {
    e.preventDefault();
    setSimResult(null);
    try {
      const res = await fetch('/api/whatsapp/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_message_id: `wamid.sim_${Date.now()}`,
          whatsapp_number: simPhone,
          message: simText,
          customer_name: 'Webhook Tester'
        })
      });
      const json = await res.json();
      setSimResult(json);
      triggerToast('Test Webhook payload executed!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunRetentionPurge = async () => {
    if (!window.confirm('Run 14-Day Conversation Retention Purge now? (Messages older than 14 days without active site visits will be cleaned)')) return;
    try {
      const res = await fetch('/api/whatsapp/purge-retention', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        triggerToast(`Retention Purge Complete! Purged ${json.result.purged_count} messages.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {toast && (
        <div style={{ background: '#10b981', color: '#042f2e', padding: '0.75rem 1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.875rem' }}>
          ✓ {toast}
        </div>
      )}

      {/* Safety Alert Header */}
      <div
        className="glass-card"
        style={{
          borderLeft: '4px solid #38bdf8',
          background: 'rgba(56, 189, 248, 0.05)',
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Shield size={32} color="#38bdf8" />
          <div>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Meta WhatsApp Business Cloud API Integration Architecture
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Safety Rule Active: Real production WhatsApp number remains <strong>DISCONNECTED</strong>. Default mode is set to <code>WHATSAPP_MODE=mock</code>.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="status-pill confirmed" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
            <Zap size={14} /> Mode: {status ? status.mode : 'MOCK'}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={fetchStatus}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Integration Status Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* Webhook Status */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Server size={16} color="var(--primary)" /> Webhook Handler
            </h4>
            <span className={`status-pill ${status && status.webhook_configured ? 'confirmed' : 'pending'}`}>
              {status && status.webhook_configured ? 'Configured' : 'Default Token'}
            </span>
          </div>
          <p style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
            Endpoint: <code>/api/whatsapp/webhook</code>
          </p>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Supports GET verification challenge & HMAC SHA256 signature verification.
          </div>
        </div>

        {/* Phone Number ID */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <PhoneCall size={16} color="var(--primary)" /> Phone Number ID
            </h4>
            <span className={`status-pill ${status && status.phone_number_id_configured ? 'confirmed' : 'pending'}`}>
              {status && status.phone_number_id_configured ? 'Configured' : 'Not Connected'}
            </span>
          </div>
          <p style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
            Meta Graph API ID: <strong>{status && status.phone_number_id_configured ? '••••••••' : 'Disconnected'}</strong>
          </p>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Will be connected only after explicit production approval.
          </div>
        </div>

        {/* Access Token */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Lock size={16} color="var(--primary)" /> Graph API Token
            </h4>
            <span className={`status-pill ${status && status.access_token_configured ? 'confirmed' : 'pending'}`}>
              {status && status.access_token_configured ? 'Configured' : 'Not Set'}
            </span>
          </div>
          <p style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
            Security: <strong>Backend Only (Never Exposed)</strong>
          </p>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Bearer token is stored in environment variables.
          </div>
        </div>

        {/* Retention Policy */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Trash2 size={16} color="var(--primary)" /> 14-Day Retention Purge
            </h4>
            <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.6875rem' }} onClick={handleRunRetentionPurge}>
              Purge Now
            </button>
          </div>
          <p style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
            Cleans raw message logs &gt; 14 days old. Preserves active site visits & leads.
          </p>
        </div>
      </div>

      {/* Webhook Test Simulator Panel */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
          <Send color="var(--primary)" /> Webhook Pipeline Test Simulator
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Fires simulated Meta Webhook payloads through the unified <code>processIncomingWhatsAppMessage()</code> backend pipeline, verifying database persistence, Gemini LLM grounding, and response generation.
        </p>

        <form onSubmit={handleTestWebhook} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 120px', gap: '0.75rem', marginBottom: '1rem' }}>
          <input
            className="form-input"
            placeholder="Phone Number (+91...)"
            value={simPhone}
            onChange={(e) => setSimPhone(e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Incoming WhatsApp message..."
            value={simText}
            onChange={(e) => setSimText(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            <Send size={14} /> Test
          </button>
        </form>

        {simResult && (
          <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.5rem' }}>
              ✓ Webhook Pipeline Execution Response:
            </div>
            <pre style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#a7f3d0', overflowX: 'auto', margin: 0 }}>
              {JSON.stringify(simResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
