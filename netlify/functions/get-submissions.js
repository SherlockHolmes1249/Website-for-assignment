// netlify/functions/get-submissions.js
const { getStore } = require('@netlify/blobs');
const { verifyToken, getToken } = require('./_auth');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const token = getToken(event);
  if (!verifyToken(token)) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const store = getStore({ name: 'submissions', consistency: 'strong' });
    const { blobs } = await store.list();

    const submissions = [];
    for (const blob of blobs) {
      try {
        const data = await store.get(blob.key, { type: 'json' });
        if (data) submissions.push(data);
      } catch (e) {
        // skip corrupt entries
      }
    }

    submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ submissions })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message, submissions: [] })
    };
  }
};
