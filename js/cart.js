// Simple cart using localStorage
const CART_KEY = 'widelle_cart_v1';
function getCart(){ try{return JSON.parse(localStorage.getItem(CART_KEY) || '[]')}catch(e){return []} }
function saveCart(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); updateCartUI(); }
function notifyCartChanged(){ document.dispatchEvent(new CustomEvent('cart:changed')); }
function addToCart(productId){
  const cart = getCart();
  const item = cart.find(i=>i.id===productId);
  if(item) item.qty++;
  else cart.push({id:productId,qty:1});
  saveCart(cart); notifyCartChanged();
}
function removeFromCart(productId){ const cart=getCart().filter(i=>i.id!==productId); saveCart(cart); }
function updateQty(productId,qty){ const cart=getCart(); const it=cart.find(i=>i.id===productId); if(!it) return; it.qty=qty; if(it.qty<=0) removeFromCart(productId); else saveCart(cart); }

function updateCartUI(){
  const count = getCart().reduce((s,i)=>s+i.qty,0);
  document.getElementById('cart-count').textContent = count;
  const itemsNode = document.getElementById('cart-items');
  if(!itemsNode) return;
  itemsNode.innerHTML='';
  // will be populated by store.js when product data available
  const totalNode = document.getElementById('cart-total'); if(totalNode) totalNode.textContent='0.00';
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('cart-button').addEventListener('click',(e)=>{e.preventDefault();document.getElementById('cart-drawer').classList.add('open')});
  document.getElementById('close-cart').addEventListener('click',()=>document.getElementById('cart-drawer').classList.remove('open'));
  updateCartUI();
  document.getElementById('checkout-btn').addEventListener('click',()=>{
    document.getElementById('checkout-modal').style.display='flex';
  });
  // checkout modal handlers
  const cm = document.getElementById('checkout-close'); if(cm) cm.addEventListener('click',()=>document.getElementById('checkout-modal').style.display='none');
  const submit = document.getElementById('order_submit'); if(submit) submit.addEventListener('click',async()=>{
    const name = document.getElementById('order_name').value;
    const phone = document.getElementById('order_phone').value;
    const address = document.getElementById('order_address').value;
    const notes = document.getElementById('order_notes').value;
    const cart = getCart(); if(!cart.length) return alert('Cart empty');
    // compose order
    const products = await loadProducts();
    const items = cart.map(ci=>{ const p=products.find(x=>x.id===ci.id) || {name:'Unknown',price:0}; return {id:ci.id,name:p.name,qty:ci.qty,price:p.price||0}; });
    const total = items.reduce((s,i)=>s + (i.price||0)*i.qty,0);
    const order = { id: 'ord-'+Math.random().toString(36).slice(2,9), name, phone, address, notes, items, total, status:'Pending', createdAt: new Date().toISOString() };
    // try to save via GitHub API if token available in session
    try{
      const existing = await loadOrders();
      existing.push(order);
      await saveOrders(existing);
      // show success modal
      document.getElementById('order-success').style.display='flex';
    }catch(err){
      console.warn('Save orders failed',err);
      const settings = await loadSettings();
      const subject = encodeURIComponent('New Order '+order.id);
      const body = encodeURIComponent(`Order ${order.id}\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\nNotes: ${notes}\nTotal: ${total}\nItems:\n` + items.map(it=>`${it.qty} x ${it.name} @ ${it.price}`).join('\n'));
      window.location.href = `mailto:${settings.storeEmail || ''}?subject=${subject}&body=${body}`;
      document.getElementById('order-success').style.display='flex';
    }
    // clear cart
    localStorage.removeItem(CART_KEY); updateCartUI(); document.getElementById('checkout-modal').style.display='none';
    const close = document.getElementById('order-success-close'); if(close) close.addEventListener('click',()=>document.getElementById('order-success').style.display='none');
  });
});
  notifyCartChanged();
