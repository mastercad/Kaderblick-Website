/**
 * Dashboard Modal Registration
 * Professional modal templates for dashboard functionality
 */

// Dashboard-specific modal templates
const dashboardModalTemplates = {
  addWidgetModal: `
    <div class="modal fade" id="addWidgetModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Widget hinzufügen</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="list-group">
              <button type="button" class="list-group-item list-group-item-action btn-add-widget" data-widget-type="calendar">
                <i class="fas fa-calendar"></i> Kalender
              </button>
              <button type="button" class="list-group-item list-group-item-action btn-add-widget" data-widget-type="messages">
                <i class="fas fa-envelope"></i> Nachrichten
              </button>
              <button type="button" class="list-group-item list-group-item-action btn-add-widget" data-widget-type="news">
                <i class="fas fa-newspaper"></i> News
              </button>
              <button type="button" class="list-group-item list-group-item-action btn-add-widget" data-widget-type="upcoming_events">
                <i class="fas fa-newspaper"></i> Anstehende Veranstaltungen
              </button>
              <button type="button" class="list-group-item list-group-item-action btn-add-widget" data-widget-type="report" id="openReportWidgetFlow">
                <i class="fas fa-file-alt"></i> Report Widget
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};

// Register dashboard modals when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Wait for Modal Manager and ensure we're on dashboard page
  setTimeout(() => {
    if (window.ModalManager && document.getElementById('widgetGrid')) {
      // Register dashboard-specific modals
      Object.keys(dashboardModalTemplates).forEach(modalId => {
        window.ModalManager.registerModal(modalId, dashboardModalTemplates[modalId]);
      });
      
      // Initialize dashboard modal functionality
      initializeDashboardModalFunctionality();
    }
  }, 150);
});

/**
 * Initialize dashboard-specific modal functionality
 */
function initializeDashboardModalFunctionality() {
  // Widget add button handlers
  const addWidgetButtons = document.querySelectorAll('.btn-add-widget');
  addWidgetButtons.forEach(button => {
    if (button.dataset.widgetType === 'report') {
      button.addEventListener('click', function() {
        window.ModalManager.hideModal('addWidgetModal');
        // Nach dem Schließen das Report-Auswahl-Modal öffnen
        setTimeout(() => {
          loadReportsLazy();
          window.ModalManager.showModal('selectReportModal');
        }, 300);
      });
    } else {
      button.addEventListener('click', function() {
        const widgetType = this.dataset.widgetType;
        createWidget(widgetType);
        window.ModalManager.hideModal('addWidgetModal');
      });
    }
  });
}

// Report-Auswahl-Modal (nur Grundgerüst, muss ggf. noch als ModalTemplate registriert werden)
if (!dashboardModalTemplates.selectReportModal) {
  dashboardModalTemplates.selectReportModal = `
    <div class="modal fade" id="selectReportModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Report auswählen</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div id="reportListLoading" class="text-center my-3" style="display:none;">
              <div class="spinner-border" role="status"><span class="visually-hidden">Laden...</span></div>
            </div>
            <div id="reportListContainer">
              <!-- Dynamisch per JS geladen -->
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
            <button type="button" class="btn btn-primary" id="addReportWidgetsBtn">Hinzufügen</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function loadReportsLazy() {
  const container = document.getElementById('reportListContainer');
  const loading = document.getElementById('reportListLoading');
  if (!container || !loading) return;
  container.innerHTML = '';
  loading.style.display = '';
  fetch('/api/report/available')
    .then(r => r.json())
    .then(data => {
      loading.style.display = 'none';
      if (!Array.isArray(data)) { container.innerHTML = '<div class="alert alert-danger">Fehler beim Laden</div>'; return; }
      if (data.length === 0) { container.innerHTML = '<div class="alert alert-info">Keine Reports verfügbar</div>'; return; }
      container.innerHTML = data.map(report =>
        `<div class="form-check">
          <input class="form-check-input" type="checkbox" value="${report.id}" id="report${report.id}">
          <label class="form-check-label" for="report${report.id}">
            ${report.name} <span class="badge bg-${report.isTemplate ? 'info' : 'secondary'}">${report.isTemplate ? 'Template' : 'Eigen'}</span>
          </label>
        </div>`
      ).join('');
    })
    .catch(() => { loading.style.display = 'none'; container.innerHTML = '<div class="alert alert-danger">Fehler beim Laden</div>'; });
}

document.addEventListener('DOMContentLoaded', function() {
  // Report-Widget Hinzufügen-Button im Modal
  const dashboardModalsReady = () => {
    if (window.ModalManager && window.ModalManager.registerModal) {
      window.ModalManager.registerModal('selectReportModal', dashboardModalTemplates.selectReportModal);
      // Button-Handler für Report-Auswahl
      document.body.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'addReportWidgetsBtn') {
          const checked = document.querySelectorAll('#reportListContainer input[type="checkbox"]:checked');
          const ids = Array.from(checked).map(cb => cb.value);
          if (ids.length > 0) {
            ids.forEach(id => createWidget('report', id));
          }
          window.ModalManager.hideModal('selectReportModal');
        }
      });
    } else {
      setTimeout(dashboardModalsReady, 100);
    }
  };
  dashboardModalsReady();
});

