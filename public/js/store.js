// WID-ELLE Store — Main JavaScript (version complète)

// ── STATE ──
let products = [];
let collections = [];
let cart = [];
let currency = 'TND';
let activeFilter = 'all';
let currentProductId = null;

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  loadCart();
  setupNavbarScroll();
  setupScrollReveal();
  setupBackToTop();
  setupCookieBanner();
  await Promise.all([loadCollections(), loadProducts()]);
});

// ── API ──
async function apiRead(file) {
  const res = await fetch(`/api/github-read?file=${file}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Failed to load ${file}`);
  }
  const json = await res.json();
  return json.data;
}

async function apiWrite(file, data) {
  const res = await fetch('/api/github-write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Failed to save ${file}`);
  }
  return res.json();
}

// ── LOAD COLLECTIONS ──
async function loadCollections() {
  try {
    collections = await apiRead('collections');
    renderCollections();
    buildFilterBar();
  } catch (e) {
    console.error('Collections load error:', e.message);
  }
}

function renderCollections() {
  const grid = document.getElementById('collectionsGrid');
  if (!grid) return;
  if (!collections.length) {
    grid.innerHTML = '<p style="color:var(--text-light);font-size:0.9rem;padding:40px;text-align:center;grid-column:1/-1">Aucune collection disponible.</p>';
    return;
  }
  grid.innerHTML = collections.map((col, i) => `
    <div class="collection-card reveal reveal-delay-${i + 1}" onclick="filterByCollection('${col.id}')">
      <p class="collection-name">${esc(col.name)}</p>
      <p class="collection-desc">${esc(col.description)}</p>
      <span class="collection-arrow">Voir les sacs →</span>
    </div>
  `).join('');
  observeReveal();
}

function buildFilterBar() {
  const bar = document.getElementById('filterBar');
  if (!bar || !collections.length) return;
  bar.innerHTML = `
    <button class="filter-btn active" data-collection="all" onclick="filterProducts('all')">Tout voir</button>
    ${collections.map(col => `
      <button class="filter-btn" data-collection="${col.id}" onclick="filterProducts('${col.id}')">${esc(col.name)}</button>
    `).join('')}
  `;
}

function filterByCollection(colId) {
  filterProducts(colId);
  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
}

function filterProducts(colId) {
  activeFilter = colId;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.collection === colId);
  });
  const filtered = colId === 'all' ? products : products.filter(p => p.collection === colId);
  renderProducts(filtered);
}

// ── LOAD PRODUCTS ──
async function loadProducts() {
  try {
    const settings = await apiRead('settings');
    currency = settings.currency || 'TND';
    products = await apiRead('products');
    renderProducts(products);
  } catch (e) {
    console.error('Products load error:', e.message);
    const grid = document.getElementById('productsGrid');
    if (grid) grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-light)">
        <p style="font-size:0.9rem;margin-bottom:8px">Erreur de chargement du catalogue</p>
        <p style="font-size:0.8rem;color:var(--rose)">${esc(e.message)}</p>
        <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;background:var(--plum);color:#fff;border:none;border-radius:2px;cursor:pointer;font-size:0.8rem;letter-spacing:0.1em">
          Réessayer
        </button>
      </div>
    `;
  }
}

function getCollectionName(colId) {
  const col = collections.find(c => c.id === colId);
  return col ? col.name : '';
}

function renderProducts(list) {
  const grid = document.getElementById('productsGrid');
  const empty = document.getElementById('emptyState');
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  grid.innerHTML = list.map((p, i) => {
    const colName = getCollectionName(p.collection);
    const imgHTML = p.image
      ? `<img src="${p.image}" alt="${esc(p.name)}" loading="lazy" />`
      : `<span class="product-placeholder">W</span>`;
    const badge = p.badge ? `<span class="product-badge">${esc(p.badge)}</span>` : '';
    const delay = (i % 3) + 1;
    return `
      <article class="product-card reveal reveal-delay-${delay}">
        <div class="product-image-wrap" onclick="openProductDetail('${p.id}')">
          ${imgHTML}
          ${badge}
          <div class="product-quickview">Voir le détail</div>
        </div>
        <div class="product-info">
          ${colName ? `<p class="product-collection">${esc(colName)}</p>` : ''}
          <h3 class="product-name" onclick="openProductDetail('${p.id}')" style="cursor:pointer">${esc(p.name)}</h3>
          <p class="product-desc">${esc(p.description)}</p>
          <div class="product-footer">
            <span class="product-price">${p.price} ${currency}</span>
            <button class="add-to-cart" onclick="addToCart('${p.id}')">Ajouter</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
  observeReveal();
}

