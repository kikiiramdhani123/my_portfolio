/* =============================================
   TALLOWNARA — Main JavaScript
   ============================================= */

/* ---- Navbar: scroll effect ---- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

/* ---- Hamburger menu ---- */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

document.addEventListener('click', (e) => {
  if (!navbar.contains(e.target)) {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  }
});

/* ---- Contact form ---- */
const contactForm = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const btn  = contactForm.querySelector('button[type="submit"]');
  const lang = document.documentElement.lang || 'en';
  btn.textContent = lang === 'id' ? 'Mengirim...' : 'Sending...';
  btn.disabled = true;
  setTimeout(() => {
    contactForm.style.display = 'none';
    formSuccess.classList.add('visible');
  }, 1000);
});

/* ---- Fade-in on scroll ---- */
function initFadeObserver() {
  const fadeEls = document.querySelectorAll(
    '.product-card, .benefit-card, .testimonial-card, .process-step, .pillar, .channel'
  );
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  fadeEls.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = `opacity 0.5s ease ${i * 0.06}s, transform 0.5s ease ${i * 0.06}s`;
    observer.observe(el);
  });
}

document.head.insertAdjacentHTML('beforeend', `
  <style>
    .product-card.visible,
    .benefit-card.visible,
    .testimonial-card.visible,
    .process-step.visible,
    .pillar.visible,
    .channel.visible {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  </style>
`);

/* ---- Active nav link on scroll ---- */
const sections   = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 100) current = section.getAttribute('id');
  });
  navAnchors.forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  });
}, { passive: true });

document.head.insertAdjacentHTML('beforeend', `
  <style>
    .nav-links a.active { color: var(--brown-900) !important; font-weight: 600; }
  </style>
`);

/* ============================================
   LANGUAGE SWITCHER
   ============================================ */

const STORAGE_KEY = 'tallownara_lang';
let _currentLang  = 'en';
let _dbProducts   = [];   // products loaded from API

function applyLanguage(lang) {
  const dict = TRANSLATIONS[lang];
  if (!dict) return;
  _currentLang = lang;
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) el.textContent = dict[key];
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key] !== undefined) el.placeholder = dict[key];
  });

  // Switch product descriptions loaded from DB
  document.querySelectorAll('.product-desc[data-desc-en]').forEach(el => {
    el.textContent = lang === 'id'
      ? (el.getAttribute('data-desc-id') || el.getAttribute('data-desc-en'))
      : el.getAttribute('data-desc-en');
  });

  // Re-label read-more buttons
  document.querySelectorAll('.read-more-btn').forEach(btn => {
    const expanded = btn.previousElementSibling?.classList.contains('expanded');
    btn.textContent = expanded
      ? (lang === 'id' ? 'Tampilkan lebih sedikit' : 'Show less')
      : (lang === 'id' ? 'Baca selengkapnya'       : 'Read more');
  });

  document.title = lang === 'id'
    ? 'Tallownara — Skincare & Obat Tallow Murni'
    : 'Tallownara — Pure Tallow Skincare & Medicine';

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  localStorage.setItem(STORAGE_KEY, lang);
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => applyLanguage(btn.getAttribute('data-lang')));
});

/* ============================================
   DYNAMIC CONTENT FROM API
   ============================================ */

function getProductEmoji(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('baby') || n.includes('bayi')) return '👶';
  if (n.includes('salve') || n.includes('salep')) return '🩹';
  if (n.includes('whipped') || n.includes('kocok')) return '✨';
  return '🫙';
}

function starStr(rating, count) {
  const full  = Math.round(parseFloat(rating) || 5);
  const empty = 5 - full;
  let s = '★'.repeat(full) + '☆'.repeat(empty);
  if (count) s += ` <span class="sold-count">· ${count} terjual</span>`;
  return s;
}

