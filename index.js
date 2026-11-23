'use strict';

const $ = id => document.getElementById(id);
const currencyFlags = {
  IDR:'Images/flag-id.svg', MYR:'Images/flag-my.svg', SGD:'Images/flag-sg.svg',
  USD:'Images/flag-us.svg', PHP:'Images/flag-ph.svg', THB:'Images/flag-th.svg'
};
let exchangeRates = { IDR:1 };
let currentCurrency = 'IDR';

async function loadRates() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=IDR&symbols=MYR,SGD,USD,PHP,THB');
    if (!response.ok) throw new Error('Kurs gagal dimuat');
    exchangeRates = { IDR:1, ...(await response.json()).rates };
  } catch {
    exchangeRates = { IDR:1 };
  }
}

function initCurrency() {
  const select = $('currency');
  const dialog = $('locationDialog');
  if (!select || !dialog) return;

  function openDialog() {
    document.querySelectorAll('.location-option').forEach(option => {
      const active = option.dataset.currency === currentCurrency;
      option.classList.toggle('active', active);
      option.setAttribute('aria-pressed', String(active));
    });
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  select.addEventListener('mousedown', event => event.preventDefault());
  select.addEventListener('click', event => {
    event.preventDefault();
    openDialog();
  });

  document.querySelectorAll('.location-option').forEach(option => {
    option.addEventListener('click', async () => {
      currentCurrency = option.dataset.currency;
      select.value = currentCurrency;
      await loadRates();
      const flag = $('currencyFlag');
      if (flag) flag.src = currencyFlags[currentCurrency];
      dialog.close();
    });
  });

  $('locationClose')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
}

function initMenu() {
  const button = $('menuBtn');
  const sidebar = $('dkSidebar');
  const overlay = $('dkOverlay');
  const close = $('dkClose');
  if (!button || !sidebar || !overlay || !close) return;

  function open() {
    sidebar.classList.add('is-open');
    overlay.classList.add('is-open');
    sidebar.removeAttribute('inert');
    sidebar.setAttribute('aria-hidden', 'false');
  }

  function closeMenu() {
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-open');
    sidebar.setAttribute('inert', '');
    sidebar.setAttribute('aria-hidden', 'true');
  }

  button.addEventListener('click', open);
  close.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });

  document.querySelectorAll('[data-view], [data-desktop-view]').forEach(link => {
    link.addEventListener('click', event => {
      const viewName = link.dataset.view || link.dataset.desktopView;
      if (!viewName) return;
      event.preventDefault();
      document.querySelectorAll('[data-view-panel]').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.viewPanel === viewName);
      });
      window.history.replaceState(null, '', '#' + viewName);
      window.scrollTo({ top:0, behavior:'instant' });
      closeMenu();
    });
  });

  const initialView = window.location.hash.slice(1);
  if (initialView) {
    document.querySelectorAll('[data-view-panel]').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.viewPanel === initialView);
    });
  }
}

function initSearch() {
  const container = document.querySelector('.dk-search-container');
  const button = $('searchIconBtn');
  const wrap = $('dkSearchWrap');
  const input = $('dkSearchInput');
  const close = $('dkSearchClose');
  if (!container || !button || !wrap || !input || !close) return;

  function open() {
    wrap.classList.add('active');
    container.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    setTimeout(() => input.focus(), 100);
  }

  function closeSearch() {
    wrap.classList.remove('active');
    container.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    input.value = '';
    document.querySelectorAll('#games .game').forEach(game => {
      game.hidden = false;
    });
  }

  button.addEventListener('click', () => {
    if (wrap.classList.contains('active')) closeSearch();
    else open();
  });
  close.addEventListener('click', closeSearch);
  document.addEventListener('click', event => {
    if (!container.contains(event.target)) closeSearch();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSearch();
  });

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    document.querySelectorAll('#games .game').forEach(game => {
      game.hidden = !game.textContent.toLowerCase().includes(query);
    });
  });
}

function initGameNavigation() {
  const games = $('games');
  if (!games) return;
  games.addEventListener('click', event => {
    const button = event.target.closest('.game');
    if (!button) return;
    window.location.href = 'transaksi.html?game=' + encodeURIComponent(button.dataset.game);
  });

  document.querySelectorAll('.popular-game').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = 'transaksi.html?game=' + encodeURIComponent(card.dataset.game);
    });
  });
}

