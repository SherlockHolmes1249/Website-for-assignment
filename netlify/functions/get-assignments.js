const { readIndex } = require('./_index-store');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const idx = await readIndex('assignments');
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const assignments = Object.values(idx.items).filter(
      (a) => a && new Date(a.dueDate).getTime() > cutoff
    );
    assignments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ assignments }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message, assignments: [] }) };
  }
};
