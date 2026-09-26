const { getBlobStore, removeAll } = require('./_index-store');
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
    const { assignmentId } = JSON.parse(event.body || '{}');

    const filterFn = assignmentId ? (rec) => rec.assignmentId === assignmentId : null;
    const { removedIds } = await removeAll('submissions', filterFn);

    if (removedIds.length) {
      const filesStore = getBlobStore('submission-files');
      await Promise.all(removedIds.map((id) => filesStore.delete(id).catch(() => {})));
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, deletedCount: removedIds.length }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
  }
};
