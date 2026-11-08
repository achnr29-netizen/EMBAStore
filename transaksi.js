'use strict';

const currencyNames = {
  IDR: 'id-ID',
  MYR: 'ms-MY',
  SGD: 'en-SG',
  USD: 'en-US',
  PHP: 'en-PH',
  THB: 'th-TH'
};

let exchangeRates = { IDR: 1 };
let currentCurrency = 'IDR';
let products = [];
let game = 'Mobile Legends';
let selected = null;
const $ = id => document.getElementById(id);

function alertMsg(message) {
  const alertEl = $('alert');
  if (alertEl) {
    alertEl.textContent = message;
    alertEl.classList.add('show');
  }
}

function clearAlert() {
  const alertEl = $('alert');
  if (alertEl) {
    alertEl.textContent = '';
    alertEl.classList.remove('show');
  }
}

function money(amount) {
  const rate = exchangeRates[currentCurrency];
  if (!rate) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(amount);
  }

  return new Intl.NumberFormat(
    currencyNames[currentCurrency],
    {
      style: 'currency',
      currency: currentCurrency,
      maximumFractionDigits: currentCurrency === 'IDR' ? 0 : 2
    }
  ).format(Number(amount) * rate);
}

async function loadExchangeRates() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=IDR&symbols=MYR,SGD,USD,PHP,THB');
    if (!response.ok) throw new Error('Kurs mata uang tidak dapat dimuat.');
    const data = await response.json();
    exchangeRates = { IDR: 1, ...data.rates };
  } catch (error) {
    console.warn('Kurs mata uang belum berhasil dimuat.');
  }
}

function updatePrices() {
  document.querySelectorAll('.pack .price').forEach(price => {
    price.textContent = money(price.dataset.priceIdr);
  });

  if (selected && $('total')) {
    $('total').textContent = money(selected.price_idr);
  }
}

async function readJson(response) {
  try { return await response.json(); }
  catch { return {}; }
}

function normalizeGame(value) {
  return String(value ?? '').trim().toLocaleLowerCase('id-ID');
}