function buildProductCard(p, idx) {
  const isFirst = idx === 0;

  const badgeHtml = isFirst
    ? `<div class="product-badge" data-i18n="products.bestseller">Best Seller</div>`
    : '';
  const btnClass = isFirst ? 'btn-primary' : 'btn-outline';
  const emoji = getProductEmoji(p.name);

  const imageHtml = p.image_url
    ? `<img src="${p.image_url}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div class="placeholder-label">
         <span class="ph-icon">${emoji}</span>
         <span>${p.name}</span>
       </div>`;

  const ratingHtml = `<div class="product-rating-row">${starStr(p.rating_star, p.sold || 0)}</div>`;

  const tagsHtml = (p.variants || []).slice(0, 3).map(v => `<li>${v}</li>`).join('') +
    (p.price ? `<li class="price-tag">${p.price}</li>` : '');

  return `
    <div class="product-card${isFirst ? ' featured' : ''}">
      ${badgeHtml}
      <div class="placeholder-image medium" style="${p.image_url ? 'padding:0;overflow:hidden;' : ''}">
        ${imageHtml}
      </div>
      <div class="product-info">
        <h3>${p.name}</h3>
        ${ratingHtml}
        <div class="desc-clamp">
          <p class="product-desc"
             data-desc-en="${(p.description_en || '').replace(/"/g, '&quot;')}"
             data-desc-id="${(p.description_id || '').replace(/"/g, '&quot;')}">
            ${_currentLang === 'id' ? (p.description_id || p.description_en) : p.description_en}
          </p>
        </div>
        <button class="read-more-btn" onclick="toggleReadMore(this)">
          ${_currentLang === 'id' ? 'Baca selengkapnya' : 'Read more'}
        </button>
        <ul class="product-tags">${tagsHtml}</ul>
        <a href="${p.shopee_url || 'https://shopee.co.id/tallownara_id'}"
           target="_blank" rel="noopener"
           class="btn ${btnClass} btn-sm" data-i18n="products.order">
          ${_currentLang === 'id' ? 'Pesan Sekarang' : 'Order Now'}
        </a>
      </div>
    </div>`;
}

function buildTestimonialCard(r, idx) {
  const featured = idx === 1 ? ' featured' : '';
  const stars    = '★'.repeat(r.stars || 5) + '☆'.repeat(5 - (r.stars || 5));
  const initial  = (r.reviewer || 'P')[0].toUpperCase();
  const location = r.location
    ? `${r.product_name || ''} · ${r.location} · ${_currentLang === 'id' ? 'Pelanggan Terverifikasi' : 'Verified Customer'}`
    : `${r.product_name || ''} · ${_currentLang === 'id' ? 'Pelanggan Terverifikasi' : 'Verified Customer'}`;

  return `
    <div class="testimonial-card${featured}">
      <div class="stars">${stars}</div>
      <div class="desc-clamp">
        <p>"${r.text}"</p>
      </div>
      <button class="read-more-btn" onclick="toggleReadMore(this)">
        ${_currentLang === 'id' ? 'Baca selengkapnya' : 'Read more'}
      </button>
      <div class="testimonial-author">
        <div class="author-avatar">${initial}</div>
        <div>
          <strong>${r.reviewer || 'Pelanggan'}</strong>
          <small>${location}</small>
        </div>
      </div>
    </div>`;
}

function buildSelectOptions(products) {
  const lang = _currentLang;
  const defaultOpt = lang === 'id' ? 'Pilih produk...' : 'Select a product...';
  const infoOpt    = lang === 'id' ? 'Hanya ingin informasi' : 'Just want information';
  return `<option value="">${defaultOpt}</option>` +
    products.map(p => `<option value="${p.id}">${p.name}</option>`).join('') +
    `<option>${infoOpt}</option>`;
}

/* ============================================
   READ MORE / SHOW LESS
   ============================================ */

function toggleReadMore(btn) {
  const clamp    = btn.previousElementSibling;   // .desc-clamp
  const expanded = clamp.classList.toggle('expanded');
  const isId     = document.documentElement.lang === 'id';
  btn.textContent = expanded
    ? (isId ? 'Tampilkan lebih sedikit' : 'Show less')
    : (isId ? 'Baca selengkapnya'       : 'Read more');
}

/* ============================================
   ABOUT SECTION IMAGE SLIDER
   ============================================ */

