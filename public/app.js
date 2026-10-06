* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f5f5f5;
  color: #1f2937;
}
button, input, select, textarea {
  font: inherit;
}
.app-shell {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #111827;
  color: white;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 16px;
}
.eyebrow {
  font-size: 12px;
  letter-spacing: 0.14em;
  opacity: 0.8;
}
h1, h2, h3, p {
  margin-top: 0;
}
.nav-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.nav-btn, .primary-btn, .ghost-btn, .fraction-btn {
  border: none;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
}
.nav-btn {
  background: #dbeafe;
  color: #1d4ed8;
  flex: 1 1 auto;
  min-width: 120px;
}
.nav-btn.active {
  background: #1d4ed8;
  color: white;
}
.primary-btn {
  background: #16a34a;
  color: white;
}
.ghost-btn {
  background: #e5e7eb;
  color: #111827;
}
.fraction-btn {
  background: #fef3c7;
  color: #92400e;
  min-width: 60px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}
.view {
  display: none;
}
.view.active {
  display: block;
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.kpi-card, .panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05);
  padding: 16px;
}
.kpi-card {
  border-left: 6px solid #1d4ed8;
}
.kpi-card h3 {
  margin-bottom: 8px;
  color: #4b5563;
  font-size: 13px;
}
.kpi-card strong {
  font-size: 28px;
}
.two-column {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
form {
  width: 100%;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 600;
}
input, select, textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #fff;
}
textarea {
  min-height: 80px;
  resize: vertical;
}
.full-span {
  grid-column: 1 / -1;
}
.action-row {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}
th, td {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}
th {
  font-size: 12px;
  text-transform: uppercase;
  color: #6b7280;
}
.item-action {
  color: #2563eb;
  cursor: pointer;
  display: inline-block;
  margin-right: 8px;
}
.fraction-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.list-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  margin-top: 8px;
  background: #fafafa;
}
.status-tag {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: #dcfce7;
  color: #166534;
}
.status-tag.warning {
  background: #fef3c7;
  color: #92400e;
}
.status-tag.danger {
  background: #fee2e2;
  color: #991b1b;
}
@media (max-width: 700px) {
  .topbar, .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .nav-btn {
    flex: 1 1 calc(50% - 8px);
  }
  .app-shell {
    padding: 12px;
  }
}