async function load() {
  const packageBox = $('packages');
  if (!packageBox) return;

  packageBox.innerHTML = '<p class="muted">Memuat paket…</p>';
  try {
    const response = await fetch('/api/products', {
      headers: { 'Accept': 'application/json' }
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(data.error || `Server gagal memuat paket (HTTP ${response.status}).`);
    }
    if (!Array.isArray(data.products)) {
      throw new Error('Format respons /api/products tidak sesuai.');
    }
    products = data.products.filter(product =>
      product && typeof product.game === 'string' &&
      typeof product.name === 'string' &&
      Number.isFinite(Number(product.price_idr)) && Number(product.price_idr) >= 0
    );
    render();
  } catch (error) {
    packageBox.innerHTML = '<p class="muted">Paket tidak dapat dimuat. Pastikan backend aktif.</p>';
    alertMsg(error.message || 'Tidak dapat terhubung ke server.');
  }
}

function render() {
  const packageBox = $('packages');
  if (!packageBox) return;

  const list = products.filter(product => normalizeGame(product.game) === normalizeGame(game));
  packageBox.innerHTML = '';
  selected = null;
  if ($('total')) $('total').textContent = money(0);
  if ($('summary')) $('summary').textContent = 'Pilih paket untuk melihat ringkasan.';

  if (!list.length) {
    packageBox.innerHTML = '<p class="muted">Belum ada paket untuk game ini.</p>';
    return;
  }

  list.forEach(product => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pack';
    button.setAttribute('aria-pressed', 'false');

    const quantity = document.createElement('div');
    quantity.className = 'qty';
    quantity.textContent = '💎 ' + product.name;

    const gameName = document.createElement('small');
    gameName.textContent = product.game;

    const price = document.createElement('div');
    price.className = 'price';
    price.dataset.priceIdr = product.price_idr;
    price.textContent = money(product.price_idr);

    button.append(quantity, gameName, price);

    button.addEventListener('click', () => {
      document.querySelectorAll('.pack').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      selected = product;
      
      const formattedPrice = money(product.price_idr);
      if ($('total')) $('total').textContent = formattedPrice;
      if ($('summary')) $('summary').textContent = product.game + ' • ' + product.name;

      // Sinkronisasi otomatis ke kartu pembayaran
      document.querySelectorAll('.pay-nominal').forEach(el => {
        el.textContent = formattedPrice;
      });

      clearAlert();
    });
    packageBox.appendChild(button);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadExchangeRates();

  const currencySelect = $('currency');
  if (currencySelect) {
    const currencyFlags = { IDR: '🇮🇩', MYR: '🇲🇾', SGD: '🇸🇬', USD: '🇺🇸', PHP: '🇵🇭', THB: '🇹🇭' };
    currencySelect.addEventListener('change', async event => {
      const newCurrency = event.target.value;
      if (!exchangeRates[newCurrency]) {
        try { await loadExchangeRates(); } catch {
          event.target.value = currentCurrency;
          alertMsg('Kurs gagal dimuat.');
          return;
        }
      }
      currentCurrency = newCurrency;
      const flagElement = $('currencyFlag');
      if (flagElement) flagElement.textContent = currencyFlags[currentCurrency] || '🌐';
      updatePrices();
      clearAlert();
    });
  }

  // Pilihan Metode Pembayaran menggunakan .emba-payment-card yang benar
  document.querySelectorAll('.emba-payment-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.emba-payment-card').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('active');
      card.setAttribute('aria-pressed', 'true');
      if ($('method')) $('method').value = card.dataset.method;
    });
  });

  // Tombol Promo
  const promoButton = $('applyPromo');
  if (promoButton) {
    promoButton.addEventListener('click', () => {
      const code = $('promoCode') ? $('promoCode').value.trim() : '';
      if ($('promoMessage')) {
        $('promoMessage').textContent = code
          ? 'Kode promo sudah dimasukkan. Validasi belum diaktifkan di backend.'
          : 'Masukkan kode promo terlebih dahulu.';
      }
    });
  }

  // Tombol Pesan / Bayar Sekarang
  const orderBtn = $('orderBtn');
  if (orderBtn) {
    orderBtn.addEventListener('click', async () => {
      clearAlert();
      if (!selected) return alertMsg('Pilih paket terlebih dahulu.');

      const player = $('player') ? $('player').value.trim() : '';
      if (!player) {
        if ($('player')) $('player').focus();
        return alertMsg('Masukkan ID pemain.');
      }
      if (!selected.sku) {
        return alertMsg('Paket ini tidak memiliki SKU.');
      }

      orderBtn.disabled = true;
      orderBtn.textContent = 'Memproses…';
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            player_id: player,
            server_id: $('server') ? $('server').value.trim() : '',
            buyer_contact: $('contact') ? $('contact').value.trim() : '',
            sku: selected.sku,
            payment_method: $('method') ? $('method').value : 'qris'
          })
        });
        const data = await readJson(response);
        if (!response.ok) throw new Error(data.error || 'Gagal membuat pesanan.');

        const paymentResponse = await fetch('/api/orders/' + encodeURIComponent(data.order.id) + '/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({})
        });
        const paymentData = await readJson(paymentResponse);
        if (!paymentResponse.ok || !paymentData.payment_url) {
          throw new Error(paymentData.error || 'Pembayaran gagal dibuat.');
        }

        window.location.href = paymentData.payment_url;
      } catch (error) {
        alertMsg(error.message || 'Terjadi kesalahan.');
      } finally {
        orderBtn.disabled = false;
        orderBtn.innerHTML = 'Bayar Sekarang <span aria-hidden="true">→</span>';
      }
    });
  }

  // Parameter Game URL
  const pageParams = new URLSearchParams(window.location.search);
  const requestedGame = pageParams.get('game');
  if (requestedGame) {
    game = requestedGame;
    const playerTitle = $('player-title');
    if (playerTitle) playerTitle.textContent = 'Data pemain — ' + game;
  } else {
    window.location.replace('index.html');
    return;
  }

  // Sidebar Menu Logic
  const dkSidebar = $('dkSidebar');
  const dkOverlay = $('dkOverlay');
  const dkMenuButton = $('menuBtn');
  const dkCloseButton = $('dkClose');

  function openSidebar() {
    if (!dkSidebar || !dkOverlay) return;
    dkSidebar.classList.add('is-open');
    dkOverlay.classList.add('is-open');
    dkSidebar.removeAttribute('inert');
    dkSidebar.setAttribute('aria-hidden', 'false');
    document.body.classList.add('dk-menu-open');
    if (dkMenuButton) dkMenuButton.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    if (!dkSidebar || !dkOverlay) return;
    dkSidebar.classList.remove('is-open');
    dkOverlay.classList.remove('is-open');
    dkSidebar.setAttribute('inert', '');
    dkSidebar.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('dk-menu-open');
    if (dkMenuButton) dkMenuButton.setAttribute('aria-expanded', 'false');
  }

  if (dkMenuButton && dkSidebar && dkOverlay && dkCloseButton) {
    dkMenuButton.addEventListener('click', e => {
      e.stopPropagation();
      if (dkSidebar.classList.contains('is-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
    dkCloseButton.addEventListener('click', closeSidebar);
    dkOverlay.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && dkSidebar.classList.contains('is-open')) closeSidebar();
    });
  }

  load();
});