function buildAboutSlider(images) {
  const slider = document.getElementById('aboutSlider');
  if (!slider) return;

  // No images → keep the fallback placeholder
  if (!images.length) return;

  // Single image → plain image, no controls
  if (images.length === 1) {
    slider.innerHTML = `
      <img src="${images[0]}" alt="Tallownara product"
           style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;" />`;
    return;
  }

  // Multiple images → full slider
  const slides = images.map(src =>
    `<div class="about-slider-slide">
       <img src="${src}" alt="Tallownara product" loading="lazy" />
     </div>`
  ).join('');

  const dots = images.map((_, i) =>
    `<button class="slider-dot${i === 0 ? ' active' : ''}" data-idx="${i}" aria-label="Slide ${i + 1}"></button>`
  ).join('');

  slider.innerHTML = `
    <div class="about-slider-track" id="sliderTrack">${slides}</div>
    <button class="slider-btn prev" id="sliderPrev" aria-label="Previous">&#8592;</button>
    <button class="slider-btn next" id="sliderNext" aria-label="Next">&#8594;</button>
    <div class="slider-dots" id="sliderDots">${dots}</div>`;

  let current   = 0;
  let autoTimer = null;
  const track   = document.getElementById('sliderTrack');
  const dotsEl  = document.getElementById('sliderDots');

  function goTo(idx) {
    current = (idx + images.length) % images.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    dotsEl.querySelectorAll('.slider-dot').forEach((d, i) =>
      d.classList.toggle('active', i === current)
    );
  }

  function startAuto() {
    autoTimer = setInterval(() => goTo(current + 1), 4000);
  }
  function resetAuto() {
    clearInterval(autoTimer);
    startAuto();
  }

  document.getElementById('sliderPrev').addEventListener('click', () => { goTo(current - 1); resetAuto(); });
  document.getElementById('sliderNext').addEventListener('click', () => { goTo(current + 1); resetAuto(); });
  dotsEl.querySelectorAll('.slider-dot').forEach(dot => {
    dot.addEventListener('click', () => { goTo(parseInt(dot.dataset.idx)); resetAuto(); });
  });

  // Touch swipe support
  let touchStartX = 0;
  slider.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend',   e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) { goTo(diff > 0 ? current + 1 : current - 1); resetAuto(); }
  });

  startAuto();
  // Pause on hover
  slider.addEventListener('mouseenter', () => clearInterval(autoTimer));
  slider.addEventListener('mouseleave', startAuto);
}

async function loadFromAPI() {
  try {
    const [prods, revs] = await Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/reviews?landing=1').then(r => r.json()),
    ]);

    _dbProducts = prods;

    // ── About slider: collect all product images that exist ──
    const productImages = prods.map(p => p.image_url).filter(Boolean);
    buildAboutSlider(productImages);

    // ── Products grid ──
    const grid = document.querySelector('.products-grid');
    if (grid && prods.length) {
      grid.innerHTML = prods.map((p, i) => buildProductCard(p, i)).join('');
    }

    // ── Testimonials ──
    const tGrid = document.querySelector('.testimonials-grid');
    if (tGrid && revs.length) {
      tGrid.innerHTML = revs.slice(0, 3).map((r, i) => buildTestimonialCard(r, i)).join('');
    }

    // ── Contact form select ──
    const sel = document.getElementById('product');
    if (sel) sel.innerHTML = buildSelectOptions(prods);

    // ── Footer product links ──
    const footerCol = document.querySelector('.footer-col strong[data-i18n="footer.col1title"]');
    if (footerCol && prods.length) {
      const parent = footerCol.parentElement;
      // Remove old product links (keep the strong tag)
      Array.from(parent.querySelectorAll('a')).forEach(a => a.remove());
      prods.forEach(p => {
        const a = document.createElement('a');
        a.href = '#products'; a.textContent = p.name;
        parent.appendChild(a);
      });
    }

    // Re-apply language to newly rendered elements
    applyLanguage(_currentLang);

    // Re-init fade-in observer for new elements
    initFadeObserver();

  } catch (e) {
    // API not reachable (e.g. opening file directly) — fall back to static HTML
    console.info('API not available, using static content.', e.message);
    initFadeObserver();
  }
}

/* ── Init ── */
const savedLang = localStorage.getItem(STORAGE_KEY) || 'en';
applyLanguage(savedLang);   // apply language first (static strings)
loadFromAPI();              // then overlay with DB data
