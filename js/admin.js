/**
 * Solana Beauty - Admin Dashboard Logic
 * Full site editing, interactive guide for mom, photo uploads & bookings
 */

document.addEventListener('DOMContentLoaded', async () => {
  const isAuth = await checkAuth();
  if (!isAuth) {
    window.location.href = '/admin-login';
    return;
  }

  initTabs();
  initLogout();
  initGuideModal();
  loadAdminCatalog();
  loadBookings();
  loadAllSettings();
  initForms();
});

// -------------------------------------------------------------
// Auth Check
// -------------------------------------------------------------
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/verify');
    const data = await res.json();
    return data && data.authenticated;
  } catch (e) {
    return false;
  }
}

function initLogout() {
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin-login';
  });
}

// -------------------------------------------------------------
// Interactive Guide Modal for Mom
// -------------------------------------------------------------
function initGuideModal() {
  const dialog = document.getElementById('guide-dialog');
  const openBtn = document.getElementById('btn-open-guide');
  const closeIcon = document.getElementById('guide-close');
  const closeBtn = document.getElementById('guide-close-btn');

  if (!dialog) return;

  const openGuide = () => dialog.showModal();
  const closeGuide = () => dialog.close();

  if (openBtn) openBtn.addEventListener('click', openGuide);
  if (closeIcon) closeIcon.addEventListener('click', closeGuide);
  if (closeBtn) closeBtn.addEventListener('click', closeGuide);

  // Close when clicking outside modal backdrop
  dialog.addEventListener('click', (e) => {
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
      && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      dialog.close();
    }
  });

  // Automatically show guide on the first visit to help mom!
  if (!localStorage.getItem('solana_guide_shown')) {
    setTimeout(() => {
      openGuide();
      localStorage.setItem('solana_guide_shown', 'true');
    }, 600);
  }
}

// -------------------------------------------------------------
// Navigation Tabs
// -------------------------------------------------------------
function initTabs() {
  const buttons = document.querySelectorAll('.sidebar-btn');
  const views = document.querySelectorAll('.admin-view');
  const title = document.getElementById('topbar-title');
  const desc = document.getElementById('topbar-desc');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');

      if (tabId === 'tab-categories') {
        title.textContent = 'Service Sections & Photos';
        desc.textContent = 'Manage procedures, prices, and upload your real results.';
      }
      if (tabId === 'tab-hero') {
        title.textContent = 'Hero & Cover Section';
        desc.textContent = 'Customize the top banner headline, cover picture, and studio counters.';
      }
      if (tabId === 'tab-content') {
        title.textContent = 'Page Blocks & Standards';
        desc.textContent = 'Edit the clinical standards cards and section headers.';
      }
      if (tabId === 'tab-bookings') {
        title.textContent = 'Client Requests & Leads';
        desc.textContent = 'Clients who submitted their details for an appointment.';
        loadBookings();
      }
      if (tabId === 'tab-settings') {
        title.textContent = 'Studio Contacts & Settings';
        desc.textContent = 'Direct messaging numbers, address, and login credentials.';
      }
    });
  });
}

