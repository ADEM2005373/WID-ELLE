// WID-ELLE Admin Dashboard — Main JavaScript

// ── STATE ──
let products = [];
let collections = [];
let orders = [];
let settings = {};

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  checkAuth();
});

// ── AUTH ──
function checkAuth() {
  if (sessionStorage.getItem('wid_elle_admin') === 'true') {
    showAdmin();
  }
}

async function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  errEl.classList.add('hidden');
  btn.textContent = 'Connexion…';
  btn.disabled = true;

  try {
    const res = await fetch('/api/github-read?file=settings');
    if (!res.ok) throw new Error('Impossible de vérifier les identifiants.');
    const json = await res.json();
    const s = json.data;

    if (user === s.adminUsername && pass === s.adminPassword) {
      sessionStorage.setItem('wid_elle_admin', 'true');
      settings = s;
      showAdmin();
    } else {
      errEl.classList.remove('hidden');
      btn.textContent = 'Se connecter';
      btn.disabled = false;
    }
  } catch (e) {
    errEl.textContent = 'Erreur: ' + e.message;
    errEl.classList.remove('hidden');
    btn.textContent = 'Se connecter';
    btn.disabled = false;
  }
}

function doLogout() {
  sessionStorage.removeItem('wid_elle_admin');
  location.reload();
}

async function showAdmin() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminLayout').classList.remove('hidden');
  await loadAllData();
  showSection('overview');
}

// ── LOAD DATA ──
async function loadAllData() {
  try {
    [products, collections, orders, settings] = await Promise.all([
      apiRead('products'),
      apiRead('collections'),
      apiRead('orders'),
      apiRead('settings'),
    ]);
    updateOverview();
    renderProductsTable();
    renderCollectionsTable();
    renderOrdersTable();
    populateSettingsForm();
  } catch (e) {
    showToast('Erreur de chargement: ' + e.message, true);
  }
}

