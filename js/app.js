const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';

const ICON_DASHBOARD   = SVG_OPEN + '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>';
const ICON_REPORT      = SVG_OPEN + '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
const ICON_ANALISIS    = SVG_OPEN + '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>';
const ICON_PRODUCT     = SVG_OPEN + '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
const ICON_TRANSACTION = SVG_OPEN + '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
const ICON_TRACKING    = SVG_OPEN + '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
const ICON_REKAP       = SVG_OPEN + '<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>';

const PAGES = [
  { id: 'dashboard',   label: 'Dashboard',   icon: ICON_DASHBOARD,   file: 'dashboard.html'   },
  { id: 'report',      label: 'Report',      icon: ICON_REPORT,      file: 'report.html'      },
  { id: 'analisis',    label: 'Analisis',    icon: ICON_ANALISIS,    file: 'analisis.html'    },
  { id: 'product',     label: 'Product',     icon: ICON_PRODUCT,     file: 'product.html'     },
  { id: 'transaction', label: 'Transaction', icon: ICON_TRANSACTION, file: 'transaction.html' },
  { id: 'tracking',    label: 'Tracking Resi', icon: ICON_TRACKING,  file: 'tracking.html'  },
  { id: 'rekap',       label: 'Rekap SKU',   icon: ICON_REKAP,       file: 'rekap.html'       },
];

const ADV_COLORS = ['#4361EE','#7B2FBE','#06C270','#FFB703','#EF233C'];

// ── Theme ─────────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  return saved;
}
function toggleDarkMode() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

