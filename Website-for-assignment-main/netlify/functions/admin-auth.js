// netlify/functions/admin-auth.js
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const { username, password } = JSON.parse(event.body || '{}');

    const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      // Simple token: base64(user:timestamp:secret)
      const secret = process.env.TOKEN_SECRET || 'edusubmit-secret-2024';
      const payload = `${username}:${Date.now()}:${secret}`;
      const token = Buffer.from(payload).toString('base64');
      return { statusCode: 200, headers, body: JSON.stringify({ token }) };
    }

    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
