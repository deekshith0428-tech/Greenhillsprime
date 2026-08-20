import React, { useState, useEffect } from 'react';
import { MapPin, MessageSquare, ShieldCheck, History, RefreshCw, Building2, Users, Calendar, Scale, Zap, UserCheck, PhoneCall } from 'lucide-react';
import LocationManager from './components/LocationManager';
import LandManager from './components/LandManager';
import LeadsManager from './components/LeadsManager';
import SiteVisitsManager from './components/SiteVisitsManager';
import GoogleIntegrationsManager from './components/GoogleIntegrationsManager';
import AgentSimulator from './components/AgentSimulator';
import ConversationsManager from './components/ConversationsManager';
import WhatsAppSettingsManager from './components/WhatsAppSettingsManager';
import TestSuite from './components/TestSuite';

export default function App() {
  const [activeTab, setActiveTab] = useState('simulator');
  const [knowledge, setKnowledge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const fetchKnowledge = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/location/knowledge');
      const json = await res.json();
      if (json.success) {
        setKnowledge(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge base:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUpdateProject = async (data) => {
    try {
      const res = await fetch('/api/location/project-location', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Project location updated successfully');
        fetchKnowledge();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateNimz = async (data) => {
    try {
      const res = await fetch('/api/location/nimz', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        showToast('NIMZ landmark settings updated');
        fetchKnowledge();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateNearby = async (id, data) => {
    try {
      const res = await fetch(`/api/location/nearby/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Nearby location updated');
        fetchKnowledge();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateHighway = async (id, data) => {
    try {
      const res = await fetch(`/api/location/highway/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Highway connectivity updated');
        fetchKnowledge();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateRailway = async (id, data) => {
    try {
      const res = await fetch(`/api/location/railway/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Railway connectivity updated');
        fetchKnowledge();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateAirport = async (id, data) => {
    try {
      const res = await fetch(`/api/location/airport/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Airport connectivity updated');
        fetchKnowledge();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRegionalDev = async (data) => {
    try {
      const res = await fetch('/api/location/regional-dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Development item added');
        fetchKnowledge();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRegionalDev = async (id) => {
    try {
      const res = await fetch(`/api/location/regional-dev/${id}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.success) {
        showToast('Development item deleted');
        fetchKnowledge();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateLandDev = async (data) => {
    try {
      const res = await fetch('/api/location/land-development', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) fetchKnowledge();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePlotCat = async (id, data) => {
    try {
      const res = await fetch(`/api/location/plot-category/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) fetchKnowledge();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateRegInfo = async (data) => {
    try {
      const res = await fetch('/api/location/registration-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) fetchKnowledge();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePickup = async (data) => {
    try {
      const res = await fetch('/api/location/pickup-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) fetchKnowledge();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateVerifItem = async (id, data) => {
    try {
      const res = await fetch(`/api/location/verification-checklist/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) fetchKnowledge();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (message, whatsappNumber, customerName) => {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        whatsapp_number: whatsappNumber,
        customer_name: customerName
      })
    });
    return await res.json();
  };

  const handleRunTests = async () => {
    const res = await fetch('/api/agent/run-test-suite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return await res.json();
  };

  return (
    <div>
      {/* Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="logo-group">
            <div className="logo-badge">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="brand-title">Royal Kingdom – Green Hills Prime</h1>
              <p className="brand-subtitle">Phase 3 Production Architecture • Meta WhatsApp Cloud API Ready</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="status-pill confirmed">
              <ShieldCheck size={14} /> Meta Webhook & SQL Architecture Ready
            </span>
            <button className="btn btn-secondary btn-sm" onClick={fetchKnowledge}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync Knowledge
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {notification && (
          <div
            style={{
              background: '#10b981',
              color: '#042f2e',
              padding: '0.75rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>✓ {notification}</span>
            <button
              onClick={() => setNotification(null)}
              style={{ background: 'transparent', border: 'none', color: '#042f2e', cursor: 'pointer', fontWeight: 800 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="nav-tabs">
          <button className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`} onClick={() => setActiveTab('simulator')}>
            <MessageSquare size={18} /> Interactive Simulator (Test Mode)
          </button>
          <button className={`tab-btn ${activeTab === 'conversations' ? 'active' : ''}`} onClick={() => setActiveTab('conversations')}>
            <UserCheck size={18} /> Conversations & Human Takeover (DB)
          </button>
          <button className={`tab-btn ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => setActiveTab('whatsapp')}>
            <PhoneCall size={18} /> Meta WhatsApp Settings
          </button>
          <button className={`tab-btn ${activeTab === 'leads' ? 'active' : ''}`} onClick={() => setActiveTab('leads')}>
            <Users size={18} /> Leads Management
          </button>
          <button className={`tab-btn ${activeTab === 'site-visits' ? 'active' : ''}`} onClick={() => setActiveTab('site-visits')}>
            <Calendar size={18} /> Site Visits (Calendar Sync)
          </button>
          <button className={`tab-btn ${activeTab === 'land' ? 'active' : ''}`} onClick={() => setActiveTab('land')}>
            <Scale size={18} /> Land & Registration Manager
          </button>
          <button className={`tab-btn ${activeTab === 'manager' ? 'active' : ''}`} onClick={() => setActiveTab('manager')}>
            <MapPin size={18} /> Location & Connectivity Manager
          </button>
          <button className={`tab-btn ${activeTab === 'google' ? 'active' : ''}`} onClick={() => setActiveTab('google')}>
            <Zap size={18} /> Integrations & Gemini Status
          </button>
          <button className={`tab-btn ${activeTab === 'tests' ? 'active' : ''}`} onClick={() => setActiveTab('tests')}>
            <ShieldCheck size={18} /> Automated Test Suite
          </button>
          <button className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
            <History size={18} /> Audit Log
          </button>
        </div>

        {/* Tab Views */}
        {activeTab === 'simulator' && <AgentSimulator onSendMessage={handleSendMessage} />}

        {activeTab === 'conversations' && <ConversationsManager />}

        {activeTab === 'whatsapp' && <WhatsAppSettingsManager />}

        {activeTab === 'leads' && <LeadsManager />}

        {activeTab === 'site-visits' && <SiteVisitsManager />}

        {activeTab === 'land' && (
          <LandManager
            knowledge={knowledge}
            onUpdateLandDev={handleUpdateLandDev}
            onUpdatePlotCat={handleUpdatePlotCat}
            onUpdateRegInfo={handleUpdateRegInfo}
            onUpdatePickup={handleUpdatePickup}
            onUpdateVerifItem={handleUpdateVerifItem}
          />
        )}

        {activeTab === 'manager' && (
          <LocationManager
            knowledge={knowledge}
            onRefresh={fetchKnowledge}
            onUpdateProject={handleUpdateProject}
            onUpdateNimz={handleUpdateNimz}
            onUpdateNearby={handleUpdateNearby}
            onUpdateHighway={handleUpdateHighway}
            onUpdateRailway={handleUpdateRailway}
            onUpdateAirport={handleUpdateAirport}
            onAddRegionalDev={handleAddRegionalDev}
            onDeleteRegionalDev={handleDeleteRegionalDev}
          />
        )}

        {activeTab === 'google' && <GoogleIntegrationsManager />}

        {activeTab === 'tests' && <TestSuite onRunTests={handleRunTests} />}

        {activeTab === 'audit' && (
          <div className="glass-card">
            <div className="card-header">
              <h3 className="card-title"><History color="var(--primary)" /> Source Control & Verification Audit Log</h3>
              <span className="status-pill confirmed">Internal Administrative Log</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Note: Internal source control fields, verified_by metadata, and audit logs are strictly protected and never exposed to public WhatsApp customers.
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {knowledge && knowledge.source_control && knowledge.source_control.audit_log ? (
                  knowledge.source_control.audit_log.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td><span className="debug-tag">{log.action}</span></td>
                      <td style={{ fontWeight: 600 }}>{log.user}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{log.details}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">No audit logs available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
