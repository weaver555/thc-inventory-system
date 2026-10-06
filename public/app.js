/**
 * Client-side app logic for THC Inventory System.
 */

const state = {
  items: [],
  categories: [],
  units: []
};

const els = {
  navButtons: [...document.querySelectorAll('.nav-btn')],
  kpiGrid: document.getElementById('kpiGrid'),
  lowStockList: document.getElementById('lowStockList'),
  replenishmentList: document.getElementById('replenishmentList'),
  recentActivityList: document.getElementById('recentActivityList'),
  itemsTableBody: document.getElementById('itemsTableBody'),
  productionList: document.getElementById('productionList'),
  stockList: document.getElementById('stockList'),
  nightList: document.getElementById('nightList'),
  dailyReportList: document.getElementById('dailyReportList'),
  productionReportList: document.getElementById('productionReportList'),
  dashboardDate: document.getElementById('dashboardDate'),
  reportDate: document.getElementById('reportDate'),
  itemForm: document.getElementById('itemForm'),
  itemId: document.getElementById('itemId'),
  itemName: document.getElementById('itemName'),
  itemCategory: document.getElementById('itemCategory'),
  itemUnit: document.getElementById('itemUnit'),
  itemReorder: document.getElementById('itemReorder'),
  itemCritical: document.getElementById('itemCritical'),
  itemTarget: document.getElementById('itemTarget'),
  itemActive: document.getElementById('itemActive'),
  itemNotes: document.getElementById('itemNotes'),
  productionForm: document.getElementById('productionForm'),
  productionDate: document.getElementById('productionDate'),
  productionItem: document.getElementById('productionItem'),
  productionQty: document.getElementById('productionQty'),
  productionUnit: document.getElementById('productionUnit'),
  productionNotes: document.getElementById('productionNotes'),
  stockForm: document.getElementById('stockForm'),
  stockDate: document.getElementById('stockDate'),
  stockItem: document.getElementById('stockItem'),
  stockQty: document.getElementById('stockQty'),
  stockUnit: document.getElementById('stockUnit'),
  stockSource: document.getElementById('stockSource'),
  stockReference: document.getElementById('stockReference'),
  stockNotes: document.getElementById('stockNotes'),
  nightDate: document.getElementById('nightDate'),
  nightItem: document.getElementById('nightItem'),
  nightBeginning: document.getElementById('nightBeginning'),
  nightProduction: document.getElementById('nightProduction'),
  nightStocksIn: document.getElementById('nightStocksIn'),
  nightEnding: document.getElementById('nightEnding'),
  nightNotes: document.getElementById('nightNotes')
};

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  els.dashboardDate.value = today;
  els.reportDate.value = today;
  els.productionDate.value = today;
  els.stockDate.value = today;
  els.nightDate.value = today;
}

function showView(name) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.id === name);
  });
  els.navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

async function loadReferenceData() {
  const [categories, units, items] = await Promise.all([
    fetchJson('/api/categories'),
    fetchJson('/api/units'),
    fetchJson('/api/items')
  ]);

  state.categories = categories;
  state.units = units;
  state.items = items;

  populateSelect(els.itemCategory, categories, 'id', 'name');
  populateSelect(els.itemUnit, units, 'id', 'name');
  populateSelect(els.productionItem, items.filter((i) => i.active), 'id', 'name');
  populateSelect(els.stockItem, items.filter((i) => i.active), 'id', 'name');
  populateSelect(els.nightItem, items.filter((i) => i.active), 'id', 'name');

  renderInventoryTable();
}

function populateSelect(select, collection, valueKey, labelKey) {
  select.innerHTML = collection
    .map((entry) => `<option value="${entry[valueKey]}">${entry[labelKey]}</option>`)
    .join('');
}

