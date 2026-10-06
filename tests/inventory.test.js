const state = {
  items: [],
  dashboardDate: new Date().toISOString().slice(0, 10),
  reportDate: new Date().toISOString().slice(0, 10)
};

const els = {
  navButtons: [...document.querySelectorAll('.nav-btn')],
  dashboardDate: document.getElementById('dashboardDate'),
  reportDate: document.getElementById('reportDate'),
  itemForm: document.getElementById('itemForm'),
  itemsTableBody: document.getElementById('itemsTableBody'),
  productionForm: document.getElementById('productionForm'),
  productionDate: document.getElementById('productionDate'),
  productionItem: document.getElementById('productionItem'),
  productionQty: document.getElementById('productionQty'),
  productionUnit: document.getElementById('productionUnit'),
  productionNotes: document.getElementById('productionNotes'),
  productionList: document.getElementById('productionList'),
  stockInForm: document.getElementById('stocksInForm'),
  stockDate: document.getElementById('stockDate'),
  stockItem: document.getElementById('stockItem'),
  stockQuantity: document.getElementById('stockQuantity'),
  stockUnit: document.getElementById('stockUnit'),
  stockSource: document.getElementById('stockSource'),
  stockReference: document.getElementById('stockReference'),
  stockNotes: document.getElementById('stockNotes'),
  stockList: document.getElementById('stockList'),
  nightForm: document.getElementById('nightForm'),
  nightDate: document.getElementById('nightDate'),
  nightItem: document.getElementById('nightItem'),
  nightBeginning: document.getElementById('nightBeginning'),
  nightProduction: document.getElementById('nightProduction'),
  nightStocksIn: document.getElementById('nightStocksIn'),
  nightEnding: document.getElementById('nightEnding'),
  nightNotes: document.getElementById('nightNotes'),
  nightList: document.getElementById('nightList'),
  dashboardKpis: document.getElementById('dashboardKpis'),
  lowStockList: document.getElementById('lowStockList'),
  replenishmentList: document.getElementById('replenishmentList'),
  recentActivityList: document.getElementById('recentActivityList'),
  dailyReportList: document.getElementById('dailyReportList'),
  productionReportList: document.getElementById('productionReportList'),
  itemId: document.getElementById('itemId'),
  itemName: document.getElementById('itemName'),
  itemCategory: document.getElementById('itemCategory'),
  itemUnit: document.getElementById('itemUnit'),
  itemReorder: document.getElementById('itemReorder'),
  itemCritical: document.getElementById('itemCritical'),
  itemTarget: document.getElementById('itemTarget'),
  itemActive: document.getElementById('itemActive'),
  itemNotes: document.getElementById('itemNotes')
};

function setTodayDefaults() {
  const today = new Date().toISOString().slice(0, 10);
  els.dashboardDate.value = today;
  els.reportDate.value = today;
  els.productionDate.value = today;
  els.stockDate.value = today;
  els.nightDate.value = today;
  state.dashboardDate = today;
  state.reportDate = today;
}

function showView(viewName) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === viewName));
  els.navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewName));
}

