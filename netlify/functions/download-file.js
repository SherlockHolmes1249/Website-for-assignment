// netlify/functions/download-file.js
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

exports.handler = async (event) => {
  const token = getToken(event);
  if (!verifyToken(token)) return { statusCode: 401, body: 'Unauthorized' };

  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: 'Missing id' };

  try {
    const metaStore = getBlobStore('submissions');
    const meta = await metaStore.get(id, { type: 'json' });
    if (!meta) return { statusCode: 404, body: 'Submission not found' };

    const filesStore = getBlobStore('submission-files');
    const fileBlob = await filesStore.get(id, { type: 'arrayBuffer' });
    if (!fileBlob) return { statusCode: 404, body: 'File not found' };

    const ext = (meta.fileName || '').split('.').pop().toLowerCase();
    const mimeTypes = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

    // Filename: RegNo_StudentName.ext  e.g. 2024-CS-045_Ali_Hassan.pdf
    const regNo = (meta.studentId || 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const name = (meta.studentName || 'Unknown').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
    const downloadName = encodeURIComponent(`${regNo}_${name}.${ext}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Access-Control-Allow-Origin': '*',
      },
      body: Buffer.from(fileBlob).toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    console.error('Download error:', e);
    return { statusCode: 500, body: 'Error: ' + e.message };
  }
};
