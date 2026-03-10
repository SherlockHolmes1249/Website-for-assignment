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

    const ext = meta.fileName.split('.').pop().toLowerCase();
    const mimeTypes = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

    const safeDownloadName = encodeURIComponent(
      `${meta.studentName}_${meta.subject}_${meta.fileName}`.replace(/\s+/g, '_')
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeDownloadName}"`,
        'Access-Control-Allow-Origin': '*',
      },
      body: Buffer.from(fileBlob).toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, body: 'Error: ' + e.message };
  }
};
