const { readIndex } = require('./_index-store');
const { verifyToken, getToken } = require('./_auth');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  const token = getToken(event);
  if (!verifyToken(token)) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    const idx = await readIndex('submissions');
    const submissions = Object.values(idx.items);
    submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ submissions, allTimeCount: idx.allTimeCount || 0 }),
    };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message, submissions: [], allTimeCount: 0 }) };
  }
};
