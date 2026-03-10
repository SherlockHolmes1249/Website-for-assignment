// netlify/functions/get-assignments.js
const { getStore } = require('@netlify/blobs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const store = getStore({ name: 'assignments', consistency: 'strong' });
    const { blobs } = await store.list();

    const assignments = [];
    for (const blob of blobs) {
      try {
        const data = await store.get(blob.key, { type: 'json' });
        if (data) {
          // Only return non-expired assignments
          if (new Date(data.dueDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
            assignments.push(data);
          }
        }
      } catch (e) {
        // skip corrupt entries
      }
    }

    // Sort by due date
    assignments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ assignments })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message, assignments: [] })
    };
  }
};
