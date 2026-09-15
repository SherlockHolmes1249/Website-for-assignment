const { readIndex, upsertRecord } = require('./_index-store');
const { verifyToken, getToken } = require('./_auth');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };

  const token = getToken(event);
  if (!verifyToken(token)) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const { id, isOpen } = JSON.parse(event.body || '{}');
    if (!id || typeof isOpen !== 'boolean') {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'id and isOpen (boolean) are required' }) };
    }

    const idx = await readIndex('assignments');
    const assignment = idx.items[id];
    if (!assignment) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Assignment not found' }) };

    assignment.isOpen = isOpen;
    await upsertRecord('assignments', id, assignment);

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, assignment }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
  }
};
