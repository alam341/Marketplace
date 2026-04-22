// ── Mock Users ────────────────────────────────────────────────────────────────
const USERS = [
  { id: 'spv',  username: 'spv',  password: 'password123', role: 'spv',  name: 'Andi Wijaya',   avatar: 'AW', title: 'Supervisor' },
  { id: 'adv1', username: 'adv1', password: 'password123', role: 'adv',  name: 'Budi Santoso',  avatar: 'BS', title: 'Advertiser' },
  { id: 'adv2', username: 'adv2', password: 'password123', role: 'adv',  name: 'Sari Dewi',     avatar: 'SD', title: 'Advertiser' },
  { id: 'adv3', username: 'adv3', password: 'password123', role: 'adv',  name: 'Ahmad Fauzi',   avatar: 'AF', title: 'Advertiser' },
  { id: 'adv4', username: 'adv4', password: 'password123', role: 'adv',  name: 'Rina Kusuma',   avatar: 'RK', title: 'Advertiser' },
];

// ── Monthly Revenue per ADV (Jan–Jul) ─────────────────────────────────────────
const MONTHLY_REVENUE = {
  adv1: { shopee: [18,22,19,28,31,27,35], lazada: [12,14,11,16,18,15,20], tiktok: [8,10,9,14,16,13,18] },
  adv2: { shopee: [14,16,18,22,19,24,26], lazada: [20,22,19,25,28,26,30], tiktok: [6,8,7,10,9,11,13] },
  adv3: { shopee: [10,12,11,14,13,15,17], lazada: [8,9,8,11,10,12,14],   tiktok: [22,26,24,30,28,32,36] },
  adv4: { shopee: [16,18,20,24,22,26,28], lazada: [14,16,15,18,17,20,22], tiktok: [12,14,13,16,15,18,20] },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul'];

// ── Products ──────────────────────────────────────────────────────────────────
const PRODUCTS = [
  { id:'P001', sku:'SKU-ELEC-001', name:'Earbuds Pro X1',      category:'Elektronik', price:285000,  stock:142, adv:'adv1', img:'🎧' },
  { id:'P002', sku:'SKU-ELEC-002', name:'Smart Watch Series 3',category:'Elektronik', price:520000,  stock:87,  adv:'adv1', img:'⌚' },
  { id:'P003', sku:'SKU-FASH-001', name:'Kemeja Linen Premium', category:'Fashion',   price:189000,  stock:230, adv:'adv2', img:'👔' },
  { id:'P004', sku:'SKU-FASH-002', name:'Celana Chino Slim',    category:'Fashion',   price:245000,  stock:195, adv:'adv2', img:'👖' },
  { id:'P005', sku:'SKU-BEAU-001', name:'Serum Vitamin C 30ml', category:'Beauty',    price:165000,  stock:312, adv:'adv3', img:'💊' },
  { id:'P006', sku:'SKU-BEAU-002', name:'Sunscreen SPF50 PA+++',category:'Beauty',    price:98000,   stock:428, adv:'adv3', img:'🧴' },
  { id:'P007', sku:'SKU-HOME-001', name:'Talenan Kayu Jati',    category:'Home',      price:125000,  stock:167, adv:'adv4', img:'🍽️' },
  { id:'P008', sku:'SKU-HOME-002', name:'Lampu LED Smart 12W',  category:'Home',      price:75000,   stock:253, adv:'adv4', img:'💡' },
  { id:'P009', sku:'SKU-ELEC-003', name:'Power Bank 20000mAh',  category:'Elektronik', price:195000, stock:94,  adv:'adv1', img:'🔋' },
  { id:'P010', sku:'SKU-BEAU-003', name:'Sheet Mask Pack 10pcs',category:'Beauty',    price:45000,   stock:580, adv:'adv3', img:'🫧' },
];

// ── Transactions ──────────────────────────────────────────────────────────────
const TRANSACTIONS = [
  { id:'TRX-2024071501', date:'2024-07-15', adv:'adv1', sku:'SKU-ELEC-001', product:'Earbuds Pro X1',      marketplace:'shopee', qty:3,  price:285000, status:'selesai'  },
  { id:'TRX-2024071502', date:'2024-07-15', adv:'adv2', sku:'SKU-FASH-001', product:'Kemeja Linen Premium', marketplace:'lazada', qty:2,  price:189000, status:'selesai'  },
  { id:'TRX-2024071503', date:'2024-07-14', adv:'adv3', sku:'SKU-BEAU-001', product:'Serum Vitamin C',      marketplace:'tiktok', qty:5,  price:165000, status:'selesai'  },
  { id:'TRX-2024071504', date:'2024-07-14', adv:'adv4', sku:'SKU-HOME-002', product:'Lampu LED Smart 12W',  marketplace:'shopee', qty:10, price:75000,  status:'selesai'  },
  { id:'TRX-2024071505', date:'2024-07-13', adv:'adv1', sku:'SKU-ELEC-002', product:'Smart Watch Series 3', marketplace:'lazada', qty:1,  price:520000, status:'diproses' },
  { id:'TRX-2024071506', date:'2024-07-13', adv:'adv2', sku:'SKU-FASH-002', product:'Celana Chino Slim',    marketplace:'tiktok', qty:4,  price:245000, status:'selesai'  },
  { id:'TRX-2024071507', date:'2024-07-12', adv:'adv3', sku:'SKU-BEAU-002', product:'Sunscreen SPF50',      marketplace:'shopee', qty:8,  price:98000,  status:'selesai'  },
  { id:'TRX-2024071508', date:'2024-07-12', adv:'adv4', sku:'SKU-HOME-001', product:'Talenan Kayu Jati',    marketplace:'lazada', qty:3,  price:125000, status:'dibatalkan'},
  { id:'TRX-2024071509', date:'2024-07-11', adv:'adv1', sku:'SKU-ELEC-003', product:'Power Bank 20000mAh',  marketplace:'tiktok', qty:6,  price:195000, status:'selesai'  },
  { id:'TRX-2024071510', date:'2024-07-11', adv:'adv2', sku:'SKU-FASH-001', product:'Kemeja Linen Premium', marketplace:'shopee', qty:3,  price:189000, status:'diproses' },
  { id:'TRX-2024071511', date:'2024-07-10', adv:'adv3', sku:'SKU-BEAU-003', product:'Sheet Mask Pack',      marketplace:'tiktok', qty:15, price:45000,  status:'selesai'  },
  { id:'TRX-2024071512', date:'2024-07-10', adv:'adv4', sku:'SKU-HOME-002', product:'Lampu LED Smart 12W',  marketplace:'lazada', qty:7,  price:75000,  status:'selesai'  },
  { id:'TRX-2024071513', date:'2024-07-09', adv:'adv1', sku:'SKU-ELEC-001', product:'Earbuds Pro X1',       marketplace:'shopee', qty:2,  price:285000, status:'selesai'  },
  { id:'TRX-2024071514', date:'2024-07-09', adv:'adv2', sku:'SKU-FASH-002', product:'Celana Chino Slim',    marketplace:'lazada', qty:5,  price:245000, status:'selesai'  },
  { id:'TRX-2024071515', date:'2024-07-08', adv:'adv4', sku:'SKU-HOME-001', product:'Talenan Kayu Jati',    marketplace:'shopee', qty:4,  price:125000, status:'selesai'  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getUser(id) { return USERS.find(u => u.id === id); }

function getAdvMonthly(advId) {
  const d = MONTHLY_REVENUE[advId];
  return MONTHS.map((_, i) => (d.shopee[i] + d.lazada[i] + d.tiktok[i]) * 1_000_000);
}

function getAllMonthly() {
  return MONTHS.map((_, i) =>
    ['adv1','adv2','adv3','adv4'].reduce((sum, id) => {
      const d = MONTHLY_REVENUE[id];
      return sum + (d.shopee[i] + d.lazada[i] + d.tiktok[i]) * 1_000_000;
    }, 0)
  );
}

function getAdvStats(advId) {
  const d = MONTHLY_REVENUE[advId];
  const months = d.shopee.length;
  const lastIdx = months - 1;
  const prevIdx = months - 2;

  const totalThis = (d.shopee[lastIdx] + d.lazada[lastIdx] + d.tiktok[lastIdx]) * 1_000_000;
  const totalPrev = (d.shopee[prevIdx] + d.lazada[prevIdx] + d.tiktok[prevIdx]) * 1_000_000;

  const myTrx = TRANSACTIONS.filter(t => t.adv === advId);
  const myQty = myTrx.reduce((s, t) => s + t.qty, 0);
  const myProducts = [...new Set(myTrx.map(t => t.sku))].length;

  return {
    revenue: totalThis,
    revenuePrev: totalPrev,
    revGrowth: ((totalThis - totalPrev) / totalPrev * 100).toFixed(1),
    orders: myTrx.filter(t => t.status !== 'dibatalkan').length,
    qty: myQty,
    products: myProducts,
  };
}

function getSpvStats() {
  const allAdvIds = ['adv1','adv2','adv3','adv4'];
  let totalThis = 0, totalPrev = 0;
  allAdvIds.forEach(id => {
    const s = getAdvStats(id);
    totalThis += s.revenue;
    totalPrev += s.revenuePrev;
  });
  const totalOrders = TRANSACTIONS.filter(t => t.status !== 'dibatalkan').length;
  const totalQty = TRANSACTIONS.reduce((s, t) => s + t.qty, 0);
  return {
    revenue: totalThis,
    revenuePrev: totalPrev,
    revGrowth: ((totalThis - totalPrev) / totalPrev * 100).toFixed(1),
    orders: totalOrders,
    qty: totalQty,
    teamSize: allAdvIds.length,
  };
}

function getTeamRevenue() {
  return ['adv1','adv2','adv3','adv4'].map(id => {
    const user = getUser(id);
    const d = MONTHLY_REVENUE[id];
    const lastIdx = d.shopee.length - 1;
    const total = (d.shopee[lastIdx] + d.lazada[lastIdx] + d.tiktok[lastIdx]) * 1_000_000;
    return { id, name: user.name, avatar: user.avatar, total,
      shopee: d.shopee[lastIdx]*1e6, lazada: d.lazada[lastIdx]*1e6, tiktok: d.tiktok[lastIdx]*1e6 };
  }).sort((a, b) => b.total - a.total);
}

function fmt(n) {
  if (n >= 1e9) return 'Rp ' + (n/1e9).toFixed(1) + 'M';
  if (n >= 1e6) return 'Rp ' + (n/1e6).toFixed(1) + ' Jt';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
function fmtFull(n) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