// -------------------------------------------------------------
// Categories & Services & Photos Management
// -------------------------------------------------------------
async function loadAdminCatalog() {
  const container = document.getElementById('admin-categories-list');
  try {
    const res = await fetch('/api/catalog');
    const categories = await res.json();

    if (!categories || categories.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No sections created yet. Add your first section above!</div>';
      return;
    }

    container.innerHTML = categories.map(cat => `
      <div class="cat-mgmt-item" id="cat-card-${cat.id}">
        <div class="cat-mgmt-head">
          <div>
            <h3 style="font-size: 1.15rem; margin-bottom: 2px;">
              ${escapeHtml(cat.title)}
              <span class="location-tag">Active Section on Website</span>
            </h3>
            <p style="font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(cat.description || 'No description provided')}</p>
          </div>
          <button class="btn" style="background: #FEE2E2; color: #991B1B; padding: 6px 14px; font-size: 0.78rem;" onclick="deleteCategory(${cat.id})">
            Delete Section
          </button>
        </div>

        <div class="cat-mgmt-body">
          <!-- 1. Photos in this Section -->
          <h4 style="font-size: 0.95rem; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary);">
            Section Portfolio Photos
          </h4>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">
            Photos uploaded here will be displayed in this section and in the main studio gallery.
          </p>
          
          <div class="upload-box" onclick="document.getElementById('file-input-${cat.id}').click()">
            <input type="file" id="file-input-${cat.id}" style="display: none;" accept="image/*" onchange="uploadPhoto(${cat.id}, this)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-gold); margin-bottom: 6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <div style="font-size: 0.88rem; font-weight: 500;">Click to upload a new client photo to this section</div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">JPG, PNG, WebP supported</div>
          </div>

          <div class="admin-gallery-grid" id="admin-gallery-${cat.id}">
            ${cat.gallery && cat.gallery.length > 0 ? cat.gallery.map(img => `
              <div class="admin-photo-card" id="photo-${img.id}">
                <img src="${img.image_url}" alt="Work" loading="lazy">
                <button class="admin-photo-del" title="Delete Photo" onclick="deletePhoto(${img.id})">&times;</button>
              </div>
            `).join('') : '<p style="grid-column: 1/-1; font-size: 0.8rem; color: var(--text-muted);">No photos uploaded yet in this section.</p>'}
          </div>

          <hr style="border: none; border-top: 1px dashed var(--border-subtle); margin: 24px 0;">

          <!-- 2. Services / Procedures in this Section -->
          <h4 style="font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 12px;">
            Procedures & Pricing
          </h4>

          <!-- Add Procedure Inline Form -->
          <form onsubmit="addService(event, ${cat.id})" style="display: grid; grid-template-columns: 2fr 1fr 1fr 3fr auto; gap: 10px; margin-bottom: 16px; align-items: center;">
            <input type="text" placeholder="Procedure Name (e.g. Ombre Brows)" class="form-input" style="padding: 10px;" required name="srv_title">
            <input type="text" placeholder="Price (e.g. $120)" class="form-input" style="padding: 10px;" name="srv_price">
            <input type="text" placeholder="Duration (e.g. 60 min)" class="form-input" style="padding: 10px;" name="srv_dur">
            <input type="text" placeholder="Brief note/description" class="form-input" style="padding: 10px;" name="srv_desc">
            <button type="submit" class="btn btn-primary" style="padding: 10px 18px; font-size: 0.8rem;">+ Add</button>
          </form>

          <table class="data-table">
            <thead>
              <tr>
                <th>Procedure</th>
                <th>Price</th>
                <th>Duration</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${cat.services && cat.services.length > 0 ? cat.services.map(srv => `
                <tr id="service-row-${srv.id}">
                  <td style="font-weight: 500;">${escapeHtml(srv.title)}</td>
                  <td style="color: var(--accent-gold); font-weight: 600;">${escapeHtml(srv.price || '')}</td>
                  <td>${escapeHtml(srv.duration || '')}</td>
                  <td style="color: var(--text-secondary); font-size: 0.84rem;">${escapeHtml(srv.description || '')}</td>
                  <td>
                    <button class="btn" style="background: #FEE2E2; color: #991B1B; padding: 4px 10px; font-size: 0.74rem;" onclick="deleteService(${srv.id})">Delete</button>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No procedures added yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');

  } catch (err) {
    showToast('Failed to load catalog');
  }
}

// Create Category
async function handleCreateCategory(e) {
  e.preventDefault();
  const title = document.getElementById('cat-title').value;
  const description = document.getElementById('cat-desc').value;

  try {
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });
    if (res.ok) {
      document.getElementById('form-create-cat').reset();
      showToast('Section added successfully!');
      loadAdminCatalog();
    }
  } catch (err) {
    showToast('Error creating section');
  }
}

// Delete Category
async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this whole section with all its services and photos?')) return;
  try {
    const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Section deleted');
      loadAdminCatalog();
    }
  } catch (err) {
    showToast('Failed to delete section');
  }
}

// Add Service
async function addService(e, categoryId) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    category_id: categoryId,
    title: form.srv_title.value,
    price: form.srv_price.value,
    duration: form.srv_dur.value,
    description: form.srv_desc.value
  };

  try {
    const res = await fetch('/api/admin/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('Procedure added!');
      form.reset();
      loadAdminCatalog();
    }
  } catch (err) {
    showToast('Failed to add procedure');
  }
}

