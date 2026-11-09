import { Pool } from 'pg';

const connectionString = process.env.RETAIL_DATABASE_URL;
if (!connectionString) throw new Error('Set RETAIL_DATABASE_URL to the PostgreSQL database containing the dashboard migrations.');

const pool = new Pool({ connectionString, max: 2 });
const now = new Date(process.env.DEMO_SEED_AS_OF || '2026-11-09T12:00:00Z');
if (!Number.isFinite(now.getTime())) throw new Error('DEMO_SEED_AS_OF must be a valid ISO date/time.');
const atDaysAgo = days => new Date(now.getTime() - days * 86_400_000).toISOString();
const demoOnly = { is_demo: true, source: 'mock_demo' };

async function save(table, ownerColumn, ownerId, demoKey, fields) {
  const entries = Object.entries({ ...fields, ...demoOnly });
  const columns = [ownerColumn, 'demo_key', ...entries.map(([key]) => key)];
  const values = [ownerId, demoKey, ...entries.map(([, value]) => value)];
  const placeholders = values.map((_, index) => `$${index + 1}`);
  await pool.query(
    `INSERT INTO public.${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT DO NOTHING`, values
  );
  const setters = entries.map(([key], index) => `${key} = $${index + 3}`).join(', ');
  const updated = await pool.query(
    `UPDATE public.${table} SET ${setters} WHERE ${ownerColumn} = $1 AND demo_key = $2`,
    [ownerId, demoKey, ...entries.map(([, value]) => value)]
  );
  if (updated.rowCount !== 1) throw new Error(`Could not upsert ${table} fixture ${demoKey}.`);
  const result = await pool.query(
    `SELECT id FROM public.${table} WHERE ${ownerColumn} = $1 AND demo_key = $2`, [ownerId, demoKey]
  );
  return result.rows[0].id;
}

async function seedProducts(ownerColumn, ownerId, role) {
  const fixtures = [
    { key: 'desk-lamp', canonical: 'demo-desk-lamp', title: 'Arc LED Desk Lamp', brand: 'Northstar Home', category: 'Lighting', variant: { finish: 'Matte black', model: 'Arc 2' } },
    { key: 'headphones', canonical: 'demo-wireless-headphones', title: 'Studio Wireless Headphones', brand: 'Soundcraft', category: 'Audio', variant: { color: 'Graphite', generation: '2nd gen' } },
    { key: 'travel-mug', canonical: 'demo-travel-mug', title: 'Insulated Travel Mug', brand: 'Trailform', category: 'Kitchen', variant: { capacity: '16 oz', color: 'Moss' } }
  ];
  const products = new Map();
  for (const product of fixtures) {
    const id = await save('dashboard_demo_products', ownerColumn, ownerId, `${role}-${product.key}`, {
      canonical_product_id: product.canonical,
      title: product.title,
      brand: product.brand,
      category: product.category,
      selected_variant: product.variant
    });
    products.set(product.key, { ...product, id });
  }
  return products;
}

async function seedOffers(ownerColumn, ownerId, role, products) {
  const offers = new Map();
  for (const product of products.values()) {
    const examples = [
      { seller: 'Demo Seller Alpha', price: product.key === 'headphones' ? 89.99 : product.key === 'travel-mug' ? 24.99 : 68.99, condition: 'New', availability: 'InStock', suffix: 'alpha' },
      { seller: 'Demo Seller Beta', price: product.key === 'headphones' ? 94.50 : product.key === 'travel-mug' ? 27.50 : 72.50, condition: 'New', availability: product.key === 'travel-mug' ? 'OutOfStock' : 'InStock', suffix: 'beta' }
    ];
    for (const offer of examples) {
      const demoKey = `${role}-${product.key}-${offer.suffix}`;
      const id = await save('dashboard_demo_seller_offers', ownerColumn, ownerId, demoKey, {
        product_id: product.id,
        seller_name: offer.seller,
        price: offer.price,
        compare_at_price: Number((offer.price * 1.12).toFixed(2)),
        currency: 'USD',
        availability: offer.availability,
        condition: offer.condition,
        offer_url: `https://example.com/bopit-demo/${demoKey}`
      });
      offers.set(demoKey, { ...offer, id, product });
      const historicalPrices = [offer.price + 9, offer.price + 6, offer.price + 3, offer.price];
      for (let index = 0; index < historicalPrices.length; index++) {
        await save('dashboard_demo_price_history', ownerColumn, ownerId, `${demoKey}-price-${index + 1}`, {
          offer_id: id,
          observed_at: atDaysAgo((historicalPrices.length - index - 1) * 14),
          price: historicalPrices[index],
          currency: 'USD'
        });
      }
    }
  }
  return offers;
}

