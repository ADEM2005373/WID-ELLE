// Admin UI logic: auth, product & collection CRUD, orders, settings
let _products = [];
let _collections = [];
let _orders = [];

function openModal(html){
  const modal = document.getElementById('modal');
  document.getElementById('modal-body').innerHTML = html;
  modal.style.display = 'flex';
  document.getElementById('modal-close').onclick = closeModal;
}
function closeModal(){ document.getElementById('modal').style.display = 'none'; }

async function login(){
  const user = document.getElementById('admin-user').value;
  const pass = document.getElementById('admin-pass').value;
  const token = document.getElementById('github-token').value;
  const settings = await (async function(){ try{ return await loadSettings(); }catch(e){ try{ const r = await fetch('/data/settings.json',{cache:'no-cache'}); if(r.ok) return await r.json(); }catch(err){} throw e; }})();
  if(user===settings.adminUser && pass===settings.adminPassword){
    sessionStorage.setItem('isAdmin','1');
    if(token){ setGithubToken(token); }
    showDashboard();
  } else alert('Invalid credentials');
}

async function showDashboard(){
  document.getElementById('login-panel').style.display='none';
  document.getElementById('dashboard').style.display='block';
  await Promise.all([refreshProducts(), refreshCollections(), refreshOrders(), renderOverview()]);
}

async function refreshProducts(){
  _products = await loadProducts();
  const list = document.getElementById('products-list'); list.innerHTML='';
  _products.forEach(p=>{
    const row = document.createElement('div'); row.className='card';
    row.innerHTML = `<div style="display:flex;gap:1rem"><div style="width:80px;height:80px;background-size:cover;background-image:url(${p.imageBase64||''})"></div><div><strong>${p.name}</strong><div>${p.price} ${p.currency||'TND'}</div></div></div><div style="margin-top:.5rem"><button class="btn" data-id="${p.id}" data-action="edit">Edit</button> <button class="btn" data-id="${p.id}" data-action="del">Delete</button></div>`;
    row.querySelector('[data-action="edit"]').addEventListener('click',()=>openEditProduct(p.id));
    row.querySelector('[data-action="del"]').addEventListener('click',()=>deleteProduct(p.id));
    list.appendChild(row);
  });
}

async function refreshCollections(){
  _collections = await loadCollections();
  const list = document.getElementById('collections-list'); list.innerHTML='';
  _collections.forEach(c=>{
    const row = document.createElement('div'); row.className='card';
    row.innerHTML = `<div><strong>${c.emoji||''} ${c.name}</strong><div>${c.subtitle||''}</div></div><div><button class="btn" data-id="${c.id}" data-action="edit">Edit</button> <button class="btn" data-id="${c.id}" data-action="del">Delete</button></div>`;
    row.querySelector('[data-action="edit"]').addEventListener('click',()=>openEditCollection(c.id));
    row.querySelector('[data-action="del"]').addEventListener('click',()=>deleteCollection(c.id));
    list.appendChild(row);
  });
}

async function refreshOrders(){
  _orders = await loadOrders();
  const list = document.getElementById('orders-list'); list.innerHTML='';
  _orders.forEach(o=>{
    const row = document.createElement('div'); row.className='card';
    row.innerHTML = `<div><strong>Order ${o.id}</strong><div>${o.name} • ${o.phone}</div></div><div><span>${o.status||'Pending'}</span><div style="margin-top:.5rem"><button class="btn" data-id="${o.id}" data-action="view">View</button> <button class="btn" data-id="${o.id}" data-action="del">Delete</button></div></div>`;
    row.querySelector('[data-action="view"]').addEventListener('click',()=>viewOrder(o.id));
    row.querySelector('[data-action="del"]').addEventListener('click',()=>deleteOrder(o.id));
    list.appendChild(row);
  });
  // export/print controls
  const exp = document.createElement('div'); exp.className='card'; exp.innerHTML = '<button id="export-csv" class="btn">Export CSV</button> <button id="print-orders" class="btn">Print</button>';
  list.prepend(exp);
  document.getElementById('export-csv').addEventListener('click',exportOrdersCSV);
  document.getElementById('print-orders').addEventListener('click',()=>window.print());
}

