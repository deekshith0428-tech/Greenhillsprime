import React, { useState } from 'react';
import { MapPin, ShieldCheck, CheckCircle2, Clock, AlertTriangle, Edit3, Plus, Trash2, ExternalLink, Save, RefreshCw } from 'lucide-react';

export default function LocationManager({ knowledge, onRefresh, onUpdateProject, onUpdateNimz, onUpdateNearby, onUpdateHighway, onUpdateRailway, onUpdateAirport, onAddRegionalDev, onDeleteRegionalDev }) {
  const [activeSubTab, setActiveSubTab] = useState('project');
  const [editingModal, setEditingModal] = useState(null); // { type, item }

  if (!knowledge) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <RefreshCw className="animate-spin" style={{ margin: '0 auto 1rem auto' }} size={32} />
        <p style={{ color: 'var(--text-muted)' }}>Loading Location & Connectivity Knowledge Base...</p>
      </div>
    );
  }

  const { project_location, nimz_landmark, nearby_locations, highway_connectivity, railway_connectivity, airport_connectivity, regional_development, source_control } = knowledge;

  const renderStatusPill = (status, approved = true) => {
    const s = (status || 'TO_BE_CONFIRMED').toUpperCase();
    if (s === 'CONFIRMED' && approved) {
      return <span className="status-pill confirmed"><CheckCircle2 size={12} /> CONFIRMED</span>;
    }
    if (s === 'APPROXIMATE' || (s === 'CONFIRMED' && !approved)) {
      return <span className="status-pill approximate"><Clock size={12} /> {s === 'APPROXIMATE' ? 'APPROXIMATE' : 'UNAPPROVED'}</span>;
    }
    return <span className="status-pill to_be_confirmed"><AlertTriangle size={12} /> TO BE CONFIRMED</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Sub navigation tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <button
          className={`btn ${activeSubTab === 'project' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('project')}
        >
          <MapPin size={16} /> 1. Project Location & GPS
        </button>
        <button
          className={`btn ${activeSubTab === 'nimz' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('nimz')}
        >
          <ShieldCheck size={16} /> 2. NIMZ Zaheerabad Landmark
        </button>
        <button
          className={`btn ${activeSubTab === 'nearby' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('nearby')}
        >
          Nearby Locations Matrix ({nearby_locations.length})
        </button>
        <button
          className={`btn ${activeSubTab === 'transit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('transit')}
        >
          Highways, Railways & Airports
        </button>
        <button
          className={`btn ${activeSubTab === 'regional' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('regional')}
        >
          Regional Development
        </button>
      </div>

      {/* TAB 1: PROJECT LOCATION */}
      {activeSubTab === 'project' && (
        <div className="glass-card">
          <div className="card-header">
            <h3 className="card-title"><MapPin color="var(--primary)" /> Project Location Details (Royal Kingdom – Green Hills Prime)</h3>
            {renderStatusPill(project_location.verification_status)}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const updates = Object.fromEntries(formData.entries());
              onUpdateProject(updates);
            }}
          >
            <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Project Address</label>
                <input className="form-input" name="project_address" defaultValue={project_location.project_address || ''} placeholder="e.g. Plot No 12, Main Road (Leave blank if unconfirmed)" />
              </div>
              <div className="form-group">
                <label className="form-label">Village</label>
                <input className="form-input" name="village" defaultValue={project_location.village || ''} placeholder="Village name" />
              </div>
              <div className="form-group">
                <label className="form-label">Mandal</label>
                <input className="form-input" name="mandal" defaultValue={project_location.mandal || ''} placeholder="Mandal name" />
              </div>
              <div className="form-group">
                <label className="form-label">District</label>
                <input className="form-input" name="district" defaultValue={project_location.district || ''} placeholder="District" />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input className="form-input" name="state" defaultValue={project_location.state || ''} placeholder="State" />
              </div>
              <div className="form-group">
                <label className="form-label">Pincode</label>
                <input className="form-input" name="pincode" defaultValue={project_location.pincode || ''} placeholder="Pincode" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Google Maps URL</label>
                <input className="form-input" name="google_maps_location" defaultValue={project_location.google_maps_location || ''} placeholder="https://maps.google.com/?q=..." />
              </div>
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input className="form-input" name="latitude" defaultValue={project_location.latitude || ''} placeholder="e.g. 17.6833" />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input className="form-input" name="longitude" defaultValue={project_location.longitude || ''} placeholder="e.g. 77.6083" />
              </div>
              <div className="form-group">
                <label className="form-label">Nearest Highway</label>
                <input className="form-input" name="nearest_highway" defaultValue={project_location.nearest_highway || ''} placeholder="Nearest Highway" />
              </div>
              <div className="form-group">
                <label className="form-label">Nearest Town</label>
                <input className="form-input" name="nearest_town" defaultValue={project_location.nearest_town || ''} placeholder="Nearest Town" />
              </div>
              <div className="form-group">
                <label className="form-label">Nearest City</label>
                <input className="form-input" name="nearest_city" defaultValue={project_location.nearest_city || ''} placeholder="Nearest City" />
              </div>
              <div className="form-group">
                <label className="form-label">Verification Status</label>
                <select className="form-select" name="verification_status" defaultValue={project_location.verification_status || 'TO_BE_CONFIRMED'}>
                  <option value="TO_BE_CONFIRMED">TO BE CONFIRMED (Safety Locked)</option>
                  <option value="APPROXIMATE">APPROXIMATE</option>
                  <option value="CONFIRMED">CONFIRMED (Official)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button type="submit" className="btn btn-primary"><Save size={16} /> Save Location Settings</button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: NIMZ ZAHEERABAD */}
      {activeSubTab === 'nimz' && (
        <div className="glass-card">
          <div className="card-header">
            <h3 className="card-title"><ShieldCheck color="var(--primary)" /> Zaheerabad NIMZ Landmark & Safety Rules</h3>
            {renderStatusPill(nimz_landmark.nimz_distance_status, nimz_landmark.approved_for_customer)}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const updates = {
                nimz_distance_km: formData.get('nimz_distance_km') ? parseFloat(formData.get('nimz_distance_km')) : null,
                nimz_distance_status: formData.get('nimz_distance_status'),
                nimz_distance_source: formData.get('nimz_distance_source'),
                approved_for_customer: formData.get('approved_for_customer') === 'true',
                customer_explanation: formData.get('customer_explanation')
              };
              onUpdateNimz(updates);
            }}
          >
            <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Landmark Name</label>
                <input className="form-input" value={nimz_landmark.name} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Short Name</label>
                <input className="form-input" value={nimz_landmark.short_name} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">NIMZ Distance (KM)</label>
                <input className="form-input" type="number" step="0.1" name="nimz_distance_km" defaultValue={nimz_landmark.nimz_distance_km || ''} placeholder="e.g. 15 (Leave blank if pending)" />
              </div>
              <div className="form-group">
                <label className="form-label">Distance Status</label>
                <select className="form-select" name="nimz_distance_status" defaultValue={nimz_landmark.nimz_distance_status}>
                  <option value="TO_BE_CONFIRMED">TO_BE_CONFIRMED</option>
                  <option value="APPROXIMATE">APPROXIMATE</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Customer Approval Status</label>
                <select className="form-select" name="approved_for_customer" defaultValue={nimz_landmark.approved_for_customer ? 'true' : 'false'}>
                  <option value="false">DO NOT COMMUNICATE NUMERIC DISTANCE (Unapproved)</option>
                  <option value="true">APPROVED FOR CUSTOMER COMMUNICATION</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Distance Source / Verification Log</label>
                <input className="form-input" name="nimz_distance_source" defaultValue={nimz_landmark.nimz_distance_source || ''} placeholder="e.g. Verified by Project Surveyor Team" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Customer Explanation Boilerplate</label>
                <textarea className="form-textarea" name="customer_explanation" defaultValue={nimz_landmark.customer_explanation} />
              </div>
            </div>

            <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#f43f5e', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <AlertTriangle size={16} /> Strict AI Safety Guardrail (Rule 16 & 2)
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                The AI is programmed to <strong>NEVER promise financial returns or double plot prices</strong> when answering NIMZ or location questions. It enforces objective factual growth corridor explanations.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary"><Save size={16} /> Update NIMZ Settings</button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: NEARBY LOCATIONS MATRIX */}
      {activeSubTab === 'nearby' && (
        <div className="glass-card">
          <div className="card-header">
            <h3 className="card-title">Nearby Locations Database</h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Source Controlled & Verified Distances Only</span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Location Name</th>
                <th>Type</th>
                <th>Distance (KM)</th>
                <th>Travel Time</th>
                <th>Status</th>
                <th>Customer Approval</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {nearby_locations.map((loc) => (
                <tr key={loc.id}>
                  <td style={{ fontWeight: 700 }}>{loc.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{loc.type}</td>
                  <td>{loc.distance_km !== null ? `${loc.distance_km} km` : <span style={{ color: 'var(--text-dim)' }}>Pending</span>}</td>
                  <td>{loc.travel_time || <span style={{ color: 'var(--text-dim)' }}>--</span>}</td>
                  <td>{renderStatusPill(loc.distance_status, loc.approved_for_customer)}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${loc.approved_for_customer ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => onUpdateNearby(loc.id, { approved_for_customer: !loc.approved_for_customer })}
                    >
                      {loc.approved_for_customer ? 'Approved' : 'Unapproved'}
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingModal({ type: 'nearby', item: loc })}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: TRANSIT */}
      {activeSubTab === 'transit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Highways */}
          <div className="glass-card">
            <div className="card-header">
              <h3 className="card-title">Highway Connectivity (NH-65, SH-14, SH-16)</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Highway</th>
                  <th>Full Title</th>
                  <th>Project Relationship</th>
                  <th>Distance Status</th>
                  <th>Customer Approval</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {highway_connectivity.map((hw) => (
                  <tr key={hw.id}>
                    <td style={{ fontWeight: 700 }}>{hw.name}</td>
                    <td>{hw.full_name || hw.name}</td>
                    <td>{hw.relationship}</td>
                    <td>{renderStatusPill(hw.distance_status, hw.approved_for_customer)}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${hw.approved_for_customer ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => onUpdateHighway(hw.id, { approved_for_customer: !hw.approved_for_customer })}
                      >
                        {hw.approved_for_customer ? 'Approved' : 'Unapproved'}
                      </button>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingModal({ type: 'highway', item: hw })}>
                        <Edit3 size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Railways */}
          <div className="glass-card">
            <div className="card-header">
              <h3 className="card-title">Railway Stations (Metalkunta, Zaheerabad, Bidar)</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Station Name</th>
                  <th>Distance (KM)</th>
                  <th>Travel Time</th>
                  <th>Status</th>
                  <th>Customer Approved</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {railway_connectivity.map((rw) => (
                  <tr key={rw.id}>
                    <td style={{ fontWeight: 700 }}>{rw.name}</td>
                    <td>{rw.distance_km !== null ? `${rw.distance_km} km` : <span style={{ color: 'var(--text-dim)' }}>Pending</span>}</td>
                    <td>{rw.travel_time || '--'}</td>
                    <td>{renderStatusPill(rw.distance_status, rw.approved_for_customer)}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${rw.approved_for_customer ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => onUpdateRailway(rw.id, { approved_for_customer: !rw.approved_for_customer })}
                      >
                        {rw.approved_for_customer ? 'Approved' : 'Unapproved'}
                      </button>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingModal({ type: 'railway', item: rw })}>
                        <Edit3 size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Airports */}
          <div className="glass-card">
            <div className="card-header">
              <h3 className="card-title">Airports (Bidar & RGIA Hyderabad)</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Airport Name</th>
                  <th>Distance (KM)</th>
                  <th>Travel Time</th>
                  <th>Status</th>
                  <th>Customer Approved</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {airport_connectivity.map((ap) => (
                  <tr key={ap.id}>
                    <td style={{ fontWeight: 700 }}>{ap.name}</td>
                    <td>{ap.distance_km !== null ? `${ap.distance_km} km` : <span style={{ color: 'var(--text-dim)' }}>Pending</span>}</td>
                    <td>{ap.travel_time || '--'}</td>
                    <td>{renderStatusPill(ap.distance_status, ap.approved_for_customer)}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${ap.approved_for_customer ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => onUpdateAirport(ap.id, { approved_for_customer: !ap.approved_for_customer })}
                      >
                        {ap.approved_for_customer ? 'Approved' : 'Unapproved'}
                      </button>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingModal({ type: 'airport', item: ap })}>
                        <Edit3 size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: REGIONAL DEVELOPMENT */}
      {activeSubTab === 'regional' && (
        <div className="glass-card">
          <div className="card-header">
            <h3 className="card-title">Regional Development Context (Current vs Proposed Infrastructure)</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const name = prompt('Development Item Title:');
                if (!name) return;
                const type = confirm('Is this CURRENT/CONFIRMED? Click OK for CURRENT, Cancel for PROPOSED/PLANNED')
                  ? 'CURRENT_CONFIRMED'
                  : 'PROPOSED_PLANNED';
                onAddRegionalDev({ name, type, category: 'Infrastructure', description: 'Added via Admin' });
              }}
            >
              <Plus size={14} /> Add Infrastructure Item
            </button>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Infrastructure Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {regional_development.map((rd) => (
                <tr key={rd.id}>
                  <td style={{ fontWeight: 700 }}>{rd.name}</td>
                  <td>{rd.category}</td>
                  <td>
                    {rd.type === 'CURRENT_CONFIRMED' ? (
                      <span className="status-pill confirmed">CURRENT / CONFIRMED</span>
                    ) : (
                      <span className="status-pill approximate">PROPOSED / PLANNED</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{rd.description}</td>
                  <td>{rd.status}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => onDeleteRegionalDev(rd.id)}>
                      <Trash2 size={14} color="#f43f5e" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingModal && (
        <div className="modal-backdrop" onClick={() => setEditingModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Edit {editingModal.item.name}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const updates = {
                  distance_km: formData.get('distance_km') ? parseFloat(formData.get('distance_km')) : null,
                  travel_time: formData.get('travel_time') || null,
                  distance_status: formData.get('distance_status'),
                  approved_for_customer: formData.get('approved_for_customer') === 'true',
                  source: formData.get('source'),
                  notes: formData.get('notes')
                };

                if (editingModal.type === 'nearby') onUpdateNearby(editingModal.item.id, updates);
                if (editingModal.type === 'highway') onUpdateHighway(editingModal.item.id, updates);
                if (editingModal.type === 'railway') onUpdateRailway(editingModal.item.id, updates);
                if (editingModal.type === 'airport') onUpdateAirport(editingModal.item.id, updates);

                setEditingModal(null);
              }}
            >
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Distance (KM)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.1"
                  name="distance_km"
                  defaultValue={editingModal.item.distance_km || ''}
                  placeholder="Enter confirmed numeric distance"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Travel Time</label>
                <input
                  className="form-input"
                  name="travel_time"
                  defaultValue={editingModal.item.travel_time || ''}
                  placeholder="e.g. 20 mins"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Distance Status</label>
                <select className="form-select" name="distance_status" defaultValue={editingModal.item.distance_status || 'TO_BE_CONFIRMED'}>
                  <option value="TO_BE_CONFIRMED">TO_BE_CONFIRMED (Hidden from AI)</option>
                  <option value="APPROXIMATE">APPROXIMATE</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Approved for Customer</label>
                <select className="form-select" name="approved_for_customer" defaultValue={editingModal.item.approved_for_customer ? 'true' : 'false'}>
                  <option value="true">YES - Approved</option>
                  <option value="false">NO - Unapproved</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Source / Verification Note</label>
                <input className="form-input" name="source" defaultValue={editingModal.item.source || ''} placeholder="e.g. Approved by Project Head" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Save size={14} /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
