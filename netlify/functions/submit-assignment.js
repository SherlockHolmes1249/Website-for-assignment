const { getBlobStore, readIndex, upsertRecord } = require('./_index-store');
const Busboy = require('busboy');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

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

    if (!fields.assignmentId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing assignment' }) };
    }
    if (!fileBuffer || !fileName) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'No file uploaded' }) };
    }

    // Check the assignment is actually open for submissions.
    const assignmentsIdx = await readIndex('assignments');
    const assignment = assignmentsIdx.items[fields.assignmentId];
    if (assignment) {
      const pastDue = new Date(assignment.dueDate).getTime() < Date.now();
      const manuallyOpen = assignment.isOpen === true;
      // Closed if explicitly marked closed, OR past due and not manually reopened.
      if (assignment.isOpen === false || (pastDue && !manuallyOpen)) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Submissions are closed for this assignment.' }) };
      }
    }

    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const safeFileName = `${submissionId}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const filesStore = getBlobStore('submission-files');
    await filesStore.set(submissionId, fileBuffer, {
      metadata: { fileName, safeFileName, mimeType: fileMime, studentName: fields.studentName || '', subject: fields.subject || '' }
    });

    const submission = {
      id: submissionId,
      assignmentId: fields.assignmentId,
      subject: fields.subject || '',
      studentName: (fields.studentName || '').trim(),
      studentId: (fields.studentId || '').trim(),
      note: fields.note || '',
      fileName,
      safeFileName,
      fileSize: fileBuffer.length,
      submittedAt: new Date().toISOString()
    };
    await upsertRecord('submissions', submissionId, submission, { countsTowardAllTime: true });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, submissionId }) };
  } catch (e) {
    console.error('Submit error:', e);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message || 'Submission failed' }) };
  }
};
