const { getBlobStore, removeRecord } = require('./_index-store');
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

    const filesStore = getBlobStore('submission-files');
    await Promise.all([removeRecord('submissions', id), filesStore.delete(id)]);

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
  }
};
