// netlify/functions/_index-store.js
// Maintains a single JSON index blob per collection so list endpoints don't
// have to read every blob individually (N+1 problem). Each index blob has
// the shape: { items: { [id]: <record> }, allTimeCount: <number> }
// allTimeCount only ever increments — it is NOT decremented on delete, so it
// tracks total submissions ever made even after records/assignments are removed.
const { getStore } = require('@netlify/blobs');

function getBlobStore(name) {
  return getStore({
    name,
    consistency: 'strong',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN,
  });
}

const INDEX_KEY = '_index';

async function readIndex(storeName) {
  const store = getBlobStore(storeName);
  const idx = await store.get(INDEX_KEY, { type: 'json' });
  return idx && typeof idx === 'object'
    ? { items: idx.items || {}, allTimeCount: idx.allTimeCount || 0 }
    : { items: {}, allTimeCount: 0 };
}

async function writeIndex(storeName, idx) {
  const store = getBlobStore(storeName);
  await store.setJSON(INDEX_KEY, idx);
}

// Add/update a record in the index. If `countsTowardAllTime` is true, bumps
// the permanent all-time counter (used for new submissions only).
async function upsertRecord(storeName, id, record, { countsTowardAllTime = false } = {}) {
  const idx = await readIndex(storeName);
  idx.items[id] = record;
  if (countsTowardAllTime) idx.allTimeCount = (idx.allTimeCount || 0) + 1;
  await writeIndex(storeName, idx);
  return idx;
}

// Remove a record from the index (does NOT touch allTimeCount).
async function removeRecord(storeName, id) {
  const idx = await readIndex(storeName);
  delete idx.items[id];
  await writeIndex(storeName, idx);
  return idx;
}

// Remove many records at once (does NOT touch allTimeCount). If `filterFn`
// is provided, only removes records for which filterFn(record) is true and
// returns the ids that were removed; otherwise clears everything.
async function removeAll(storeName, filterFn) {
  const idx = await readIndex(storeName);
  let removedIds = [];
  if (typeof filterFn === 'function') {
    for (const [id, rec] of Object.entries(idx.items)) {
      if (filterFn(rec)) { removedIds.push(id); delete idx.items[id]; }
    }
  } else {
    removedIds = Object.keys(idx.items);
    idx.items = {};
  }
  await writeIndex(storeName, idx);
  return { idx, removedIds };
}

module.exports = { getBlobStore, readIndex, writeIndex, upsertRecord, removeRecord, removeAll, INDEX_KEY };
