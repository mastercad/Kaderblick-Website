/**
 * Calendar Modal Management
 * Handles all modal interactions for the calendar page
 */

document.addEventListener('DOMContentLoaded', function() {
    // Warte auf Modal Manager mit Retry-Mechanismus
    function initializeCalendarModals() {
        const modalManager = window.modalManager || window.ModalManager;
        
        if (!modalManager) {
            console.warn('Modal Manager not yet available, retrying in 100ms...');
            setTimeout(initializeCalendarModals, 100);
            return;
        }

        // Calendar Modal Templates
        const modalTemplates = {
            eventModal: {
                id: 'eventModal',
                title: 'Event verwalten',
                size: 'lg',
                content: `
                    <form id="eventForm">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label for="eventTitle" class="form-label">Titel *</label>
                                    <input type="text" class="form-control" id="eventTitle" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="eventDate" class="form-label">Datum *</label>
                                    <input type="date" class="form-control" id="eventDate" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="eventTime" class="form-label">Uhrzeit</label>
                                    <input type="time" class="form-control" id="eventTime">
                                </div>
                                
                                <div class="mb-3">
                                    <label for="eventType" class="form-label">Event-Typ *</label>
                                    <select class="form-control" id="eventType" required>
                                        <option value="">Bitte wählen...</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label for="eventLocation" class="form-label">Ort</label>
                                    <input type="text" class="form-control" id="eventLocation">
                                </div>
                                
                                <div class="mb-3" id="teamFieldSet" style="display: none;">
                                    <label for="team" class="form-label">Team</label>
                                    <select class="form-control" id="team">
                                        <option value="">Bitte wählen...</option>
                                    </select>
                                </div>
                                
                                <div class="mb-3" id="opponentFieldSet" style="display: none;">
                                    <label for="opponentTeam" class="form-label">Gegner</label>
                                    <input type="text" class="form-control" id="opponentTeam">
                                </div>
                                
                                <div class="mb-3">
                                    <label for="eventDescription" class="form-label">Beschreibung</label>
                                    <textarea class="form-control" id="eventDescription" rows="4"></textarea>
                                </div>
                            </div>
                        </div>
                    </form>
                `,
                footer: `
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Abbrechen</button>
                    <button type="button" class="btn btn-danger" id="deleteEvent" style="display: none;">Löschen</button>
                    <button type="button" class="btn btn-primary" id="saveEvent">Speichern</button>
                `
            },
        
            eventDetailsModal: {
                id: 'eventDetailsModal',
                title: 'Event Details',
                size: 'md',
                content: `
                    <div id="eventDetailsContent">
                    </div>
                `,
                footer: `
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
                    <button type="button" class="btn btn-primary" id="editEventFromDetails" style="display: none;">Bearbeiten</button>
                `
            }
        };

        Object.entries(modalTemplates).forEach(([key, template]) => {
            const modalHtml = `
                <div class="modal fade" id="${template.id}" tabindex="-1">
                    <div class="modal-dialog modal-${template.size || 'md'}">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${template.title}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                ${template.content}
                            </div>
                            <div class="modal-footer">
                                ${template.footer}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            modalManager.registerModal(template.id, modalHtml);
        });

        function populateEventTypes() {
            const eventTypeSelect = document.getElementById('eventType');
            if (eventTypeSelect && window.eventTypes) {
                eventTypeSelect.innerHTML = '<option value="">Bitte wählen...</option>';
                window.eventTypes.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.id;
                    option.textContent = type.name;
                    option.dataset.color = type.color;
                    eventTypeSelect.appendChild(option);
                });
            }
        }

        // Teams laden
        function populateTeams() {
            const teamSelect = document.getElementById('team');
            if (teamSelect && window.teams) {
                teamSelect.innerHTML = '<option value="">Bitte wählen...</option>';
                window.teams.forEach(team => {
                    const option = document.createElement('option');
                    option.value = team.id;
                    option.textContent = team.name;
                    teamSelect.appendChild(option);
                });
            }
        }

        // Event Type Änderung überwachen
        document.addEventListener('change', function(e) {
            if (e.target && e.target.id === 'eventType') {
                const selectedType = window.eventTypes?.find(type => type.id == e.target.value);
                const teamFieldSet = document.getElementById('teamFieldSet');
                const opponentFieldSet = document.getElementById('opponentFieldSet');
                
                if (selectedType && selectedType.name.toLowerCase().includes('spiel')) {
                    teamFieldSet?.style.setProperty('display', 'block');
                    opponentFieldSet?.style.setProperty('display', 'block');
                } else {
                    teamFieldSet?.style.setProperty('display', 'none');
                    opponentFieldSet?.style.setProperty('display', 'none');
                }
            }
        });

        // Global functions für Calendar
        window.handleDateClick = function(info) {
            const modal = document.getElementById('eventModal');
            if (!modal) return;
            
            // Modal für neues Event vorbereiten
            const modalTitle = modal.querySelector('.modal-title');
            const eventDateInput = document.getElementById('eventDate');
            const saveEventBtn = document.getElementById('saveEvent');
            const deleteEventBtn = document.getElementById('deleteEvent');
            
            if (modalTitle) modalTitle.textContent = 'Neues Event erstellen';
            if (eventDateInput) eventDateInput.value = info.dateStr;
            if (saveEventBtn) saveEventBtn.removeAttribute('data-event-id');
            if (deleteEventBtn) deleteEventBtn.style.display = 'none';
            
            // Formular zurücksetzen
            const form = document.getElementById('eventForm');
            if (form) form.reset();
            
            // Selects populieren
            populateEventTypes();
            populateTeams();
            
            // Modal anzeigen
            const modalManager = window.modalManager || window.ModalManager;
            if (modalManager) {
                modalManager.showModal('eventModal');
            }
        };

        window.handleEventClick = function(info) {
            const event = info.event;
            const modal = document.getElementById('eventModal');
            if (!modal) return;
            
            // Modal für Event-Bearbeitung vorbereiten
            const modalTitle = modal.querySelector('.modal-title');
            const saveEventBtn = document.getElementById('saveEvent');
            const deleteEventBtn = document.getElementById('deleteEvent');
            
            if (modalTitle) modalTitle.textContent = 'Event bearbeiten';
            if (saveEventBtn) saveEventBtn.setAttribute('data-event-id', event.id);
            if (deleteEventBtn) deleteEventBtn.style.display = 'inline-block';
            
            // Formular mit Event-Daten füllen
            const fields = {
                eventTitle: event.title,
                eventDate: event.startStr.split('T')[0],
                eventTime: event.startStr.includes('T') ? event.startStr.split('T')[1].substring(0, 5) : '',
                eventType: event.extendedProps.eventTypeId,
                eventLocation: event.extendedProps.location || '',
                eventDescription: event.extendedProps.description || '',
                team: event.extendedProps.teamId || '',
                opponentTeam: event.extendedProps.opponentTeam || ''
            };
            
            // Selects populieren
            populateEventTypes();
            populateTeams();
            
            // Felder füllen
            Object.entries(fields).forEach(([fieldId, value]) => {
                const field = document.getElementById(fieldId);
                if (field) field.value = value || '';
            });
            
            // Event Type Felder anzeigen/verstecken
            const eventTypeSelect = document.getElementById('eventType');
            if (eventTypeSelect) {
                eventTypeSelect.dispatchEvent(new Event('change'));
            }
            
            // Modal anzeigen
            const modalManager = window.modalManager || window.ModalManager;
            if (modalManager) {
                modalManager.showModal('eventModal');
            }
        };

        window.handleAddEvent = function() {
            const today = new Date().toISOString().split('T')[0];
            window.handleDateClick({ dateStr: today });
        };

        window.handleDateRangeSelect = function(info) {
            window.handleDateClick({ dateStr: info.startStr.split('T')[0] });
        };

        // Event Speichern
        document.addEventListener('click', function(e) {
            if (e.target && e.target.id === 'saveEvent') {
                e.preventDefault();
                saveEvent();
            }
            
            if (e.target && e.target.id === 'deleteEvent') {
                e.preventDefault();
                deleteEvent();
            }
        });

        function saveEvent() {
            const form = document.getElementById('eventForm');
            if (!form || !form.checkValidity()) {
                form?.reportValidity();
                return;
            }

            const saveBtn = document.getElementById('saveEvent');
            const eventId = saveBtn?.getAttribute('data-event-id');
            const isUpdate = !!eventId;

            const formData = {
                title: document.getElementById('eventTitle')?.value,
                date: document.getElementById('eventDate')?.value,
                time: document.getElementById('eventTime')?.value,
                eventTypeId: document.getElementById('eventType')?.value,
                location: document.getElementById('eventLocation')?.value,
                description: document.getElementById('eventDescription')?.value,
                teamId: document.getElementById('team')?.value,
                opponentTeam: document.getElementById('opponentTeam')?.value
            };

            // API Call
            const url = isUpdate ? `/api/events/${eventId}` : '/api/events';
            const method = isUpdate ? 'PUT' : 'POST';

            fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(formData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const modalManager = window.modalManager || window.ModalManager;
                    modalManager.hideModal('eventModal');
                    if (window.calendar) {
                        window.calendar.refetchEvents();
                    }
                    if (window.showNotification) {
                        window.showNotification('Event erfolgreich gespeichert!', 'success');
                    }
                } else {
                    if (window.showNotification) {
                        window.showNotification('Fehler beim Speichern: ' + (data.message || 'Unbekannter Fehler'), 'error');
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                if (window.showNotification) {
                    window.showNotification('Fehler beim Speichern des Events', 'error');
                }
            });
        }

        function deleteEvent() {
            const saveBtn = document.getElementById('saveEvent');
            const eventId = saveBtn?.getAttribute('data-event-id');
            
            if (!eventId) return;

            if (!confirm('Möchten Sie dieses Event wirklich löschen?')) {
                return;
            }

            fetch(`/api/events/${eventId}`, {
                method: 'DELETE',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const modalManager = window.modalManager || window.ModalManager;
                    modalManager.hideModal('eventModal');
                    if (window.calendar) {
                        window.calendar.refetchEvents();
                    }
                    if (window.showNotification) {
                        window.showNotification('Event erfolgreich gelöscht!', 'success');
                    }
                } else {
                    if (window.showNotification) {
                        window.showNotification('Fehler beim Löschen: ' + (data.message || 'Unbekannter Fehler'), 'error');
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                if (window.showNotification) {
                    window.showNotification('Fehler beim Löschen des Events', 'error');
                }
            });
        }
    }

    // Start initialization
    initializeCalendarModals();
});
