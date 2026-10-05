/**
 * Solana Beauty - Main Client-side Engine
 * Dynamic Catalog, Category Navigation, Lightbox, and Booking
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  loadSiteSettings();
  loadCatalogData();
  initBookingForm();
  initLightbox();
});

// -------------------------------------------------------------
// 1. Navigation & Scroll Behavior
// -------------------------------------------------------------
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const toggleBtn = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', isOpen);
    });

    // Close menu on nav item click
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

let cachedFallbackData = null;

async function getFallbackData() {
  if (cachedFallbackData) return cachedFallbackData;
  try {
    const res = await fetch('data-fallback.json');
    if (res.ok) {
      cachedFallbackData = await res.json();
      return cachedFallbackData;
    }
  } catch (e) {}
  return null;
}

// -------------------------------------------------------------
// 2. Load Site Settings & Social Channels
// -------------------------------------------------------------
async function loadSiteSettings() {
  try {
    let s = null;
    try {
      const res = await fetch('/api/settings');
      if (res.ok) s = await res.json();
    } catch (e) {}

    if (!s) {
      const fallback = await getFallbackData();
      if (fallback && fallback.settings) s = fallback.settings;
    }

    if (!s) return;

    if (s.site_title) document.title = s.site_title;

    // Helper for safe text setting
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) el.innerText = val;
    };

    setText('hero-tag-text', s.hero_tag);
    setText('hero-title-main', s.hero_title_main);
    setText('hero-tagline-text', s.tagline);

    // Hero image
    const heroImg = document.getElementById('hero-img-element');
    if (heroImg && s.hero_image_url) {
      heroImg.src = s.hero_image_url;
    }

    setText('hero-badge-title', s.hero_badge_title);
    setText('hero-badge-desc', s.hero_badge_desc);

    // Stats
    setText('stat-num-1', s.stat_num_1);
    setText('stat-lbl-1', s.stat_lbl_1);
    setText('stat-num-2', s.stat_num_2);
    setText('stat-lbl-2', s.stat_lbl_2);
    setText('stat-num-3', s.stat_num_3);
    setText('stat-lbl-3', s.stat_lbl_3);

    // Philosophy & Standards
    setText('standards-badge', s.standards_badge);
    setText('standards-title', s.standards_title);
    setText('standards-subtitle', s.standards_subtitle);
    setText('card-title-1', s.card_title_1);
    setText('card-desc-1', s.card_desc_1);
    setText('card-title-2', s.card_title_2);
    setText('card-desc-2', s.card_desc_2);
    setText('card-title-3', s.card_title_3);
    setText('card-desc-3', s.card_desc_3);

    // Services & Portfolio Headers
    setText('services-badge', s.services_badge);
    setText('services-title', s.services_title);
    setText('services-subtitle', s.services_subtitle);

    setText('gallery-badge', s.gallery_badge);
    setText('gallery-title', s.gallery_title);
    setText('gallery-subtitle', s.gallery_subtitle);

    setText('booking-badge-header', s.booking_badge);
    setText('booking-title', s.booking_title);
    setText('booking-desc', s.booking_desc);

    // Contacts & Footer
    setText('studio-phone', s.phone);
    setText('studio-address', s.address);
    setText('footer-about', s.about_text);
    if (s.working_hours && document.getElementById('footer-hours')) {
      document.getElementById('footer-hours').innerHTML = s.working_hours.replace(/\|/g, '<br>');
    }

    // Direct WhatsApp Link
    const waBtn = document.getElementById('direct-whatsapp');
    if (waBtn && s.whatsapp) {
      const cleanWa = s.whatsapp.replace(/[^0-9]/g, '');
      const waMsg = encodeURIComponent("Hello Solana Beauty, I would like to inquire about booking an appointment!");
      waBtn.href = `https://wa.me/${cleanWa}?text=${waMsg}`;
    }

    // Direct Telegram Link
    const tgBtn = document.getElementById('direct-telegram');
    if (tgBtn && s.telegram) {
      const cleanTg = s.telegram.replace('@', '');
      tgBtn.href = `https://t.me/${cleanTg}`;
    }
  } catch (err) {
    console.warn('Using default site settings:', err);
  }
}

// -------------------------------------------------------------
// 3. Dynamic Catalog & Gallery Loading
// -------------------------------------------------------------
async function loadCatalogData() {
  const tabsContainer = document.getElementById('category-tabs');
  const catalogContent = document.getElementById('catalog-content');
  const galleryGrid = document.getElementById('full-gallery');
  const serviceSelect = document.getElementById('service_name');

  try {
    let categories = null;
    try {
      const res = await fetch('/api/catalog');
      if (res.ok) categories = await res.json();
    } catch (e) {}

    if (!categories) {
      const fallback = await getFallbackData();
      if (fallback && fallback.catalog) categories = fallback.catalog;
    }

    if (!categories || categories.length === 0) {
      catalogContent.innerHTML = '<div class="text-center" style="padding: 40px 0;">No services currently published. Check back soon!</div>';
      return;
    }

    // Build Category Tabs
    let tabsHtml = `<button class="cat-tab-btn active" data-filter="all">All Procedures</button>`;
    categories.forEach(cat => {
      tabsHtml += `<button class="cat-tab-btn" data-filter="cat-${cat.id}">${escapeHtml(cat.title)}</button>`;
    });
    tabsContainer.innerHTML = tabsHtml;

    // Build Catalog Sections & Services
    let catalogHtml = '';
    const allGalleryItems = [];

    // Reset Service Select Options
    serviceSelect.innerHTML = '<option value="">Select a procedure...</option>';

    categories.forEach(cat => {
      catalogHtml += `
        <div class="category-block" id="cat-${cat.id}">
          <div class="cat-block-header">
            <h3>${escapeHtml(cat.title)}</h3>
            ${cat.description ? `<p>${escapeHtml(cat.description)}</p>` : ''}
          </div>

          <div class="services-grid">
            ${cat.services && cat.services.length > 0 ? cat.services.map(srv => {
              // Add to select options
              const opt = document.createElement('option');
              opt.value = `${cat.title} - ${srv.title}`;
              opt.textContent = `${srv.title} (${srv.price || 'Consultation'})`;
              serviceSelect.appendChild(opt);

              return `
                <div class="service-card">
                  <div>
                    <div class="service-head">
                      <span class="service-name">${escapeHtml(srv.title)}</span>
                      <span class="service-price">${escapeHtml(srv.price || '')}</span>
                    </div>
                    <p class="service-desc">${escapeHtml(srv.description || '')}</p>
                  </div>
                  <div class="service-foot">
                    <span class="service-meta">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      ${escapeHtml(srv.duration || 'Flexible')}
                    </span>
                    <a href="#appointment" class="btn btn-outline" style="padding: 8px 18px; font-size: 0.8rem;" onclick="selectServiceForBooking('${escapeHtml(srv.title)}')">
                      Book
                    </a>
                  </div>
                </div>
              `;
            }).join('') : '<p style="color: var(--text-muted);">No services listed under this section yet.</p>'}
          </div>
        </div>
      `;

      // Collect gallery works
      if (cat.gallery && cat.gallery.length > 0) {
        cat.gallery.forEach(img => {
          allGalleryItems.push({
            ...img,
            categoryTitle: cat.title
          });
        });
      }
    });

    catalogContent.innerHTML = catalogHtml;

    // Render Gallery
    if (allGalleryItems.length > 0) {
      galleryGrid.innerHTML = allGalleryItems.map(item => `
        <div class="gallery-card" onclick="openLightbox('${item.image_url}', '${escapeHtml(item.title || item.categoryTitle)}')">
          <img src="${item.image_url}" alt="${escapeHtml(item.title || 'Solana Beauty work')}" loading="lazy" />
          <div class="gallery-zoom-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </div>
          <div class="gallery-overlay">
            <span class="gallery-title">${escapeHtml(item.title || item.categoryTitle)}</span>
          </div>
        </div>
      `).join('');
    } else {
      galleryGrid.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: var(--text-muted);">Portfolio photos will be added shortly.</p>';
    }

    // Attach Category Tab Filter Handlers
    tabsContainer.querySelectorAll('.cat-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tabsContainer.querySelectorAll('.cat-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');
        const blocks = catalogContent.querySelectorAll('.category-block');

        blocks.forEach(block => {
          if (filter === 'all' || block.id === filter) {
            block.style.display = 'block';
          } else {
            block.style.display = 'none';
          }
        });
      });
    });

  } catch (err) {
    catalogContent.innerHTML = '<div class="text-center" style="color: red;">Failed to load services. Please refresh.</div>';
  }
}

// Helper: auto-select service when clicking 'Book' on card
window.selectServiceForBooking = function(serviceName) {
  const select = document.getElementById('service_name');
  if (!select) return;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].text.includes(serviceName)) {
      select.selectedIndex = i;
      break;
    }
  }
};

// -------------------------------------------------------------
// 4. Accessible Native Lightbox
// -------------------------------------------------------------
function initLightbox() {
  const dialog = document.getElementById('lightbox-dialog');
  const closeBtn = document.getElementById('lightbox-close');

  if (!dialog) return;

  closeBtn.addEventListener('click', () => dialog.close());

  // Click outside backdrop to close
  dialog.addEventListener('click', (e) => {
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
      && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      dialog.close();
    }
  });
}

window.openLightbox = function(imageUrl, title) {
  const dialog = document.getElementById('lightbox-dialog');
  const img = document.getElementById('lightbox-img');
  const caption = document.getElementById('lightbox-caption');

  if (!dialog || !img) return;

  img.src = imageUrl;
  img.alt = title;
  caption.textContent = title;
  dialog.showModal();
};

// -------------------------------------------------------------
// 5. Booking Form Submission
// -------------------------------------------------------------
function initBookingForm() {
  const form = document.getElementById('booking-form');
  const alertBox = document.getElementById('booking-alert');
  const submitBtn = document.getElementById('btn-submit-booking');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting Request...';
    alertBox.style.display = 'none';

    const payload = {
      client_name: form.client_name.value,
      client_phone: form.client_phone.value,
      service_name: form.service_name.value,
      preferred_date: form.preferred_date.value,
      comment: form.comment.value
    };

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alertBox.style.display = 'block';
        alertBox.style.backgroundColor = '#EBF9F1';
        alertBox.style.color = '#1F7A4D';
        alertBox.style.border = '1px solid #C3EED5';
        alertBox.innerHTML = `<strong>Appointment Requested!</strong> Thank you, ${escapeHtml(payload.client_name)}. We will contact you shortly to confirm the appointment.`;
        form.reset();
      } else {
        throw new Error(data.error || 'Failed to submit booking');
      }
    } catch (err) {
      alertBox.style.display = 'block';
      alertBox.style.backgroundColor = '#FDF2F2';
      alertBox.style.color = '#B91C1C';
      alertBox.style.border = '1px solid #F87171';
      alertBox.textContent = err.message || 'An error occurred. Please try WhatsApp directly.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Appointment Request';
    }
  });
}

// Safe HTML sanitizer
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
