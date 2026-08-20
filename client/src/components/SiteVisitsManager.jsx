import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Car, CheckCircle2, AlertTriangle, Plus, RefreshCw } from 'lucide-react';

export default function SiteVisitsManager() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');

  // Form states
  const [phone, setPhone] = useState('+919876543210');
  const [name, setName] = useState('Anil Verma');
  const [date, setDate] = useState('2026-08-23');
  const [time, setTime] = useState('11:00 AM');
  const [pickup, setPickup] = useState('Miyapur Metro Station, Hyderabad');

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/site-visits');
      const json = await res.json();
      if (json.success) {
        setAppointments(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const handleBook = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/site-visits/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_number: phone,
          customer_name: name,
          date,
          time,
          pickup_location: pickup
        })
      });
      const json = await res.json();
      if (json.success) {
        triggerToast(`Site Visit Confirmed! Google Calendar Event ID: ${json.calendar.eventId}`);
        setShowModal(false);
        fetchAppointments();
      } else {
        alert(json.error || 'Failed to schedule appointment');
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

      {/* Header controls */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar size={22} color="var(--primary)" />
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Green Hills Prime Site Visit Appointments</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Integrated with <strong>Google Calendar API</strong> (Double Booking Protection Active)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
              <Plus size={14} /> Schedule New Visit
            </button>
            <button className="btn btn-secondary btn-sm" onClick={fetchAppointments}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Modal for manual booking */}
      {showModal && (
        <div className="glass-card" style={{ border: '2px solid var(--primary)', background: '#182229' }}>
          <div className="card-header">
            <h3 className="card-title"><Calendar color="var(--primary)" /> Book Site Visit (Company Vehicle)</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>✕ Close</button>
          </div>
          <form onSubmit={handleBook} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label className="form-label">Customer Name</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">WhatsApp Phone Number</label>
              <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Visit Date (YYYY-MM-DD)</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Visit Time Slot</label>
              <select className="form-input" value={time} onChange={(e) => setTime(e.target.value)}>
                <option value="10:00 AM">10:00 AM Slot</option>
                <option value="11:00 AM">11:00 AM Slot (Recommended)</option>
                <option value="02:00 PM">02:00 PM Slot</option>
                <option value="04:00 PM">04:00 PM Slot</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Pickup Location (Company Vehicle)</label>
              <input className="form-input" value={pickup} onChange={(e) => setPickup(e.target.value)} required />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">✓ Confirm & Create Calendar Event</button>
            </div>
          </form>
        </div>
      )}

      {/* Appointments Table */}
      <div className="glass-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Date & Time</th>
              <th>Transportation & Pickup</th>
              <th>Status</th>
              <th>Google Calendar Event ID</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length > 0 ? (
              appointments.map((apt) => (
                <tr key={apt.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{apt.customer_name}</div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{apt.whatsapp_number}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}><Calendar size={12} /> {apt.date}</div>
                    <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}><Clock size={12} /> {apt.time}</div>
                  </td>
                  <td style={{ fontSize: '0.8125rem' }}>
                    <div><Car size={12} color="var(--primary)" /> {apt.vehicle_required ? 'Company Vehicle' : 'Self Transport'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 {apt.pickup_location || 'Project Site Direct'}</div>
                  </td>
                  <td>
                    <span className={`status-pill ${apt.status === 'CONFIRMED' || apt.status === 'RESCHEDULED' ? 'confirmed' : apt.status === 'CANCELLED' ? 'unverified' : 'pending'}`}>
                      {apt.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#8696a0' }}>
                    {apt.google_calendar_event_id || 'gcal_pending'}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {apt.created_at ? new Date(apt.created_at).toLocaleDateString() : 'Today'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No appointments scheduled yet. Click "Schedule New Visit" or test in the Interactive Simulator.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
