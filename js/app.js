const PAGES = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '⊞',  file: 'dashboard.html'   },
  { id: 'report',      label: 'Report',      icon: '📊', file: 'report.html'      },
  { id: 'product',     label: 'Product',     icon: '📦', file: 'product.html'     },
  { id: 'transaction', label: 'Transaction', icon: '💳', file: 'transaction.html' },
];

const ADV_COLORS = { adv1:'#4361EE', adv2:'#7B2FBE', adv3:'#06C270', adv4:'#FFB703', spv:'#EF233C' };

// ── Theme ─────────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  return saved;
}

function toggleDarkMode() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

// ── Layout ────────────────────────────────────────────────────────────────────
function renderLayout(activePage, user) {
  const theme = initTheme();
  const color = ADV_COLORS[user.id] || '#4361EE';

  document.getElementById('sidebar-slot').innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">M</div>
        <span class="logo-text">MarketDash</span>
      </div>
      <div class="sidebar-label">MENU</div>
      <nav class="sidebar-nav">
        ${PAGES.map(p => `
          <a href="${p.file}" class="nav-item ${activePage === p.id ? 'active' : ''}">
            <span class="nav-icon">${p.icon}</span>
            <span>${p.label}</span>
          </a>
        `).join('')}
      </nav>
      <div style="margin-top:auto">
        <button class="import-btn" onclick="openUploadModal()">
          <span>📥</span> Import Data Excel
        </button>
        <div class="sidebar-bottom">
          <div class="user-card">
            <div class="user-avatar" style="background:${color}">${user.avatar}</div>
            <div class="user-info">
              <div class="user-name">${user.name}</div>
              <div class="user-role">${user.title}</div>
            </div>
            <button class="logout-btn" onclick="logout()" title="Logout">⏻</button>
          </div>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>
  `;

  document.getElementById('header-slot').innerHTML = `
    <header class="topbar">
      <button class="hamburger" onclick="openSidebar()">☰</button>
      <div class="topbar-title">
        <h1>${PAGES.find(p => p.id === activePage)?.label || ''}</h1>
        <p class="topbar-date">${formatDate(new Date())}</p>
      </div>
      <div class="topbar-right">
        <div class="search-wrap">
          <span style="color:var(--text-3)">🔍</span>
          <input type="text" placeholder="Cari..." class="topbar-search">
        </div>
        <div class="divider-v"></div>
        <button class="theme-toggle" id="themeToggle" onclick="toggleDarkMode()" title="Toggle dark mode">
          ${theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button class="icon-btn notif-btn" title="Notifikasi">🔔<span class="notif-dot"></span></button>
        <div class="divider-v"></div>
        <div class="topbar-user">
          <div class="user-avatar sm" style="background:${color}">${user.avatar}</div>
          <div>
            <div class="topbar-name">${user.name}</div>
            <div class="topbar-role">${user.title}</div>
          </div>
        </div>
      </div>
    </header>
  `;
}

function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

// ── Date Filter ───────────────────────────────────────────────────────────────
// Default range: covers all mock data
const DATA_MIN_DATE = '2024-01-01';
const DATA_MAX_DATE = '2024-07-31';

window._dateFilter = { from: DATA_MIN_DATE, to: DATA_MAX_DATE, preset: 'all' };

function renderDateFilter(containerId, onChangeCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="date-filter-bar">
      <div style="font-size:.78rem;font-weight:700;color:var(--text-3);white-space:nowrap">📅 Periode:</div>
      <div class="date-presets">
        <button class="date-preset ${window._dateFilter.preset === 'all'    ? 'active' : ''}" onclick="setPreset('all',    '${onChangeCallback}')">Semua</button>
        <button class="date-preset ${window._dateFilter.preset === 'thismonth' ? 'active' : ''}" onclick="setPreset('thismonth','${onChangeCallback}')">Bln Ini</button>
        <button class="date-preset ${window._dateFilter.preset === 'last3'   ? 'active' : ''}" onclick="setPreset('last3',   '${onChangeCallback}')">3 Bulan</button>
        <button class="date-preset ${window._dateFilter.preset === 'firsthalf'? 'active' : ''}" onclick="setPreset('firsthalf','${onChangeCallback}')">H1 2024</button>
      </div>
      <div class="date-range-wrap">
        <input type="date" class="date-input" id="dateFrom" value="${window._dateFilter.from}"
          min="${DATA_MIN_DATE}" max="${DATA_MAX_DATE}"
          onchange="customDate('${onChangeCallback}')">
        <span>—</span>
        <input type="date" class="date-input" id="dateTo" value="${window._dateFilter.to}"
          min="${DATA_MIN_DATE}" max="${DATA_MAX_DATE}"
          onchange="customDate('${onChangeCallback}')">
      </div>
    </div>
  `;
}

function setPreset(preset, cb) {
  const presets = {
    all:       { from: '2024-01-01', to: '2024-07-31' },
    thismonth: { from: '2024-07-01', to: '2024-07-31' },
    last3:     { from: '2024-05-01', to: '2024-07-31' },
    firsthalf: { from: '2024-01-01', to: '2024-06-30' },
  };
  const range = presets[preset];
  if (!range) return;
  window._dateFilter = { ...range, preset };
  document.getElementById('dateFrom').value = range.from;
  document.getElementById('dateTo').value   = range.to;

  document.querySelectorAll('.date-preset').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  if (cb && window[cb]) window[cb]();
}

function customDate(cb) {
  const from = document.getElementById('dateFrom').value;
  const to   = document.getElementById('dateTo').value;
  if (!from || !to || from > to) return;
  window._dateFilter = { from, to, preset: 'custom' };
  document.querySelectorAll('.date-preset').forEach(b => b.classList.remove('active'));
  if (cb && window[cb]) window[cb]();
}

// Filter months in data range
function getActiveMonthIndices() {
  const { from, to } = window._dateFilter;
  const monthDates = [
    '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06', '2024-07'
  ];
  return monthDates.reduce((arr, m, i) => {
    const mFrom = m + '-01';
    const mTo   = m + '-31';
    if (mFrom <= to && mTo >= from) arr.push(i);
    return arr;
  }, []);
}

// Filter transactions by current date range
function filterTrxByDate(trxList) {
  const { from, to } = window._dateFilter;
  return trxList.filter(t => t.date >= from && t.date <= to);
}

// ── Shared Helpers ─────────────────────────────────────────────────────────────
function formatDate(d) {
  return d.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function badgeMarketplace(mp) {
  const map   = { shopee:'badge-shopee', lazada:'badge-badge', tiktok:'badge-tiktok' };
  const label = { shopee:'Shopee',       lazada:'Lazada',      tiktok:'TikTok' };
  return `<span class="badge ${map[mp]||'badge-gray'}">${label[mp]||mp}</span>`;
}

function badgeStatus(s) {
  const map = { selesai:'badge-success', diproses:'badge-warning', dibatalkan:'badge-danger' };
  return `<span class="badge ${map[s]||'badge-gray'}">${s}</span>`;
}

function growthBadge(pct) {
  const v = parseFloat(pct);
  const pos = v >= 0;
  return `<span class="growth ${pos?'pos':'neg'}">${pos?'▲':'▼'} ${Math.abs(v).toFixed(1)}%</span>`;
}

// Chart color helper (dark mode aware)
function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
function chartGridColor()  { return isDark() ? '#334155' : '#F0F0F0'; }
function chartTextColor()  { return isDark() ? '#94A3B8' : '#666'; }