function exportOrdersCSV(){
  if(!_orders || !_orders.length) return alert('No orders');
  const keys = ['id','name','phone','address','notes','total','status','createdAt'];
  const rows = [_orders.map(o=>keys.map(k=>`"${(o[k]||'').toString().replace(/"/g,'""')}"`).join(','))];
  const csv = [keys.join(','), ..._orders.map(o=>keys.map(k=>`"${(o[k]||'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='orders.csv'; a.click(); URL.revokeObjectURL(url);
}

function viewOrder(id){
  const o = _orders.find(x=>x.id===id); if(!o) return;
  openModal(`<h3>Order ${o.id}</h3><pre>${JSON.stringify(o,null,2)}</pre><div><button id="change-status" class="btn">Toggle Confirmed</button></div>`);
  document.getElementById('change-status').addEventListener('click',async()=>{
    o.status = o.status==='Confirmed' ? 'Pending' : 'Confirmed';
    try{ await saveOrders(_orders); closeModal(); refreshOrders(); }catch(e){ console.error('Update order failed',e); alert('Update failed: '+e.message); }
  });
}

async function deleteOrder(id){ if(!confirm('Delete order?')) return; _orders = _orders.filter(o=>o.id!==id); try{ await saveOrders(_orders); refreshOrders(); }catch(e){ console.error('Delete order failed',e); alert('Delete failed: '+e.message); } }

function uid(prefix='id'){ return prefix+Math.random().toString(36).slice(2,9); }

// Product CRUD
function openAddProduct(){
  const html = `
    <h3>Add Product</h3>
    <label>Name<input id="p_name"/></label>
    <label>Price<input id="p_price" type="number"/></label>
    <label>Collection<select id="p_collection">${_collections.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></label>
    <label>Badge<input id="p_badge"/></label>
    <label>Description<textarea id="p_desc"></textarea></label>
    <label>Image<input id="p_image" type="file" accept="image/*"/></label>
    <div><button id="p_save" class="btn">Save</button></div>
  `;
  openModal(html);
  document.getElementById('p_save').addEventListener('click',async()=>{
    const name = document.getElementById('p_name').value;
    const price = parseFloat(document.getElementById('p_price').value)||0;
    const collection = document.getElementById('p_collection').value;
    const badge = document.getElementById('p_badge').value;
    const desc = document.getElementById('p_desc').value;
    const file = document.getElementById('p_image').files[0];
    let b64 = '';
    if(file){ b64 = await fileToBase64(file); }
    const prod = { id: uid('prod-'), name, price, currency:'TND', collection, badge, description:desc, imageBase64: b64 };
      _products.push(prod);
      try{ await saveProducts(_products); closeModal(); refreshProducts(); }
      catch(e){ console.error('Save product failed', e); alert('Save failed: '+e.message); }
  });
}

function openEditProduct(id){
  const p = _products.find(x=>x.id===id); if(!p) return;
  const html = `
    <h3>Edit Product</h3>
    <label>Name<input id="p_name" value="${escapeHtml(p.name)}"/></label>
    <label>Price<input id="p_price" type="number" value="${p.price}"/></label>
    <label>Collection<select id="p_collection">${_collections.map(c=>`<option value="${c.id}" ${c.id===p.collection?'selected':''}>${c.name}</option>`).join('')}</select></label>
    <label>Badge<input id="p_badge" value="${escapeHtml(p.badge||'')}"/></label>
    <label>Description<textarea id="p_desc">${escapeHtml(p.description||'')}</textarea></label>
    <label>Image<input id="p_image" type="file" accept="image/*"/></label>
    <div><button id="p_save" class="btn">Save</button> <button id="p_delete" class="btn">Delete</button></div>
  `;
  openModal(html);
    document.getElementById('p_delete').addEventListener('click',async()=>{ if(confirm('Delete product?')){ _products=_products.filter(x=>x.id!==id); try{ await saveProducts(_products); closeModal(); refreshProducts(); }catch(e){ console.error('Delete product failed',e); alert('Delete failed: '+e.message); } } });
  document.getElementById('p_save').addEventListener('click',async()=>{
    p.name = document.getElementById('p_name').value;
    p.price = parseFloat(document.getElementById('p_price').value)||0;
    p.collection = document.getElementById('p_collection').value;
    p.badge = document.getElementById('p_badge').value;
    p.description = document.getElementById('p_desc').value;
    const file = document.getElementById('p_image').files[0];
    if(file){ p.imageBase64 = await fileToBase64(file); }
    await saveProducts(_products);
    closeModal(); refreshProducts();
  });
}

async function deleteProduct(id){ if(!confirm('Delete product?')) return; _products = _products.filter(p=>p.id!==id); await saveProducts(_products); refreshProducts(); }

// Collection CRUD
function openAddCollection(){
  const html = `
    <h3>Add Collection</h3>
    <label>Name<input id="c_name"/></label>
    <label>Subtitle<input id="c_sub"/></label>
    <label>Emoji<input id="c_emoji"/></label>
    <div><button id="c_save" class="btn">Save</button></div>
  `;
  openModal(html);
  document.getElementById('c_save').addEventListener('click',async()=>{
    const c = { id: uid('col-'), name: document.getElementById('c_name').value, subtitle: document.getElementById('c_sub').value, emoji: document.getElementById('c_emoji').value };
      _collections.push(c); try{ await saveCollections(_collections); closeModal(); refreshCollections(); }catch(e){ console.error('Save collection failed',e); alert('Save failed: '+e.message); }
  });
}

function openEditCollection(id){
  const c = _collections.find(x=>x.id===id); if(!c) return;
  const html = `
    <h3>Edit Collection</h3>
    <label>Name<input id="c_name" value="${escapeHtml(c.name)}"/></label>
    <label>Subtitle<input id="c_sub" value="${escapeHtml(c.subtitle||'')}"/></label>
    <label>Emoji<input id="c_emoji" value="${escapeHtml(c.emoji||'')}"/></label>
    <div><button id="c_save" class="btn">Save</button> <button id="c_del" class="btn">Delete</button></div>
  `;
  openModal(html);
    document.getElementById('c_del').addEventListener('click',async()=>{ if(confirm('Delete collection?')){ _collections=_collections.filter(x=>x.id!==id); try{ await saveCollections(_collections); closeModal(); refreshCollections(); }catch(e){ console.error('Delete collection failed',e); alert('Delete failed: '+e.message); } } });
  document.getElementById('c_save').addEventListener('click',async()=>{ c.name=document.getElementById('c_name').value; c.subtitle=document.getElementById('c_sub').value; c.emoji=document.getElementById('c_emoji').value; await saveCollections(_collections); closeModal(); refreshCollections(); });
}

async function deleteCollection(id){ if(!confirm('Delete collection?')) return; _collections = _collections.filter(c=>c.id!==id); await saveCollections(_collections); refreshCollections(); }

// Settings
async function renderSettings(){
  // try GitHub-backed settings, fall back to local file
  let s;
  try{ s = await loadSettings(); }catch(e){ try{ const r = await fetch('/data/settings.json',{cache:'no-cache'}); if(r.ok) s = await r.json(); else throw e; }catch(err){ s = {adminUser:'admin', adminPassword:'changeme', storeEmail:'', currency:'TND', repoOwner:'', repoName:''}; }
  }
  const el = document.getElementById('settings-form');
  // update runtime config
  if(window.GITHUB_CONFIG){ GITHUB_CONFIG.owner = s.repoOwner || GITHUB_CONFIG.owner; GITHUB_CONFIG.repo = s.repoName || GITHUB_CONFIG.repo; }
  el.innerHTML = `
    <label>Admin User<input id="s_user" value="${escapeHtml(s.adminUser||'')}"/></label>
    <label>Admin Pass<input id="s_pass" value="${escapeHtml(s.adminPassword||'')}"/></label>
    <label>Store Email<input id="s_email" value="${escapeHtml(s.storeEmail||'')}"/></label>
    <label>Currency<input id="s_currency" value="${escapeHtml(s.currency||'TND')}"/></label>
    <label>Repo Owner<input id="s_owner" value="${escapeHtml(s.repoOwner||'')}"/></label>
    <label>Repo Name<input id="s_repo" value="${escapeHtml(s.repoName||'')}"/></label>
    <div style="margin-top:12px"><button id="s_save" class="btn">Save Settings</button></div>
    <hr />
    <h4>GitHub Debug</h4>
    <div><button id="test-github" class="btn">Test GitHub Connection</button></div>
    <pre id="github-debug" style="white-space:pre-wrap;margin-top:12px;background:#f7f5f4;padding:12px;border-radius:8px;max-height:220px;overflow:auto"></pre>
  `;
  document.getElementById('s_save').addEventListener('click',async()=>{
    s.adminUser=document.getElementById('s_user').value; s.adminPassword=document.getElementById('s_pass').value; s.storeEmail=document.getElementById('s_email').value; s.currency=document.getElementById('s_currency').value; s.repoOwner=document.getElementById('s_owner').value; s.repoName=document.getElementById('s_repo').value; try{ await saveSettings(s); alert('Saved'); renderSettings(); }catch(err){ alert('Save failed: '+err.message); }
  });
  document.getElementById('test-github').addEventListener('click',async()=>{
    const out = document.getElementById('github-debug'); out.textContent = 'Testing...';
    // copy repo values into GITHUB_CONFIG
    try{ const owner = document.getElementById('s_owner').value; const repo = document.getElementById('s_repo').value; if(owner) GITHUB_CONFIG.owner = owner; if(repo) GITHUB_CONFIG.repo = repo; const token = sessionStorage.getItem('githubToken') || '';
      if(token) GITHUB_CONFIG.token = token;
      const res = await testGithubConnection();
      if(res.ok){ out.textContent = 'SUCCESS:\n' + res.logs.join('\n'); }
      else{ out.textContent = 'FAILED:\n' + (res.logs||[]).join('\n') + '\nError: ' + (res.error||'unknown'); }
    }catch(e){ out.textContent = 'Error: '+e.message; }
  });
}

// Orders and CSV handled above

// Helpers
function fileToBase64(file){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); }); }
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function renderOverview(){
  const products = await loadProducts();
  const collections = await loadCollections();
  const orders = await loadOrders();
  const stats = {
    totalProducts: products.length,
    totalCollections: collections.length,
    totalOrders: orders.length,
    revenue: orders.reduce((s,o)=>s+(o.total||0),0)
  };
  const node = document.getElementById('overview-stats');
  node.innerHTML = `<div class="card"><strong>Products:</strong> ${stats.totalProducts} • <strong>Collections:</strong> ${stats.totalCollections} • <strong>Orders:</strong> ${stats.totalOrders} • <strong>Revenue:</strong> ${stats.revenue.toFixed(2)}</div>`;

  // Charts
  const charts = document.getElementById('overview-charts'); charts.innerHTML='';
  // Orders last 7 days
  const days = [];
  for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); days.push(d); }
  const ordersByDay = days.map(d=>{
    const key = d.toISOString().slice(0,10);
    return orders.filter(o=>o.createdAt && o.createdAt.slice(0,10)===key).length;
  });
  charts.appendChild(createSVGBar('Orders (7d)', days.map(d=>d.toLocaleDateString()), ordersByDay, '#7B4A5A'));

  // Revenue by collection
  const revenueByCollection = collections.map(c=>{
    const ids = products.filter(p=>p.collection===c.id).map(p=>p.id);
    const rev = orders.reduce((s,o)=>s + (o.items||[]).reduce((ss,it)=> ids.includes(it.id) ? ss + ((it.price||0)* (it.qty||1)) : ss,0),0);
    return rev;
  });
  charts.appendChild(createSVGBar('Revenue by Collection', collections.map(c=>c.name), revenueByCollection, '#C4A882'));
}

function createSVGBar(title, labels, values, color){
  const width = 360, height = 120, padding=24;
  const max = Math.max(1, ...values);
  const svgNS = 'http://www.w3.org/2000/svg';
  const wrap = document.createElement('div'); wrap.className='card';
  const titleEl = document.createElement('div'); titleEl.style.marginBottom='8px'; titleEl.textContent = title; wrap.appendChild(titleEl);
  const svg = document.createElementNS(svgNS,'svg'); svg.setAttribute('width',width); svg.setAttribute('height',height);
  const barW = (width - padding*2) / values.length * 0.7;
  values.forEach((v,i)=>{
    const h = (v/max) * (height - padding*2);
    const x = padding + i * ((width - padding*2)/values.length) + ((width - padding*2)/values.length - barW)/2;
    const y = height - padding - h;
    const rect = document.createElementNS(svgNS,'rect'); rect.setAttribute('x',x); rect.setAttribute('y',y); rect.setAttribute('width',barW); rect.setAttribute('height',h); rect.setAttribute('fill',color); rect.setAttribute('rx',4);
    svg.appendChild(rect);
    const text = document.createElementNS(svgNS,'text'); text.setAttribute('x', x + barW/2); text.setAttribute('y', height - padding + 12); text.setAttribute('font-size',10); text.setAttribute('text-anchor','middle'); text.textContent = labels[i] ? (labels[i].length>8? labels[i].slice(0,8)+'..':labels[i]) : '';
    svg.appendChild(text);
  });
  wrap.appendChild(svg);
  return wrap;
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('login-btn').addEventListener('click',()=>login());
  document.getElementById('logout').addEventListener('click',()=>{ sessionStorage.removeItem('isAdmin'); sessionStorage.removeItem('githubToken'); location.reload(); });
  document.getElementById('add-product').addEventListener('click',()=>openAddProduct());
  document.getElementById('add-collection').addEventListener('click',()=>openAddCollection());
  // if already logged in, show dashboard
  if(sessionStorage.getItem('isAdmin')) showDashboard();
  renderSettings();
});
