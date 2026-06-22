// GitHub API helpers
async function loadJSON(path){
  const res = await fetch(path,{cache:'no-cache'});
  if(!res.ok) throw new Error('Failed to load '+path);
  return res.json();
}

async function saveFileToGit(path, contentString, commitMessage){
  const settings = await loadJSON('/data/settings.json');
  const owner = settings.repoOwner;
  const repo = settings.repoName;
  const token = sessionStorage.getItem('githubToken');
  if(!token) throw new Error('GitHub token required in sessionStorage as githubToken');

  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  // get existing file to obtain sha
  const getRes = await fetch(apiBase, {headers:{Authorization:'token '+token}});
  const getData = getRes.ok ? await getRes.json() : null;
  const sha = getData && getData.sha ? getData.sha : undefined;

  const body = {
    message: commitMessage || 'Update '+path,
    content: btoa(unescape(encodeURIComponent(contentString)))
  };
  if(sha) body.sha = sha;

  const putRes = await fetch(apiBase, {
    method:'PUT',
    headers:{
      Authorization:'token '+token,
      'Content-Type':'application/json'
    },
    body: JSON.stringify(body)
  });
  if(!putRes.ok){
    const err = await putRes.text();
    throw new Error('GitHub save failed: '+err);
  }
  return await putRes.json();
}

async function loadProducts(){ return loadJSON('/data/products.json'); }
async function saveProducts(products){ return saveFileToGit('data/products.json', JSON.stringify(products, null, 2), 'Update products'); }
async function loadCollections(){ return loadJSON('/data/collections.json'); }
async function saveCollections(collections){ return saveFileToGit('data/collections.json', JSON.stringify(collections, null, 2), 'Update collections'); }
async function loadOrders(){ return loadJSON('/data/orders.json'); }
async function saveOrders(orders){ return saveFileToGit('data/orders.json', JSON.stringify(orders, null, 2), 'Update orders'); }
async function loadSettings(){ return loadJSON('/data/settings.json'); }
async function saveSettings(settings){ return saveFileToGit('data/settings.json', JSON.stringify(settings, null, 2), 'Update settings'); }
async function loadNewsletter(){ return loadJSON('/data/newsletter.json'); }
async function saveNewsletter(list){ return saveFileToGit('data/newsletter.json', JSON.stringify(list, null, 2), 'Update newsletter'); }
