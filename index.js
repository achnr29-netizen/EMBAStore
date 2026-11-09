'use strict';

const currencyNames = {
  IDR: 'id-ID',
  MYR: 'ms-MY',
  SGD: 'en-SG',
  USD: 'en-US',
  PHP: 'en-PH',
  THB: 'th-TH'
};

const currencyFlags = {
  IDR: '🇮🇩', 
  MYR: '🇲🇾', 
  SGD: '🇸🇬',
  USD: '🇺🇸', 
  PHP: '🇵🇭', 
  THB: '🇹🇭'
};

let exchangeRates = { IDR: 1 };
let currentCurrency = 'IDR';

const $ = id => document.getElementById(id);

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

function initCurrency() {
  const currencySelect = $('currency');
  if (currencySelect) {
    currencySelect.addEventListener('change', async event => {
      const newCurrency = event.target.value;
      if (!exchangeRates[newCurrency]) {
        try {
          await loadExchangeRates();
        } catch (error) {
          event.target.value = currentCurrency;
          return;
        }
      }
      currentCurrency = newCurrency;
      const flagElement = $('currencyFlag');
      if (flagElement) flagElement.textContent = currencyFlags[currentCurrency] || '🌐';
    });
  }
}

function initGameNavigation() {
  const gamesContainer = $('games');
  if (gamesContainer) {
    gamesContainer.addEventListener('click', function(event) {
      const button = event.target.closest('button.game');
      if (!button) return;
      const selectedGame = button.dataset.game;
      window.location.href = 'transaksi.html?game=' + encodeURIComponent(selectedGame);
    });
  }
}

function initEmbaMainMenu() {
  const button = document.getElementById('menuBtn');
  const sidebar = document.getElementById('dkSidebar');
  const overlay = document.getElementById('dkOverlay');
  const closeButton = document.getElementById('dkClose');
  if (!button || !sidebar || !overlay || !closeButton) return;

  function openMenu() {
    sidebar.classList.add('is-open');
    overlay.classList.add('is-open');
    sidebar.removeAttribute('inert');
    sidebar.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
    document.body.classList.add('dk-menu-open');
  }

  function closeMenu() {
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-open');
    sidebar.setAttribute('inert', '');
    sidebar.setAttribute('aria-hidden', 'true');
    button.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('dk-menu-open');
  }

  button.addEventListener('click', function (event) {
    event.preventDefault();
    openMenu();
  });
  closeButton.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);
  
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu();
  });
  
  sidebar.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });
}

function initBannerSlider() {
  const track = document.getElementById('embaBannerTrack');
  const slider = document.getElementById('embaBannerSlider');
  const dotsBox = document.getElementById('embaBannerDots');
  const prev = document.getElementById('embaBannerPrev');
  const next = document.getElementById('embaBannerNext');

  if (!track || !slider || !dotsBox) return;

  const slides = [...track.children];
  const dots = [...dotsBox.children];

  if (slides.length === 0) return;

  let current = 0;
  let autoSlide;

  function goTo(index) {
    current = (index + slides.length) % slides.length;

    track.scrollTo({
      left: slides[current].offsetLeft,
      behavior: 'smooth'
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === current);
    });
  }

  function startAuto() {
    clearInterval(autoSlide);
    autoSlide = setInterval(() => {
      goTo(current + 1);
    }, 4000);
  }

  function stopAuto() {
    clearInterval(autoSlide);
  }

  next?.addEventListener('click', () => {
    goTo(current + 1);
    startAuto();
  });

  prev?.addEventListener('click', () => {
    goTo(current - 1);
    startAuto();
  });

  track.addEventListener('scroll', () => {
    const width = track.clientWidth;
    if (!width) return;

    const index = Math.round(track.scrollLeft / width);

    if (index !== current && index >= 0 && index < slides.length) {
      current = index;
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === current);
      });
    }
  }, { passive: true });

  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);
  slider.addEventListener('touchstart', stopAuto, { passive: true });
  slider.addEventListener('touchend', startAuto, { passive: true });

  startAuto();
}


/* ========================================
   EMBA STORE SEARCH TOGGLE FIX
======================================== */

document.addEventListener("DOMContentLoaded", function () {

  const searchIconBtn = document.getElementById("searchIconBtn");
  const searchWrap = document.getElementById("dkSearchWrap");
  const searchClose = document.getElementById("dkSearchClose");
  const searchInput = document.getElementById("dkSearchInput");

  if (!searchIconBtn || !searchWrap || !searchClose) {
    console.warn("EMBA Store: Elemen search tidak ditemukan.");
    return;
  }

  // Buka pencarian
  function openSearch() {
    searchWrap.classList.add("active");

    searchIconBtn.setAttribute("aria-expanded", "true");

    searchIconBtn.style.visibility = "hidden";
    searchIconBtn.style.pointerEvents = "none";

    if (searchInput) {
      setTimeout(function () {
        searchInput.focus();
      }, 100);
    }
  }

  // Tutup pencarian
  function closeSearch() {
    searchWrap.classList.remove("active");

    searchIconBtn.setAttribute("aria-expanded", "false");

    searchIconBtn.style.visibility = "visible";
    searchIconBtn.style.pointerEvents = "auto";

    if (searchInput) {
      searchInput.value = "";

      // Memicu event input jika ada filter pencarian
      searchInput.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }
  }

  // Klik tombol search
  searchIconBtn.addEventListener("click", function (event) {
    event.preventDefault();
    openSearch();
  });

  // Klik tombol X
  searchClose.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();

    closeSearch();
  });

  // Escape untuk menutup search
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && searchWrap.classList.contains("active")) {
      closeSearch();
    }
  });

});
        
      
