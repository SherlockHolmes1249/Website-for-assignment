const { getStore } = require('@netlify/blobs');
const Busboy = require('busboy');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function getBlobStore(name) {
  return getStore({
    name,
    consistency: 'strong',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN,
  });
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] },
      limits: { fileSize: 20 * 1024 * 1024 }
    });

    const fields = {};
    let fileBuffer = null;
    let fileName = '';
    let fileMime = '';
    let fileTooLarge = false;

    busboy.on('field', (name, val) => { fields[name] = val; });

    busboy.on('file', (name, stream, info) => {
      fileName = info.filename;
      fileMime = info.mimeType;
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => { fileTooLarge = true; stream.resume(); });
      stream.on('end', () => { if (!fileTooLarge) fileBuffer = Buffer.concat(chunks); });
    });

    busboy.on('finish', () => {
      if (fileTooLarge) return reject(new Error('File too large (max 20MB)'));
      resolve({ fields, fileBuffer, fileName, fileMime });
    });

    busboy.on('error', reject);

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body || '');

    busboy.write(body);
    busboy.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { fields, fileBuffer, fileName, fileMime } = await parseMultipart(event);

    if (!fields.assignmentId || !fields.studentName || !fields.studentId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing required fields' }) };
    }
    if (!fileBuffer || !fileName) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'No file uploaded' }) };
    }

    const ext = fileName.split('.').pop().toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext)) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Only PDF, DOC, DOCX allowed' }) };
    }

    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const safeFileName = `${submissionId}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const filesStore = getBlobStore('submission-files');
    await filesStore.set(submissionId, fileBuffer, {
      metadata: { fileName, safeFileName, mimeType: fileMime, studentName: fields.studentName, subject: fields.subject || '' }
    });

    const metaStore = getBlobStore('submissions');
    const submission = {
      id: submissionId,
      assignmentId: fields.assignmentId,
      subject: fields.subject || '',
      studentName: fields.studentName.trim(),
      studentId: fields.studentId.trim(),
      note: fields.note || '',
      fileName,
      safeFileName,
      fileSize: fileBuffer.length,
      submittedAt: new Date().toISOString()
    };
    await metaStore.setJSON(submissionId, submission);

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, submissionId }) };
  } catch (e) {
    console.error('Submit error:', e);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message || 'Submission failed' }) };
  }
};
