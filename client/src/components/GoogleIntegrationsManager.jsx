import React, { useState, useEffect } from 'react';
import { Calendar, FileSpreadsheet, ShieldCheck, RefreshCw, Zap, CheckCircle2, AlertTriangle, Key } from 'lucide-react';

export default function GoogleIntegrationsManager() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testOutput, setTestOutput] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/google/status');
      const json = await res.json();
      if (json.success) {
        setStatus(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTestCalendar = async () => {
    setTestOutput({ loading: true, type: 'Calendar' });
    try {
      const res = await fetch('/api/google/test-calendar', { method: 'POST' });
      const json = await res.json();
      setTestOutput({ loading: false, type: 'Calendar', data: json });
    } catch (err) {
      setTestOutput({ loading: false, type: 'Calendar', error: err.message });
    }
  };

  const handleTestSheets = async () => {
    setTestOutput({ loading: true, type: 'Sheets' });
    try {
      const res = await fetch('/api/google/test-sheets', { method: 'POST' });
      const json = await res.json();
      setTestOutput({ loading: false, type: 'Sheets', data: json });
    } catch (err) {
      setTestOutput({ loading: false, type: 'Sheets', error: err.message });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap color="var(--primary)" /> Google Services Architecture (Part F, K, R)
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Official Google Calendar API & Google Sheets API Integration Layer
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchStatus}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Health Status
          </button>
        </div>

        {/* Health status grid */}
        {status && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
            {/* Google Calendar Box */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '1.25rem', borderRadius: '12px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.75rem' }}>
                <Calendar size={18} /> Google Calendar API
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
                <div>Mode: <span className="status-pill confirmed">{status.calendar.mode}</span></div>
                <div>Configured Credentials: <strong>{status.calendar.configured ? 'LIVE API READY' : 'MOCK ENGINE ACTIVE'}</strong></div>
                <div>Double Booking Protection: <span className="status-pill confirmed">ACTIVE</span></div>
                <div>Target Calendar ID: <code style={{ color: 'var(--text-muted)' }}>{status.calendar.calendar_id}</code></div>
              </div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: '1rem', width: '100%' }} onClick={handleTestCalendar}>
                ⚡ Run Calendar Event Creation Test
              </button>
            </div>

            {/* Google Sheets Box */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '1.25rem', borderRadius: '12px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', color: '#10b981', fontWeight: 700, marginBottom: '0.75rem' }}>
                <FileSpreadsheet size={18} /> Google Sheets API
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
                <div>Mode: <span className="status-pill confirmed">{status.sheets.mode}</span></div>
                <div>Configured Credentials: <strong>{status.sheets.configured ? 'LIVE API READY' : 'MOCK SYNC ACTIVE'}</strong></div>
                <div>Primary Upsert Key: <strong style={{ color: '#10b981' }}>{status.sheets.upsert_identifier}</strong></div>
                <div>Target Sheet ID: <code style={{ color: 'var(--text-muted)' }}>{status.sheets.spreadsheet_id}</code></div>
              </div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: '1rem', width: '100%', background: '#10b981' }} onClick={handleTestSheets}>
                ⚡ Run Sheets Lead Upsert Test
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test Execution Output */}
      {testOutput && (
        <div className="glass-card" style={{ background: '#182229' }}>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>
            Test Result ({testOutput.type} API Test)
          </h4>
          {testOutput.loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Running API execution test...</p>
          ) : (
            <pre style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontSize: '0.78125rem', color: '#38bdf8' }}>
              {JSON.stringify(testOutput.data || testOutput.error, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Security & Credentials guide */}
      <div className="glass-card">
        <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Key size={16} color="var(--primary)" /> Environment Variables & Credentials Architecture (Part R)
        </h4>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          To switch from Mock Mode to Live Production Google APIs, set the following environment variables in your server environment (or <code>.env</code> file):
        </p>
        <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px', fontSize: '0.78125rem', color: '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
{`GOOGLE_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_oauth_client_secret
GOOGLE_REFRESH_TOKEN=your_oauth_refresh_token
GOOGLE_CALENDAR_ID=primary_or_green_hills_calendar_id
GOOGLE_SHEET_ID=your_google_sheet_id`}
        </pre>
      </div>
    </div>
  );
}
