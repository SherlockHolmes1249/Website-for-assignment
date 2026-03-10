const { getStore } = require('@netlify/blobs');
const { verifyToken, getToken } = require('./_auth');
const archiver = require('archiver');

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

  try {
    const metaStore = getBlobStore('submissions');
    const filesStore = getBlobStore('submission-files');

    const { blobs } = await metaStore.list();
    if (!blobs.length) return { statusCode: 200, body: 'No submissions found', headers: { 'Content-Type': 'text/plain' } };

    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks = [];
    archive.on('data', chunk => chunks.push(chunk));

    const allMeta = [];
    for (const blob of blobs) {
      try {
        const meta = await metaStore.get(blob.key, { type: 'json' });
        if (meta) allMeta.push(meta);
      } catch (e) {}
    }

    const bySubject = {};
    for (const meta of allMeta) {
      const folder = (meta.subject || 'Unknown').replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Unknown';
      if (!bySubject[folder]) bySubject[folder] = [];
      bySubject[folder].push(meta);
    }

    for (const [subject, metas] of Object.entries(bySubject)) {
      for (const meta of metas) {
        try {
          const fileData = await filesStore.get(meta.id, { type: 'arrayBuffer' });
          if (fileData) {
            const safeName = `${meta.studentName}_${meta.studentId}_${meta.fileName}`
              .replace(/[^a-zA-Z0-9._\- ]/g, '_').replace(/\s+/g, '_');
            archive.append(Buffer.from(fileData), { name: `${subject}/${safeName}` });
          }
        } catch (e) {}
      }
    }

    await new Promise((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
      archive.finalize();
    });

    const zipBuffer = Buffer.concat(chunks);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="submissions_${timestamp}.zip"`,
        'Access-Control-Allow-Origin': '*',
      },
      body: zipBuffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, body: 'Error: ' + e.message };
  }
};