// ── API ──
async function apiRead(file) {
  const res = await fetch(`/api/github-read?file=${file}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown' }));
    throw new Error(err.error || 'Erreur lecture');
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
    const err = await res.json().catch(() => ({ error: 'Unknown' }));
    throw new Error(err.error || 'Erreur écriture');
  }
  return res.json();
}

// ── NAVIGATION ──
function showSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  document.getElementById(`sec-${name}`)?.classList.remove('hidden');
  document.querySelector(`[data-section="${name}"]`)?.classList.add('active');

  if (name === 'debug') runDebug();
}

// ── OVERVIEW ──
function updateOverview() {
  document.getElementById('statProducts').textContent = products.length;
  document.getElementById('statCollections').textContent = collections.length;
  document.getElementById('statOrders').textContent = orders.length;
  document.getElementById('statPending').textContent = orders.filter(o => o.status === 'pending').length;

  const recent = [...orders].reverse().slice(0, 5);
  const recentEl = document.getElementById('recentOrders');
  if (!recentEl) return;

  if (!recent.length) {
    recentEl.innerHTML = '<div class="table-empty">Aucune commande pour le moment.</div>';
    return;
  }

  recentEl.innerHTML = `
    <table>
      <thead><tr>
        <th>Référence</th>
        <th>Client</th>
        <th>Total</th>
        <th>Statut</th>
        <th>Date</th>
      </tr></thead>
      <tbody>
        ${recent.map(o => `
          <tr>
            <td style="font-family:monospace;font-size:0.75rem">${esc(o.id)}</td>
            <td>${esc(o.customer?.name || '—')}</td>
            <td>${o.total} ${o.currency || 'TND'}</td>
            <td>${statusBadge(o.status)}</td>
            <td>${formatDate(o.createdAt)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ── PRODUCTS ──
function renderProductsTable() {
  document.getElementById('productCount').textContent = `${products.length} produit${products.length !== 1 ? 's' : ''}`;
  const wrap = document.getElementById('productsTable');
  if (!wrap) return;

  if (!products.length) {
    wrap.innerHTML = '<div class="table-empty">Aucun produit. Ajoutez-en un !</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Image</th>
        <th>Nom</th>
        <th>Collection</th>
        <th>Prix</th>
        <th>Badge</th>
        <th>Actions</th>
      </tr></thead>
      <tbody>
        ${products.map(p => {
          const col = collections.find(c => c.id === p.collection);
          const imgHTML = p.image
            ? `<img src="${p.image}" alt="" />`
            : 'W';
          return `
            <tr>
              <td><div class="table-img">${imgHTML}</div></td>
              <td><strong>${esc(p.name)}</strong></td>
              <td>${col ? esc(col.name) : '—'}</td>
              <td>${p.price} TND</td>
              <td>${p.badge ? `<span class="badge badge-confirmed">${esc(p.badge)}</span>` : '—'}</td>
              <td>
                <button class="action-btn action-edit" onclick="openProductModal('${p.id}')">Modifier</button>
                <button class="action-btn action-delete" onclick="deleteProduct('${p.id}')">Supprimer</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function openProductModal(productId) {
  const modal = document.getElementById('productModalOverlay');
  document.getElementById('pmError').classList.add('hidden');
  document.getElementById('pmImagePreview').classList.add('hidden');
  document.getElementById('pmImagePreview').innerHTML = '';

  // Populate collection dropdown
  const colSelect = document.getElementById('pmCollection');
  colSelect.innerHTML = '<option value="">— Aucune —</option>' +
    collections.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

  if (productId) {
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    document.getElementById('productModalTitle').textContent = 'Modifier le produit';
    document.getElementById('pmId').value = p.id;
    document.getElementById('pmName').value = p.name;
    document.getElementById('pmPrice').value = p.price;
    document.getElementById('pmCollection').value = p.collection || '';
    document.getElementById('pmBadge').value = p.badge || '';
    document.getElementById('pmDesc').value = p.description || '';
    document.getElementById('pmImage').value = p.image || '';
    if (p.image) {
      document.getElementById('pmImagePreview').innerHTML = `<img src="${p.image}" alt="" />`;
      document.getElementById('pmImagePreview').classList.remove('hidden');
    }
  } else {
    document.getElementById('productModalTitle').textContent = 'Nouveau produit';
    document.getElementById('pmId').value = '';
    document.getElementById('pmName').value = '';
    document.getElementById('pmPrice').value = '';
    document.getElementById('pmCollection').value = '';
    document.getElementById('pmBadge').value = '';
    document.getElementById('pmDesc').value = '';
    document.getElementById('pmImage').value = '';
    document.getElementById('pmImageFile').value = '';
  }

  modal.classList.add('active');
}

function closeProductModal(e) {
  if (e && e.target !== document.getElementById('productModalOverlay')) return;
  closeProductModalDirect();
}
function closeProductModalDirect() {
  document.getElementById('productModalOverlay').classList.remove('active');
}

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    document.getElementById('pmImage').value = base64;
    const preview = document.getElementById('pmImagePreview');
    preview.innerHTML = `<img src="${base64}" alt="Aperçu" />`;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function saveProduct() {
  const id = document.getElementById('pmId').value;
  const name = document.getElementById('pmName').value.trim();
  const price = parseFloat(document.getElementById('pmPrice').value);
  const collection = document.getElementById('pmCollection').value;
  const badge = document.getElementById('pmBadge').value.trim();
  const description = document.getElementById('pmDesc').value.trim();
  const image = document.getElementById('pmImage').value;
  const errEl = document.getElementById('pmError');

  errEl.classList.add('hidden');
  if (!name) { showPmError('Le nom est obligatoire.'); return; }
  if (isNaN(price) || price < 0) { showPmError('Le prix est invalide.'); return; }

  const productData = {
    id: id || 'p' + Date.now(),
    name, price, collection, badge, description, image,
    createdAt: id ? (products.find(p => p.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
  };

  try {
    if (id) {
      products = products.map(p => p.id === id ? productData : p);
    } else {
      products = [...products, productData];
    }
    await apiWrite('products', products);
    closeProductModalDirect();
    renderProductsTable();
    updateOverview();
    showToast(id ? 'Produit mis à jour.' : 'Produit ajouté.');
  } catch (e) {
    showPmError('Erreur: ' + e.message);
    // Reload from source to restore state
    products = await apiRead('products');
    renderProductsTable();
  }
}

function showPmError(msg) {
  const el = document.getElementById('pmError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function deleteProduct(id) {
  if (!confirm('Supprimer ce produit ? Cette action est irréversible.')) return;
  try {
    products = products.filter(p => p.id !== id);
    await apiWrite('products', products);
    renderProductsTable();
    updateOverview();
    showToast('Produit supprimé.');
  } catch (e) {
    showToast('Erreur: ' + e.message, true);
    products = await apiRead('products');
    renderProductsTable();
  }
}

// ── COLLECTIONS ──
function renderCollectionsTable() {
  document.getElementById('collectionCount').textContent = `${collections.length} collection${collections.length !== 1 ? 's' : ''}`;
  const wrap = document.getElementById('collectionsTable');
  if (!wrap) return;

  if (!collections.length) {
    wrap.innerHTML = '<div class="table-empty">Aucune collection. Créez-en une !</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Nom</th>
        <th>Description</th>
        <th>Produits</th>
        <th>Actions</th>
      </tr></thead>
      <tbody>
        ${collections.map(c => {
          const count = products.filter(p => p.collection === c.id).length;
          return `
            <tr>
              <td><strong>${esc(c.name)}</strong></td>
              <td style="max-width:300px; color:var(--text-light); font-size:0.82rem">${esc(c.description)}</td>
              <td>${count}</td>
              <td>
                <button class="action-btn action-edit" onclick="openCollectionModal('${c.id}')">Modifier</button>
                <button class="action-btn action-delete" onclick="deleteCollection('${c.id}')">Supprimer</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function openCollectionModal(colId) {
  document.getElementById('cmError').classList.add('hidden');

  if (colId) {
    const col = collections.find(c => c.id === colId);
    if (!col) return;
    document.getElementById('collectionModalTitle').textContent = 'Modifier la collection';
    document.getElementById('cmId').value = col.id;
    document.getElementById('cmName').value = col.name;
    document.getElementById('cmDesc').value = col.description || '';
  } else {
    document.getElementById('collectionModalTitle').textContent = 'Nouvelle collection';
    document.getElementById('cmId').value = '';
    document.getElementById('cmName').value = '';
    document.getElementById('cmDesc').value = '';
  }

  document.getElementById('collectionModalOverlay').classList.add('active');
}

function closeCollectionModal(e) {
  if (e && e.target !== document.getElementById('collectionModalOverlay')) return;
  closeCollectionModalDirect();
}
function closeCollectionModalDirect() {
  document.getElementById('collectionModalOverlay').classList.remove('active');
}

async function saveCollection() {
  const id = document.getElementById('cmId').value;
  const name = document.getElementById('cmName').value.trim();
  const description = document.getElementById('cmDesc').value.trim();

  if (!name) {
    const el = document.getElementById('cmError');
    el.textContent = 'Le nom est obligatoire.';
    el.classList.remove('hidden');
    return;
  }

  const colData = {
    id: id || 'col' + Date.now(),
    name, description,
    createdAt: id ? (collections.find(c => c.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
  };

  try {
    if (id) {
      collections = collections.map(c => c.id === id ? colData : c);
    } else {
      collections = [...collections, colData];
    }
    await apiWrite('collections', collections);
    closeCollectionModalDirect();
    renderCollectionsTable();
    updateOverview();
    showToast(id ? 'Collection mise à jour.' : 'Collection créée.');
  } catch (e) {
    const el = document.getElementById('cmError');
    el.textContent = 'Erreur: ' + e.message;
    el.classList.remove('hidden');
    collections = await apiRead('collections');
    renderCollectionsTable();
  }
}

async function deleteCollection(id) {
  const count = products.filter(p => p.collection === id).length;
  const msg = count > 0
    ? `Cette collection contient ${count} produit(s). Supprimer quand même ?`
    : 'Supprimer cette collection ?';
  if (!confirm(msg)) return;

  try {
    collections = collections.filter(c => c.id !== id);
    await apiWrite('collections', collections);
    renderCollectionsTable();
    updateOverview();
    showToast('Collection supprimée.');
  } catch (e) {
    showToast('Erreur: ' + e.message, true);
    collections = await apiRead('collections');
    renderCollectionsTable();
  }
}

// ── ORDERS ──
function renderOrdersTable() {
  const sorted = [...orders].reverse();
  document.getElementById('orderCount').textContent = `${orders.length} commande${orders.length !== 1 ? 's' : ''}`;
  const wrap = document.getElementById('ordersTable');
  if (!wrap) return;

  if (!sorted.length) {
    wrap.innerHTML = '<div class="table-empty">Aucune commande pour le moment.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Référence</th>
        <th>Client</th>
        <th>Téléphone</th>
        <th>Articles</th>
        <th>Total</th>
        <th>Statut</th>
        <th>Date</th>
        <th>Actions</th>
      </tr></thead>
      <tbody>
        ${sorted.map(o => `
          <tr>
            <td style="font-family:monospace;font-size:0.72rem">${esc(o.id)}</td>
            <td>${esc(o.customer?.name || '—')}</td>
            <td>${esc(o.customer?.phone || '—')}</td>
            <td>${(o.items || []).length}</td>
            <td><strong>${o.total} ${o.currency || 'TND'}</strong></td>
            <td>${statusBadge(o.status)}</td>
            <td>${formatDate(o.createdAt)}</td>
            <td>
              <button class="action-btn action-status" onclick="openOrderStatus('${o.id}')">Statut</button>
              <button class="action-btn action-delete" onclick="deleteOrder('${o.id}')">Supprimer</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openOrderStatus(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  document.getElementById('osOrderId').value = orderId;
  document.getElementById('osStatus').value = order.status || 'pending';
  document.getElementById('orderStatusOverlay').classList.add('active');
}

function closeOrderStatus(e) {
  if (e && e.target !== document.getElementById('orderStatusOverlay')) return;
  closeOrderStatusDirect();
}
function closeOrderStatusDirect() {
  document.getElementById('orderStatusOverlay').classList.remove('active');
}

async function updateOrderStatus() {
  const id = document.getElementById('osOrderId').value;
  const status = document.getElementById('osStatus').value;
  try {
    orders = orders.map(o => o.id === id ? { ...o, status } : o);
    await apiWrite('orders', orders);
    closeOrderStatusDirect();
    renderOrdersTable();
    updateOverview();
    showToast('Statut mis à jour.');
  } catch (e) {
    showToast('Erreur: ' + e.message, true);
    orders = await apiRead('orders');
    renderOrdersTable();
  }
}

async function deleteOrder(id) {
  if (!confirm('Supprimer cette commande ?')) return;
  try {
    orders = orders.filter(o => o.id !== id);
    await apiWrite('orders', orders);
    renderOrdersTable();
    updateOverview();
    showToast('Commande supprimée.');
  } catch (e) {
    showToast('Erreur: ' + e.message, true);
    orders = await apiRead('orders');
    renderOrdersTable();
  }
}

function exportOrdersCSV() {
  if (!orders.length) { showToast('Aucune commande à exporter.', true); return; }

  const rows = [
    ['ID', 'Nom', 'Téléphone', 'Adresse', 'Total', 'Devise', 'Statut', 'Date', 'Notes'],
    ...orders.map(o => [
      o.id,
      o.customer?.name || '',
      o.customer?.phone || '',
      (o.customer?.address || '').replace(/\n/g, ' '),
      o.total,
      o.currency || 'TND',
      o.status,
      o.createdAt,
      (o.customer?.notes || '').replace(/\n/g, ' '),
    ]),
  ];

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wid-elle-commandes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export CSV téléchargé.');
}

function printOrders() {
  window.print();
}

// ── SETTINGS ──
function populateSettingsForm() {
  document.getElementById('setEmail').value = settings.storeEmail || '';
  document.getElementById('setCurrency').value = settings.currency || 'TND';
}

async function saveSettings() {
  const email = document.getElementById('setEmail').value.trim();
  const currency = document.getElementById('setCurrency').value;
  const newPass = document.getElementById('setNewPass').value;
  const msgEl = document.getElementById('settingsSaveMsg');

  msgEl.className = 'save-msg';
  msgEl.textContent = 'Sauvegarde…';
  msgEl.classList.remove('hidden');

  const updatedSettings = {
    ...settings,
    storeEmail: email,
    currency,
  };
  if (newPass) {
    updatedSettings.adminPassword = newPass;
  }

  try {
    await apiWrite('settings', updatedSettings);
    settings = updatedSettings;
    msgEl.textContent = 'Paramètres sauvegardés.';
    msgEl.className = 'save-msg success';
    document.getElementById('setNewPass').value = '';
    showToast('Paramètres enregistrés.');
  } catch (e) {
    msgEl.textContent = 'Erreur: ' + e.message;
    msgEl.className = 'save-msg error';
  }
}

// ── DEBUG ──
async function runDebug() {
  const output = document.getElementById('debugOutput');
  if (!output) return;
  output.textContent = 'Lancement du diagnostic…\n';

  try {
    const res = await fetch('/api/github-debug');
    const data = await res.json();

    let lines = [];
    lines.push(`<span class="debug-warn">═══ WID-ELLE DIAGNOSTIC ═══</span>`);
    lines.push(`Horodatage : ${data.timestamp}`);
    lines.push('');

    lines.push('<span class="debug-warn">── Variables d\'environnement ──</span>');
    for (const [k, v] of Object.entries(data.environment || {})) {
      const ok = !v.includes('MISSING');
      lines.push(`${ok ? '<span class="debug-ok">✓</span>' : '<span class="debug-err">✗</span>'} ${k}: ${v}`);
    }
    lines.push('');

    lines.push('<span class="debug-warn">── Token GitHub ──</span>');
    const tk = data.checks?.token;
    if (tk?.status === 'ok') {
      lines.push(`<span class="debug-ok">✓ Token valide — Connecté en tant que: ${tk.authenticatedAs}</span>`);
    } else {
      lines.push(`<span class="debug-err">✗ ${tk?.error || 'Erreur inconnue'}</span>`);
    }
    lines.push('');

    lines.push('<span class="debug-warn">── Dépôt GitHub ──</span>');
    const rp = data.checks?.repository;
    if (rp?.status === 'ok') {
      lines.push(`<span class="debug-ok">✓ ${rp.fullName} (${rp.private ? 'privé' : 'public'}, branche par défaut: ${rp.defaultBranch})</span>`);
    } else {
      lines.push(`<span class="debug-err">✗ ${rp?.error || 'Dépôt introuvable'}</span>`);
    }
    lines.push('');

    lines.push('<span class="debug-warn">── Fichiers de données ──</span>');
    for (const [file, info] of Object.entries(data.checks?.files || {})) {
      if (info.status === 'ok') {
        lines.push(`<span class="debug-ok">✓ data/${file}.json — ${info.count} entrée(s), SHA: ${info.sha?.slice(0,8)}</span>`);
      } else {
        lines.push(`<span class="debug-err">✗ data/${file}.json — ${info.error}</span>`);
      }
    }
    lines.push('');

    const overall = data.overall === 'healthy';
    lines.push(`<span class="${overall ? 'debug-ok' : 'debug-err'}">═══ ÉTAT GÉNÉRAL: ${overall ? 'SAIN ✓' : 'PROBLÈMES DÉTECTÉS ✗'} ═══</span>`);

    output.innerHTML = lines.join('\n');
  } catch (e) {
    output.innerHTML = `<span class="debug-err">Erreur de diagnostic: ${e.message}\n\nVérifiez que l'API /api/github-debug est bien déployée.</span>`;
  }
}

// ── UTILITIES ──
function statusBadge(status) {
  const labels = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    shipped: 'Expédiée',
    delivered: 'Livrée',
    cancelled: 'Annulée',
  };
  return `<span class="badge badge-${status || 'pending'}">${labels[status] || status || 'En attente'}</span>`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-TN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer;
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.background = isError ? '#c9484a' : '#1a1118';
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3500);
}
