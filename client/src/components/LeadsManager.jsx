import React, { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, CheckCircle, FileSpreadsheet, Calendar, Phone, ArrowUpRight } from 'lucide-react';

export default function LeadsManager() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [interestFilter, setInterestFilter] = useState('ALL');
  const [toast, setToast] = useState('');

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leads');
      const json = await res.json();
      if (json.success) {
        setLeads(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const handleStatusChange = async (phone, newStatus) => {
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(phone)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_status: newStatus })
      });
      const json = await res.json();
      if (json.success) {
        triggerToast(`Lead status updated to ${newStatus}`);
        fetchLeads();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      (lead.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (lead.whatsapp_number || '').includes(search) ||
      (lead.budget || '').toLowerCase().includes(search.toLowerCase());
    const matchesInterest = interestFilter === 'ALL' || lead.interest_level === interestFilter;
    return matchesSearch && matchesInterest;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {toast && (
        <div style={{ background: '#10b981', color: '#042f2e', padding: '0.75rem 1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.875rem' }}>
          ✓ {toast}
        </div>
      )}

      {/* Header controls */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Users size={22} color="var(--primary)" />
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Green Hills Prime Interested Leads (Google Sheets Sync)</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Primary Identifier: <strong>WhatsApp Number</strong> (Upsert protection - Zero duplicate rows created)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchLeads}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Leads
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '1rem', marginTop: '1.25rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search leads by name, WhatsApp number, or budget..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="form-input" value={interestFilter} onChange={(e) => setInterestFilter(e.target.value)}>
            <option value="ALL">All Interest Levels</option>
            <option value="SITE_VISIT_READY">SITE_VISIT_READY</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
            <option value="HUMAN_HANDOFF">HUMAN_HANDOFF</option>
            <option value="NOT_INTERESTED">NOT_INTERESTED</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="glass-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer / Phone</th>
              <th>Interest Level</th>
              <th>Budget & Purpose</th>
              <th>Site Visit Status</th>
              <th>Lead Status</th>
              <th>Last Customer Message</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => (
                <tr key={lead.lead_id || lead.whatsapp_number}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{lead.customer_name || 'Interested Customer'}</div>
                    <div style={{ fontSize: '0.78125rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Phone size={12} /> {lead.whatsapp_number}
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill ${lead.interest_level === 'SITE_VISIT_READY' || lead.interest_level === 'HIGH' ? 'confirmed' : 'pending'}`}>
                      {lead.interest_level || 'MEDIUM'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem' }}>
                    <div>💰 Budget: <strong>{lead.budget || 'Unspecified'}</strong></div>
                    <div style={{ color: 'var(--text-muted)' }}>🎯 Purpose: {lead.purpose || 'Unspecified'}</div>
                    <div style={{ color: 'var(--text-muted)' }}>📏 Size: {lead.preferred_plot_size || 'General'}</div>
                  </td>
                  <td style={{ fontSize: '0.8125rem' }}>
                    {lead.site_visit_interested ? (
                      <div>
                        <span className="status-pill confirmed">📅 {lead.site_visit_date} @ {lead.site_visit_time}</span>
                        {lead.pickup_location && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>📍 Pickup: {lead.pickup_location}</div>}
                        {lead.google_calendar_event_id && <div style={{ fontSize: '0.71875rem', fontFamily: 'var(--font-mono)', color: '#8696a0' }}>Calendar ID: {lead.google_calendar_event_id}</div>}
                      </div>
                    ) : (
                      <span className="status-pill pending">No Visit Scheduled</span>
                    )}
                  </td>
                  <td>
                    <select
                      className="form-input"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.78125rem' }}
                      value={lead.lead_status || 'NEW_LEAD'}
                      onChange={(e) => handleStatusChange(lead.whatsapp_number, e.target.value)}
                    >
                      <option value="NEW_LEAD">NEW_LEAD</option>
                      <option value="ONBOARDED">ONBOARDED</option>
                      <option value="SITE_VISIT_SCHEDULED">SITE_VISIT_SCHEDULED</option>
                      <option value="SITE_VISIT_CONFIRMED">SITE_VISIT_CONFIRMED</option>
                      <option value="SITE_VISIT_RESCHEDULED">SITE_VISIT_RESCHEDULED</option>
                      <option value="VISIT_CANCELLED">VISIT_CANCELLED</option>
                      <option value="HUMAN_HANDOFF">HUMAN_HANDOFF</option>
                    </select>
                  </td>
                  <td style={{ fontSize: '0.78125rem', color: 'var(--text-muted)', maxWidth: '240px' }}>
                    "{lead.last_customer_message || 'N/A'}"
                  </td>
                  <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                    {lead.updated_at ? new Date(lead.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No matching leads found. Start a conversation in the Interactive Simulator to create real-time leads.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