function renderInventoryTable() {
  els.itemsTableBody.innerHTML = state.items.map((item) => `
    <tr>
      <td>${item.name}</td>
      <td>${item.category_name || '-'}</td>
      <td>${item.unit_name || '-'}</td>
      <td>${item.reorder_level ?? 0}</td>
      <td>${item.critical_level ?? 0}</td>
      <td>${item.target_stock ?? 0}</td>
      <td>${item.active ? 'YES' : 'NO'}</td>
      <td>
        <button class="tiny-btn" data-action="edit" data-id="${item.id}">Edit</button>
        <button class="tiny-btn" data-action="history" data-id="${item.id}">History</button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => populateItemForm(btn.dataset.id));
  });

  document.querySelectorAll('[data-action="history"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const history = await fetchJson(`/api/item-history/${btn.dataset.id}`);
      const lines = history.history.map((row) => `
        <div class="list-card">
          <strong>${row.operating_date}</strong>
          <div>Type: ${row.transaction_type}</div>
          <div>Qty: ${row.quantity} ${row.unit_name || ''}</div>
          <div>Source: ${row.source || ''}</div>
          <div>Notes: ${row.notes || ''}</div>
        </div>
      `).join('') || '<p>No history found.</p>';
      alert(`${history.item.name}\n${lines}`);
    });
  });
}

function populateItemForm(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;

  els.itemId.value = item.id;
  els.itemName.value = item.name;
  els.itemCategory.value = item.category_id;
  els.itemUnit.value = item.unit_id;
  els.itemReorder.value = item.reorder_level ?? 0;
  els.itemCritical.value = item.critical_level ?? 0;
  els.itemTarget.value = item.target_stock ?? 0;
  els.itemActive.value = item.active ? '1' : '0';
  els.itemNotes.value = item.notes || '';
  showView('inventory');
}

async function renderDashboard() {
  const date = els.dashboardDate.value;
  const data = await fetchJson(`/api/dashboard?date=${date}`);

  els.kpiGrid.innerHTML = `
    <div class="kpi-card"><h3>Total Inventory Items</h3><strong>${data.totalItems}</strong></div>
    <div class="kpi-card"><h3>Out of Stock</h3><strong>${data.outOfStock}</strong></div>
    <div class="kpi-card"><h3>Critical Low</h3><strong>${data.criticalLow}</strong></div>
    <div class="kpi-card"><h3>Low Stock</h3><strong>${data.lowStock}</strong></div>
    <div class="kpi-card"><h3>Total Production Today</h3><strong>${data.totalProductionToday}</strong></div>
    <div class="kpi-card"><h3>Total Stocks In Today</h3><strong>${data.totalStocksInToday}</strong></div>
    <div class="kpi-card"><h3>Total Actual Usage Today</h3><strong>${data.totalActualUsageToday}</strong></div>
    <div class="kpi-card"><h3>Replenishment Needed</h3><strong>${data.itemsRequiringReplenishment}</strong></div>
  `;

  els.lowStockList.innerHTML = (data.lowStockItems || []).map((item) => `
    <div class="list-card">
      <strong>${item.name}</strong>
      <div>${item.quantity} ${item.unit}</div>
      <div>${item.status}</div>
    </div>
  `).join('') || '<p>No low stock items.</p>';

  els.replenishmentList.innerHTML = (data.replenishmentItems || []).map((item) => `
    <div class="list-card">
      <strong>${item.name}</strong>
      <div>Replenish: ${item.replenishment} ${item.unit}</div>
      <div>${item.status}</div>
    </div>
  `).join('') || '<p>No replenishment needed.</p>';

  els.recentActivityList.innerHTML = (data.recentActivity || []).map((row) => `
    <div class="list-card">
      <strong>${row.item_name}</strong>
      <div>${row.type} • ${row.quantity} ${row.unit_name || ''}</div>
      <div>Source: ${row.source || ''}</div>
    </div>
  `).join('') || '<p>No recent activity.</p>';
}

async function renderProductionList() {
  const date = els.productionDate.value;
  const rows = await fetchJson(`/api/production?date=${date}`);
  els.productionList.innerHTML = rows.map((row) => `
    <div class="list-card">
      <strong>${row.item_name}</strong>
      <div>${row.quantity} ${row.unit_name || ''}</div>
      <div>Source: ${row.source}</div>
      <div>${row.notes || ''}</div>
    </div>
  `).join('') || '<p>No production recorded.</p>';
}

async function renderStockList() {
  const date = els.stockDate.value;
  const rows = await fetchJson(`/api/stocks-in?date=${date}`);
  els.stockList.innerHTML = rows.map((row) => `
    <div class="list-card">
      <strong>${row.item_name}</strong>
      <div>${row.quantity} ${row.unit_name || ''}</div>
      <div>Source: ${row.source}</div>
      <div>${row.reference || ''}</div>
    </div>
  `).join('') || '<p>No stock in records.</p>';
}

async function renderNightList() {
  const date = els.nightDate.value;
  const rows = await fetchJson(`/api/reports/night?date=${date}`);
  els.nightList.innerHTML = rows.map((row) => `
    <div class="list-card">
      <strong>${row.item_name}</strong>
      <div>Beginning: ${row.beginning}</div>
      <div>Production: ${row.production}</div>
      <div>Stocks In: ${row.stocksIn}</div>
      <div>Total Available: ${row.totalAvailable}</div>
      <div>Ending: ${row.quantity}</div>
      <div>Actual Usage: ${row.actualUsage}</div>
      <div>Status: ${row.status}</div>
    </div>
  `).join('') || '<p>No physical counts entered.</p>';
}

async function renderReports() {
  const date = els.reportDate.value;
  const [dailyRows, productionRows] = await Promise.all([
    fetchJson(`/api/reports/daily?date=${date}`),
    fetchJson(`/api/reports/production?date=${date}`)
  ]);

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
      <div>Replenishment: ${row.suggestedReplenishment}</div>
    </div>
  `).join('') || '<p>No daily inventory data.</p>';

  els.productionReportList.innerHTML = productionRows.map((row) => `
    <div class="list-card">
      <strong>${row.item_name}</strong>
      <div>${row.quantity} ${row.unit_name || ''}</div>
      <div>Source: ${row.source}</div>
    </div>
  `).join('') || '<p>No production report.</p>';
}

