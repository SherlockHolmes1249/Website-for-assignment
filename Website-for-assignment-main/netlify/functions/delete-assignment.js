const { getBlobStore, removeRecord, removeAll } = require('./_index-store');
const { verifyToken, getToken } = require('./_auth');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'DELETE') return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };

  const token = getToken(event);
  if (!verifyToken(token)) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const { id } = JSON.parse(event.body || '{}');
    if (!id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'ID required' }) };

    // Cascade: remove the assignment itself, then every submission that
    // belongs to it, then the actual files backing those submissions.
    // Without this, deleted assignments leave orphaned submission records
    // and orphaned files sitting in blob storage forever.
    await removeRecord('assignments', id);
    const { removedIds } = await removeAll('submissions', (rec) => rec.assignmentId === id);

    if (removedIds.length) {
      const filesStore = getBlobStore('submission-files');
      await Promise.all(removedIds.map((subId) => filesStore.delete(subId).catch(() => {})));
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, deletedSubmissions: removedIds.length }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
  }
};
