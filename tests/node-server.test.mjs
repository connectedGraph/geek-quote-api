import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { startServer } from '../server.js';

test('Node server exposes the shared API contract', async (t) => {
  const server = startServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  t.after(() => server.close());

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.equal(await health.text(), 'OK');

  const statsResponse = await fetch(`${baseUrl}/api/stats`);
  assert.equal(statsResponse.status, 200);
  const stats = await statsResponse.json();
  assert.equal(stats.code, 200);
  assert.equal(stats.data.total_quotes, 560);
  assert.equal(stats.data.server, 'Node.js (stdlib)');

  const quotesResponse = await fetch(`${baseUrl}/api/quotes?category=ai_ml&limit=3`);
  const quotes = await quotesResponse.json();
  assert.equal(quotes.code, 200);
  assert.equal(quotes.data.items.length, 3);
  assert.equal(quotes.data.limit, 3);

  const randomResponse = await fetch(`${baseUrl}/api/random?lang=zh&format=text`);
  assert.equal(randomResponse.status, 200);
  assert.match(await randomResponse.text(), /\S/);
});