// ── PRODUCT DETAIL MODAL ──
function openProductDetail(productId) {
  const p = products.find(pr => pr.id === productId);
  if (!p) return;
  currentProductId = productId;

  const overlay = document.getElementById('productDetailOverlay');
  const imgEl = document.getElementById('pdImage');
  const colName = getCollectionName(p.collection);

  // Image
  imgEl.innerHTML = p.image
    ? `<img src="${p.image}" alt="${esc(p.name)}" />`
    : `<span class="product-modal-placeholder">W</span>`;

  document.getElementById('pdCollection').textContent = colName || '';
  document.getElementById('pdName').textContent = p.name;
  document.getElementById('pdPrice').textContent = `${p.price} ${currency}`;
  document.getElementById('pdDesc').textContent = p.description || '';

  const badgeEl = document.getElementById('pdBadge');
  if (p.badge) {
    badgeEl.textContent = p.badge;
    badgeEl.style.display = '';
  } else {
    badgeEl.style.display = 'none';
  }

  const addBtn = document.getElementById('pdAddBtn');
  addBtn.textContent = 'Ajouter au panier';
  addBtn.classList.remove('added');

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeProductDetail(e) {
  if (e && e.target !== document.getElementById('productDetailOverlay')) return;
  closeProductDetailDirect();
}

function closeProductDetailDirect() {
  document.getElementById('productDetailOverlay')?.classList.remove('active');
  document.body.style.overflow = '';
  currentProductId = null;
}

function addToCartFromModal() {
  if (!currentProductId) return;
  addToCart(currentProductId, false);

  const btn = document.getElementById('pdAddBtn');
  btn.textContent = '✓ Ajouté au panier';
  btn.classList.add('added');

  setTimeout(() => {
    closeProductDetailDirect();
    openCart();
  }, 600);
}

// ── CART ──
function loadCart() {
  try { cart = JSON.parse(localStorage.getItem('wid_elle_cart') || '[]'); }
  catch { cart = []; }
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('wid_elle_cart', JSON.stringify(cart));
}

function addToCart(productId, openDrawer = true) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const existing = cart.find(i => i.id === productId);
  if (existing) { existing.qty++; }
  else { cart.push({ id: productId, qty: 1 }); }
  saveCart();
  updateCartUI();
  showStoreToast(`${product.name} ajouté au panier`);
  if (openDrawer) openCart();
}

function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const countEl = document.getElementById('cartCount');
  if (countEl) {
    countEl.textContent = count;
    countEl.classList.toggle('visible', count > 0);
  }
  renderCartItems();
}

