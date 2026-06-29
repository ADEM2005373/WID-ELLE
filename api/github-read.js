// /api/github-read.js
// Reads JSON data files from GitHub repository

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo  = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token) return res.status(500).json({ error: 'Missing GITHUB_TOKEN environment variable' });
  if (!owner) return res.status(500).json({ error: 'Missing GITHUB_OWNER environment variable' });
  if (!repo)  return res.status(500).json({ error: 'Missing GITHUB_REPO environment variable' });

  const { file } = req.query;
  if (!file) return res.status(400).json({ error: 'Missing ?file= query parameter. Example: ?file=products' });

  const allowedFiles = ['products', 'collections', 'orders', 'settings'];
  if (!allowedFiles.includes(file)) {
    return res.status(400).json({ error: `Invalid file "${file}". Allowed: ${allowedFiles.join(', ')}` });
  }

  const filePath = `data/${file}.json`;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'WID-ELLE-Store',
      },
    });

    if (response.status === 401) {
      return res.status(500).json({ error: 'Invalid GitHub token. Check your GITHUB_TOKEN value.' });
    }
    if (response.status === 403) {
      return res.status(500).json({ error: 'GitHub token lacks required permissions. Enable repo scope.' });
    }
    if (response.status === 404) {
      const repoCheck = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'WID-ELLE-Store' },
      });
      if (repoCheck.status === 404) {
        return res.status(500).json({ error: `Repository not found: ${owner}/${repo}` });
      }
      return res.status(500).json({ error: `File not found: ${filePath}. Push the data/ folder to GitHub.` });
    }
    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: `GitHub API error ${response.status}: ${errText}` });
    }

    const data = await response.json();
    let content;
    try {
      const decoded = Buffer.from(data.content, 'base64').toString('utf8');
      content = JSON.parse(decoded);
    } catch (parseErr) {
      return res.status(500).json({ error: `Failed to parse ${filePath}: ${parseErr.message}` });
    }

    return res.status(200).json({ data: content, sha: data.sha });
  } catch (err) {
    return res.status(500).json({ error: `Network error reading from GitHub: ${err.message}` });
  }
};
