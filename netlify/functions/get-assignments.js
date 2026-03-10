const { getStore } = require('@netlify/blobs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function getBlobStore(name) {
  return getStore({
    name,
    consistency: 'strong',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN,
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const store = getBlobStore('assignments');
    const { blobs } = await store.list();

    const assignments = [];
    for (const blob of blobs) {
      try {
        const data = await store.get(blob.key, { type: 'json' });
        if (data && new Date(data.dueDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
          assignments.push(data);
        }
      } catch (e) {}
    }
    assignments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ assignments }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message, assignments: [] }) };
  }
};
