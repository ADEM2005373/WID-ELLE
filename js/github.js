// GitHub API helpers with robust error handling and central config
const GITHUB_CONFIG = {
  owner: 'ADEM2005373',
  repo: 'WID-ELLE',
  branch: 'main',
  token: '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'
};

function setGithubToken(token){ if(!token) return; sessionStorage.setItem('githubToken', token); GITHUB_CONFIG.token = token; }

async function initGithubConfig(){
  // load settings.json to populate owner/repo if present
  try{
    const res = await fetch('/data/settings.json', {cache:'no-cache'});
    if(res.ok){
      const s = await res.json();
      if(s.repoOwner) GITHUB_CONFIG.owner = s.repoOwner;
      if(s.repoName) GITHUB_CONFIG.repo = s.repoName;
      if(s.branch) GITHUB_CONFIG.branch = s.branch;
    }
  }catch(e){ console.warn('Could not load settings.json during github init',e); }
  const token = sessionStorage.getItem('githubToken') || '';
  if(token) GITHUB_CONFIG.token = token;
}

function githubApiHeaders(){
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' };
  if(GITHUB_CONFIG.token) headers['Authorization'] = 'token ' + GITHUB_CONFIG.token;
  return headers;
}

function apiUrl(path){
  return `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${path}`;
}

async function checkRepo(){
  if(!GITHUB_CONFIG.owner || !GITHUB_CONFIG.repo) throw new Error('Repository owner and name not configured. Update settings.json or admin settings.');
  const url = apiUrl('');
  console.debug('GitHub: checking repo', url);
  const res = await fetch(url, {headers: githubApiHeaders()});
  if(res.status===404) throw new Error('Repository not found');
  if(res.status===401 || res.status===403) throw new Error('Invalid GitHub token or access denied');
  if(!res.ok) throw new Error('GitHub repository access error: '+res.status);
  return await res.json();
}

async function checkBranch(){
  const url = apiUrl(`branches/${encodeURIComponent(GITHUB_CONFIG.branch)}`);
  console.debug('GitHub: checking branch', url);
  const res = await fetch(url, {headers: githubApiHeaders()});
  if(res.status===404) throw new Error('Branch not found');
  if(!res.ok) throw new Error('GitHub branch access error: '+res.status);
  return await res.json();
}

async function getFileMetadata(path){
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}?ref=${encodeURIComponent(GITHUB_CONFIG.branch)}`;
  console.debug('GitHub: getFileMetadata', url);
  const res = await fetch(url, {headers: githubApiHeaders()});
  if(res.status===404) return null;
  if(res.status===401 || res.status===403) throw new Error('GitHub authentication failed when accessing '+path);
  if(!res.ok) throw new Error('Failed to fetch file metadata: '+res.status);
  return await res.json();
}

async function loadFileFromGit(path){
  await initGithubConfig();
  await checkRepo();
  await checkBranch();
  const meta = await getFileMetadata(path);
  if(!meta) throw new Error(`${path} not found in repository`);
  if(!meta.content) throw new Error('No content returned for '+path);
  try{
    const decoded = atob(meta.content.replace(/\n/g,''));
    return JSON.parse(decoded);
  }catch(e){
    throw new Error('Failed to decode or parse JSON for '+path+': '+e.message);
  }
}

async function saveFileToGit(path, contentString, commitMessage){
  await initGithubConfig();
  await checkRepo();
  await checkBranch();
  if(!GITHUB_CONFIG.token) throw new Error('GitHub token not set. Please provide a Personal Access Token in admin.');
  const apiPath = `contents/${path}`;
  const url = apiUrl(apiPath) + `?ref=${encodeURIComponent(GITHUB_CONFIG.branch)}`;
  // get existing file to obtain sha
  const meta = await getFileMetadata(path);
  const sha = meta && meta.sha ? meta.sha : undefined;
  const body = {
    message: commitMessage || 'Update '+path,
    content: btoa(unescape(encodeURIComponent(contentString))),
    branch: GITHUB_CONFIG.branch
  };
  if(sha) body.sha = sha;
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: githubApiHeaders(),
    body: JSON.stringify(body)
  });
  console.debug('GitHub PUT', url, body);
  const text = await putRes.text();
  let data;
  try{ data = text ? JSON.parse(text) : {}; }catch(e){ throw new Error('Invalid JSON response from GitHub: '+text); }
  if(!putRes.ok){
    const msg = data && data.message ? data.message : putRes.statusText;
    console.error('GitHub save failed', putRes.status, msg, data);
    throw new Error('GitHub save failed: '+msg);
  }
  console.debug('GitHub save success', data);
  // return parsed response
  return data;
}

// Local-first loaders for visitor experience; fallback to GitHub when necessary
async function loadLocalJSON(path){
  try{
    const res = await fetch('/'+path, {cache:'no-cache'});
    if(res.ok) return await res.json();
    throw new Error('Local fetch failed');
  }catch(e){ throw e; }
}

async function loadProducts(){
  try{ return await loadLocalJSON('data/products.json'); }
  catch(e){ return await loadFileFromGit('data/products.json'); }
}
async function saveProducts(products){ return await saveFileToGit('data/products.json', JSON.stringify(products, null, 2), 'Update products'); }
async function loadCollections(){
  try{ return await loadLocalJSON('data/collections.json'); }
  catch(e){ return await loadFileFromGit('data/collections.json'); }
}
async function saveCollections(collections){ return await saveFileToGit('data/collections.json', JSON.stringify(collections, null, 2), 'Update collections'); }
async function loadOrders(){
  try{ return await loadLocalJSON('data/orders.json'); }
  catch(e){ return await loadFileFromGit('data/orders.json'); }
}
async function saveOrders(orders){ return await saveFileToGit('data/orders.json', JSON.stringify(orders, null, 2), 'Update orders'); }
async function loadSettings(){
  try{ return await loadLocalJSON('data/settings.json'); }
  catch(e){ return await loadFileFromGit('data/settings.json'); }
}
async function saveSettings(settings){ return await saveFileToGit('data/settings.json', JSON.stringify(settings, null, 2), 'Update settings'); }
async function loadNewsletter(){
  try{ return await loadLocalJSON('data/newsletter.json'); }
  catch(e){ return await loadFileFromGit('data/newsletter.json'); }
}
async function saveNewsletter(list){ return await saveFileToGit('data/newsletter.json', JSON.stringify(list, null, 2), 'Update newsletter'); }

// Debug helper
async function testGithubConnection(){
  await initGithubConfig();
  const logs = [];
  try{ logs.push('Checking repo...'); await checkRepo(); logs.push('Repository found'); }
  catch(e){ return {ok:false, logs, error:e.message}; }
  try{ logs.push('Checking branch...'); await checkBranch(); logs.push('Branch found'); }
  catch(e){ return {ok:false, logs, error:e.message}; }
  // check files
  const paths = ['data/products.json','data/collections.json','data/orders.json','data/settings.json','data/newsletter.json'];
  for(const p of paths){
    try{ logs.push(`Checking ${p}...`); const meta = await getFileMetadata(p); if(!meta) throw new Error(p+' missing'); logs.push(`${p} OK (sha: ${meta.sha})`); }
    catch(e){ return {ok:false, logs, error:e.message}; }
  }
  return {ok:true, logs, message:'All checks passed'};
}
