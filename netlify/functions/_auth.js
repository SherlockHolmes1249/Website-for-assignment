// netlify/functions/_auth.js
function verifyToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length < 3) return false;
    const secret = process.env.TOKEN_SECRET || 'edusubmit-secret-2024';
    const expectedSecret = parts[parts.length - 1];
    // Validate secret
    if (expectedSecret !== secret) return false;
    // Validate not too old (24 hours)
    const ts = parseInt(parts[1]);
    if (Date.now() - ts > 24 * 60 * 60 * 1000) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function getToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  // Also check query param for download endpoints
  return event.queryStringParameters?.token || '';
}

module.exports = { verifyToken, getToken };
