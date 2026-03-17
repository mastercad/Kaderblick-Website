/**
 * Modal Template Generator
 * Helper utility for generating modal templates with Twig data
 */

class ModalTemplateGenerator {
    constructor() {
        this.templates = new Map();
    }

    /**
     * Generate modal template with server-side data
     * @param {string} modalId 
     * @param {string} templatePath 
     * @param {Object} data 
     */
    generateTemplate(modalId, templatePath, data = {}) {
        // This would be called from Twig templates to pass server data
        // For now, we store the data for use in JS
        this.templates.set(modalId, {
            templatePath: templatePath,
            data: data
        });
    }

    /**
     * Get template data for a modal
     * @param {string} modalId 
     */
    getTemplateData(modalId) {
        return this.templates.get(modalId);
    }

    /**
     * Render modal with data
     * @param {string} modalId 
     * @param {string} template 
     * @param {Object} data 
     */
    renderModal(modalId, template, data = {}) {
        // Simple template rendering (could be enhanced with a proper template engine)
        let rendered = template;
        
        // Replace common placeholders
        Object.keys(data).forEach(key => {
            const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            rendered = rendered.replace(placeholder, data[key]);
        });

        return rendered;
    }

    /**
     * Create modal HTML with dynamic content
     * @param {string} modalId 
     * @param {Object} config 
     */
    createModal(modalId, config) {
        const {
            title = 'Modal',
            body = '',
            footer = '',
            size = '',
            centered = false,
            backdrop = true,
            keyboard = true
        } = config;

        const sizeClass = size ? `modal-${size}` : '';
        const centeredClass = centered ? 'modal-dialog-centered' : '';
        const dialogClasses = `modal-dialog ${sizeClass} ${centeredClass}`.trim();

        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true" 
                 data-bs-backdrop="${backdrop}" data-bs-keyboard="${keyboard}">
                <div class="${dialogClasses}">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schließen"></button>
                        </div>
                        <div class="modal-body">
                            ${body}
                        </div>
                        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
                    </div>
                </div>
            </div>
        `;

        return modalHTML;
    }

    /**
     * Create confirmation modal
     * @param {string} modalId 
     * @param {Object} config 
     */
    createConfirmationModal(modalId, config) {
        const {
            title = 'Bestätigung',
            message = 'Sind Sie sicher?',
            confirmText = 'Bestätigen',
            cancelText = 'Abbrechen',
            confirmClass = 'btn-primary',
            onConfirm = null,
            onCancel = null
        } = config;

        const body = `
            <p>${message}</p>
        `;

        const footer = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${cancelText}</button>
            <button type="button" class="btn ${confirmClass}" id="${modalId}_confirm">${confirmText}</button>
        `;

        const modalHTML = this.createModal(modalId, {
            title: title,
            body: body,
            footer: footer,
            centered: true
        });

        // Register event handlers
        setTimeout(() => {
            const confirmBtn = document.getElementById(`${modalId}_confirm`);
            if (confirmBtn && onConfirm) {
                confirmBtn.addEventListener('click', () => {
                    onConfirm();
                    if (window.ModalManager) {
                        window.ModalManager.hideModal(modalId);
                    }
                });
            }

            // Handle cancel
            const modal = document.getElementById(modalId);
            if (modal && onCancel) {
                modal.addEventListener('hidden.bs.modal', onCancel);
            }
        }, 100);

        return modalHTML;
    }

    /**
     * Create form modal
     * @param {string} modalId 
     * @param {Object} config 
     */
    createFormModal(modalId, config) {
        const {
            title = 'Formular',
            fields = [],
            submitText = 'Speichern',
            cancelText = 'Abbrechen',
            onSubmit = null
        } = config;

        let formHTML = '<form id="' + modalId + '_form">';
        
        fields.forEach(field => {
            const {
                type = 'text',
                name,
                label,
                required = false,
                placeholder = '',
                options = [],
                value = ''
            } = field;

            formHTML += `<div class="mb-3">`;
            formHTML += `<label for="${name}" class="form-label">${label}</label>`;

            switch (type) {
                case 'select':
                    formHTML += `<select class="form-select" id="${name}" name="${name}" ${required ? 'required' : ''}>`;
                    options.forEach(option => {
                        const selected = option.value === value ? 'selected' : '';
                        formHTML += `<option value="${option.value}" ${selected}>${option.text}</option>`;
                    });
                    formHTML += `</select>`;
                    break;
                
                case 'textarea':
                    formHTML += `<textarea class="form-control" id="${name}" name="${name}" placeholder="${placeholder}" ${required ? 'required' : ''}>${value}</textarea>`;
                    break;
                
                case 'checkbox':
                    const checked = value ? 'checked' : '';
                    formHTML += `<div class="form-check">
                        <input class="form-check-input" type="checkbox" id="${name}" name="${name}" ${checked}>
                        <label class="form-check-label" for="${name}">${label}</label>
                    </div>`;
                    break;
                
                default:
                    formHTML += `<input type="${type}" class="form-control" id="${name}" name="${name}" placeholder="${placeholder}" value="${value}" ${required ? 'required' : ''}>`;
            }

            formHTML += `</div>`;
        });

        formHTML += '</form>';

        const footer = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${cancelText}</button>
            <button type="button" class="btn btn-primary" id="${modalId}_submit">${submitText}</button>
        `;

        const modalHTML = this.createModal(modalId, {
            title: title,
            body: formHTML,
            footer: footer
        });

        // Register form handler
        setTimeout(() => {
            const submitBtn = document.getElementById(`${modalId}_submit`);
            const form = document.getElementById(`${modalId}_form`);
            
            if (submitBtn && form && onSubmit) {
                submitBtn.addEventListener('click', () => {
                    const formData = new FormData(form);
                    const data = Object.fromEntries(formData.entries());
                    onSubmit(data);
                });
            }
        }, 100);

        return modalHTML;
    }
}

// Create global instance
window.ModalTemplateGenerator = new ModalTemplateGenerator();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalTemplateGenerator;
}