function renderItemSelects() {
  const options = state.items.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
  els.productionItem.innerHTML = options;
  els.stockItem.innerHTML = options;
  els.nightItem.innerHTML = options;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

function attachNavHandlers() {
  els.navButtons.forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
}

async function loadItems() {
  const items = await fetchJson('/api/items');
  state.items = items;
  renderItemSelects();
  renderInventoryTable();
}

function renderInventoryTable() {
  els.itemsTableBody.innerHTML = state.items.map((item) => `
    <tr>
      <td>${item.name}</td>
      <td>${item.category || '-'}</td>
      <td>${item.unit || 'pcs'}</td>
      <td>${item.reorder_level ?? 0}</td>
      <td>${item.critical_level ?? 0}</td>
      <td>${item.target_stock ?? 0}</td>
      <td>${item.active ? 'YES' : 'NO'}</td>
      <td>
        <span class="item-action" data-id="${item.id}" data-action="edit">Edit</span>
        <span class="item-action" data-id="${item.id}" data-action="history">History</span>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.item-action').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      const action = button.dataset.action;
      if (action === 'edit') {
        const item = state.items.find((entry) => entry.id === id);
        if (!item) return;
        els.itemId.value = item.id;
        els.itemName.value = item.name;
        els.itemCategory.value = item.category || '';
        els.itemUnit.value = item.unit || 'pcs';
        els.itemReorder.value = item.reorder_level ?? 0;
        els.itemCritical.value = item.critical_level ?? 0;
        els.itemTarget.value = item.target_stock ?? 0;
        els.itemActive.value = item.active ? '1' : '0';
        els.itemNotes.value = item.notes || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (action === 'history') {
        const history = await fetchJson(`/api/item-history/${id}`);
        const rows = history.history.map((row) => `
          <div class="list-card">
            <strong>${row.operating_date}</strong>
            <div>Type: ${row.transaction_type}</div>
            <div>Qty: ${row.quantity} ${row.unit || ''}</div>
            <div>Source: ${row.source || ''}</div>
            <div>Notes: ${row.notes || ''}</div>
          </div>
        `).join('') || '<p>No history found.</p>';
        alert(`${history.item.name}\n\n${rows}`);
      }
    });
  });
}

async function renderDashboard() {
  const date = els.dashboardDate.value || state.dashboardDate;
  const data = await fetchJson(`/api/dashboard?date=${date}`);
  els.dashboardKpis.innerHTML = `
    <div class="kpi-card"><h3>Total Inventory Items</h3><strong>${data.totalItems}</strong></div>
    <div class="kpi-card"><h3>Out of Stock</h3><strong>${data.outOfStock}</strong></div>
    <div class="kpi-card"><h3>Critical Low</h3><strong>${data.criticalLow}</strong></div>
    <div class="kpi-card"><h3>Low Stock</h3><strong>${data.lowStock}</strong></div>
    <div class="kpi-card"><h3>Total Production Today</h3><strong>${data.totalProductionToday}</strong></div>
    <div class="kpi-card"><h3>Total Stocks In Today</h3><strong>${data.totalStocksInToday}</strong></div>
    <div class="kpi-card"><h3>Total Actual Usage Today</h3><strong>${data.totalActualUsageToday}</strong></div>
    <div class="kpi-card"><h3>Items Requiring Replenishment</h3><strong>${data.itemsRequiringReplenishment}</strong></div>
  `;

  els.lowStockList.innerHTML = (data.lowStockItems || []).map((item) => `
    <div class="list-card">
      <strong>${item.name}</strong>
      <div>${item.quantity} ${item.unit}</div>
      <span class="status-tag ${item.status === 'OK' ? '' : item.status.includes('CRITICAL') || item.status.includes('OUT') ? 'danger' : 'warning'}">${item.status}</span>
    </div>
  `).join('') || '<p>No low stock items.</p>';

  els.replenishmentList.innerHTML = (data.replenishment || []).map((item) => `
    <div class="list-card">
      <strong>${item.name}</strong>
      <div>Replenish: ${item.recommended} ${item.unit}</div>
      <div>${item.action}</div>
    </div>
  `).join('') || '<p>No replenishment required.</p>';

  els.recentActivityList.innerHTML = (data.recentActivity || []).map((row) => `
    <div class="list-card">
      <strong>${row.item_name}</strong>
      <div>${row.type} • ${row.quantity} ${row.unit || ''} • ${row.source || ''}</div>
    </div>
  `).join('') || '<p>No recent activity.</p>';
}

async function renderProductionList() {
  const date = els.productionDate.value || new Date().toISOString().slice(0, 10);
  const rows = await fetchJson(`/api/production?date=${date}`);
  els.productionList.innerHTML = rows.map((row) => `
    <div class="list-card">
      <strong>${row.item_name}</strong>
      <div>${row.quantity} ${row.unit || ''}</div>
      <div>Source: ${row.source}</div>
      <div>${row.notes || ''}</div>
    </div>
  `).join('') || '<p>No production yet.</p>';
}

async function renderStockList() {
  const date = els.stockDate.value || new Date().toISOString().slice(0, 10);
  const rows = await fetchJson(`/api/stocks-in?date=${date}`);
  els.stockList.innerHTML = rows.map((row) => `
    <div class="list-card">
      <strong>${row.item_name}</strong>
      <div>${row.quantity} ${row.unit || ''}</div>
      <div>Source: ${row.source}</div>
      <div>${row.reference || ''}</div>
    </div>
  `).join('') || '<p>No stock in records yet.</p>';
}

async function renderNightList() {
  const date = els.nightDate.value || new Date().toISOString().slice(0, 10);
  const rows = await fetchJson(`/api/reports/night?date=${date}`);
  els.nightList.innerHTML = rows.map((row) => `
    <div class="list-card">
      <strong>${row.item_name}</strong>
      <div>Beginning: ${row.beginning}</div>
      <div>Production: ${row.production}</div>
      <div>Stocks In: ${row.stocksIn}</div>
      <div>Available: ${row.totalAvailable}</div>
      <div>Ending: ${row.quantity}</div>
      <div>Actual Usage: ${row.actualUsage}</div>
      <span class="status-tag ${row.status.includes('CHECK') || row.status.includes('OUT') ? 'danger' : row.status.includes('LOW') || row.status.includes('CRITICAL') ? 'warning' : ''}">${row.status}</span>
    </div>
  `).join('') || '<p>No physical counts yet.</p>';
}

async function renderReports() {
  const date = els.reportDate.value || state.reportDate;
  const dailyRows = await fetchJson(`/api/reports/daily?date=${date}`);
  els.dailyReportList.innerHTML = dailyRows.map((row) => `
    <div class="list-card">
      <strong>${row.itemName}</strong>
      <div>Beginning: ${row.beginning}</div>
      <div>Production: ${row.production}</div>
      <div>Stocks In: ${row.stocksIn}</div>
      <div>Available: ${row.totalAvailable}</div>
      <div>Ending: ${row.physicalEnding}</div>
      <div>Actual Usage: ${row.actualUsage}</div>
      <div>Status: ${row.status}</div>
      <div>Replenishment: ${row.recommendedReplenishment}</div>
    </div>
  `).join('') || '<p>No daily report.</p>';

  const productionRows = await fetchJson(`/api/reports/production?date=${date}`);
  els.productionReportList.innerHTML = productionRows.map((row) => `
    <div class="list-card">
      <strong>${row.item_name}</strong>
      <div>${row.quantity} ${row.unit || ''}</div>
      <div>Source: ${row.source}</div>
    </div>
  `).join('') || '<p>No production report.</p>';
}

async function handleItemSubmit(event) {
  event.preventDefault();
  const payload = {
    id: els.itemId.value,
    name: els.itemName.value,
    category: els.itemCategory.value,
    unit: els.itemUnit.value,
    reorder_level: Number(els.itemReorder.value || 0),
    critical_level: Number(els.itemCritical.value || 0),
    target_stock: Number(els.itemTarget.value || 0),
    active: els.itemActive.value === '1',
    notes: els.itemNotes.value
  };

  if (!payload.name) {
    alert('Item name is required.');
    return;
  }

  try {
    if (payload.id) {
      await fetchJson(`/api/items/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson('/api/items', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    els.itemForm.reset();
    els.itemId.value = '';
    await loadItems();
    await renderDashboard();
    await renderReports();
  } catch (error) {
    alert(error.message);
  }
}

async function handleProductionSubmit(event) {
  event.preventDefault();
  const payload = {
    item_id: els.productionItem.value,
    date: els.productionDate.value,
    quantity: els.productionQty.value,
    unit: els.productionUnit.value,
    notes: els.productionNotes.value
  };

  try {
    await fetchJson('/api/production', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    els.productionForm.reset();
    await renderProductionList();
    await renderDashboard();
    await renderReports();
  } catch (error) {
    alert(error.message);
  }
}

async function handleStockSubmit(event) {
  event.preventDefault();
  const payload = {
    item_id: els.stockItem.value,
    date: els.stockDate.value,
    quantity: els.stockQuantity.value,
    unit: els.stockUnit.value,
    source: els.stockSource.value,
    reference: els.stockReference.value,
    notes: els.stockNotes.value
  };

  try {
    await fetchJson('/api/stocks-in', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    els.stockInForm.reset();
    await renderStockList();
    await renderDashboard();
    await renderReports();
  } catch (error) {
    alert(error.message);
  }
}

async function handleNightSubmit(event) {
  event.preventDefault();
  const payload = {
    item_id: els.nightItem.value,
    date: els.nightDate.value,
    quantity: els.nightEnding.value,
    notes: els.nightNotes.value,
    shift: 'NIGHT'
  };

  try {
    await fetchJson('/api/physical-counts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    els.nightForm.reset();
    await renderNightList();
    await renderDashboard();
    await renderReports();
  } catch (error) {
    alert(error.message);
  }
}

async function populateNightFields() {
  const itemId = els.nightItem.value;
  if (!itemId) return;
  const date = els.nightDate.value;
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;

  const summary = await fetchJson(`/api/reports/daily?date=${date}`)
    .then((rows) => rows.find((row) => row.itemId === itemId) || { beginning: 0, production: 0, stocksIn: 0, totalAvailable: 0 });

  els.nightBeginning.value = summary.beginning ?? 0;
  els.nightProduction.value = summary.production ?? 0;
  els.nightStocksIn.value = summary.stocksIn ?? 0;
}

function attachFormHandlers() {
  els.itemForm.addEventListener('submit', handleItemSubmit);
  els.productionForm.addEventListener('submit', handleProductionSubmit);
  els.stockInForm.addEventListener('submit', handleStockSubmit);
  els.nightForm.addEventListener('submit', handleNightSubmit);
  document.getElementById('showAddItem').addEventListener('click', () => {
    els.itemForm.reset();
    els.itemId.value = '';
    els.itemName.focus();
  });
  document.getElementById('cancelItemEdit').addEventListener('click', () => {
    els.itemForm.reset();
    els.itemId.value = '';
  });
  document.querySelectorAll('.fraction-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const current = els.productionQty.value ? `${els.productionQty.value} ` : '';
      els.productionQty.value = `${current}${button.dataset.value}`.trim();
      els.productionQty.focus();
    });
  });
  els.dashboardDate.addEventListener('change', renderDashboard);
  els.reportDate.addEventListener('change', renderReports);
  els.nightDate.addEventListener('change', populateNightFields);
  els.nightItem.addEventListener('change', populateNightFields);
}

async function init() {
  setTodayDefaults();
  attachNavHandlers();
  attachFormHandlers();
  await loadItems();
  await renderDashboard();
  await renderProductionList();
  await renderStockList();
  await renderNightList();
  await renderReports();
  populateNightFields();
}

init();

document.getElementById('demoBtn').addEventListener('click', async () => {
  const payload = {
    item_id: state.items[0]?.id,
    date: new Date().toISOString().slice(0, 10),
    quantity: '40',
    unit: 'pcs',
    notes: 'Demo transaction'
  };

  try {
    await fetchJson('/api/production', { method: 'POST', body: JSON.stringify(payload) });
    alert('Demo production entry created.');
    await renderDashboard();
    await renderProductionList();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  window.location.href = '/api/export/items';
});
