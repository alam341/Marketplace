// ── Mood & Welcome Banner ─────────────────────────────────────────────────────
const MOODS = [
  { emoji:'😊', label:'Bahagia',      msg:'Semoga harimu tetap menyenangkan!' },
  { emoji:'🤩', label:'Semangat',     msg:'Energimu menular ke seluruh tim!'  },
  { emoji:'😌', label:'Biasa Aja',    msg:'Hari biasa pun bisa luar biasa!'   },
  { emoji:'🥱', label:'Lelah',        msg:'Istirahat sejenak, lalu bangkit!'  },
  { emoji:'😢', label:'Sedih',        msg:'Tidak apa-apa, besok pasti lebih baik!' },
  { emoji:'🤯', label:'Stres',        msg:'Tarik nafas dalam, kamu pasti bisa!' },
  { emoji:'🔥', label:'On Fire!',     msg:'Gas terus, momentum ada di tanganmu!' },
  { emoji:'🤧', label:'Kurang Sehat', msg:'Jaga kesehatan dulu ya, yang lain menyusul!' },
  { emoji:'💪', label:'Siap Tempur',  msg:'Target hari ini pasti tercapai!'   },
];

const ANIMALS = [
  { emoji:'🐬', desc:'Lumba-lumba cerdas & gesit'    },
  { emoji:'🦁', desc:'Singa berani & memimpin'        },
  { emoji:'🦅', desc:'Elang tajam & selalu fokus'     },
  { emoji:'🐅', desc:'Harimau gesit & bertenaga'      },
  { emoji:'🦊', desc:'Rubah cerdik & adaptif'         },
  { emoji:'🐺', desc:'Serigala setia & tangguh'       },
  { emoji:'🦉', desc:'Burung hantu bijak & sabar'     },
  { emoji:'🐉', desc:'Naga kuat & penuh semangat'     },
  { emoji:'🦋', desc:'Kupu-kupu indah & penuh warna'  },
  { emoji:'🐆', desc:'Cheetah tercepat di kelasnya'   },
];

let _animalIdx = Math.floor(Math.random() * ANIMALS.length);
let _animalTimer = null;

