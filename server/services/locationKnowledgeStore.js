const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/locationKnowledge.json');

class LocationKnowledgeStore {
  constructor() {
    this.data = null;
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        this.data = JSON.parse(raw);
      } else {
        throw new Error('Data file missing');
      }
    } catch (err) {
      console.error('Failed to load locationKnowledge.json:', err.message);
      this.data = this.getDefaults();
      this.saveData();
    }
  }

  saveData() {
    try {
      if (this.data && this.data.source_control) {
        this.data.source_control.verification_date = new Date().toISOString().split('T')[0];
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Failed to save locationKnowledge.json:', err.message);
      return false;
    }
  }

  getKnowledge() {
    return this.data;
  }

  logAudit(action, user = 'Admin', details = '') {
    const entry = {
      id: 'audit_' + Date.now(),
      timestamp: new Date().toISOString(),
      action,
      user,
      details
    };
    if (!this.data.source_control.audit_log) {
      this.data.source_control.audit_log = [];
    }
    this.data.source_control.audit_log.unshift(entry);
    if (this.data.source_control.audit_log.length > 50) {
      this.data.source_control.audit_log = this.data.source_control.audit_log.slice(0, 50);
    }
  }

  updateProjectLocation(updates, user = 'Admin') {
    const allowedFields = [
      'project_name',
      'project_address',
      'village',
      'project_village',
      'mandal',
      'project_mandal',
      'district',
      'project_district',
      'state',
      'project_state',
      'pincode',
      'google_maps_location',
      'latitude',
      'longitude',
      'nearest_highway',
      'nearest_town',
      'nearest_city',
      'verification_status',
      'location_verification_status'
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        this.data.project_location[field] = updates[field];
      }
    });

    this.logAudit('UPDATE_PROJECT_LOCATION', user, 'Updated project location fields');
    return this.saveData();
  }

  updateNimzLandmark(updates, user = 'Admin') {
    const fields = [
      'name',
      'distance_km',
      'nimz_distance_km',
      'distance_status',
      'nimz_distance_status',
      'verification_status',
      'nimz_distance_source',
      'approved_for_customer',
      'customer_explanation',
      'disclaimer'
    ];

    fields.forEach((field) => {
      if (updates[field] !== undefined) {
        this.data.nimz_landmark[field] = updates[field];
      }
    });

    this.logAudit(
      'UPDATE_NIMZ_LANDMARK',
      user,
      `NIMZ status: ${updates.distance_status || this.data.nimz_landmark.distance_status}, Distance: ${updates.distance_km || 'N/A'}`
    );
    return this.saveData();
  }

  updateNearbyLocation(id, updates, user = 'Admin') {
    const index = this.data.nearby_locations.findIndex((loc) => loc.id === id);
    if (index === -1) return false;

    const loc = this.data.nearby_locations[index];
    if (updates.distance_km !== undefined) loc.distance_km = updates.distance_km;
    if (updates.distance_type !== undefined) loc.distance_type = updates.distance_type;
    if (updates.distance_status !== undefined) loc.distance_status = updates.distance_status;
    if (updates.source !== undefined) loc.source = updates.source;
    if (updates.verified !== undefined) loc.verified = updates.verified;
    if (updates.verification_status !== undefined) loc.verification_status = updates.verification_status;
    if (updates.approved_for_customer !== undefined) loc.approved_for_customer = updates.approved_for_customer;
    if (updates.notes !== undefined) loc.notes = updates.notes;

    this.logAudit('UPDATE_NEARBY_LOCATION', user, `Updated location ${loc.name} (${loc.distance_status})`);
    return this.saveData();
  }

  updateHighway(id, updates, user = 'Admin') {
    const index = this.data.highway_connectivity.findIndex((hw) => hw.id === id);
    if (index === -1) return false;

    const hw = this.data.highway_connectivity[index];
    if (updates.relationship !== undefined) hw.relationship = updates.relationship;
    if (updates.distance_status !== undefined) hw.distance_status = updates.distance_status;
    if (updates.approved_for_customer !== undefined) hw.approved_for_customer = updates.approved_for_customer;
    if (updates.notes !== undefined) hw.notes = updates.notes;

    this.logAudit('UPDATE_HIGHWAY', user, `Updated highway ${hw.name}`);
    return this.saveData();
  }

  updateRailway(id, updates, user = 'Admin') {
    const index = this.data.railway_connectivity.findIndex((rw) => rw.id === id);
    if (index === -1) return false;

    const rw = this.data.railway_connectivity[index];
    if (updates.distance_km !== undefined) rw.distance_km = updates.distance_km;
    if (updates.distance_status !== undefined) rw.distance_status = updates.distance_status;
    if (updates.approved_for_customer !== undefined) rw.approved_for_customer = updates.approved_for_customer;
    if (updates.source !== undefined) rw.source = updates.source;

    this.logAudit('UPDATE_RAILWAY', user, `Updated railway ${rw.name}`);
    return this.saveData();
  }

  updateAirport(id, updates, user = 'Admin') {
    const index = this.data.airport_connectivity.findIndex((ap) => ap.id === id);
    if (index === -1) return false;

    const ap = this.data.airport_connectivity[index];
    if (updates.distance_km !== undefined) ap.distance_km = updates.distance_km;
    if (updates.distance_status !== undefined) ap.distance_status = updates.distance_status;
    if (updates.approved_for_customer !== undefined) ap.approved_for_customer = updates.approved_for_customer;
    if (updates.source !== undefined) ap.source = updates.source;

    this.logAudit('UPDATE_AIRPORT', user, `Updated airport ${ap.name}`);
    return this.saveData();
  }

  addRegionalDevelopment(item, user = 'Admin') {
    const newItem = {
      id: 'dev_' + Date.now(),
      name: item.name,
      category: item.category || 'Industrial development',
      status: item.status || 'PROPOSED',
      description: item.description || '',
      approved_for_customer: item.approved_for_customer !== undefined ? item.approved_for_customer : true
    };
    if (!this.data.development_ecosystem) this.data.development_ecosystem = [];
    this.data.development_ecosystem.push(newItem);
    this.logAudit('ADD_REGIONAL_DEV', user, `Added development item ${newItem.name}`);
    this.saveData();
    return newItem;
  }

  updateRegionalDevelopment(id, updates, user = 'Admin') {
    if (!this.data.development_ecosystem) return false;
    const index = this.data.development_ecosystem.findIndex((rd) => rd.id === id);
    if (index === -1) return false;

    const rd = this.data.development_ecosystem[index];
    if (updates.name !== undefined) rd.name = updates.name;
    if (updates.category !== undefined) rd.category = updates.category;
    if (updates.status !== undefined) rd.status = updates.status;
    if (updates.description !== undefined) rd.description = updates.description;
    if (updates.approved_for_customer !== undefined) rd.approved_for_customer = updates.approved_for_customer;

    this.logAudit('UPDATE_REGIONAL_DEV', user, `Updated development item ${rd.name}`);
    return this.saveData();
  }

  deleteRegionalDevelopment(id, user = 'Admin') {
    if (!this.data.development_ecosystem) return false;
    const initialLen = this.data.development_ecosystem.length;
    this.data.development_ecosystem = this.data.development_ecosystem.filter((rd) => rd.id !== id);
    if (this.data.development_ecosystem.length !== initialLen) {
      this.logAudit('DELETE_REGIONAL_DEV', user, `Deleted development item ID ${id}`);
      return this.saveData();
    }
    return false;
  }

  updateLandDevelopment(updates, user = 'Admin') {
    if (!this.data.land_development) this.data.land_development = {};
    const fields = ['claim', 'source', 'verification_status', 'approved_for_customer', 'disclaimer'];
    fields.forEach((f) => {
      if (updates[f] !== undefined) this.data.land_development[f] = updates[f];
    });
    this.logAudit('UPDATE_LAND_DEVELOPMENT', user, 'Updated land development claims');
    return this.saveData();
  }

  updatePlotCategory(id, updates, user = 'Admin') {
    if (!this.data.plot_categories) return false;
    const cat = this.data.plot_categories.find((c) => c.id === id);
    if (!cat) return false;

    const fields = ['name', 'plot_category', 'category_description', 'legal_status', 'verification_status', 'approved_for_customer'];
    fields.forEach((f) => {
      if (updates[f] !== undefined) cat[f] = updates[f];
    });

    this.logAudit('UPDATE_PLOT_CATEGORY', user, `Updated plot category ${cat.name}`);
    return this.saveData();
  }

  updateRegistrationInfo(updates, user = 'Admin') {
    if (!this.data.registration_info) this.data.registration_info = {};
    const fields = [
      'spot_registration_available',
      'spot_registration_wording',
      'registration_amount',
      'registration_amount_type',
      'registration_description',
      'verification_status',
      'patta_passbook_claim',
      'patta_passbook_wording',
      'patta_passbook_status',
      'rythu_bandhu_claim',
      'rythu_bandhu_wording',
      'rythu_bandhu_status',
      'rythu_bima_claim',
      'rythu_bima_wording',
      'rythu_bima_status'
    ];

    fields.forEach((f) => {
      if (updates[f] !== undefined) this.data.registration_info[f] = updates[f];
    });

    this.logAudit('UPDATE_REGISTRATION_INFO', user, 'Updated registration and government scheme claims');
    return this.saveData();
  }

  updatePickupPolicy(updates, user = 'Admin') {
    if (!this.data.pickup_policy) this.data.pickup_policy = {};
    if (updates.free_site_visit !== undefined) this.data.pickup_policy.free_site_visit = updates.free_site_visit;
    if (updates.company_vehicle_available !== undefined) this.data.pickup_policy.company_vehicle_available = updates.company_vehicle_available;
    if (updates.pickup_locations !== undefined) this.data.pickup_policy.pickup_locations = updates.pickup_locations;
    if (updates.transportation_notes !== undefined) this.data.pickup_policy.transportation_notes = updates.transportation_notes;

    this.logAudit('UPDATE_PICKUP_POLICY', user, 'Updated pickup & site visit policy');
    return this.saveData();
  }

  updateVerificationItem(id, updates, user = 'Admin') {
    if (!this.data.verification_checklist) return false;
    const item = this.data.verification_checklist.find((v) => v.id === id);
    if (!item) return false;

    if (updates.status !== undefined) item.status = updates.status;
    if (updates.note !== undefined) item.note = updates.note;

    this.logAudit('UPDATE_VERIFICATION_ITEM', user, `Updated verification status for ${item.item}`);
    return this.saveData();
  }

  searchKnowledge(userQuery) {
    if (!this.data || !userQuery) return { matches: [], categoriesMatched: [] };
    const stopWords = new Set(['what', 'which', 'where', 'when', 'how', 'who', 'why', 'color', 'is', 'are', 'the', 'this', 'that', 'with', 'from', 'have', 'has', 'your', 'about', 'some', 'any', 'does', 'distance', 'tell', 'show', 'give', 'many', 'much', 'there']);
    
    // Normalize typos and common spelling variations
    let qNorm = userQuery.toLowerCase().trim();
    qNorm = qNorm.replace(/\bameneties\b/g, 'amenities');
    qNorm = qNorm.replace(/\bamenity\b/g, 'amenities');
    qNorm = qNorm.replace(/\bfacilties\b/g, 'facilities');
    qNorm = qNorm.replace(/\bfacilites\b/g, 'facilities');
    qNorm = qNorm.replace(/\bfeature\b/g, 'features');
    qNorm = qNorm.replace(/\bdevelpmnt\b/g, 'development');
    qNorm = qNorm.replace(/\bdevlopment\b/g, 'development');
    qNorm = qNorm.replace(/\binfrastrucutre\b/g, 'infrastructure');

    const rawTokens = qNorm.split(/\W+/).filter((t) => t.length >= 3 && !stopWords.has(t));
    const tokens = [];
    rawTokens.forEach((t) => {
      tokens.push(t);
      if (t === 'features') tokens.push('feature');
      if (t === 'amenities') tokens.push('amenity');
      if (t === 'facilities') tokens.push('facility');
      if (t === 'development' || t === 'developed') tokens.push('develop');
    });

    const matches = [];
    const categoriesMatched = new Set();

    if (tokens.length === 0) return { matches: [], categoriesMatched: [] };

    // Helper to score text snippet against query tokens and key phrases
    const scoreSnippet = (text, category, metadata = {}) => {
      if (!text) return 0;
      const textLower = String(text).toLowerCase();
      let score = 0;

      tokens.forEach((token) => {
        const regex = new RegExp('\\b' + token + '\\b', 'i');
        if (regex.test(textLower)) score += 2;
        else if (textLower.includes(token)) score += 1;
      });

      // Boost specific keyword clusters ONLY if tokens matched the snippet
      if (score > 0) {
        const qLower = qNorm;
        if ((qLower.includes('develop') || qLower.includes('infrastructure') || qLower.includes('growth') || qLower.includes('invest') || qLower.includes('feature') || qLower.includes('amenities') || qLower.includes('facilities')) &&
            (category === 'development_ecosystem' || category === 'nimz_landmark' || category === 'land_development' || category === 'resort_and_clubhouse')) {
          score += 3;
        }
        if ((qLower.includes('city') || qLower.includes('town') || qLower.includes('nearby') || qLower.includes('distance') || qLower.includes('far')) &&
            (category === 'nearby_locations' || category === 'project_location')) {
          score += 3;
        }
        if ((qLower.includes('register') || qLower.includes('patta') || qLower.includes('rythu')) && category === 'registration_info') {
          score += 3;
        }
      }

      if (score > 0) {
        matches.push({ category, text, score, metadata });
        categoriesMatched.add(category);
      }
      return score;
    };

    // 1. Development Ecosystem
    if (Array.isArray(this.data.development_ecosystem)) {
      this.data.development_ecosystem.forEach((item) => {
        scoreSnippet(`${item.name} ${item.category} ${item.description}`, 'development_ecosystem', item);
      });
    }

    // 2. NIMZ Landmark
    if (this.data.nimz_landmark) {
      const nimz = this.data.nimz_landmark;
      scoreSnippet(`${nimz.name} ${nimz.region} ${nimz.importance} ${nimz.customer_explanation}`, 'nimz_landmark', nimz);
    }

    // 3. Land Development Features
    if (this.data.land_development) {
      scoreSnippet(`${this.data.land_development.claim} 30ft 40ft BT roads electricity lines avenue plantation gated entry`, 'land_development', this.data.land_development);
    }

    // 4. Nearby Locations
    if (Array.isArray(this.data.nearby_locations)) {
      this.data.nearby_locations.forEach((loc) => {
        scoreSnippet(`${loc.name} ${loc.type} ${loc.distance_km} km ${loc.notes || ''}`, 'nearby_locations', loc);
      });
    }

    // 5. Plot Categories & Plot Pricing
    if (this.data.plot_pricing && Array.isArray(this.data.plot_pricing.options)) {
      this.data.plot_pricing.options.forEach((opt) => {
        scoreSnippet(`${opt.guntas} Gunta ${opt.sq_yards} sq yards price ${opt.formatted_price} total ${opt.total_price} registration ${opt.formatted_registration}`, 'plot_pricing', opt);
      });
    }
    if (Array.isArray(this.data.plot_categories)) {
      this.data.plot_categories.forEach((cat) => {
        scoreSnippet(`${cat.name} ${cat.plot_category} ${cat.category_description}`, 'plot_categories', cat);
      });
    }

    // 6. Resort & Clubhouse
    if (this.data.resort_and_clubhouse) {
      const r = this.data.resort_and_clubhouse;
      scoreSnippet(`Resort ${r.resort_area_acres} acre resort ${r.water_feature_area_acres} acre water feature total ${r.total_resort_zone_acres} acres ${r.description}`, 'resort_and_clubhouse', r);
    }

    // 7. Registration Info
    if (this.data.registration_info) {
      const reg = this.data.registration_info;
      scoreSnippet(`${reg.spot_registration_wording} ${reg.patta_passbook_wording} ${reg.rythu_bandhu_wording} ${reg.rythu_bima_wording}`, 'registration_info', reg);
    }

    // 8. Connectivity (Highways, Railways, Airports)
    if (Array.isArray(this.data.highway_connectivity)) {
      this.data.highway_connectivity.forEach((hw) => scoreSnippet(`${hw.name} ${hw.full_name} ${hw.relationship}`, 'highway_connectivity', hw));
    }
    if (Array.isArray(this.data.railway_connectivity)) {
      this.data.railway_connectivity.forEach((rw) => scoreSnippet(`${rw.name} ${rw.distance_km} km`, 'railway_connectivity', rw));
    }
    if (Array.isArray(this.data.airport_connectivity)) {
      this.data.airport_connectivity.forEach((ap) => scoreSnippet(`${ap.name} ${ap.distance_km} km`, 'airport_connectivity', ap));
    }

    matches.sort((a, b) => b.score - a.score);
    return { matches, categoriesMatched: Array.from(categoriesMatched) };
  }

  getDefaults() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
}

module.exports = new LocationKnowledgeStore();
