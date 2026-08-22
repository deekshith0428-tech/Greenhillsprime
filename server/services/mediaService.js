const dbService = require('./dbService');

class MediaService {
  constructor() {
    this.storageProvider = process.env.MEDIA_STORAGE_PROVIDER || 'PERSISTENT_CDN';
    this.mediaCatalog = {
      brochure_pdf: {
        type: 'document',
        name: 'Green Hills Prime Official Brochure.pdf',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/Green_Hills_Prime_Brochure.pdf',
        caption: '🌿 Royal Kingdom – Green Hills Prime Official Brochure & Layout Details'
      },
      project_video: {
        type: 'video',
        name: 'Green Hills Prime Walkthrough.mp4',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/Green_Hills_Prime_Video.mp4',
        caption: '🎥 Green Hills Prime Site Walkthrough & Road Network Overview'
      },
      site_plan_image: {
        type: 'image',
        name: 'Site Layout Plan.jpg',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/green_hills_prime_master_layout_plan.jpg',
        caption: '📐 Master Layout Plan & Plot Sizes (1 Gunta, 2 Guntas, 5 Guntas)'
      },
      location_map: {
        type: 'location',
        name: 'Green Hills Prime Site Coordinates',
        latitude: 18.022750,
        longitude: 77.654268,
        url: 'https://maps.app.goo.gl/tjvaVs8RNn8WFLtV8',
        address: 'Morgi Village, Nagalgidda Mandal / Zaheerabad NIMZ Corridor, Sangareddy District, Telangana 502286'
      },
      project_entrance: {
        type: 'image',
        name: 'green_hills_prime_entrance_arch.jpg',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/green_hills_prime_entrance_arch.jpg',
        caption: '🏛️ *Green Hills Prime Grand Entrance Gate Arch*'
      },
      master_plan_layout: {
        type: 'image',
        name: 'green_hills_prime_master_layout_plan.jpg',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/green_hills_prime_master_layout_plan.jpg',
        caption: '📐 *Green Hills Prime Master Layout Plan & Road Network*'
      },
      clubhouse_resort: {
        type: 'image',
        name: 'resort_and_water_feature_zone.jpg',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/resort_and_water_feature_zone.jpg',
        caption: '🏊 *2-Acre Resort & 3-Acre Water Feature Zone*'
      },
      swimming_pool: {
        type: 'image',
        name: 'resort_swimming_pool.jpg',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/resort_swimming_pool.jpg',
        caption: '🏊‍♂️ *Resort Swimming Pool & Recreation Area*'
      },
      sports_recreation: {
        type: 'image',
        name: 'indoor_recreation_arena.jpg',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/indoor_recreation_arena.jpg',
        caption: '🎯 *Indoor Games & Recreation Arena*'
      },
      plantation_landscaping: {
        type: 'image',
        name: 'fruit_plantation_and_landscaping.jpg',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/fruit_plantation_and_landscaping.jpg',
        caption: '🌴 *Fruit Plantations & Avenue Landscaping*'
      },
      roads_infrastructure: {
        type: 'image',
        name: 'internal_bt_roads_and_gated_security.jpg',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/internal_bt_roads_and_gated_security.jpg',
        caption: '🛣️ *Wide Internal BT Roads & Gated Infrastructure*'
      },
      location_connectivity: {
        type: 'image',
        name: 'route_map_connectivity.jpg',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/route_map_connectivity.jpg',
        caption: '📍 *Location Connectivity & Highway Growth Corridor Map*'
      },
      promotional_posters: {
        type: 'image',
        name: 'green_hills_prime_spot_gold_offer_poster.jpg',
        url: 'https://raw.githubusercontent.com/GreenHillsPrime/assets/main/green_hills_prime_spot_gold_offer_poster.jpg',
        caption: '🌟 *Green Hills Prime Spot Payment Gold Offer Poster*'
      }
    };
  }

  getMediaAsset(key) {
    return this.mediaCatalog[key] || null;
  }

  async recordMediaSent(customerId, conversationId, mediaType, fileReference, whatsappMessageId = null) {
    const mediaId = 'med_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const now = new Date().toISOString();

    const sql = dbService.usePostgres
      ? 'INSERT INTO media (id, customer_id, media_type, media_url, sent_at) VALUES ($1, $2, $3, $4, $5)'
      : 'INSERT INTO media (id, customer_id, media_type, media_url, sent_at) VALUES (?, ?, ?, ?, ?)';

    try {
      await dbService.query(sql, [mediaId, customerId, mediaType, fileReference || '', now]);
    } catch (err) {
      console.warn('[MediaService] Failed to log media to DB table:', err.message);
    }
    return mediaId;
  }

  async hasMediaBeenSent(customerId, mediaType) {
    const sql = dbService.usePostgres
      ? 'SELECT * FROM media WHERE customer_id = $1 AND media_type = $2'
      : 'SELECT * FROM media WHERE customer_id = ? AND media_type = ?';

    try {
      const rows = await dbService.query(sql, [customerId, mediaType]);
      return rows && rows.length > 0;
    } catch (err) {
      return false;
    }
  }
}

module.exports = new MediaService();
