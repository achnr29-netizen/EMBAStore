'use strict';

const $ = id => document.getElementById(id);
const currencyFlags = {
  IDR:'Images/flag-id.svg', MYR:'Images/flag-my.svg', SGD:'Images/flag-sg.svg',
  USD:'Images/flag-us.svg', PHP:'Images/flag-ph.svg', THB:'Images/flag-th.svg'
};
const gameFields = {
  'Mobile Legends':['User ID','Zone ID'],
  'Free Fire':['Player ID',''],
  'PUBG Mobile':['Character ID',''],
  'Genshin Impact':['UID','Server'],
  'Valorant':['Riot ID','Tagline'],
  'Honor of Kings':['User ID','Zone ID'],
  'Call of Duty: Mobile':['Open ID / Player ID',''],
  'League of Legends Wild Rift':['Riot ID','Tagline'],
  'Clash of Clans':['Player Tag','']
};
const gameVisuals = {
  'Mobile Legends':['Images/mobile-legends.png','Moonton','Diamond'],
  'Free Fire':['Images/free-fire.png','Garena','Diamond'],
  'PUBG Mobile':['Images/pubg-mobile.png','Level Infinite','UC'],
  'Genshin Impact':['Images/genshin-impact.png','HoYoverse','Genesis Crystals'],
  'Valorant':['Images/valorant.png','Riot Games','VP'],
  'Honor of Kings':['Images/honor-of-kings.png','Level Infinite','Tokens'],
  'Call of Duty: Mobile':['Images/cod-mobile.png','Activision','CP'],
  'League of Legends Wild Rift':['Images/league-of-legends-wild-rift.png','Riot Games','VP'],
  'Clash of Clans':['Images/clash-of-clans.png','Supercell','Gems']
};

let currency = 'IDR';
let exchangeRates = { IDR:1 };
let game = 'Mobile Legends';
let products = [];
let selected = null;

async function loadRates() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=IDR&symbols=MYR,SGD,USD,PHP,THB');
    if (response.ok) exchangeRates = { IDR:1, ...(await response.json()).rates };
  } catch {}
}

function formatMoney(amount) {
  const locales = { IDR:'id-ID', MYR:'ms-MY', SGD:'en-SG', USD:'en-US', PHP:'en-PH', THB:'th-TH' };
  return new Intl.NumberFormat(locales[currency], {
    style:'currency',
    currency,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2
  }).format(Number(amount) * (exchangeRates[currency] || 1));
}

function initCurrency() {
  const select = $('currency');
  const dialog = $('locationDialog');
  if (!select || !dialog) return;
  select.addEventListener('mousedown', event => event.preventDefault());
  select.addEventListener('click', event => {
    event.preventDefault();
    if (typeof dialog.showModal === 'function') dialog.showModal();
  });
  document.querySelectorAll('.location-option').forEach(option => {
    option.addEventListener('click', async () => {
      currency = option.dataset.currency;
      select.value = currency;
      await loadRates();
      $('currencyFlag').src = currencyFlags[currency];
      updatePrices();
      dialog.close();
    });
  });
  $('locationClose')?.addEventListener('click', () => dialog.close());
}

function configureGame() {
  const params = new URLSearchParams(window.location.search);
  game = params.get('game') || 'Mobile Legends';
  if (!gameVisuals[game]) game = 'Mobile Legends';

  const visual = gameVisuals[game];
  $('transactionGameName').textContent = game;
  $('transactionGameIcon').src = visual[0];
  $('transactionGameIcon').alt = game;
  $('transactionGamePublisher').textContent = `${visual[1]} • ${visual[2]}`;
  $('transactionGameHero').style.setProperty('--game-art', `url("${visual[0]}")`);

  const fields = gameFields[game] || ['ID Pemain',''];
  $('player-title').textContent = `Data Pemain — ${game}`;
  document.querySelector('label[for="player"]').textContent = `${fields[0]} *`;
  $('player').placeholder = `Masukkan ${fields[0]}`;
  const serverField = $('server').closest('.field');
  if (fields[1]) {
    serverField.hidden = false;
    document.querySelector('label[for="server"]').textContent = `${fields[1]} *`;
    $('server').placeholder = `Masukkan ${fields[1]}`;
  } else {
    serverField.hidden = true;
  }
}

async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Paket gagal dimuat');
    products = data.products || [];
    renderPackages();
  } catch (error) {
    $('packages').innerHTML = '<p class="muted">Paket tidak dapat dimuat.</p>';
  }
}

function updatePrices() {
  document.querySelectorAll('.pack').forEach(pack => {
    const price = pack.querySelector('.price');
    if (price) price.textContent = formatMoney(price.dataset.idr);
  });
  if (selected) $('total').textContent = formatMoney(selected.price_idr);
}

