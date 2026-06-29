// /api/github-debug.js
// Diagnostic endpoint for verifying GitHub configuration

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token  = process.env.GITHUB_TOKEN;
  const owner  = process.env.GITHUB_OWNER;
  const repo   = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      GITHUB_TOKEN:  token  ? `set (${token.length} chars, starts with ${token.substring(0, 4)}...)` : 'MISSING',
      GITHUB_OWNER:  owner  || 'MISSING',
      GITHUB_REPO:   repo   || 'MISSING',
      GITHUB_BRANCH: branch,
    },
    checks: {},
  };

  // Check 1: Token validity
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'WID-ELLE-Store' },
    });
    if (userRes.status === 200) {
      const user = await userRes.json();
      report.checks.token = { status: 'ok', authenticatedAs: user.login };
    } else if (userRes.status === 401) {
      report.checks.token = { status: 'error', error: 'Invalid token — authentication failed' };
    } else {
      report.checks.token = { status: 'error', error: `Unexpected status ${userRes.status}` };
    }
  } catch (e) {
    report.checks.token = { status: 'error', error: e.message };
  }

  // Check 2: Repository access
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'WID-ELLE-Store' },
    });
    if (repoRes.status === 200) {
      const repoData = await repoRes.json();
      report.checks.repository = {
        status: 'ok',
        fullName: repoData.full_name,
        private: repoData.private,
        defaultBranch: repoData.default_branch,
      };
    } else if (repoRes.status === 404) {
      report.checks.repository = { status: 'error', error: `Repository ${owner}/${repo} not found` };
    } else {
      report.checks.repository = { status: 'error', error: `Status ${repoRes.status}` };
    }
  } catch (e) {
    report.checks.repository = { status: 'error', error: e.message };
  }

  // Check 3-6: Data files
  const files = ['products', 'collections', 'orders', 'settings'];
  report.checks.files = {};

  for (const file of files) {
    try {
      const fileRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/data/${file}.json?ref=${branch}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'WID-ELLE-Store',
          },
        }
      );
      if (fileRes.status === 200) {
        const fileData = await fileRes.json();
        const decoded = Buffer.from(fileData.content, 'base64').toString('utf8');
        const parsed  = JSON.parse(decoded);
        report.checks.files[file] = {
          status: 'ok',
          sha:    fileData.sha,
          size:   fileData.size,
          count:  Array.isArray(parsed) ? parsed.length : 'object',
        };
      } else if (fileRes.status === 404) {
        report.checks.files[file] = { status: 'missing', error: `data/${file}.json not found in repo` };
      } else {
        report.checks.files[file] = { status: 'error', error: `Status ${fileRes.status}` };
      }
    } catch (e) {
      report.checks.files[file] = { status: 'error', error: e.message };
    }
  }

  const allOk =
    report.checks.token      && report.checks.token.status === 'ok' &&
    report.checks.repository && report.checks.repository.status === 'ok' &&
    Object.values(report.checks.files).every(f => f.status === 'ok');

  report.overall = allOk ? 'healthy' : 'issues_found';

  return res.status(200).json(report);
};
