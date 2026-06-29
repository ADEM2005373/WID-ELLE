// /api/github-write.js
// Writes JSON data files to GitHub repository

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const token  = process.env.GITHUB_TOKEN;
  const owner  = process.env.GITHUB_OWNER;
  const repo   = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token) return res.status(500).json({ error: 'Missing GITHUB_TOKEN environment variable' });
  if (!owner) return res.status(500).json({ error: 'Missing GITHUB_OWNER environment variable' });
  if (!repo)  return res.status(500).json({ error: 'Missing GITHUB_REPO environment variable' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { file, data } = body;
  if (!file) return res.status(400).json({ error: 'Missing "file" in request body.' });
  if (data === undefined) return res.status(400).json({ error: 'Missing "data" in request body.' });

  const allowedFiles = ['products', 'collections', 'orders', 'settings'];
  if (!allowedFiles.includes(file)) {
    return res.status(400).json({ error: `Invalid file "${file}". Allowed: ${allowedFiles.join(', ')}` });
  }

  const filePath = `data/${file}.json`;
  const apiUrl   = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  // Step 1: Get current SHA
  let sha;
  try {
    const shaRes = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'WID-ELLE-Store',
      },
    });
    if (shaRes.status === 401) {
      return res.status(500).json({ error: 'Invalid GitHub token. Cannot write to repository.' });
    }
    if (shaRes.status === 404) {
      sha = undefined; // File will be created
    } else if (!shaRes.ok) {
      const errText = await shaRes.text();
      return res.status(500).json({ error: `Failed to get SHA for ${filePath}: ${errText}` });
    } else {
      const shaData = await shaRes.json();
      sha = shaData.sha;
    }
  } catch (err) {
    return res.status(500).json({ error: `Network error getting SHA: ${err.message}` });
  }

  // Step 2: Encode content as base64
  let contentEncoded;
  try {
    const contentStr = JSON.stringify(data, null, 2);
    contentEncoded = Buffer.from(contentStr).toString('base64');
  } catch (encErr) {
    return res.status(500).json({ error: `Failed to encode data: ${encErr.message}` });
  }

  // Step 3: Commit to GitHub
  const commitBody = {
    message: `[WID-ELLE] Update ${file}.json`,
    content: contentEncoded,
    branch,
  };
  if (sha) commitBody.sha = sha;

  try {
    const writeRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'WID-ELLE-Store',
      },
      body: JSON.stringify(commitBody),
    });

    if (writeRes.status === 401) {
      return res.status(500).json({ error: 'GitHub token rejected. Check GITHUB_TOKEN.' });
    }
    if (writeRes.status === 403) {
      return res.status(500).json({ error: 'Permission denied. Token needs repo write access.' });
    }
    if (writeRes.status === 422) {
      return res.status(500).json({ error: 'Conflict writing file. SHA mismatch — try again.' });
    }
    if (!writeRes.ok) {
      const errData = await writeRes.json().catch(() => ({}));
      return res.status(500).json({ error: `GitHub write failed (${writeRes.status}): ${errData.message || 'Unknown error'}` });
    }

    const result = await writeRes.json();
    return res.status(200).json({
      success: true,
      file: filePath,
      sha: result.content && result.content.sha,
      commit: result.commit && result.commit.sha,
    });
  } catch (err) {
    return res.status(500).json({ error: `Network error writing to GitHub: ${err.message}` });
  }
};
