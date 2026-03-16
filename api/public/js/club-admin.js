// --- fussball.de Daten laden (nur für ROLE_SUPERADMIN) ---
function bindFussballDeButton() {
  const btn = document.getElementById('fetchFussballDeBtn');
  if (!btn) return;
  btn.addEventListener('click', async function() {
    const loading = document.getElementById('fussballDeLoading');
    if (loading) loading.classList.remove('d-none');
    btn.disabled = true;
    try {
      const clubName = document.getElementById('clubName').value;
      const res = await axios.get(`/clubs/fussballde-lookup?name=${encodeURIComponent(clubName)}`);
      if (res.data && res.data.vereinId && res.data.url) {
        // Mapping: fussball.de Feldname -> {inputId, alter Wert}
        const mapping = [
          { key: 'name', id: 'clubName' },
          { key: 'website', id: 'clubWebsite' },
          { key: 'vereinId', id: 'clubFussballDeId' },
          { key: 'url', id: 'clubFussballDeUrl' },
          { key: 'adresse', id: 'locationAddress' },
          { key: 'city', id: 'locationCity' },
          { key: 'farben', id: 'clubColors' },
          { key: 'ansprechpartner', id: 'contactPerson' },
          { key: 'gruendung', id: 'foundingYear' }
        ];
        if (!window.fussballdeOriginalValues) window.fussballdeOriginalValues = {};
        let changed = false;
        mapping.forEach(map => {
          const input = document.getElementById(map.id);
          if (input && res.data[map.key] && input.value !== res.data[map.key]) {
            // Save original value for revert
            if (!window.fussballdeOriginalValues[map.id]) {
              window.fussballdeOriginalValues[map.id] = input.value;
            }
            input.value = res.data[map.key];
            input.classList.add('fussballde-updated');
            // Badge + Revert-Button
            let badge = document.createElement('span');
            badge.className = 'fussballde-badge';
            badge.innerText = 'neu';
            // Revert-Button
            let revertBtn = document.createElement('button');
            revertBtn.type = 'button';
            revertBtn.className = 'fussballde-revert-btn';
            revertBtn.innerText = 'Zurücksetzen';
            revertBtn.onclick = function() {
              input.value = window.fussballdeOriginalValues[map.id];
              input.classList.remove('fussballde-updated');
              badge.remove();
              revertBtn.remove();
              // Wenn keine Felder mehr geändert, Reset-All ausblenden
              if (!document.querySelector('.fussballde-updated')) {
                const resetAll = document.getElementById('fussballde-reset-all');
                if (resetAll) resetAll.remove();
              }
            };
            // Nur einmal anhängen
            if (!input.nextSibling || !input.nextSibling.classList || !input.nextSibling.classList.contains('fussballde-badge')) {
              input.parentNode.appendChild(badge);
              input.parentNode.appendChild(revertBtn);
            }
            changed = true;
          }
        });
        // Globaler Reset-Button
        if (changed && !document.getElementById('fussballde-reset-all')) {
          let resetAll = document.createElement('button');
          resetAll.type = 'button';
          resetAll.className = 'btn btn-warning btn-sm fussballde-reset-all';
          resetAll.id = 'fussballde-reset-all';
          resetAll.innerHTML = '<i class="fas fa-undo"></i> Alle Änderungen zurücksetzen';
          resetAll.onclick = function() {
            mapping.forEach(map => {
              const input = document.getElementById(map.id);
              if (input && window.fussballdeOriginalValues[map.id] !== undefined) {
                input.value = window.fussballdeOriginalValues[map.id];
                input.classList.remove('fussballde-updated');
                if (input.parentNode.querySelector('.fussballde-badge')) input.parentNode.querySelector('.fussballde-badge').remove();
                if (input.parentNode.querySelector('.fussballde-revert-btn')) input.parentNode.querySelector('.fussballde-revert-btn').remove();
              }
            });
            resetAll.remove();
          };
          // Im ersten Stammdaten-Block einfügen
          const row = document.querySelector('.modal-body .row.g-3');
          if (row) row.parentNode.insertBefore(resetAll, row);
        }
      } else {
        // Fehler-Feedback
        alert('Keine passenden Daten auf fussball.de gefunden.');
      }
    } catch (e) {
      alert('Fehler beim Laden der fussball.de-Daten.');
    } finally {
      if (loading) loading.classList.add('d-none');
      btn.disabled = false;
    }
  });
}
async function loadList() {
  const res = await axios.get('/api/clubs/list');
  if (res.status === 200 && typeof res.data === 'object') {
    const data = res.data;
    const tbody = document.querySelector('#clubs-table tbody');
    tbody.innerHTML = '';
    // Die eigentlichen Einträge stehen unter numerischen Keys
    Object.keys(data)
      .filter(key => /^\d+$/.test(key))
      .forEach(key => {
        const club = data[key];
        const tr = document.createElement('tr');
        tr.dataset.id = club.id;
        tr.innerHTML = `
          <td>${club.name || ''}</td>
          <td>${club.address || ''}</td>
          <td>${club.city || ''}</td>
          <td>${club.latitude || ''}</td>
          <td>${club.longitude || ''}</td>
          <td>
            <button class="btn btn-sm btn-primary edit-club-btn" data-id="${club.id}"><i class="fas fa-edit"></i> Bearbeiten</button>
            <button class="btn btn-sm btn-danger delete-club-btn" data-id="${club.id}"><i class="fas fa-trash"></i> Löschen</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    // Re-bind Buttons
    bindEditButtons();
    bindDeleteButtons();
  }
}

function openEditModal(clubId) {
  axios.get(`/clubs/${clubId}/edit`)
    .then(response => {
      document.getElementById('clubEditModalContainer').innerHTML = response.data;
      if (window.ModalManager) {
        if (window.ModalManager.registeredModals && window.ModalManager.registeredModals.has('clubEditModal')) {
          window.ModalManager.unregisterModal('clubEditModal');
        }
        window.ModalManager.registerModal('clubEditModal', document.getElementById('clubEditModal'));
        window.ModalManager.showModal('clubEditModal');
      } else {
        const modal = new bootstrap.Modal(document.getElementById('clubEditModal'));
        modal.show();
      }
      bindEditModalEvents();
    });
}

// Bindet Events im Modal (Formular, OSM-Button)
function bindEditModalEvents() {
  bindFussballDeButton();
  const form = document.getElementById('clubEditForm');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const id = form.querySelector('input[name="id"]').value;
      const data = new FormData(form);
      axios.post(`/clubs/${id}/update`, data)
        .then(() => {
          // Detailansicht neu laden (nur Partial!)
          axios.get(`/clubs/${id}/detail-partial`).then(response => {
            const detailContainer = document.getElementById('clubDetailModalContainer') || document.querySelector('.modal-body').parentElement;
            if (detailContainer) {
              detailContainer.innerHTML = response.data;
            }
            // Buttons neu binden
            if (typeof bindEditButtons === 'function') bindEditButtons();
            if (typeof bindDeleteButtons === 'function') bindDeleteButtons();
          });
          if (typeof loadList === 'function') {
            loadList();
          }
          if (window.ModalManager) {
            window.ModalManager.hideModal('clubEditModal');
          }
        });
    });
  }

  const fetchBtn = document.getElementById('fetchCoordinatesBtn');
  if (fetchBtn) {
    fetchBtn.addEventListener('click', function() {
      fetchCoordinatesFromOSM();
    });
  }
}

function bindDeleteButtons() {
    document.querySelectorAll('.delete-club-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const clubId = this.dataset.id;
            const modalId = 'deleteClubConfirmModal_' + clubId;
            const modalHtml = window.ModalTemplateGenerator.createConfirmationModal(modalId, {
                title: 'Löschen bestätigen',
                message: 'Möchtest du diesen Verein wirklich löschen?',
                confirmText: 'Löschen',
                confirmClass: 'btn-danger',
                onConfirm: () => {
                    axios.post(`/clubs/${clubId}/delete`)
                        .then(() => {
                            if (window.ModalManager) {
                                window.ModalManager.hideModal(modalId);
                            }
                            loadList();
                        });
                }
            });
            if (window.ModalManager) {
                window.ModalManager.registerModal(modalId, modalHtml);
                window.ModalManager.showModal(modalId);
            }
        });
    });
}

function bindEditButtons() {
  document.querySelectorAll('.edit-club-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      openEditModal(btn.dataset.id);
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  bindEditButtons();
  bindDeleteButtons();
});