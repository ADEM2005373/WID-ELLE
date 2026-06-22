const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH ='main';
const TOKEN = process.env.GITHUB_TOKEN;

function apiHeaders(){
  const h = { 'Accept': 'application/vnd.github.v3+json' };
  if(TOKEN) h['Authorization'] = `token ${TOKEN}`;
  return h;
}

module.exports = async (req, res) => {
  // simple health check
  if(!OWNER || !REPO || !TOKEN){
    return res.status(500).json({ error: 'Server not configured: set GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN' });
  }

  const path = req.query.path;
  if(!path){
    return res.status(400).json({ error: 'Missing path query parameter' });
  }

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
  try{
    const r = await fetch(url, { headers: apiHeaders() });
    if(r.status===404) return res.status(404).json({ error: 'File not found', path });
    if(r.status===401 || r.status===403) return res.status(403).json({ error: 'GitHub authentication failed' });
    if(!r.ok) {
      const text = await r.text();
      return res.status(500).json({ error: 'GitHub API error', status: r.status, body: text });
    }
    const data = await r.json();
    if(!data.content) return res.status(500).json({ error: 'No content in GitHub response' });
    const decoded = Buffer.from(data.content, 'base64').toString('utf8');
    let parsed;
    try{ parsed = JSON.parse(decoded); }catch(e){ return res.status(500).json({ error: 'Failed to parse JSON', message: e.message }); }
    return res.json({ path, sha: data.sha, content: parsed, raw: decoded });
  }catch(err){
    console.error('github-read error', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};
