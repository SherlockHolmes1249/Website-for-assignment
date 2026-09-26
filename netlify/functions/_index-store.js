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

// Concurrency-safe update wrapper using ETags.
// Prevents two simultaneous requests from overwriting each other.
async function updateIndex(storeName, updateFn) {
  const store = getBlobStore(storeName);
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let idx;
    let etag = null;

    try {
      const meta = await store.getWithMetadata(INDEX_KEY, { type: 'json' });
      const data = meta && meta.data;
      etag = (meta && meta.etag) || null;

      idx = data && typeof data === 'object'
        ? { items: data.items || {}, allTimeCount: data.allTimeCount || 0 }
        : { items: {}, allTimeCount: 0 };
    } catch (e) {
      const isNotFound =
        e.name === 'BlobNotFoundError' ||
        e.status === 404 ||
        (e.message && e.message.toLowerCase().includes('not found'));

      if (!isNotFound) throw e;

      idx = { items: {}, allTimeCount: 0 };
      etag = null;
    }

    const updatedIdx = updateFn({
      items: { ...idx.items },
      allTimeCount: idx.allTimeCount,
    });

    try {
      if (etag) {
        await store.setJSON(INDEX_KEY, updatedIdx, { etag });
      } else {
        await store.setJSON(INDEX_KEY, updatedIdx);
      }

      return updatedIdx;
    } catch (e) {
      const errorMessage = (e.message || '').toLowerCase();
      const isEtagError =
        errorMessage.includes('etag') ||
        errorMessage.includes('conflict') ||
        errorMessage.includes('mismatch') ||
        errorMessage.includes('precondition');

      if (isEtagError && attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 100 * (attempt + 1))
        );
        continue;
      }

      throw e;
    }
  }

  throw new Error('Failed to update index: too many conflicts');
}

// Add/update a record in the index. If `countsTowardAllTime` is true, bumps
// the permanent all-time counter (used for new submissions only).
async function upsertRecord(storeName, id, record, { countsTowardAllTime = false } = {}) {
  return await updateIndex(storeName, (idx) => {
    idx.items[id] = record;
    if (countsTowardAllTime) idx.allTimeCount = (idx.allTimeCount || 0) + 1;
    return idx;
  });
}

// Remove a record from the index (does NOT touch allTimeCount).
async function removeRecord(storeName, id) {
  return await updateIndex(storeName, (idx) => {
    delete idx.items[id];
    return idx;
  });
}

// Remove many records at once (does NOT touch allTimeCount). If `filterFn`
// is provided, only removes records for which filterFn(record) is true and
// returns the ids that were removed; otherwise clears everything.
async function removeAll(storeName, filterFn) {
  let removedIds = [];

  const idx = await updateIndex(storeName, (idx) => {
    removedIds = [];

    if (typeof filterFn === 'function') {
      for (const [id, rec] of Object.entries(idx.items)) {
        if (filterFn(rec)) {
          removedIds.push(id);
          delete idx.items[id];
        }
      }
    } else {
      removedIds = Object.keys(idx.items);
      idx.items = {};
    }

    return idx;
  });

  return { idx, removedIds };
}

module.exports = {
  getBlobStore,
  readIndex,
  writeIndex,
  updateIndex,
  upsertRecord,
  removeRecord,
  removeAll,
};
 