function renderPackages() {
  const list = products.filter(product => product.game.toLowerCase() === game.toLowerCase());
  const box = $('packages');
  box.innerHTML = '';
  selected = null;
  if (!list.length) {
    box.innerHTML = '<p class="muted">Belum ada paket untuk game ini.</p>';
    return;
  }
  list.forEach(product => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pack';
    button.innerHTML =
      `<div class="qty">💎 ${product.name}</div>` +
      `<small>${product.game}</small>` +
      `<div class="price" data-idr="${product.price_idr}">${formatMoney(product.price_idr)}</div>`;
    button.addEventListener('click', () => {
      document.querySelectorAll('.pack').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      selected = product;
      $('total').textContent = formatMoney(product.price_idr);
      $('summary').textContent = `${product.game} • ${product.name}`;
      clearAlert();
    });
    box.appendChild(button);
  });
}

function clearAlert() {
  if ($('alert')) {
    $('alert').textContent = '';
    $('alert').classList.remove('show');
  }
}

function alertMsg(message) {
  if ($('alert')) {
    $('alert').textContent = message;
    $('alert').classList.add('show');
  }
}

function initPayments() {
  const method = $('method');
  document.querySelectorAll('.emba-payment-category').forEach(category => {
    category.addEventListener('click', () => {
      document.querySelectorAll('.emba-payment-category').forEach(item => item.classList.remove('active'));
      category.classList.add('active');
      document.querySelectorAll('.emba-payment-options').forEach(group => {
        group.hidden = group.dataset.paymentOptions !== category.dataset.paymentCategory;
      });
      const card = document.querySelector(`.emba-payment-options:not([hidden]) .emba-payment-card`);
      if (card) card.click();
    });
  });
  document.querySelectorAll('.emba-payment-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.emba-payment-card').forEach(item => item.classList.remove('active'));
      card.classList.add('active');
      method.value = card.dataset.method;
    });
  });
}

function initSearch() {
  const toggle = $('searchToggleBtn');
  const wrap = $('dkSearchWrap');
  const input = $('gameSearch');
  const results = $('transactionSearchResults');
  if (!toggle || !wrap || !input || !results) return;

  const games = Object.keys(gameVisuals).map(name => ({
    name,
    publisher:gameVisuals[name][1],
    image:gameVisuals[name][0]
  })).concat([{ name:'Game Lainnya', publisher:'Pilih game lainnya', other:true }]);

  function render(query = '') {
    const normalized = query.trim().toLower();
    const matches = games.filter(item =>
      !normalized || item.name.toLower().includes(normalized) || item.publisher.toLower().includes(normalized)
    );
    const shown = normalized ? matches.slice(0,6) : [...matches.filter(item => !item.other).slice(0,5), matches.find(item => item.other)].filter(Boolean);
    results.innerHTML = shown.map(item => item.other
      ? '<button type="button" class="transaction-search-result" data-other="true"><span class="transaction-search-other">＋</span><span><strong>Game Lainnya</strong><small>Pilih game lainnya</small></span></button>'
      : `<button type="button" class="transaction-search-result" data-game="${item.name}"><img src="${item.image}" alt=""><span><strong>${item.name}</strong><small>${item.publisher}</small></span></button>`
    ).join('');
    results.querySelectorAll('[data-game]').forEach(button => {
      button.addEventListener('click', () => {
        window.location.href = 'transaksi.html?game=' + encodeURIComponent(button.dataset.game);
      });
    });
    results.querySelector('[data-other]')?.addEventListener('click', () => {
      window.location.href = 'index.html#topup';
    });
  }

  toggle.addEventListener('click', event => {
    event.stopPropagation();
    const open = !wrap.classList.contains('is-open');
    wrap.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      render();
      input.focus();
    }
  });
  input.addEventListener('input', () => render(input.value));
  document.addEventListener('click', event => {
    if (!wrap.contains(event.target) && !toggle.contains(event.target)) {
      wrap.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') wrap.classList.remove('is-open');
  });
}

async function submitOrder() {
  clearAlert();
  const player = $('player').value.trim();
  const server = $('server').value.trim();
  if (!player) {
    alertMsg('Masukkan ID pemain.');
    $('player').focus();
    return;
  }
  if (!$('server').closest('.field').hidden && !server) {
    alertMsg('Masukkan Server atau Zone ID.');
    $('server').focus();
    return;
  }
  if (!selected) {
    alertMsg('Pilih paket terlebih dahulu.');
    return;
  }
  const button = $('orderBtn');
  button.disabled = true;
  try {
    const response = await fetch('/api/orders', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({
        player_id:player,
        server_id:server,
        buyer_contact:$('contact').value.trim(),
        sku:selected.sku,
        payment_method:$('method').value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Pesanan gagal dibuat');
    const paymentResponse = await fetch(`/api/orders/${encodeURIComponent(data.order.id)}/payment`, { method:'POST' });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok || !payment.payment_url) throw new Error(payment.error || 'Pembayaran gagal dibuat');
    window.location.href = payment.payment_url;
  } catch (error) {
    alertMsg(error.message);
  } finally {
    button.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  configureGame();
  loadRates();
  initCurrency();
  initPayments();
  initSearch();
  loadProducts();
  $('orderBtn')?.addEventListener('click', submitOrder);
});