async function createWidget(type, reportId) {
    await fetch('/widget', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: type, reportId: reportId })
    }).then((response) => {
        if (response.status >= 400 && response.status < 600) {
            throw new Error("Bad response from server - " + response.status + " : " + response.statusText);
        }
        return response;
    }).then((returnedResponse) => returnedResponse.json()
    ).then((data) => {
        addWidget(data.widget.id);
    }).catch((error) => {
        console.log(error)
    });
}

async function addWidget(widgetId) {
    await fetch('/widget/' + widgetId, {
      method: 'GET'
    }).then((response) => {
      if (response.status >= 400 && response.status < 600) {
        throw new Error("Bad response from server - " + response.status + " : " + response.statusText);
      }
      return response.text();
    }).then((html) => {
      const widgetElement = createWidgetFromHtml(html, widgetId);
      loadWidgetContent(widgetElement);
      document.getElementById('widgetGrid').appendChild(widgetElement);
    }).catch((error) => {
      console.error(error);
    });
}

/**
 * Get widget title by type
 */
function getWidgetTitle(type) {
  const titles = {
    calendar: 'Kalender',
    messages: 'Nachrichten',
    news: 'News',
    upcoming_events: 'Anstehende Veranstaltungen'
  };
  
  return titles[type] || 'Widget';
}

/**
 * Add event listeners to widget
 */
function addWidgetEventListeners(widgetElement) {
  // Settings button
  const settingsBtn = widgetElement.querySelector('.btn-widget-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function(e) {
      e.preventDefault();
      const widgetId = this.dataset.widgetId;
      showWidgetSettings(widgetId);
    });
  }
  
  // Remove button
  const removeBtn = widgetElement.querySelector('.btn-widget-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      const widgetId = this.dataset.widgetId;
      removeWidget(widgetId);
    });
  }
}

/**
 * Show widget settings (could be extended with specific modals)
 */
function showWidgetSettings(widgetId) {
  // For now, just a simple prompt - could be extended with specific modals
  alert('Widget-Einstellungen für Widget ' + widgetId + ' - Feature wird bald implementiert');
}

/**
 * Remove a widget
 */
async function removeWidget(widgetId) {
  if (confirm('Soll dieses Widget wirklich entfernt werden?')) {
    try {
      const response = await fetch(`/api/dashboard/widgets/${widgetId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (widgetElement) {
          widgetElement.remove();
          updateWidgetPositions();
        }
      } else {
        alert('Fehler beim Entfernen des Widgets');
      }
    } catch (error) {
      console.error('Remove widget error:', error);
      alert('Fehler beim Entfernen des Widgets');
    }
  }
}

/**
 * Load widget content
 */
async function loadWidgetContent(widgetElement) {
  const widgetId = widgetElement.dataset.widgetId;
  const widgetType = widgetElement.dataset.widgetType;
  const contentContainer = widgetElement.querySelector('.widget-content');
  
  try {
    const response = await fetch(`/api/dashboard/widgets/${widgetId}/content`);
    
    if (response.ok) {
      const content = await response.text();
      contentContainer.innerHTML = content;
    } else {
      contentContainer.innerHTML = '<p class="text-muted">Fehler beim Laden des Inhalts</p>';
    }
  } catch (error) {
    console.error('Load widget content error:', error);
    contentContainer.innerHTML = '<p class="text-muted">Fehler beim Laden des Inhalts</p>';
  }
}

async function loadWidgetContent(widgetElement) {
    const widgetContent = widgetElement.querySelector('.widget-content');
    const widgetId = widgetElement.dataset.widgetId;
    try {
        const response = await fetch(`/widget/${widgetId}/content`);
        if (response.ok) {
            const html = await response.text();
            widgetContent.innerHTML = html;
            
            // Führe eventuell eingebettetes Script manuell aus, da sie beim laden nicht direkt ausgeführt werden
            const scripts = widgetContent.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                // Kopiere alle Attribute
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                if (oldScript.src) {
                    // Externe Skripte nachladen
                    newScript.src = oldScript.src;
                    document.body.appendChild(newScript);
                } else {
                    // Nur Inline-Skripte mit JS-Code ausführen
                    newScript.textContent = oldScript.textContent;
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                }
            });
        }
    } catch (error) {
        console.error('Widget loading error:', error);
        widgetContent.innerHTML = '<div class="alert alert-danger">Widget konnte nicht geladen werden</div>';
    }
}

// Widget-Updates
function updateWidgetPositions() {
    const widgets = [];
    document.querySelectorAll('.widget-item').forEach((widget, index) => {
        const width = parseInt(widget.className.match(/col-md-(\d+)/)[1]);
        const defaultWidgetCheckbox = document.getElementById('defaultWidgetCheckbox');
        const isDefault = defaultWidgetCheckbox && defaultWidgetCheckbox.checked ? 1 : 0;

        widgets.push({
            id: widget.dataset.widgetId,
            position: index,
            width: width,
            default: isDefault
        });
    });

    fetch('/app/dashboard/widgets/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: widgets })
    }).catch(error => console.error('Error:', error));
}

function saveWidgetSettings(data) {

    fetch('/app/dashboard/widget/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).catch(error => console.error('Error:', error));
}
  
function createWidgetFromHtml(htmlString, widgetId) {
    const container = document.createElement('div');
    container.innerHTML = htmlString.trim();

    return container.firstElementChild;
}

// Make functions globally available
window.addWidget = addWidget;
window.removeWidget = removeWidget;
window.loadWidgetContent = loadWidgetContent;
window.updateWidgetPositions = updateWidgetPositions;
window.saveWidgetSettings = saveWidgetSettings;
