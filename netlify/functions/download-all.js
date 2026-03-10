// netlify/functions/download-all.js
// Returns JSON list of submission IDs and metadata
// The actual ZIP is built client-side using JSZip to avoid Netlify's 6MB response limit
const { getStore } = require('@netlify/blobs');
const { verifyToken, getToken } = require('./_auth');

function getBlobStore(name) {
  return getStore({
    name,
    consistency: 'strong',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN,
  });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  const token = getToken(event);
  if (!verifyToken(token)) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

  const filterAssignmentId = event.queryStringParameters?.assignmentId || null;

  try {
    const metaStore = getBlobStore('submissions');
    const { blobs } = await metaStore.list();

    const submissions = [];
    for (const blob of blobs) {
      try {
        const meta = await metaStore.get(blob.key, { type: 'json' });
        if (meta) {
          if (filterAssignmentId && meta.assignmentId !== filterAssignmentId) continue;
          submissions.push({
            id: meta.id,
            studentId: meta.studentId,
            studentName: meta.studentName,
            subject: meta.subject,
            fileName: meta.fileName,
            submittedAt: meta.submittedAt,
          });
        }
      } catch (e) {}
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ submissions })
    };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
  }
};
