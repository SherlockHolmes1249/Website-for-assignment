// netlify/functions/download-all.js
// Returns JSON list of submission IDs and metadata
// The actual ZIP is built client-side using JSZip to avoid Netlify's 6MB response limit
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

  const filterAssignmentId = event.queryStringParameters?.assignmentId || null;

  try {
    const idx = await readIndex('submissions');
    let submissions = Object.values(idx.items);
    if (filterAssignmentId) submissions = submissions.filter((s) => s.assignmentId === filterAssignmentId);

    submissions = submissions.map((meta) => ({
      id: meta.id,
      studentId: meta.studentId,
      studentName: meta.studentName,
      subject: meta.subject,
      fileName: meta.fileName,
      submittedAt: meta.submittedAt,
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ submissions })
    };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) };
  }
};