// ── Layout ────────────────────────────────────────────────────────────────────
function renderLayout(activePage, user) {
  const theme = initTheme();
  const color = user._color || '#4361EE';

  document.getElementById('sidebar-slot').innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <img src="img/logo-adsy.png" style="height:36px;width:auto;object-fit:contain">
        <div>
          <div style="font-size:.85rem;font-weight:800;line-height:1.1;color:var(--text-1)">Team Marketplace</div>
          <div style="font-size:.68rem;color:var(--text-3);font-weight:600">by Adsy</div>
        </div>
      </div>
      <div class="sidebar-label">MENU</div>
      <nav class="sidebar-nav">
        ${PAGES.map(p => `
          <a href="${p.file}" class="nav-item ${activePage === p.id ? 'active' : ''}">
            <span class="nav-icon">${p.icon}</span><span>${p.label}</span>
          </a>
        `).join('')}
      </nav>
      <div style="margin-top:auto">
        <button class="import-btn" onclick="openUploadModal()">
          <span>📥</span> Import Data Excel
        </button>
        <button class="import-btn" onclick="openManageModal()" style="margin-top:8px;background:rgba(239,35,60,.08);color:var(--danger,#EF233C)">
          <span>🗑️</span> Kelola Upload
        </button>
        <div class="sidebar-bottom">
          <div class="user-card" onclick="location.href='profile.html'" style="cursor:pointer" title="Lihat profil">
            ${user.avatar_url
              ? `<div class="user-avatar" style="background:${color};overflow:hidden;padding:0"><img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover"></div>`
              : `<div class="user-avatar" style="background:${color}">${user.avatar || '?'}</div>`}
            <div class="user-info">
              <div class="user-name">${user.name}</div>
              <div class="user-role">${user.title}</div>
            </div>
            <button class="logout-btn" onclick="event.stopPropagation();logout()" title="Logout">⏻</button>
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
        <button class="theme-toggle" id="themeToggle" onclick="toggleDarkMode()">
          ${theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button class="icon-btn">🔔<span class="notif-dot"></span></button>
        <div class="divider-v"></div>
        <div class="topbar-user" onclick="location.href='profile.html'" style="cursor:pointer">
          ${user.avatar_url
            ? `<div class="user-avatar sm" style="background:${color};overflow:hidden;padding:0"><img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover"></div>`
            : `<div class="user-avatar sm" style="background:${color}">${user.avatar || '?'}</div>`}
          <div>
            <div class="topbar-name">${user.name}</div>
            <div class="topbar-role">${user.title}</div>
          </div>
        </div>
      </div>
    </header>
  `;
}

function openSidebar()  { document.getElementById('sidebar')?.classList.add('open'); document.getElementById('sidebarOverlay')?.classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sidebarOverlay')?.classList.remove('open'); }

// ── Loading ───────────────────────────────────────────────────────────────────
function showLoading(id = 'pageContent') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="page-loading"><div class="spinner"></div><div>Memuat data...</div></div>`;
}
function showError(msg, id = 'pageContent') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="page-loading"><div style="font-size:2rem">⚠️</div><div style="color:var(--danger)">${msg}</div><button class="btn btn-outline btn-sm" onclick="location.reload()">Coba Lagi</button></div>`;
}

// ── Date Filter ───────────────────────────────────────────────────────────────
window._dateFilter = { from: firstOfYear(), to: fmtDate(0), preset: 'thisyear' };

function renderDateFilter(containerId, onChangeFn) {
  const presets = [
    { key: 'today',    label: 'Hari Ini',  from: fmtDate(0),    to: fmtDate(0) },
    { key: 'week',     label: '7 Hari',    from: fmtDate(-6),   to: fmtDate(0) },
    { key: 'month',    label: 'Bln Ini',   from: firstOfMonth(), to: fmtDate(0) },
    { key: 'thisyear', label: 'Thn Ini',   from: firstOfYear(),  to: fmtDate(0) },
    { key: 'all',      label: 'Semua',     from: '2020-01-01',  to: '2099-12-31' },
  ];

  document.getElementById(containerId).innerHTML = `
    <div class="date-filter-bar">
      <div style="font-size:.78rem;font-weight:700;color:var(--text-3);white-space:nowrap">📅 Periode:</div>
      <div class="date-presets">
        ${presets.map(p => `
          <button class="date-preset ${window._dateFilter.preset===p.key?'active':''}"
            onclick="setPreset('${p.key}','${p.from}','${p.to}','${onChangeFn}')">
            ${p.label}
          </button>
        `).join('')}
      </div>
      <div class="date-range-wrap">
        <input type="date" class="date-input" id="dateFrom" value="${window._dateFilter.from}" onchange="customDate('${onChangeFn}')">
        <span>—</span>
        <input type="date" class="date-input" id="dateTo"   value="${window._dateFilter.to}"   onchange="customDate('${onChangeFn}')">
      </div>
    </div>
  `;
}

function setPreset(key, from, to, cb) {
  window._dateFilter = { from, to, preset: key };
  document.getElementById('dateFrom').value = from;
  document.getElementById('dateTo').value   = to;
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

function fmtDate(offsetDays = 0) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0,10);
}
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); }
function firstOfYear()  { return new Date().getFullYear() + '-01-01'; }

// ── Shared helpers ────────────────────────────────────────────────────────────
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
  const v = parseFloat(pct); const pos = v >= 0;
  return `<span class="growth ${pos?'pos':'neg'}">${pos?'▲':'▼'} ${Math.abs(v).toFixed(1)}%</span>`;
}
function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
function chartGridColor() { return isDark() ? '#334155' : '#F0F0F0'; }
function chartTextColor() { return isDark() ? '#94A3B8' : '#666'; }
function fmt(n) {
  if (n >= 1e9) return 'Rp ' + (n/1e9).toFixed(1) + ' M';
  if (n >= 1e6) return 'Rp ' + (n/1e6).toFixed(1) + ' Jt';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
function fmtFull(n) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }

function showToast(msg, type = 'success') {
  const colors = { success:'#06C270', error:'#EF233C', info:'#4361EE' };
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${colors[type]||colors.info};
    color:white;padding:12px 20px;border-radius:12px;font-weight:700;font-size:.875rem;
    box-shadow:0 4px 20px rgba(0,0,0,.25);transition:opacity .3s;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 3000);
}

// Assign color to user based on profile list index
function assignUserColor(profiles, userId) {
  const idx = profiles.findIndex(p => p.id === userId);
  return ADV_COLORS[idx >= 0 ? idx % ADV_COLORS.length : 0];
}

// Render avatar — support foto URL atau emoji/teks
function renderAvatar(user, size = 'md', color = '') {
  const bg = color || '#4361EE';
  const sz = size === 'sm' ? '28px' : size === 'lg' ? '44px' : '36px';
  const fs = size === 'sm' ? '.65rem' : size === 'lg' ? '1.1rem' : '.85rem';
  const style = `width:${sz};height:${sz};border-radius:50%;overflow:hidden;flex-shrink:0;
    background:${bg};display:flex;align-items:center;justify-content:center;font-size:${fs};`;
  if (user?.avatar_url) {
    return `<div style="${style}"><img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover"></div>`;
  }
  return `<div style="${style}">${user?.avatar || '?'}</div>`;
}