async function seedCreator(userId, displayName) {
  const products = await seedProducts('creator_user_id', userId, 'creator');
  await seedOffers('creator_user_id', userId, 'creator', products);
  const videos = [];
  for (const [index, video] of [
    { key: 'home-office-refresh', title: 'A calmer home office setup', days: 18, duration: 328 },
    { key: 'weekend-travel-kit', title: 'What I pack for a weekend away', days: 7, duration: 246 }
  ].entries()) {
    const id = await save('dashboard_demo_videos', 'creator_user_id', userId, `creator-${video.key}`, {
      title: video.title,
      platform: 'Demo video',
      video_url: `https://example.com/bopit-demo/${video.key}`,
      published_at: atDaysAgo(video.days),
      duration_seconds: video.duration
    });
    videos.push({ ...video, id, index });
  }
  const objects = [];
  const mappings = [
    { video: videos[0], key: 'desk-lamp', label: 'Adjustable desk lamp', category: 'Lighting', timestamp: 42_000, confidence: 0.94 },
    { video: videos[0], key: 'headphones', label: 'Over-ear headphones', category: 'Audio', timestamp: 118_000, confidence: 0.89 },
    { video: videos[1], key: 'travel-mug', label: 'Insulated travel mug', category: 'Kitchen', timestamp: 71_000, confidence: 0.91 }
  ];
  for (const object of mappings) {
    const product = products.get(object.key);
    const id = await save('dashboard_demo_detected_objects', 'creator_user_id', userId,
      `creator-object-${object.video.key}-${object.key}`, {
        video_id: object.video.id,
        timestamp_ms: object.timestamp,
        label: object.label,
        category: object.category,
        confidence: object.confidence,
        product_id: product.id
      });
    objects.push({ ...object, id, product });
  }
  const events = [];
  const eventFixtures = [
    { object: objects[0], kind: 'product_search', days: 15 },
    { object: objects[0], kind: 'product_click', days: 14 },
    { object: objects[0], kind: 'product_click', days: 12 },
    { object: objects[1], kind: 'product_search', days: 6 },
    { object: objects[1], kind: 'product_click', days: 5 },
    { object: objects[2], kind: 'product_search', days: 3 },
    { object: objects[2], kind: 'product_click', days: 2 }
  ];
  for (const [index, event] of eventFixtures.entries()) {
    const id = await save('dashboard_demo_engagement_events', 'creator_user_id', userId, `creator-event-${index + 1}`, {
      video_id: event.object.video.id,
      detected_object_id: event.object.id,
      product_id: event.object.product.id,
      event_type: event.kind,
      occurred_at: atDaysAgo(event.days)
    });
    events.push({ ...event, id });
  }
  for (const [index, event] of [events[2], events[4]].entries()) {
    const product = eventFixtures[event === events[2] ? 2 : 4].object.product;
    await save('dashboard_demo_purchases', 'creator_user_id', userId, `creator-purchase-${index + 1}`, {
      engagement_event_id: event.id,
      product_id: product.id,
      quantity: 1,
      amount: product.key === 'desk-lamp' ? 68.99 : 89.99,
      currency: 'USD',
      attributed_at: atDaysAgo(index === 0 ? 11 : 4),
      attribution_basis: 'demo_fixture'
    });
  }
  console.log(`Seeded mock Creator dashboard data for ${displayName} (${userId}).`);
}

async function main() {
  const { rows: profiles } = await pool.query(`
    SELECT p.user_id, p.role, p.display_name, p.tenant_id
      FROM public.dashboard_profiles p
     WHERE p.role IN ('creator', 'retailer')
     ORDER BY p.user_id
  `);
  if (!profiles.length) throw new Error('No Creator or Retailer profiles found. Register dashboard accounts, then rerun this seed command.');
  for (const profile of profiles) {
    if (profile.role === 'creator') await seedCreator(profile.user_id, profile.display_name);
    else if (profile.tenant_id) {
      const products = await seedProducts('retailer_tenant_id', profile.tenant_id, 'retailer');
      await seedOffers('retailer_tenant_id', profile.tenant_id, 'retailer', products);
      console.log(`Seeded mock Retailer products, seller offers, and price history for ${profile.display_name} (${profile.tenant_id}).`);
    }
  }
  console.log('All inserted records are isolated in dashboard_demo_* tables and marked source=mock_demo, is_demo=true. No provider transactions were created.');
}

try { await main(); }
finally { await pool.end(); }