function initAuth() {
  const dialog = $('ancaAuthDialog');
  if (!dialog) return;

  function open(mode) {
    const isRegister = mode === 'register';
    $('authTitle').textContent = isRegister ? 'Daftar' : 'Masuk';
    $('authSubmit').textContent = isRegister ? 'Daftar' : 'Masuk';
    $('authName').hidden = !isRegister;
    $('googleAuthLabel').textContent = isRegister ? 'Daftar dengan Google' : 'Masuk dengan Google';
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  document.querySelectorAll('[data-auth]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      open(button.dataset.auth);
    });
  });

  $('authClose')?.addEventListener('click', () => dialog.close());
  $('authForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const isRegister = $('authTitle').textContent === 'Daftar';
    const payload = {
      name: $('authName').value.trim(),
      email: $('authEmail').value.trim(),
      password: $('authPassword').value
    };
    try {
      const response = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Autentikasi gagal');
      dialog.close();
    } catch (error) {
      $('authMessage').textContent = error.message;
    }
  });
}

function initCalculator() {
  const pricing = {
    master_epic:{ name:'Master - Epic', price:3000 },
    legend:{ name:'Legends', price:5000 },
    mythic:{ name:'Mythic', price:10000 },
    mythic_honor:{ name:'Mythic Honor', price:15000 },
    mythical_glory:{ name:'Mythical Glory', price:20000 }
  };
  const ranks = [
    ['master_4','Master IV',0,4], ['master_3','Master III',4,4], ['master_2','Master II',8,4],
    ['master_1','Master I',12,4], ['gm_5','Grandmaster V',16,5], ['gm_4','Grandmaster IV',21,5],
    ['gm_3','Grandmaster III',26,5], ['gm_2','Grandmaster II',31,5], ['gm_1','Grandmaster I',36,5],
    ['epic_5','Epic V',41,5], ['epic_4','Epic IV',46,5], ['epic_3','Epic III',51,5],
    ['epic_2','Epic II',56,5], ['epic_1','Epic I',61,5], ['legend_5','Legend V',66,5],
    ['legend_4','Legend IV',71,5], ['legend_3','Legend III',76,5], ['legend_2','Legend II',81,5],
    ['legend_1','Legend I',86,5], ['mythic','Mythic',91,25], ['mythic_honor','Mythic Honor',91,50],
    ['mythical_glory','Mythical Glory',91,999]
  ];
  const start = $('jokiStartRank');
  const target = $('jokiTargetRank');
  if (!start || !target) return;
  ranks.forEach(rank => {
    start.add(new Option(rank[1], rank[0]));
    target.add(new Option(rank[1], rank[0]));
  });
  start.value = 'epic_2';
  target.value = 'legend_4';

  let mode = 'rank';
  let current = null;

  function categoryForStar(absStar) {
    if (absStar <= 66) return 'master_epic';
    if (absStar <= 91) return 'legend';
    const mythicStar = absStar - 91;
    if (mythicStar <= 25) return 'mythic';
    if (mythicStar <= 50) return 'mythic_honor';
    return 'mythical_glory';
  }

  function rupiah(value) {
    return 'Rp ' + Math.max(0, value).toLocaleString('id-ID');
  }

  function calculate() {
    const breakdown = $('jokiBreakdown');
    const counts = { master_epic:0, legend:0, mythic:0, mythic_honor:0, mythical_glory:0 };
    let stars = 0;
    let total = 0;

    if (mode === 'rank') {
      const startRank = ranks.find(rank => rank[0] === start.value);
      const targetRank = ranks.find(rank => rank[0] === target.value);
      const startStar = Number($('jokiStartStar').value || 0);
      const targetStar = Number($('jokiTargetStar').value || 0);
      const startAbs = startRank[2] + startStar;
      const targetAbs = targetRank[2] + targetStar;
      $('jokiSummaryRoute').textContent = `${startRank[1]} ★${startStar} → ${targetRank[1]} ★${targetStar}`;
      if (targetAbs <= startAbs) {
        $('jokiValidation').textContent = 'Rank tujuan harus lebih tinggi dari rank awal.';
        current = null;
      } else {
        $('jokiValidation').textContent = '';
        for (let step = startAbs + 1; step <= targetAbs; step++) counts[categoryForStar(step)]++;
      }
    } else {
      const tier = $('jokiStarTier').value;
      stars = Math.max(1, Number($('jokiStarCount').value || 1));
      counts[tier] = stars;
      $('jokiSummaryRoute').textContent = `${pricing[tier].name} (+${stars} Bintang)`;
    }

    if (mode === 'rank') {
      const valid = current !== null || $('jokiValidation').textContent === '';
      if (!valid) {
        $('jokiSummaryStars').textContent = '0 Bintang';
        $('jokiSummaryPrice').textContent = 'Rp 0';
        breakdown.innerHTML = '';
        current = null;
        return;
      }
    }

    const items = [];
    Object.keys(counts).forEach(key => {
      if (counts[key]) {
        stars += counts[key];
        const subtotal = counts[key] * pricing[key].price;
        total += subtotal;
        items.push({ name:pricing[key].name, stars:counts[key], subtotal, price:pricing[key].price });
      }
    });
    breakdown.innerHTML = items.map(item =>
      `<div><span>${item.name}<small>${item.stars} bintang × ${rupiah(item.price)}</small></span><strong>${rupiah(item.subtotal)}</strong></div>`
    ).join('');
    $('jokiSummaryStars').textContent = `${stars} Bintang`;
    $('jokiSummaryPrice').textContent = rupiah(total);
    current = { valid:true, stars, total, items };
  }

  function switchMode(nextMode) {
    mode = nextMode;
    $('jokiModeRank').classList.toggle('active', mode === 'rank');
    $('jokiModeStar').classList.toggle('active', mode === 'star');
    $('jokiRankPanel').hidden = mode !== 'rank';
    $('jokiStarPanel').hidden = mode !== 'star';
    $('jokiSummaryMode').textContent = mode === 'rank' ? 'Rank ke Rank' : 'Eceran / Per Bintang';
    calculate();
  }

  $('jokiModeRank').addEventListener('click', () => switchMode('rank'));
  $('jokiModeStar').addEventListener('click', () => switchMode('star'));
  ['jokiStartRank','jokiStartStar','jokiTargetRank','jokiTargetStar','jokiStarTier','jokiStarCount'].forEach(id => {
    $(id).addEventListener('input', calculate);
    $(id).addEventListener('change', calculate);
  });
  document.querySelectorAll('.joki-star-chips button').forEach(button => {
    button.addEventListener('click', () => {
      $('jokiStarCount').value = button.dataset.stars;
      calculate();
    });
  });
  document.querySelectorAll('.joki-price-card').forEach(card => {
    card.addEventListener('click', () => {
      switchMode('star');
      $('jokiStarTier').value = card.dataset.tier;
      calculate();
    });
  });

  $('jokiOrderButton').addEventListener('click', () => {
    if (!current?.valid) {
      $('jokiOrderMessage').textContent = 'Pastikan rank tujuan lebih tinggi dari rank awal.';
      return;
    }
    const email = $('jokiPlayerId').value.trim();
    const whatsapp = $('jokiContact').value.trim();
    if (!email || !whatsapp) {
      $('jokiOrderMessage').textContent = 'Lengkapi email akun dan nomor WhatsApp.';
      return;
    }
    const breakdown = current.items.map(item =>
      `• ${item.name}: ${item.stars} bintang × ${rupiah(item.price)}`
    ).join('\n');
    const text = [
      '*ORDER JOKI RANK MLBB — ANCA STORE*',
      `Mode: ${$('jokiSummaryMode').textContent}`,
      `Target: ${$('jokiSummaryRoute').textContent}`,
      `Total: ${current.stars} bintang`,
      breakdown,
      `Estimasi: ${rupiah(current.total)}`,
      `Email Akun: ${email}`,
      `Login Via: ${$('jokiLoginVia').value}`,
      `Request Hero: ${$('jokiHero').value || 'Bebas'}`,
      `Catatan: ${$('jokiNote').value || '-'}`,
      `WhatsApp: ${whatsapp}`
    ].join('\n');
    window.open(`https://wa.me/6283193617371?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  });

  switchMode('rank');
}

document.addEventListener('DOMContentLoaded', () => {
  loadRates();
  initCurrency();
  initMenu();
  initSearch();
  initGameNavigation();
  initAuth();
  initCalculator();
});