// Delete Service
async function deleteService(id) {
  if (!confirm('Delete this procedure?')) return;
  try {
    const res = await fetch(`/api/admin/services/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Procedure deleted');
      const row = document.getElementById(`service-row-${id}`);
      if (row) row.remove();
    }
  } catch (err) {
    showToast('Failed to delete');
  }
}

// Upload Gallery Photo
async function uploadPhoto(categoryId, input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('image', file);
  formData.append('category_id', categoryId);
  formData.append('title', '');

  showToast('Uploading photo...');

  try {
    const res = await fetch('/api/admin/gallery/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Photo uploaded successfully!');
      loadAdminCatalog();
    } else {
      showToast(data.error || 'Upload failed');
    }
  } catch (err) {
    showToast('Upload error occurred');
  }
}

// Delete Photo
async function deletePhoto(id) {
  if (!confirm('Delete this photo?')) return;
  try {
    const res = await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Photo removed');
      const el = document.getElementById(`photo-${id}`);
      if (el) el.remove();
    }
  } catch (err) {
    showToast('Failed to delete photo');
  }
}

// -------------------------------------------------------------
// Bookings Management
// -------------------------------------------------------------
async function loadBookings() {
  const tbody = document.getElementById('bookings-table-body');
  const badge = document.getElementById('booking-badge');

  try {
    const res = await fetch('/api/admin/bookings');
    const bookings = await res.json();

    if (badge) badge.textContent = bookings.length;

    if (!bookings || bookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No appointments received yet.</td></tr>';
      return;
    }

    tbody.innerHTML = bookings.map(b => `
      <tr id="booking-row-${b.id}">
        <td style="font-weight: 600;">${escapeHtml(b.client_name)}</td>
        <td>
          <a href="tel:${escapeHtml(b.client_phone)}" style="color: var(--accent-gold); font-weight: 500;">
            ${escapeHtml(b.client_phone)}
          </a>
        </td>
        <td>${escapeHtml(b.service_name || 'General Inquiry')}</td>
        <td>${escapeHtml(b.preferred_date || 'Flexible')}</td>
        <td style="color: var(--text-secondary);">${escapeHtml(b.comment || '-')}</td>
        <td>
          <button class="btn" style="background: #FEE2E2; color: #991B1B; padding: 4px 10px; font-size: 0.74rem;" onclick="deleteBooking(${b.id})">
            Remove
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load appointments');
  }
}

async function deleteBooking(id) {
  if (!confirm('Remove this appointment record?')) return;
  try {
    const res = await fetch(`/api/admin/bookings/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Appointment removed');
      const row = document.getElementById(`booking-row-${id}`);
      if (row) row.remove();
    }
  } catch (err) {
    showToast('Failed to remove');
  }
}

// -------------------------------------------------------------
// Load All Settings (Hero, Standards, Contacts)
// -------------------------------------------------------------
async function loadAllSettings() {
  try {
    const res = await fetch('/api/settings');
    const s = await res.json();

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };

    // Hero Tab
    setVal('set-hero-tag', s.hero_tag);
    setVal('set-hero-title-main', s.hero_title_main);
    setVal('set-hero-tagline', s.tagline);
    setVal('set-hero-badge-title', s.hero_badge_title);
    setVal('set-hero-badge-desc', s.hero_badge_desc);
    setVal('set-stat-num-1', s.stat_num_1);
    setVal('set-stat-lbl-1', s.stat_lbl_1);
    setVal('set-stat-num-2', s.stat_num_2);
    setVal('set-stat-lbl-2', s.stat_lbl_2);
    setVal('set-stat-num-3', s.stat_num_3);
    setVal('set-stat-lbl-3', s.stat_lbl_3);

    const heroPreview = document.getElementById('hero-img-preview');
    if (heroPreview && s.hero_image_url) {
      heroPreview.src = s.hero_image_url;
    }

    // Page Blocks & Standards Tab
    setVal('set-standards-badge', s.standards_badge);
    setVal('set-standards-title', s.standards_title);
    setVal('set-standards-subtitle', s.standards_subtitle);
    setVal('set-card-title-1', s.card_title_1);
    setVal('set-card-desc-1', s.card_desc_1);
    setVal('set-card-title-2', s.card_title_2);
    setVal('set-card-desc-2', s.card_desc_2);
    setVal('set-card-title-3', s.card_title_3);
    setVal('set-card-desc-3', s.card_desc_3);
    setVal('set-gallery-title', s.gallery_title);
    setVal('set-gallery-subtitle', s.gallery_subtitle);
    setVal('set-booking-title', s.booking_title);
    setVal('set-booking-desc', s.booking_desc);

    // Studio Contacts Tab
    setVal('set-site-title', s.site_title);
    setVal('set-phone', s.phone);
    setVal('set-whatsapp', s.whatsapp);
    setVal('set-telegram', s.telegram);
    setVal('set-instagram', s.instagram);
    setVal('set-address', s.address);
    setVal('set-working-hours', s.working_hours);
    setVal('set-about-text', s.about_text);

  } catch (err) {
    showToast('Failed to load settings');
  }
}

// -------------------------------------------------------------
// Forms Handlers
// -------------------------------------------------------------
function initForms() {
  // Category creation
  document.getElementById('form-create-cat').addEventListener('submit', handleCreateCategory);

  // Hero Cover Form
  document.getElementById('form-hero-settings').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check if hero image was selected for upload
    const heroFileInput = document.getElementById('hero-image-file');
    if (heroFileInput && heroFileInput.files && heroFileInput.files[0]) {
      const formData = new FormData();
      formData.append('hero_image', heroFileInput.files[0]);
      showToast('Uploading hero cover photo...');
      try {
        const uploadRes = await fetch('/api/admin/hero/upload', {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          document.getElementById('hero-img-preview').src = uploadData.image_url;
        }
      } catch (err) {
        console.error('Hero upload error', err);
      }
    }

    const payload = {
      hero_tag: document.getElementById('set-hero-tag').value,
      hero_title_main: document.getElementById('set-hero-title-main').value,
      tagline: document.getElementById('set-hero-tagline').value,
      hero_badge_title: document.getElementById('set-hero-badge-title').value,
      hero_badge_desc: document.getElementById('set-hero-badge-desc').value,
      stat_num_1: document.getElementById('set-stat-num-1').value,
      stat_lbl_1: document.getElementById('set-stat-lbl-1').value,
      stat_num_2: document.getElementById('set-stat-num-2').value,
      stat_lbl_2: document.getElementById('set-stat-lbl-2').value,
      stat_num_3: document.getElementById('set-stat-num-3').value,
      stat_lbl_3: document.getElementById('set-stat-lbl-3').value,
    };

    saveSettingsPayload(payload, 'Hero section changes saved!');
  });

  // Page Blocks Form
  document.getElementById('form-content-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      standards_badge: document.getElementById('set-standards-badge').value,
      standards_title: document.getElementById('set-standards-title').value,
      standards_subtitle: document.getElementById('set-standards-subtitle').value,
      card_title_1: document.getElementById('set-card-title-1').value,
      card_desc_1: document.getElementById('set-card-desc-1').value,
      card_title_2: document.getElementById('set-card-title-2').value,
      card_desc_2: document.getElementById('set-card-desc-2').value,
      card_title_3: document.getElementById('set-card-title-3').value,
      card_desc_3: document.getElementById('set-card-desc-3').value,
      gallery_title: document.getElementById('set-gallery-title').value,
      gallery_subtitle: document.getElementById('set-gallery-subtitle').value,
      booking_title: document.getElementById('set-booking-title').value,
      booking_desc: document.getElementById('set-booking-desc').value,
    };

    saveSettingsPayload(payload, 'Page blocks saved successfully!');
  });

  // Contacts Form
  document.getElementById('form-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      site_title: document.getElementById('set-site-title').value,
      phone: document.getElementById('set-phone').value,
      whatsapp: document.getElementById('set-whatsapp').value,
      telegram: document.getElementById('set-telegram').value,
      instagram: document.getElementById('set-instagram').value,
      address: document.getElementById('set-address').value,
      working_hours: document.getElementById('set-working-hours').value,
      about_text: document.getElementById('set-about-text').value
    };

    saveSettingsPayload(payload, 'Studio contacts saved successfully!');
  });

  // Change Password
  document.getElementById('form-change-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('new-password').value;

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPass })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Password changed successfully!');
        document.getElementById('form-change-password').reset();
      } else {
        showToast(data.error || 'Failed to update password');
      }
    } catch (err) {
      showToast('Error updating password');
    }
  });
}

async function saveSettingsPayload(payload, successMsg) {
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast(successMsg);
    } else {
      showToast('Failed to save changes');
    }
  } catch (err) {
    showToast('Network error while saving');
  }
}

// -------------------------------------------------------------
// Utilities
// -------------------------------------------------------------
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
