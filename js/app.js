const PAGES = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '⊞',  file: 'dashboard.html'   },
  { id: 'report',      label: 'Report',      icon: '📊', file: 'report.html'      },
  { id: 'product',     label: 'Product',     icon: '📦', file: 'product.html'     },
  { id: 'transaction', label: 'Transaction', icon: '💳', file: 'transaction.html' },
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
