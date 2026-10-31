// Explicit opt-in Channel3 product search CLI; not part of npm test. Never logs credentials.
import { searchChannel3 } from '../apps/recognition-server/channel3.mjs';

let query = process.argv.slice(2).join(' ') || 'Sony WH-1000XM5 headphones';
try {
  if (query.trim().startsWith('{') && query.trim().endsWith('}')) {
    query = JSON.parse(query.trim());
  }
} catch {
  // Fallback to string query
}
const apiKey = process.env.CHANNEL3_API_KEY;

if (!apiKey || !apiKey.trim()) {
  console.error('Error: CHANNEL3_API_KEY is missing from environment. Add it to .env.');
  process.exit(1);
}

console.log(`Searching Channel3 for: ${typeof query === 'object' ? JSON.stringify(query) : `"${query}"`}...`);
try {
  const result = await searchChannel3(query, { apiKey, limit: 3 });
  console.log(`\nFound ${result.total} product(s) for "${result.query}":\n`);
  for (const [i, p] of result.products.entries()) {
    console.log(`[${i + 1}] ${p.title}`);
    console.log(`    Brand:        ${p.brand || 'N/A'}`);
    console.log(`    Category:     ${p.category || 'N/A'}`);
    console.log(`    Price:        ${p.price !== null ? `$${p.price} ${p.currency}` : 'N/A'}${p.compareAtPrice ? ` (was $${p.compareAtPrice})` : ''}`);
    console.log(`    Retailer:     ${p.retailer || 'N/A'}`);
    console.log(`    Availability: ${p.availability}`);
    console.log(`    Purchase URL: ${p.purchaseUrl || 'N/A'}`);
    console.log(`    Main Image:   ${p.image || 'N/A'}`);
    console.log('');
  }
} catch (error) {
  console.error(`Search failed [${error.code || 'ERROR'}]: ${error.message}`);
  process.exit(1);
}
