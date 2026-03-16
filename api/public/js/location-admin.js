// Lädt die Location-Liste dynamisch nach (wie im generischen API-Controller)
async function loadList() {
  const res = await axios.get('/api/locations/list');
  if (res.status === 200 && typeof res.data === 'object') {
    const data = res.data;
    const tbody = document.querySelector('#locations-table tbody');
    tbody.innerHTML = '';
    // Die eigentlichen Einträge stehen unter numerischen Keys
    Object.keys(data)
      .filter(key => /^\d+$/.test(key))
      .forEach(key => {
        const location = data[key];
        const tr = document.createElement('tr');
        tr.dataset.id = location.id;
        tr.innerHTML = `
          <td>${location.name || ''}</td>
          <td>${location.address || ''}</td>
          <td>${location.city || ''}</td>
          <td>${location.latitude || ''}</td>
          <td>${location.longitude || ''}</td>
          <td>
            <button class="btn btn-sm btn-primary edit-location-btn" data-id="${location.id}"><i class="fas fa-edit"></i> Bearbeiten</button>
            <button class="btn btn-sm btn-danger delete-location-btn" data-id="${location.id}"><i class="fas fa-trash"></i> Löschen</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    // Re-bind Buttons
    bindEditButtons();
    bindDeleteButtons();
  }
}

// Öffnet das Bearbeiten-Modal und lädt die Daten per AJAX, nutzt ModalManager
function openEditModal(locationId) {
  axios.get(`/locations/edit/${locationId}`)
    .then(response => {
      // Modal HTML in Container einfügen
      document.getElementById('locationEditModalContainer').innerHTML = response.data;
      // ModalManager: Vorheriges Modal deregistrieren, dann neu registrieren
      if (window.ModalManager) {
        if (window.ModalManager.registeredModals && window.ModalManager.registeredModals.has('locationEditModal')) {
          window.ModalManager.unregisterModal('locationEditModal');
        }
        window.ModalManager.registerModal('locationEditModal', document.getElementById('locationEditModal'));
        window.ModalManager.showModal('locationEditModal');
      } else {
        // Fallback: Bootstrap direkt
        const modal = new bootstrap.Modal(document.getElementById('locationEditModal'));
        modal.show();
      }
      bindEditModalEvents();
    });
}


// Holt Koordinaten von OSM/Nominatim
function fetchCoordinatesFromOSM() {
  const name = document.getElementById('locationName').value;
  const address = document.getElementById('locationAddress').value;
  const city = document.getElementById('locationCity').value;
  const query = encodeURIComponent(`${name} ${address} ${city}`);
  const url = `/api/locations/osm-coordinates?query=${query}`;
  axios.get(url)
    .then(response => {
      const results = response.data;
      const container = document.getElementById('osmResultsContainer');
      if (results.length === 1) {
        document.getElementById('locationLatitude').value = results[0].lat;
        document.getElementById('locationLongitude').value = results[0].lon;
        container.classList.add('d-none');
      } else if (results.length > 1) {
        container.innerHTML = '<div class="alert alert-info">Mehrere Ergebnisse gefunden. Bitte wählen:</div>' +
          results.map((r, i) => `<button type="button" class="btn btn-outline-primary btn-sm mb-1 w-100 osm-select-btn" data-lat="${r.lat}" data-lon="${r.lon}">${r.display_name}</button>`).join('');
        container.classList.remove('d-none');
        container.querySelectorAll('.osm-select-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            document.getElementById('locationLatitude').value = this.dataset.lat;
            document.getElementById('locationLongitude').value = this.dataset.lon;
            container.classList.add('d-none');
          });
        });
      } else {
        container.innerHTML = '<div class="alert alert-warning">Keine Ergebnisse gefunden.</div>';
        container.classList.remove('d-none');
      }
    });
}

// Bindet Events im Modal (Formular, OSM-Button)
function bindEditModalEvents() {
  const form = document.getElementById('locationEditForm');
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = form.querySelector('input[name="id"]').value;
    const data = new FormData(form);
    axios.post(`/locations/update/${id}`, data)
      .then(() => {
        if (typeof loadList === 'function') {
          loadList();
        }
        if (window.ModalManager) {
          window.ModalManager.hideModal('locationEditModal');
        }
      });
  });

  document.getElementById('fetchCoordinatesBtn').addEventListener('click', function() {
    fetchCoordinatesFromOSM();
  });
}

// Löschen-Button
function bindDeleteButtons() {
  document.querySelectorAll('.delete-location-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const locationId = btn.dataset.id;
      const modalId = 'deleteLocationConfirmModal_' + locationId;
      // Modal erzeugen
      const modalHtml = window.ModalTemplateGenerator.createConfirmationModal(modalId, {
        title: 'Löschen bestätigen',
        message: 'Möchtest du diese Spielstätte wirklich löschen?',
        confirmText: 'Löschen',
        confirmClass: 'btn-danger',
        onConfirm: () => {
          axios.post(`/locations/delete/${locationId}`)
            .then(() => {
              if (typeof loadList === 'function') {
                loadList();
              }
            });
        }
      });
      // Modal registrieren und anzeigen
      if (window.ModalManager) {
        window.ModalManager.registerModal(modalId, modalHtml);
        window.ModalManager.showModal(modalId);
      }
    });
  });
}

// Bearbeiten-Button
function bindEditButtons() {
  document.querySelectorAll('.edit-location-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      openEditModal(btn.dataset.id);
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  bindEditButtons();
  bindDeleteButtons();
});
