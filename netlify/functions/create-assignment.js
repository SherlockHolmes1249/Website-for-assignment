// netlify/functions/create-assignment.js
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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = getToken(event);
  if (!verifyToken(token)) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { subject, description, dueDate } = JSON.parse(event.body || '{}');

    if (!subject || !dueDate) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Subject and dueDate are required' }) };
    }

    const id = `assignment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const assignment = {
      id,
      subject: subject.trim(),
      description: (description || '').trim(),
      dueDate,
      createdAt: new Date().toISOString()
    };

    const store = getStore({ name: 'assignments', consistency: 'strong' });
    await store.setJSON(id, assignment);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, assignment })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message })
    };
  }
};
