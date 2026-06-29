async function render(){
  if(window.DEBUG) console.log('DEBUG: store.render start');
  const products = await loadProducts();
  const collections = await loadCollections();
  if(window.DEBUG){ console.log('Products loaded:', products); console.log('Collections loaded:', collections); }
  const productsList = document.getElementById('products-list');
  const collList = document.getElementById('collections-list');
  if(window.DEBUG){ console.log('productsList element:', productsList); console.log('collList element:', collList); }
  productsList.innerHTML=''; collList.innerHTML='';

  // build collection buttons with counts
    const allBtn = document.createElement('button'); allBtn.className='card active reveal'; allBtn.textContent='All'; allBtn.dataset.collection = '';
  allBtn.addEventListener('click',()=>applyCollectionFilter(''));
  collList.appendChild(allBtn);
  if(window.DEBUG) console.log('Rendering collections - count:', (collections && collections.length) || 0);
  collections.forEach(c=>{
    const count = products.filter(p=>p.collection===c.id).length;
    const el = document.createElement('button'); el.className='card'; el.innerHTML = `${c.emoji||''} ${c.name} <small>(${count})</small>`;
    el.dataset.collection = c.id;
      el.addEventListener('click',()=>applyCollectionFilter(c.id));
      el.classList.add('reveal');
    collList.appendChild(el);
  });

  products.forEach(p=>{
    const tpl = document.getElementById('product-card-template');
    const node = tpl.content.cloneNode(true);
      const cardEl = node.querySelector('.product-card');
      if(cardEl) cardEl.classList.add('reveal');
    node.querySelector('.product-name').textContent = p.name;
    node.querySelector('.product-desc').textContent = p.description||'';
    node.querySelector('.price').textContent = (p.price||0).toFixed(2)+ ' ' + (p.currency||'TND');
    const img = node.querySelector('.product-image');
    if(p.imageBase64) img.style.backgroundImage = `url(${p.imageBase64})`;
    const badge = node.querySelector('.product-badge'); badge.textContent = p.badge||'';
    node.querySelector('.add-to-cart').addEventListener('click',()=>{ addToCart(p.id); });
    productsList.appendChild(node);
  });
  updateCartUI();
}

function applyCollectionFilter(collectionId){
  document.querySelectorAll('#collections-list .card').forEach(b=>b.classList.toggle('active', b.dataset.collection===collectionId || (collectionId==='' && b.dataset.collection==='')));
  document.getElementById('products-list').querySelectorAll('.product-card').forEach(card=>{
    const col = card.dataset.collection || '';
    card.style.display = (collectionId==='' || col===collectionId) ? '' : 'none';
  });
}

// bind newsletter
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('newsletter-join')?.addEventListener('click',async()=>{
    const email = (document.getElementById('newsletter-email')||{}).value || '';
    if(!email || !email.includes('@')) return alert('Enter a valid email');
    try{
      const list = await loadNewsletter(); list.push({email,createdAt:new Date().toISOString()}); await saveNewsletter(list);
      alert('Thanks — subscribed!');
    }catch(err){
      console.warn('Newsletter save failed',err);
      const settings = await loadSettings(); window.location.href = `mailto:${settings.storeEmail||''}?subject=Newsletter%20Signup&body=${encodeURIComponent(email)}`;
    }
  });
});

document.addEventListener('DOMContentLoaded',()=>{ render().catch(err=>console.error(err)); });

// Render cart drawer items and totals
async function renderCartDrawer(){
  const cart = getCart();
  const products = await loadProducts();
  const itemsNode = document.getElementById('cart-items');
  const totalNode = document.getElementById('cart-total');
  itemsNode.innerHTML='';
  let total = 0;
  cart.forEach(ci=>{
    const p = products.find(x=>x.id===ci.id) || {name:'Unknown',price:0};
    const row = document.createElement('div'); row.className='cart-item';
    row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div>${ci.qty} x ${p.name}</div><div>${((p.price||0)*ci.qty).toFixed(2)}</div></div>`;
    itemsNode.appendChild(row);
    total += (p.price||0)*ci.qty;
  });
  totalNode.textContent = total.toFixed(2);
}

document.addEventListener('DOMContentLoaded',()=>{ document.addEventListener('cart:changed',()=>renderCartDrawer()); render().then(()=>renderCartDrawer()).catch(()=>{}); });
