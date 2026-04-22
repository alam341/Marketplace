const PAGES = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '⊞',  file: 'dashboard.html'   },
  { id: 'report',      label: 'Report',      icon: '📊', file: 'report.html'      },
  { id: 'product',     label: 'Product',     icon: '📦', file: 'product.html'     },
  { id: 'transaction', label: 'Transaction', icon: '💳', file: 'transaction.html' },
];

function renderLayout(activePage, user) {
  const avatarColor = ['adv1','adv2','adv3','adv4'].includes(user.id)
    ? '#4361EE' : '#7B2FBE';

  const sidebarHTML = `
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
    <div class="sidebar-bottom">
      <div class="user-card">
        <div class="user-avatar" style="background:${avatarColor}">${user.avatar}</div>
        <div class="user-info">
          <div class="user-name">${user.name}</div>
          <div class="user-role">${user.title}</div>
        </div>
        <button class="logout-btn" onclick="logout()" title="Logout">⏻</button>
      </div>
    </div>
  </aside>`;

  const headerHTML = `
  <header class="topbar">
    <button class="hamburger" onclick="toggleSidebar()">☰</button>
    <div class="topbar-title">
      <h1 id="pageTitle">${PAGES.find(p=>p.id===activePage)?.label || ''}</h1>
      <p class="topbar-date">${formatDate(new Date())}</p>
    </div>
    <div class="topbar-right">
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Cari..." class="topbar-search">
      </div>
      <button class="icon-btn notif-btn">🔔<span class="notif-dot"></span></button>
      <div class="topbar-user">
        <div class="user-avatar sm" style="background:${avatarColor}">${user.avatar}</div>
        <div>
          <div class="topbar-name">${user.name}</div>
          <div class="topbar-role">${user.title}</div>
        </div>
      </div>
    </div>
  </header>`;

  document.getElementById('sidebar-slot').innerHTML = sidebarHTML;
  document.getElementById('header-slot').innerHTML  = headerHTML;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function formatDate(d) {
  return d.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function badgeMarketplace(mp) {
  const map = { shopee:'badge-shopee', lazada:'badge-badge', tiktok:'badge-tiktok' };
  const label = { shopee:'Shopee', lazada:'Lazada', tiktok:'TikTok' };
  return `<span class="badge ${map[mp]||'badge-gray'}">${label[mp]||mp}</span>`;
}

function badgeStatus(s) {
  const map = { selesai:'badge-success', diproses:'badge-warning', dibatalkan:'badge-danger' };
  return `<span class="badge ${map[s]||'badge-gray'}">${s}</span>`;
}

function growthBadge(pct) {
  const positive = parseFloat(pct) >= 0;
  return `<span class="growth ${positive?'pos':'neg'}">${positive?'▲':'▼'} ${Math.abs(pct)}%</span>`;
}

// Sidebar overlay close on mobile
document.addEventListener('click', e => {
  const sb = document.getElementById('sidebar');
  if (sb && sb.classList.contains('open') && !sb.contains(e.target) && !e.target.classList.contains('hamburger')) {
    sb.classList.remove('open');
  }
});
