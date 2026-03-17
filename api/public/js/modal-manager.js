/**
 * Modal Management System
 * Solution for handling modals outside the main container
 * 
 * @version 1.0.0
 */

class ModalManager {
    constructor() {
        this.modalContainer = null;
        this.registeredModals = new Map();
        this.activeModals = new Set();
        this.init();
    }

    /**
     * Initialize the modal management system
     */
    init() {
        // Create modal container if it doesn't exist
        this.ensureModalContainer();
        
        // Listen for bootstrap modal events
        this.setupEventListeners();
        
        // Register existing modals
        this.registerExistingModals();
    }

    /**
     * Ensure modal container exists outside main content
     */
    ensureModalContainer() {
        this.modalContainer = document.getElementById('modalContainer');
        
        if (!this.modalContainer) {
            this.modalContainer = document.createElement('div');
            this.modalContainer.id = 'modalContainer';
            this.modalContainer.className = 'modal-container-root';
            
            // Insert before closing body tag
            document.body.appendChild(this.modalContainer);
        }
    }

    /**
     * Register a modal to be managed by the system
     * @param {string} modalId - The ID of the modal
     * @param {HTMLElement|string} modalElement - Modal element or HTML string
     */
    registerModal(modalId, modalElement) {
        if (this.registeredModals.has(modalId)) {
            console.warn(`Modal ${modalId} is already registered`);
            return;
        }

        let element;
        
        if (typeof modalElement === 'string') {
            // Create element from HTML string
            const wrapper = document.createElement('div');
            wrapper.innerHTML = modalElement.trim();
            element = wrapper.firstChild;
        } else if (modalElement instanceof HTMLElement) {
            element = modalElement;
        } else {
            console.error(`Invalid modal element for ${modalId}`);
            return;
        }

        // Move modal to container
        this.moveToContainer(element);
        
        // Register modal
        this.registeredModals.set(modalId, {
            element: element,
            originalParent: null,
            isActive: false
        });
    }

    /**
     * Move modal element to the modal container
     * @param {HTMLElement} modalElement 
     */
    moveToContainer(modalElement) {
        if (modalElement.parentNode && modalElement.parentNode !== this.modalContainer) {
            this.modalContainer.appendChild(modalElement);
        }
    }

    /**
     * Register all existing modals found in the DOM
     */
    registerExistingModals() {
        const existingModals = document.querySelectorAll('.modal');
        
        existingModals.forEach(modal => {
            if (modal.id) {
                // Move existing modal to container
                this.moveToContainer(modal);
                
                this.registeredModals.set(modal.id, {
                    element: modal,
                    originalParent: null,
                    isActive: false
                });
            }
        });
    }

    /**
     * Setup event listeners for modal lifecycle
     */
    setupEventListeners() {
        // Bootstrap modal events
        document.addEventListener('show.bs.modal', (event) => {
            const modalId = event.target.id;
            if (this.registeredModals.has(modalId)) {
                this.registeredModals.get(modalId).isActive = true;
                this.activeModals.add(modalId);
                this.handleModalShow(modalId);
            }
        });

        document.addEventListener('hidden.bs.modal', (event) => {
            const modalId = event.target.id;
            if (this.registeredModals.has(modalId)) {
                this.registeredModals.get(modalId).isActive = false;
                this.activeModals.delete(modalId);
                this.handleModalHidden(modalId);
            }
        });

        // Handle escape key for proper modal management
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.activeModals.size > 0) {
                this.handleEscapeKey();
            }
        });
    }

    /**
     * Handle modal show event
     * @param {string} modalId 
     */
    handleModalShow(modalId) {
        const modal = this.registeredModals.get(modalId);
        if (modal && modal.element) {
            document.body.classList.add('modal-open');
            if (window.jQuery && window.jQuery.fn.selectpicker && modal && modal.element) {
                // Nur Selects im aktuellen Modal ansprechen!
                const selects = modal.element.querySelectorAll('.selectpicker');
                selects.forEach(sel => {
                    const $sel = window.jQuery(sel);
                    // Nur initialisieren, wenn noch nicht aktiv
                    if (!$sel.parent().hasClass('bootstrap-select')) {
                        $sel.selectpicker();
                    } else {
                        $sel.selectpicker('refresh');
                    }
                });
            }
        }
    }

    /**
     * Handle modal hidden event
     * @param {string} modalId 
     */
    handleModalHidden(modalId) {
        // Remove body class if no more active modals
        if (this.activeModals.size === 0) {
            document.body.classList.remove('modal-open');
        }
    }

    /**
     * Handle escape key press
     */
    handleEscapeKey() {
        // Close the topmost modal
        const activeModalIds = Array.from(this.activeModals);
        if (activeModalIds.length > 0) {
            const topModalId = activeModalIds[activeModalIds.length - 1];
            const modal = this.registeredModals.get(topModalId);
            if (modal && modal.element) {
                const bootstrapModal = bootstrap.Modal.getInstance(modal.element);
                if (bootstrapModal) {
                    bootstrapModal.hide();
                }
            }
        }
    }

    /**
     * Programmatically show a modal
     * @param {string} modalId 
     */
    showModal(modalId) {
        const modal = this.registeredModals.get(modalId);
        if (modal && modal.element) {
            const bootstrapModal = new bootstrap.Modal(modal.element);
            bootstrapModal.show();
        } else {
            console.error(`Modal ${modalId} not found or not registered`);
        }
    }

    /**
     * Programmatically hide a modal
     * @param {string} modalId 
     */
    hideModal(modalId) {
        const modal = this.registeredModals.get(modalId);
        if (modal && modal.element) {
            const bootstrapModal = bootstrap.Modal.getInstance(modal.element);
            if (bootstrapModal) {
                bootstrapModal.hide();
            }
        }
    }

    /**
     * Get modal information
     * @param {string} modalId 
     * @returns {Object|null}
     */
    getModalInfo(modalId) {
        return this.registeredModals.get(modalId) || null;
    }

    /**
     * Get all registered modals
     * @returns {Array}
     */
    getAllModals() {
        return Array.from(this.registeredModals.keys());
    }

    /**
     * Get currently active modals
     * @returns {Array}
     */
    getActiveModals() {
        return Array.from(this.activeModals);
    }

    /**
     * Remove a modal from management
     * @param {string} modalId 
     */
    unregisterModal(modalId) {
        const modal = this.registeredModals.get(modalId);
        if (modal && modal.element) {
            // Remove from DOM
            modal.element.remove();
            
            // Clean up references
            this.registeredModals.delete(modalId);
            this.activeModals.delete(modalId);
        }
    }
}

// Initialize global modal manager when DOM is ready
let globalModalManager = null;

document.addEventListener('DOMContentLoaded', function() {
    globalModalManager = new ModalManager();
    // Make it globally accessible (both conventions)
    window.ModalManager = globalModalManager;
    window.modalManager = globalModalManager;
    // Initialisiere alle Selectpicker mit container: body
    if (window.jQuery && window.jQuery.fn.selectpicker) {
        window.jQuery('.selectpicker').each(function() {
            const $sel = window.jQuery(this);
            if (!$sel.parent().hasClass('bootstrap-select')) {
                $sel.selectpicker();
            } else {
                $sel.selectpicker('refresh');
            }
        });
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalManager;
}
