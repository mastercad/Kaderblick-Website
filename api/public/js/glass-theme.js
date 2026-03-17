/**
 * Glass Theme Toggle
 * Aktiviert/deaktiviert den optionalen Glassmorphism-Style
 */
class GlassThemeToggle {
    constructor() {
        this.isActive = localStorage.getItem('glass-theme') === 'true';
        this.init();
    }

    init() {
        this.attachEventListener();
        if (this.isActive) {
            this.enableGlassTheme();
        }
    }

    attachEventListener() {
        // Button ist bereits im HTML definiert
        const button = document.getElementById('glass-toggle');
        if (button) {
            button.addEventListener('click', () => this.toggleTheme());
        } else {
            console.warn('Glass-toggle button not found in HTML');
        }
    }

    toggleTheme() {
        this.isActive = !this.isActive;
        localStorage.setItem('glass-theme', this.isActive.toString());
        
        if (this.isActive) {
            this.enableGlassTheme();
        } else {
            this.disableGlassTheme();
        }
    }

    enableGlassTheme() {
        document.body.classList.add('glass-theme');
        
        // Glass Theme CSS laden falls noch nicht geladen
        if (!document.querySelector('link[href*="glass-theme.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/glass-theme.css';
            document.head.appendChild(link);
        }
    }

    disableGlassTheme() {
        document.body.classList.remove('glass-theme');
    }
}

// Theme Toggle initialisieren wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
    new GlassThemeToggle();
});
