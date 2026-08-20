import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, FileText, CheckCircle2, RefreshCw, Car, MapPin, Scale } from 'lucide-react';

export default function LandManager({
  knowledge,
  onUpdateLandDev,
  onUpdatePlotCat,
  onUpdateRegInfo,
  onUpdatePickup,
  onUpdateVerifItem
}) {
  const [activeSubTab, setActiveSubTab] = useState('categories');
  const [toast, setToast] = useState('');

  if (!knowledge) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading Land & Registration Knowledge...</div>;
  }

  const regInfo = knowledge.registration_info || {};
  const landDev = knowledge.land_development || {};
  const pickup = knowledge.pickup_policy || {};
  const plotCats = knowledge.plot_categories || [];
  const checklist = knowledge.verification_checklist || [];

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {toast && (
        <div style={{ background: '#10b981', color: '#042f2e', padding: '0.75rem 1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.875rem' }}>
          ✓ {toast}
        </div>
      )}

      {/* Sub Navigation */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
        <button
          className={`btn ${activeSubTab === 'categories' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveSubTab('categories')}
        >
          <FileText size={16} /> Plot Categories & Land Status
        </button>
        <button
          className={`btn ${activeSubTab === 'registration' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveSubTab('registration')}
        >
          <Scale size={16} /> Spot Registration & Schemes
        </button>
        <button
          className={`btn ${activeSubTab === 'pickup' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveSubTab('pickup')}
        >
          <Car size={16} /> Free Site Visit & Pickup Policy
        </button>
        <button
          className={`btn ${activeSubTab === 'checklist' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveSubTab('checklist')}
        >
          <ShieldCheck size={16} /> Unconfirmed Facts Checklist
        </button>
      </div>

      {/* SUB TAB 1: PLOT CATEGORIES & LAND DEVELOPMENT */}
      {activeSubTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card">
            <div className="card-header">
              <h3 className="card-title"><FileText color="var(--primary)" /> Land Development Claim</h3>
              <span className="status-pill warning">Project Team Provided</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
              <div>
                <label className="form-label">Development Claim Title</label>
                <input
                  className="form-input"
                  defaultValue={landDev.claim || 'Fully developed land'}
                  onBlur={(e) => {
                    onUpdateLandDev({ claim: e.target.value });
                    triggerToast('Land development claim updated');
                  }}
                />
              </div>
              <div>
                <label className="form-label">Verification Status</label>
                <select
                  className="form-input"
                  value={landDev.verification_status || 'PROJECT_TEAM_PROVIDED'}
                  onChange={(e) => {
                    onUpdateLandDev({ verification_status: e.target.value });
                    triggerToast('Status updated');
                  }}
                >
                  <option value="PROJECT_TEAM_PROVIDED">PROJECT_TEAM_PROVIDED</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="TO_BE_OFFICIALLY_CONFIRMED">TO_BE_OFFICIALLY_CONFIRMED</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label className="form-label">Safety Disclaimer (Prevents misinterpretation)</label>
              <textarea
                className="form-input"
                rows={2}
                defaultValue={landDev.disclaimer || ''}
                onBlur={(e) => {
                  onUpdateLandDev({ disclaimer: e.target.value });
                  triggerToast('Disclaimer updated');
                }}
              />
            </div>
          </div>

          <div className="glass-card">
            <div className="card-header">
              <h3 className="card-title"><FileText color="var(--primary)" /> Land & Plot Categories</h3>
            </div>
            <table className="data-table" style={{ marginTop: '0.75rem' }}>
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Classification</th>
                  <th>Legal Status</th>
                  <th>Customer Exposure</th>
                </tr>
              </thead>
              <tbody>
                {plotCats.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      <strong>{cat.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cat.category_description}</div>
                    </td>
                    <td><span className="debug-tag">{cat.plot_category}</span></td>
                    <td>
                      <select
                        className="form-input"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                        value={cat.legal_status || 'PROJECT_TEAM_PROVIDED'}
                        onChange={(e) => {
                          onUpdatePlotCat(cat.id, { legal_status: e.target.value });
                          triggerToast(`Updated legal status for ${cat.name}`);
                        }}
                      >
                        <option value="PROJECT_TEAM_PROVIDED">PROJECT_TEAM_PROVIDED</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="VERIFIED">VERIFIED</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className={`btn ${cat.approved_for_customer ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={() => {
                          onUpdatePlotCat(cat.id, { approved_for_customer: !cat.approved_for_customer });
                          triggerToast(`Customer approval toggled for ${cat.name}`);
                        }}
                      >
                        {cat.approved_for_customer ? '✓ Approved' : '🔒 Internal Only'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB TAB 2: REGISTRATION & SCHEMES */}
      {activeSubTab === 'registration' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card">
            <div className="card-header">
              <h3 className="card-title"><Scale color="var(--primary)" /> Spot Registration & ₹2 Lakh Guardrail</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '0.75rem' }}>
              <div>
                <label className="form-label">Spot Registration Available</label>
                <select
                  className="form-input"
                  value={regInfo.spot_registration_available ? 'true' : 'false'}
                  onChange={(e) => {
                    onUpdateRegInfo({ spot_registration_available: e.target.value === 'true' });
                    triggerToast('Spot registration availability updated');
                  }}
                >
                  <option value="true">Yes - Spot Registration Available</option>
                  <option value="false">No - Unavailable</option>
                </select>
              </div>

              <div>
                <label className="form-label">₹2 Lakh Claim Interpretation Guardrail</label>
                <input
                  className="form-input"
                  readOnly
                  value="UNCLARIFIED_PROJECT_TEAM_CLAIM (AI never states as fixed registration fee)"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid #f87171' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label className="form-label">Approved Spot Registration Customer Wording</label>
              <textarea
                className="form-input"
                rows={2}
                defaultValue={regInfo.spot_registration_wording || ''}
                onBlur={(e) => {
                  onUpdateRegInfo({ spot_registration_wording: e.target.value });
                  triggerToast('Registration wording updated');
                }}
              />
            </div>
          </div>

          <div className="glass-card">
            <div className="card-header">
              <h3 className="card-title"><ShieldCheck color="var(--primary)" /> Patta, Passbook, Rythu Bandhu & Rythu Bima Claims</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
              <div>
                <label className="form-label">Patta & Passbook Claim Wording</label>
                <textarea
                  className="form-input"
                  rows={2}
                  defaultValue={regInfo.patta_passbook_wording || ''}
                  onBlur={(e) => {
                    onUpdateRegInfo({ patta_passbook_wording: e.target.value });
                    triggerToast('Patta wording updated');
                  }}
                />
              </div>

              <div>
                <label className="form-label">Rythu Bandhu Eligibility Wording (Conditional language enforced)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  defaultValue={regInfo.rythu_bandhu_wording || ''}
                  onBlur={(e) => {
                    onUpdateRegInfo({ rythu_bandhu_wording: e.target.value });
                    triggerToast('Rythu Bandhu wording updated');
                  }}
                />
              </div>

              <div>
                <label className="form-label">Rythu Bima Eligibility Wording (Conditional language enforced)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  defaultValue={regInfo.rythu_bima_wording || ''}
                  onBlur={(e) => {
                    onUpdateRegInfo({ rythu_bima_wording: e.target.value });
                    triggerToast('Rythu Bima wording updated');
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 3: FREE SITE VISIT & PICKUP POLICY */}
      {activeSubTab === 'pickup' && (
        <div className="glass-card">
          <div className="card-header">
            <h3 className="card-title"><Car color="var(--primary)" /> Free Site Visit & Pickup Policy Settings</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '0.75rem' }}>
            <div>
              <label className="form-label">Company Vehicle Site Visit Available</label>
              <select
                className="form-input"
                value={pickup.company_vehicle_available ? 'true' : 'false'}
                onChange={(e) => {
                  onUpdatePickup({ company_vehicle_available: e.target.value === 'true' });
                  triggerToast('Vehicle policy updated');
                }}
              >
                <option value="true">Yes - Free Vehicle Provided</option>
                <option value="false">No - Self Transport Only</option>
              </select>
            </div>

            <div>
              <label className="form-label">Approved Pickup Locations (Comma separated)</label>
              <input
                className="form-input"
                defaultValue={Array.isArray(pickup.pickup_locations) ? pickup.pickup_locations.join(', ') : ''}
                onBlur={(e) => {
                  const locs = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                  onUpdatePickup({ pickup_locations: locs });
                  triggerToast('Pickup locations updated');
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label className="form-label">Transportation Policy Notes for AI Agent</label>
            <textarea
              className="form-input"
              rows={2}
              defaultValue={pickup.transportation_notes || ''}
              onBlur={(e) => {
                onUpdatePickup({ transportation_notes: e.target.value });
                triggerToast('Policy notes updated');
              }}
            />
          </div>
        </div>
      )}

      {/* SUB TAB 4: UNCONFIRMED FACTS CHECKLIST */}
      {activeSubTab === 'checklist' && (
        <div className="glass-card">
          <div className="card-header">
            <h3 className="card-title"><ShieldCheck color="var(--primary)" /> Verification Checklist for Unconfirmed Items (Part U)</h3>
            <span className="status-pill warning">Strict Safety Enforcement</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            The AI Agent will never guess these items until an authorized admin explicitly changes their status to <strong>VERIFIED</strong>.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Checklist Item</th>
                <th>Status</th>
                <th>Safety Note</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {checklist.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.item}</strong></td>
                  <td>
                    <span className={`status-pill ${item.status === 'VERIFIED' ? 'confirmed' : 'pending'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item.note || 'Awaiting project team signoff'}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const newStatus = item.status === 'VERIFIED' ? 'PENDING_OFFICIAL_CONFIRMATION' : 'VERIFIED';
                        onUpdateVerifItem(item.id, { status: newStatus });
                        triggerToast(`Updated ${item.item} to ${newStatus}`);
                      }}
                    >
                      Toggle Verification
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