async function populateNightSummary() {
  const itemId = els.nightItem.value;
  if (!itemId) {
    els.nightBeginning.value = '';
    els.nightProduction.value = '';
    els.nightStocksIn.value = '';
    return;
  }

  const date = els.nightDate.value;
  const rows = await fetchJson(`/api/reports/daily?date=${date}`);
  const summary = rows.find((row) => row.itemId === itemId) || { beginning: 0, production: 0, stocksIn: 0 };
  els.nightBeginning.value = summary.formattedBeginning || 0;
  els.nightProduction.value = summary.formattedProduction || 0;
  els.nightStocksIn.value = summary.formattedStocksIn || 0;
}

async function refreshEverything() {
  await loadReferenceData();
  await renderDashboard();
  await renderProductionList();
  await renderStockList();
  await renderNightList();
  await renderReports();
  await populateNightSummary();
}

els.navButtons.forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

document.getElementById('demoBtn').addEventListener('click', async () => {
  const firstItem = state.items[0];
  if (!firstItem) return;
  const date = new Date().toISOString().slice(0, 10);
  try {
    await fetchJson('/api/production', {
      method: 'POST',
      body: JSON.stringify({ item_id: firstItem.id, date, quantity: '20', notes: 'Demo transaction' })
    });
    alert('Demo production entry created.');
    await refreshEverything();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById('exportBtn').addEventListener('click', () => {
  window.location.href = '/api/export/items';
});

document.getElementById('cancelEdit').addEventListener('click', () => {
  els.itemForm.reset();
  els.itemId.value = '';
});

document.getElementById('addItemBtn').addEventListener('click', () => {
  els.itemForm.reset();
  els.itemId.value = '';
  showView('inventory');
});

els.itemForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    name: els.itemName.value,
    category_id: els.itemCategory.value,
    unit_id: els.itemUnit.value,
    reorder_level: els.itemReorder.value,
    critical_level: els.itemCritical.value,
    target_stock: els.itemTarget.value,
    active: els.itemActive.value === '1',
    notes: els.itemNotes.value
  };

  try {
    if (els.itemId.value) {
      await fetchJson(`/api/items/${els.itemId.value}`, {
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
    await refreshEverything();
  } catch (error) {
    alert(error.message);
  }
});

els.productionForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    await fetchJson('/api/production', {
      method: 'POST',
      body: JSON.stringify({
        item_id: els.productionItem.value,
        date: els.productionDate.value,
        quantity: els.productionQty.value,
        notes: els.productionNotes.value
      })
    });
    els.productionForm.reset();
    await refreshEverything();
  } catch (error) {
    alert(error.message);
  }
});

els.stockForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    await fetchJson('/api/stocks-in', {
      method: 'POST',
      body: JSON.stringify({
        item_id: els.stockItem.value,
        date: els.stockDate.value,
        quantity: els.stockQty.value,
        source: els.stockSource.value,
        reference: els.stockReference.value,
        notes: els.stockNotes.value
      })
    });
    els.stockForm.reset();
    els.stockSource.value = 'PURCHASE';
    await refreshEverything();
  } catch (error) {
    alert(error.message);
  }
});

els.nightForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    await fetchJson('/api/physical-counts', {
      method: 'POST',
      body: JSON.stringify({
        item_id: els.nightItem.value,
        date: els.nightDate.value,
        quantity: els.nightEnding.value,
        notes: els.nightNotes.value,
        shift: 'NIGHT'
      })
    });
    els.nightForm.reset();
    await refreshEverything();
  } catch (error) {
    alert(error.message);
  }
});

els.dashboardDate.addEventListener('change', renderDashboard);
els.reportDate.addEventListener('change', renderReports);
els.productionDate.addEventListener('change', renderProductionList);
els.stockDate.addEventListener('change', renderStockList);
els.nightDate.addEventListener('change', populateNightSummary);
els.nightItem.addEventListener('change', populateNightSummary);

document.querySelectorAll('.fraction-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const val = button.dataset.value;
    const current = els.productionQty.value ? `${els.productionQty.value} ` : '';
    els.productionQty.value = `${current}${val}`.trim();
  });
});

setDefaultDates();
showView('dashboard');
refreshEverything();
