/* ==========================================================================
   CSS Variables Dynamic Helper JavaScript
   ========================================================================== */

/**
 * Utility class for managing dynamic CSS variables
 * Provides methods to set CSS custom properties dynamically
 */
class CSSVariableManager {
    /**
     * Set event color CSS variable on element
     * @param {Element} element - DOM element to apply color to
     * @param {string} color - Color value (hex, rgb, etc.)
     */
    static setEventColor(element, color) {
        if (element && color) {
            element.style.setProperty('--event-color', color);
            element.style.setProperty('--dynamic-color', color);
        }
    }

    /**
     * Set position CSS variables on element
     * @param {Element} element - DOM element to position
     * @param {number} x - X position in percentage
     * @param {number} y - Y position in percentage
     */
    static setPosition(element, x, y) {
        if (element && typeof x === 'number' && typeof y === 'number') {
            element.style.setProperty('--x-pos', `${x}%`);
            element.style.setProperty('--y-pos', `${y}%`);
        }
    }

    /**
     * Set multiple CSS variables at once
     * @param {Element} element - DOM element
     * @param {Object} variables - Object with CSS variable names and values
     */
    static setVariables(element, variables) {
        if (element && variables && typeof variables === 'object') {
            Object.entries(variables).forEach(([key, value]) => {
                const varName = key.startsWith('--') ? key : `--${key}`;
                element.style.setProperty(varName, value);
            });
        }
    }

    /**
     * Initialize all dynamic event colors from data attributes
     */
    static initEventColors() {
        document.querySelectorAll('[data-event-color]').forEach(element => {
            const color = element.getAttribute('data-event-color');
            this.setEventColor(element, color);
        });
    }

    /**
     * Initialize all dynamic positions from data attributes
     */
    static initPositions() {
        document.querySelectorAll('[data-x-pos][data-y-pos]').forEach(element => {
            const x = parseFloat(element.getAttribute('data-x-pos'));
            const y = parseFloat(element.getAttribute('data-y-pos'));
            this.setPosition(element, x, y);
        });
    }

    /**
     * Initialize all dynamic CSS variables
     */
    static initAll() {
        this.initEventColors();
        this.initPositions();
    }
}

/**
 * Formation specific CSS variable management
 */
class FormationVariableManager extends CSSVariableManager {
    /**
     * Update player position in formation
     * @param {Element} playerElement - Player DOM element
     * @param {number} x - X position (0-100)
     * @param {number} y - Y position (0-100)
     */
    static updatePlayerPosition(playerElement, x, y) {
        this.setPosition(playerElement, x, y);
        
        // Update data attributes for persistence
        playerElement.setAttribute('data-x-pos', x);
        playerElement.setAttribute('data-y-pos', y);
    }

    /**
     * Animate player movement to new position
     * @param {Element} playerElement - Player DOM element
     * @param {number} newX - New X position
     * @param {number} newY - New Y position
     * @param {number} duration - Animation duration in ms
     */
    static animatePlayerTo(playerElement, newX, newY, duration = 300) {
        if (!playerElement) return;

        // Add transition
        playerElement.style.transition = `left ${duration}ms ease, top ${duration}ms ease`;
        
        // Update position
        this.updatePlayerPosition(playerElement, newX, newY);
        
        // Remove transition after animation
        setTimeout(() => {
            playerElement.style.transition = '';
        }, duration);
    }
}

/**
 * Calendar specific CSS variable management
 */
class CalendarVariableManager extends CSSVariableManager {
    /**
     * Update event type colors in calendar
     * @param {string} eventTypeId - Event type ID
     * @param {string} color - New color
     */
    static updateEventTypeColor(eventTypeId, color) {
        // Update all elements with this event type
        document.querySelectorAll(`[data-event-type="${eventTypeId}"]`).forEach(element => {
            this.setEventColor(element, color);
        });
        
        // Update filter labels
        document.querySelectorAll(`[data-event-type-filter="${eventTypeId}"]`).forEach(element => {
            this.setEventColor(element, color);
        });
    }

    /**
     * Apply event colors to dynamically created elements
     * @param {Element} container - Container with dynamic elements
     */
    static applyDynamicEventColors(container) {
        if (!container) return;
        
        container.querySelectorAll('.dynamic-event-color[data-event-color]').forEach(element => {
            const color = element.getAttribute('data-event-color');
            this.setEventColor(element, color);
        });
    }
}

/**
 * Theme management with CSS variables
 */
class ThemeManager {
    /**
     * Switch between light and dark themes
     * @param {string} theme - 'light' or 'dark'
     */
    static setTheme(theme) {
        const root = document.documentElement;
        
        if (theme === 'dark') {
            root.classList.add('dark-mode');
            root.classList.remove('light-mode');
        } else {
            root.classList.add('light-mode');
            root.classList.remove('dark-mode');
        }
        
        // Store preference
        localStorage.setItem('theme-preference', theme);
        
        // Dispatch theme change event
        window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme } 
        }));
    }

    /**
     * Get current theme
     * @returns {string} Current theme ('light' or 'dark')
     */
    static getCurrentTheme() {
        return document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light';
    }

    /**
     * Toggle between light and dark themes
     */
    static toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    /**
     * Initialize theme from stored preference or system preference
     */
    static initTheme() {
        const storedTheme = localStorage.getItem('theme-preference');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const theme = storedTheme || systemTheme;
        
        this.setTheme(theme);
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme-preference')) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
}

/**
 * Initialize everything when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize CSS variables
    CSSVariableManager.initAll();
    
    // Initialize theme
    ThemeManager.initTheme();
    
    // Set up mutation observer for dynamic content
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    // Initialize CSS variables on new elements
                    if (node.hasAttribute && node.hasAttribute('data-event-color')) {
                        const color = node.getAttribute('data-event-color');
                        CSSVariableManager.setEventColor(node, color);
                    }
                    
                    if (node.hasAttribute && node.hasAttribute('data-x-pos') && node.hasAttribute('data-y-pos')) {
                        const x = parseFloat(node.getAttribute('data-x-pos'));
                        const y = parseFloat(node.getAttribute('data-y-pos'));
                        CSSVariableManager.setPosition(node, x, y);
                    }
                    
                    // Initialize variables on child elements
                    CalendarVariableManager.applyDynamicEventColors(node);
                }
            });
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});

// Export for use in other scripts
window.CSSVariableManager = CSSVariableManager;
window.FormationVariableManager = FormationVariableManager;
window.CalendarVariableManager = CalendarVariableManager;
window.ThemeManager = ThemeManager;
