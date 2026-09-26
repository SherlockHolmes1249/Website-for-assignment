const { removeRecord, updateIndex, getBlobStore } = require('./_index-store');
const { verifyToken, getToken } = require('./_auth');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if ((event.httpMethod || event.method) === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if ((event.httpMethod || event.method) !== 'DELETE') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const token = getToken(event);
  if (!verifyToken(token)) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    const { id } = JSON.parse(event.body || '{}');

    if (!id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'ID required' }),
      };
    }

    // 1. Delete the assignment itself
    await removeRecord('assignments', id);

    // 2. Clean up submissions belonging to this assignment
    let submissionsToDelete = [];

    await updateIndex('submissions', (idx) => {
      submissionsToDelete = Object.entries(idx.items).filter(
        ([, rec]) => rec.assignmentId === id
      );

      for (const [submissionId] of submissionsToDelete) {
        delete idx.items[submissionId];
      }

      return idx;
    });

    // 3. Delete actual uploaded files from blob storage
    if (submissionsToDelete.length > 0) {
      const filesStore = getBlobStore('submission-files');

      await Promise.all(
        submissionsToDelete.map(([submissionId]) =>
          filesStore.delete(submissionId).catch(() => {})
        )
      );
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