function _getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat Pagi';
  if (h < 15) return 'Selamat Siang';
  if (h < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

function _moodKey() {
  return 'mood_' + new Date().toISOString().slice(0, 10);
}

function getTodayMood() {
  const saved = localStorage.getItem(_moodKey());
  return saved ? JSON.parse(saved) : null;
}

function checkAndShowMood(user) {
  if (getTodayMood() !== null) return;
  _showMoodModal(user);
}

function _showMoodModal(user) {
  if (document.getElementById('moodOverlay')) return;
  const greeting = _getGreeting();
  const firstName = (user.name || '').split(' ')[0];

  const overlay = document.createElement('div');
  overlay.id = 'moodOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:10000;
    background:rgba(237,240,255,0.98);backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;
    animation:moodFadeIn .35s ease;
  `;

  overlay.innerHTML = `
    <style>
      @keyframes moodFadeIn { from{opacity:0;transform:scale(.97)} to{opacity:1;transform:scale(1)} }
      .mood-btn { background:#ECEEFF;border:2px solid transparent;border-radius:16px;padding:18px 10px;
        cursor:pointer;transition:all .18s;display:flex;flex-direction:column;align-items:center;gap:8px; }
      .mood-btn:hover { background:#DDE3FF;border-color:#4361EE;transform:translateY(-2px); }
    </style>
    <div style="max-width:500px;width:92%;text-align:center;padding:16px">
      <div style="font-size:.75rem;font-weight:800;letter-spacing:3px;color:#4361EE;margin-bottom:6px">
        ${greeting.toUpperCase()},
      </div>
      <div style="font-size:2.4rem;font-weight:900;color:#1E293B;margin-bottom:6px">
        ${firstName} 👋
      </div>
      <div style="font-size:.92rem;color:#64748B;margin-bottom:28px">
        Bagaimana perasaan kamu hari ini?
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-bottom:28px">
        ${MOODS.map((m, i) => `
          <button class="mood-btn" onclick="_selectMood(${i})">
            <span style="font-size:2rem">${m.emoji}</span>
            <span style="font-size:.76rem;font-weight:700;color:#334155">${m.label}</span>
          </button>
        `).join('')}
      </div>
      <button onclick="_skipMood()" style="background:none;border:none;color:#94A3B8;cursor:pointer;font-size:.85rem;font-weight:600">
        Lewati →
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
}

function _closeMoodOverlay() {
  const el = document.getElementById('moodOverlay');
  if (!el) return;
  el.style.transition = 'opacity .25s';
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 250);
}

function _selectMood(idx) {
  localStorage.setItem(_moodKey(), JSON.stringify({ idx, ts: Date.now() }));
  _closeMoodOverlay();
  _refreshBannerMsg();
}

function _skipMood() {
  localStorage.setItem(_moodKey(), JSON.stringify({ idx: -1, ts: Date.now() }));
  _closeMoodOverlay();
}

function _refreshBannerMsg() {
  const el = document.getElementById('welcomeMoodMsg');
  if (!el) return;
  const mood = getTodayMood();
  el.textContent = '✨ ' + ((mood && mood.idx >= 0) ? MOODS[mood.idx].msg : 'Semangat berkarya hari ini!');
}

// ── Welcome Banner ────────────────────────────────────────────────────────────
function renderWelcomeBanner(containerId, user) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const greeting = _getGreeting();
  const firstName = (user.name || '').split(' ')[0];
  const mood = getTodayMood();
  const moodMsg = (mood && mood.idx >= 0) ? MOODS[mood.idx].msg : 'Semangat berkarya hari ini!';
  const animal = ANIMALS[_animalIdx];

  container.innerHTML = `
    <div id="welcomeBanner" style="
      background:linear-gradient(135deg,#EEF0FF 0%,#E4E9FF 100%);
      border-radius:20px;padding:24px 32px;margin-bottom:22px;
      display:flex;justify-content:space-between;align-items:center;gap:20px;
    ">
      <div style="flex:1">
        <div style="font-size:.7rem;font-weight:800;letter-spacing:3px;color:#4361EE;margin-bottom:4px">
          ${greeting.toUpperCase()},
        </div>
        <div style="font-size:1.85rem;font-weight:900;color:#1E293B;margin-bottom:4px">${firstName}</div>
        <div style="font-size:.84rem;color:#64748B;margin-bottom:14px">Apa yang ingin kamu capai hari ini?</div>
        <div id="welcomeMoodMsg" style="
          display:inline-block;background:white;border-radius:20px;
          padding:7px 18px;font-size:.82rem;font-weight:700;color:#4361EE;
          box-shadow:0 2px 12px rgba(67,97,238,.15);
        ">✨ ${moodMsg}</div>
      </div>
      <div id="welcomeAnimal" style="text-align:center;min-width:90px;transition:opacity .4s ease">
        <div style="font-size:3.8rem;line-height:1">${animal.emoji}</div>
        <div style="font-size:.7rem;color:#64748B;margin-top:6px;font-weight:600;max-width:80px">${animal.desc}</div>
      </div>
    </div>
  `;

  // Rotate animal every 5 seconds
  if (_animalTimer) clearInterval(_animalTimer);
  _animalTimer = setInterval(() => {
    const el = document.getElementById('welcomeAnimal');
    if (!el) { clearInterval(_animalTimer); return; }
    el.style.opacity = '0';
    setTimeout(() => {
      _animalIdx = (_animalIdx + 1) % ANIMALS.length;
      const a = ANIMALS[_animalIdx];
      el.innerHTML = `
        <div style="font-size:3.8rem;line-height:1">${a.emoji}</div>
        <div style="font-size:.7rem;color:#64748B;margin-top:6px;font-weight:600;max-width:80px">${a.desc}</div>
      `;
      el.style.opacity = '1';
    }, 400);
  }, 5000);
}