// Konfigurasi Banner & Gambar Berdasarkan Game yang Dipilih
const gameVisuals = {
  'Mobile Legends': { image: 'Images/mobile-legends.png', publisher: 'Moonton', product: 'Diamond' },
  'Free Fire': { image: 'Images/free-fire.png', publisher: 'Garena', product: 'Diamond' },
  'PUBG Mobile': { image: 'Images/pubg-mobile.png', publisher: 'Level Infinite', product: 'UC' },
  'Genshin Impact': { image: 'Images/genshin-impact.png', publisher: 'HoYoverse', product: 'Genesis Crystals' },
  'Valorant': { image: 'Images/valorant.png', publisher: 'Riot Games', product: 'VP' },
  'Honor of Kings': { image: 'Images/honor-of-kings.png', publisher: 'Level Infinite', product: 'Tokens' },
  'Call of Duty: Mobile': { image: 'Images/cod-mobile.png', publisher: 'Activision', product: 'CP' }
};

const pageParams = new URLSearchParams(window.location.search);
const requestedGame = pageParams.get('game') || 'Mobile Legends';

game = requestedGame;
const visual = gameVisuals[game] || gameVisuals['Mobile Legends'];

const gameHero = $('transactionGameHero');
const gameIcon = $('transactionGameIcon');
const gameName = $('transactionGameName');
const gamePublisher = $('transactionGamePublisher');

if (gameHero) gameHero.style.setProperty('--game-art', `url("${visual.image}")`);
if (gameIcon) { gameIcon.src = visual.image; gameIcon.alt = game; }
if (gameName) gameName.textContent = game;
if (gamePublisher) gamePublisher.textContent = `${visual.publisher} • ${visual.product}`;

// Skrip otomatis penyinkron harga kartu pembayaran secara real-time
setInterval(() => {
  const totalElement = document.getElementById('total');
  if (totalElement) {
    const currentTotal = totalElement.textContent;
    if (currentTotal && currentTotal !== 'Rp0') {
      document.querySelectorAll('.pay-nominal').forEach(el => {
        if (el.textContent !== currentTotal) {
          el.textContent = currentTotal;
        }
      });
    }
  }
}, 300);


document.addEventListener('DOMContentLoaded', () => {
  const searchToggle = document.getElementById('searchToggleBtn');
  const searchWrap = document.getElementById('dkSearchWrap');
  const searchInput = document.getElementById('gameSearch');

  if (!searchToggle || !searchWrap) return;

  // Buka dan tutup popup search
  searchToggle.addEventListener('click', (event) => {
    event.stopPropagation();

    const isOpen = searchWrap.classList.toggle('is-open');

    searchToggle.setAttribute(
      'aria-expanded',
      String(isOpen)
    );

    if (isOpen && searchInput) {
      searchInput.focus();
    }
  });

  // Klik di luar popup untuk menutup
  document.addEventListener('click', (event) => {
    if (
      !searchWrap.contains(event.target) &&
      !searchToggle.contains(event.target)
    ) {
      searchWrap.classList.remove('is-open');
      searchToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Tutup dengan tombol Escape
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      searchWrap.classList.remove('is-open');
      searchToggle.setAttribute('aria-expanded', 'false');
    }
  });
});
