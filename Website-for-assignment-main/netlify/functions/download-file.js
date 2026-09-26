// netlify/functions/download-file.js
const { getBlobStore, readIndex } = require('./_index-store');
const { verifyToken, getToken } = require('./_auth');

exports.handler = async (event) => {
  const token = getToken(event);
  if (!verifyToken(token)) return { statusCode: 401, body: 'Unauthorized' };

  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: 'Missing id' };

  try {
    const idx = await readIndex('submissions');
    const meta = idx.items[id];
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
    // Missing name/regNo are skipped entirely rather than shown as "Unknown".
    const regNo = (meta.studentId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const name = (meta.studentName || '').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
    const baseName = [regNo, name].filter(Boolean).join('_') || meta.id;
    const downloadName = encodeURIComponent(`${baseName}.${ext}`);

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
