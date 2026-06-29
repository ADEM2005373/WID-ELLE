// Client-side wrapper that calls secure serverless endpoints
async function apiRead(path){
  const res = await fetch('/api/github-read?path=' + encodeURIComponent(path));
  if(!res.ok){
    let err;
    try{ err = await res.json(); }catch(e){ throw new Error('Read failed: '+res.status); }
    throw new Error(err.error || err.message || 'Read failed');
  }
  const data = await res.json();
  return data.content;
}

async function apiWrite(path, contentString, message){
  const res = await fetch('/api/github-write', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path, content: contentString, message }) });
  if(!res.ok){
    let err;
    try{ err = await res.json(); }catch(e){ throw new Error('Write failed: '+res.status); }
    throw new Error(err.error || (err.body && err.body.message) || err.message || 'Write failed');
  }
  const data = await res.json();
  return data;
}

// Local-first loaders: read from deployed /data files for visitors; writes go through serverless write
async function loadLocalJSON(path){
  // Try a direct fetch with no-store first
  try{
    const url = '/' + path;
    let res = await fetch(url, { cache: 'no-store' });
    if(res && res.status===200){ return await res.json(); }
    // If we get a 304 or other non-200, attempt a cache-busting fetch
    if(window.DEBUG) console.warn('Local fetch returned', res && res.status, '– retrying with cache-bust');
    const res2 = await fetch(url + '?_=' + Date.now(), { cache: 'no-store' });
    if(res2 && res2.ok){ return await res2.json(); }
    throw new Error('Local read failed: ' + (res2 ? res2.status : 'no-response'));
  }catch(err){
    if(window.DEBUG) console.error('loadLocalJSON error for', path, err);
    throw err;
  }
}

async function loadProducts(){ try{ return await loadLocalJSON('data/products.json'); }catch(e){ return await apiRead('data/products.json'); } }
async function saveProducts(products){ return await apiWrite('data/products.json', JSON.stringify(products, null, 2), 'Update products'); }
async function loadCollections(){ try{ return await loadLocalJSON('data/collections.json'); }catch(e){ return await apiRead('data/collections.json'); } }
async function saveCollections(collections){ return await apiWrite('data/collections.json', JSON.stringify(collections, null, 2), 'Update collections'); }

// Debug wrappers (set window.DEBUG = true in console to enable)
const _loadProducts = loadProducts;
const _loadCollections = loadCollections;
window.DEBUG = window.DEBUG || false;
loadProducts = async function(){
  const data = await _loadProducts();
  if(window.DEBUG) console.log('DEBUG: loadProducts ->', data);
  return data;
}
loadCollections = async function(){
  const data = await _loadCollections();
  if(window.DEBUG) console.log('DEBUG: loadCollections ->', data);
  return data;
}
async function loadOrders(){ try{ return await loadLocalJSON('data/orders.json'); }catch(e){ return await apiRead('data/orders.json'); } }
async function saveOrders(orders){ return await apiWrite('data/orders.json', JSON.stringify(orders, null, 2), 'Update orders'); }
async function loadSettings(){ try{ return await loadLocalJSON('data/settings.json'); }catch(e){ return await apiRead('data/settings.json'); } }
async function saveSettings(settings){ return await apiWrite('data/settings.json', JSON.stringify(settings, null, 2), 'Update settings'); }
async function loadNewsletter(){ try{ return await loadLocalJSON('data/newsletter.json'); }catch(e){ return await apiRead('data/newsletter.json'); } }
async function saveNewsletter(list){ return await apiWrite('data/newsletter.json', JSON.stringify(list, null, 2), 'Update newsletter'); }

// Test connection via serverless read of known paths
async function testGithubConnection(){
  const paths = ['data/products.json','data/collections.json','data/orders.json','data/settings.json','data/newsletter.json'];
  const logs = [];
  for(const p of paths){
    try{ logs.push('Checking '+p); const r = await fetch('/api/github-read?path='+encodeURIComponent(p)); if(!r.ok){ const e = await r.json(); return { ok:false, logs, error:e.error||e.message }; } const d = await r.json(); logs.push(`${p} OK (sha: ${d.sha||'unknown'})`); }catch(e){ return { ok:false, logs, error: e.message }; }
  }
  return { ok:true, logs, message:'All checks passed' };
}
