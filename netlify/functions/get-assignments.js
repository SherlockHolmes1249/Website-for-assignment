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
    // The 7-day cutoff is a display convenience for the public student portal
    // (keeps long-overdue clutter off their list) — it should NOT apply to the
    // admin panel, which needs to see/manage every assignment regardless of
    // age. Admin passes ?admin=1 to bypass it.
    const isAdmin = event.queryStringParameters?.admin === '1';
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const assignments = Object.values(idx.items).filter(
      (a) => a && (isAdmin || new Date(a.dueDate).getTime() > cutoff)
    );
    assignments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ assignments }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message, assignments: [] }) };
  }
};