function renderCartItems() {
  const itemsEl   = document.getElementById('cartItems');
  const emptyEl   = document.getElementById('cartEmpty');
  const footerEl  = document.getElementById('cartFooter');
  const totalEl   = document.getElementById('cartTotal');
  if (!itemsEl) return;

  if (!cart.length) {
    if (emptyEl)  emptyEl.style.display = '';
    itemsEl.innerHTML = '';
    if (footerEl) footerEl.style.display = 'none';
    return;
  }
  if (emptyEl)  emptyEl.style.display = 'none';
  if (footerEl) footerEl.style.display = '';

  let total = 0;
  itemsEl.innerHTML = cart.map(item => {
    const p = products.find(pr => pr.id === item.id);
    if (!p) return '';
    const subtotal = p.price * item.qty;
    total += subtotal;
    const imgHTML = p.image
      ? `<img src="${p.image}" alt="${esc(p.name)}" />`
      : 'W';
    return `
      <div class="cart-item">
        <div class="cart-item-img">${imgHTML}</div>
        <div class="cart-item-info">
          <p class="cart-item-name">${esc(p.name)}</p>
          <p class="cart-item-price">${p.price} ${currency} × ${item.qty} = ${subtotal} ${currency}</p>
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="changeQty('${p.id}', -1)">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="changeQty('${p.id}', 1)">+</button>
            <button class="cart-item-remove" onclick="removeFromCart('${p.id}')">Retirer</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (totalEl) totalEl.textContent = `${total} ${currency}`;
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartUI();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartUI();
}

function openCart() {
  document.getElementById('cartDrawer')?.classList.add('active');
  document.getElementById('cartOverlay')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartDrawer')?.classList.remove('active');
  document.getElementById('cartOverlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

document.getElementById('cartBtn')?.addEventListener('click', openCart);

// ── CHECKOUT ──
function openCheckout() {
  closeCart();
  const overlay = document.getElementById('checkoutOverlay');
  if (!overlay) return;

  const summaryEl = document.getElementById('orderSummary');
  if (summaryEl) {
    let total = 0;
    const lines = cart.map(item => {
      const p = products.find(pr => pr.id === item.id);
      if (!p) return '';
      const sub = p.price * item.qty;
      total += sub;
      return `<div class="order-summary-item"><span>${esc(p.name)} × ${item.qty}</span><span>${sub} ${currency}</span></div>`;
    }).join('');
    summaryEl.innerHTML = lines + `<div class="order-summary-item total"><span>Total</span><span>${total} ${currency}</span></div>`;
  }

  // Reset submit button
  const btn = document.getElementById('coSubmit');
  if (btn) { btn.textContent = 'Confirmer la commande'; btn.disabled = false; }
  document.getElementById('coError')?.classList.add('hidden');

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCheckout(e) {
  if (e && e.target !== document.getElementById('checkoutOverlay')) return;
  closeCheckoutDirect();
}

function closeCheckoutDirect() {
  document.getElementById('checkoutOverlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

async function submitOrder() {
  const name    = document.getElementById('coName')?.value.trim();
  const phone   = document.getElementById('coPhone')?.value.trim();
  const address = document.getElementById('coAddress')?.value.trim();
  const notes   = document.getElementById('coNotes')?.value.trim();
  const submitBtn = document.getElementById('coSubmit');

  document.getElementById('coError')?.classList.add('hidden');

  if (!name)    { showCoError('Veuillez entrer votre nom complet.'); return; }
  if (!phone)   { showCoError('Veuillez entrer votre numéro de téléphone.'); return; }
  if (!address) { showCoError('Veuillez entrer votre adresse de livraison.'); return; }
  if (!cart.length) { showCoError('Votre panier est vide.'); return; }

  submitBtn.textContent = 'Envoi en cours…';
  submitBtn.disabled = true;

  try {
    const existingOrders = await apiRead('orders');
    const orderId = 'ORD-' + Date.now();
    const total = cart.reduce((s, item) => {
      const p = products.find(pr => pr.id === item.id);
      return s + (p ? p.price * item.qty : 0);
    }, 0);

    const newOrder = {
      id: orderId,
      customer: { name, phone, address, notes: notes || '' },
      items: cart.map(item => {
        const p = products.find(pr => pr.id === item.id);
        return { productId: item.id, name: p?.name || '', price: p?.price || 0, qty: item.qty };
      }),
      total,
      currency,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await apiWrite('orders', [...existingOrders, newOrder]);

    cart = [];
    saveCart();
    updateCartUI();
    closeCheckoutDirect();

    document.getElementById('orderRef').textContent = `Référence commande : ${orderId}`;
    document.getElementById('successOverlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';

  } catch (e) {
    showCoError('Erreur lors de la commande : ' + e.message);
    submitBtn.textContent = 'Confirmer la commande';
    submitBtn.disabled = false;
  }
}

function showCoError(msg) {
  const el = document.getElementById('coError');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function closeSuccess() {
  document.getElementById('successOverlay')?.classList.remove('active');
  document.body.style.overflow = '';
  ['coName', 'coPhone', 'coAddress', 'coNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ── NEWSLETTER ──
function subscribeNewsletter() {
  const email = document.getElementById('nlEmail')?.value.trim();
  const msg = document.getElementById('nlMsg');
  if (!email || !email.includes('@')) {
    if (msg) msg.textContent = 'Veuillez entrer une adresse email valide.';
    return;
  }
  if (msg) msg.textContent = '✓ Merci ! Vous recevrez bientôt nos actualités exclusives.';
  document.getElementById('nlEmail').value = '';
}

// ── NAVBAR ──
function setupNavbarScroll() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

// ── SCROLL REVEAL ──
function setupScrollReveal() {
  // Reveal hero elements immediately
  setTimeout(() => {
    document.querySelectorAll('.hero .reveal').forEach(el => el.classList.add('visible'));
  }, 100);
  observeReveal();
}

function observeReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal:not(.visible)').forEach(el => observer.observe(el));
}

// ── BACK TO TOP ──
function setupBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });
}

// ── COOKIE BANNER ──
function setupCookieBanner() {
  if (!localStorage.getItem('wid_elle_cookies')) {
    setTimeout(() => {
      document.getElementById('cookieBanner')?.classList.add('visible');
    }, 2000);
  }
}

function acceptCookies() {
  localStorage.setItem('wid_elle_cookies', '1');
  document.getElementById('cookieBanner')?.classList.remove('visible');
}

// ── STORE TOAST ──
let storeToastTimer;
function showStoreToast(msg) {
  // If CSS/DOM are not loaded yet, avoid crashing the whole page.
  const toast = document.getElementById('storeToast');
  if (!toast) return;
  try {
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(storeToastTimer);
    storeToastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
  } catch (_) {}
}


// ── HERO LINK ──
document.querySelector('.hero-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('savoir-faire')?.scrollIntoView({ behavior: 'smooth' });
});

// ── CLOSE MODALS ON ESCAPE ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeProductDetailDirect();
    closeCart();
    closeCheckoutDirect();
    document.getElementById('successOverlay')?.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// ── UTILITIES ──
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
