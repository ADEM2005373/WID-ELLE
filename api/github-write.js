const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH ='main';
const TOKEN = process.env.GITHUB_TOKEN;

function apiHeaders(){
  const h = { 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
  if(TOKEN) h['Authorization'] = `token ${TOKEN}`;
  return h;
}

async function getMeta(path){
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
  const r = await fetch(url, { headers: apiHeaders() });
  if(r.status===404) return null;
  if(!r.ok) throw new Error('GitHub GET metadata failed: '+r.status);
  return await r.json();
}

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if(!OWNER || !REPO || !TOKEN) return res.status(500).json({ error: 'Server not configured: set GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN' });
  const body = req.body;
  if(!body || !body.path || typeof body.content === 'undefined') return res.status(400).json({ error: 'Missing path or content in request body' });
  const path = body.path;
  const message = body.message || `Update ${path}`;
  try{
    const meta = await getMeta(path);
    const sha = meta && meta.sha ? meta.sha : undefined;
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
    const payload = { message, content: Buffer.from(body.content, 'utf8').toString('base64'), branch: BRANCH };
    if(sha) payload.sha = sha;
    const r = await fetch(putUrl, { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(payload) });
    const text = await r.text();
    let data;
    try{ data = text ? JSON.parse(text) : {}; }catch(e){ return res.status(500).json({ error: 'Invalid response from GitHub', body: text }); }
    if(!r.ok) return res.status(500).json({ error: 'GitHub write failed', status: r.status, body: data });
    return res.json({ ok:true, data });
  }catch(err){ console.error('github-write error', err); return res.status(500).json({ error: 'Server error', message: err.message }); }
};
