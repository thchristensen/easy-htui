// Enhanced app.js - Main application controller
import { NavigationManager } from './modules/navigation.js';
import { WeatherManager } from './modules/weather.js';
import { AdminManager } from './modules/admin.js';

// Global application state
export const AppState = {
    config: {},
    allApps: [],
    isAdminMode: false,
    isNavigationMode: false
};

// Main application class
class EasyHTUI {
    constructor() {
        this.navigation = new NavigationManager(this);
        this.weather = new WeatherManager(this);
        this.admin = new AdminManager(this);
        
        // DOM elements
        this.loadingScreen = document.getElementById('loading-screen');
        this.mainContent = document.getElementById('main-content');
        this.searchInput = document.getElementById('search-input');
        this.errorModal = document.getElementById('error-modal');
        this.errorMessage = document.getElementById('error-message');
    }

    // Initialize the application
    async init() {
        try {
            await this.loadConfig();
            this.renderApps();
            this.setupEventListeners();
            this.initializeTimeDisplay();
            this.admin.setupAdminToggle();
            
            // Initialize weather after config is loaded
            await this.weather.initialize();
            
            this.hideLoadingScreen();
        } catch (error) {
            this.showError('Failed to load configuration: ' + error.message);
            this.hideLoadingScreen();
        }
    }

    // Load configuration from API
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            AppState.config = await response.json();
            
            // Set page title
            if (AppState.config.title) {
                document.title = AppState.config.title;
            }
            
            // Flatten all apps for search functionality
            AppState.allApps = [];
            for (const [categoryName, apps] of Object.entries(AppState.config.categories)) {
                apps.forEach(app => {
                    AppState.allApps.push({
                        ...app,
                        category: categoryName
                    });
                });
            }
        } catch (error) {
            console.error('Error loading config:', error);
            throw error;
        }
    }

    // Render all apps in categories
    renderApps(appsToRender = null) {
        this.mainContent.innerHTML = '';
        
        const appsData = appsToRender || AppState.config.categories;
        
        for (const [categoryName, apps] of Object.entries(appsData)) {
            if (apps.length === 0 && !AppState.isAdminMode) continue;
            
            const categoryDiv = this.createCategoryElement(categoryName, apps);
            this.mainContent.appendChild(categoryDiv);
        }
        
        // Update focusable elements after rendering
        this.navigation.updateFocusableElements();
    }

    // Create category element
    createCategoryElement(categoryName, apps) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';
        categoryDiv.setAttribute('data-category', categoryName);
        
        // Apply custom style if set
        const categoryStyle = AppState.config.categoryStyles && AppState.config.categoryStyles[categoryName];
        if (categoryStyle) {
            categoryDiv.setAttribute('data-style', categoryStyle);
        }
        
        const categoryHeader = this.admin.createCategoryHeader(categoryName, categoryStyle);
        const appsGrid = this.createAppsGrid(apps, categoryName);
        
        categoryDiv.appendChild(categoryHeader);
        categoryDiv.appendChild(appsGrid);
        
        return categoryDiv;
    }

    // Create apps grid
    createAppsGrid(apps, categoryName) {
        const appsGrid = document.createElement('div');
        appsGrid.className = 'apps-grid';
        
        apps.forEach((app, index) => {
            const appCard = this.createAppCard(app, categoryName, index, apps.length);
            appsGrid.appendChild(appCard);
        });
        
        return appsGrid;
    }

    // Create individual app card with dynamic gradients
    createAppCard(app, categoryName, currentIndex, totalApps) {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.onclick = () => {
            if (AppState.isAdminMode) {
                this.admin.showEditAppForm(app);
            } else {
                this.launchApp(app);
            }
        };
        
        this.applyCardStyling(card, app, categoryName);
        this.makeCardFocusable(card, app);
        
        const iconDiv = this.createAppIcon(app);
        const nameDiv = this.createAppName(app, card);
        
        card.appendChild(iconDiv);
        card.appendChild(nameDiv);
        
        // Add admin controls
        if (AppState.isAdminMode) {
            const adminControls = this.admin.createAdminControls(app, categoryName, currentIndex, totalApps);
            card.appendChild(adminControls);
        }
        
        return card;
    }

    // Apply dynamic gradient background and styling
    applyCardStyling(card, app, categoryName) {
        // Apply dynamic gradient background (except for Games category)
        if (categoryName !== 'Games' && app.color1 && app.color2) {
            card.style.background = `linear-gradient(135deg, ${app.color1} 0%, ${app.color2} 100%)`;
            
            // Adjust text color based on background brightness
            const textColor = this.getContrastingTextColor(app.color1, app.color2);
            card.style.color = textColor;
            
            // Ensure app name background provides good contrast
            card.style.setProperty('--app-name-bg', textColor === '#000000' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)');
            card.style.setProperty('--app-name-color', textColor === '#000000' ? '#000000' : '#ffffff');
        }
    }

    // Make card focusable for keyboard navigation
    makeCardFocusable(card, app) {
        card.tabIndex = 0;
        card.setAttribute('data-app-name', app.name);
        card.setAttribute('data-app-id', app.id);
        
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (AppState.isAdminMode) {
                    this.admin.showEditAppForm(app);
                } else {
                    this.launchApp(app);
                }
            }
        });
    }

    // Create app icon
    createAppIcon(app) {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'app-icon';
        
        if (app.icon && app.icon.trim()) {
            const img = document.createElement('img');
            img.src = app.icon;
            img.alt = app.name;
            img.onerror = () => {
                iconDiv.innerHTML = app.name;
            };
            iconDiv.appendChild(img);
        } else {
            iconDiv.innerHTML = app.name;
        }
        
        return iconDiv;
    }

    // Create app name
    createAppName(app, card) {
        const nameDiv = document.createElement('div');
        nameDiv.className = 'app-name';
        nameDiv.textContent = app.name;
        
        // Apply custom text color for app name if set
        if (card.style.getPropertyValue('--app-name-bg')) {
            nameDiv.style.background = card.style.getPropertyValue('--app-name-bg');
            nameDiv.style.color = card.style.getPropertyValue('--app-name-color');
        }
        
        return nameDiv;
    }

    // Calculate contrasting text color based on background colors
    getContrastingTextColor(color1, color2) {
        const rgb1 = this.hexToRgb(color1);
        const rgb2 = this.hexToRgb(color2);
        
        if (!rgb1 || !rgb2) return '#ffffff';
        
        const avgBrightness = ((rgb1.r + rgb2.r) / 2 * 0.299 + 
                              (rgb1.g + rgb2.g) / 2 * 0.587 + 
                              (rgb1.b + rgb2.b) / 2 * 0.114) / 255;
        
        return avgBrightness > 0.5 ? '#000000' : '#ffffff';
    }

    // Convert hex color to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    // Launch application based on type
    async launchApp(app) {
        try {
            console.log('Launching app:', app);
            
            switch (app.type) {
                case 'website':
                    if (app.url) {
                        window.location.href = app.url;
                    } else {
                        throw new Error('No URL specified for website');
                    }
                    break;
                    
                case 'executable':
                    await this.launchExecutable(app);
                    break;
                    
                case 'steam':
                case 'epic':
                default:
                    throw new Error(`Unknown app type: ${app.type}`);
            }
        } catch (error) {
            console.error('Error launching app:', error);
            this.showError(`Failed to launch ${app.name}: ${error.message}`);
        }
    }

    // Launch executable via server
    async launchExecutable(app) {
        try {
            const response = await fetch(`/api/launch/${app.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`Successfully launched: ${app.name}`);
                this.showBriefMessage(`Launching ${app.name}...`);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to launch application');
            }
        } catch (fetchError) {
            if (fetchError.message.includes('launcher file not found')) {
                this.showError('Launcher file not found. Try editing and re-saving this app to regenerate the launcher.');
            } else {
                throw fetchError;
            }
        }
    }

    // Handle search functionality
    handleSearch() {
        const query = this.searchInput.value.toLowerCase().trim();
        
        if (!query) {
            this.renderApps();
            return;
        }
        
        const filteredApps = AppState.allApps.filter(app => 
            app.name.toLowerCase().includes(query) ||
            app.type.toLowerCase().includes(query) ||
            app.category.toLowerCase().includes(query)
        );
        
        const filteredCategories = {};
        filteredApps.forEach(app => {
            if (!filteredCategories[app.category]) {
                filteredCategories[app.category] = [];
            }
            filteredCategories[app.category].push(app);
        });
        
        this.renderApps(filteredCategories);
    }

    // Setup event listeners
    setupEventListeners() {
        // Search functionality
        this.searchInput.addEventListener('input', () => this.handleSearch());
        
        // Navigation and keyboard events
        this.navigation.setupKeyboardEvents();
        this.navigation.setupGamepadSupport();
        
        // Click to exit navigation mode
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) && !e.target.closest('.app-card')) {
                this.navigation.exitNavigationMode();
            }
        });
    }

    // Time display functions
    updateTime() {
        const now = new Date();
        
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        const dateOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        const timeString = now.toLocaleTimeString('en-US', timeOptions);
        const dateString = now.toLocaleDateString('en-US', dateOptions);
        
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            timeElement.innerHTML = `
                <div class="time">${timeString}</div>
                <div class="date">${dateString}</div>
            `;
        }
    }

    initializeTimeDisplay() {
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
    }

    // UI Helper functions
    hideLoadingScreen() {
        setTimeout(() => {
            this.loadingScreen.classList.add('hidden');
        }, 500);
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorModal.classList.remove('hidden');
    }

    showMessage(message) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Success</h3>
                <p>${message}</p>
                <button onclick="this.closest('.modal').remove()">OK</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 3000);
    }

    showBriefMessage(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(46, 125, 50, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 3000;
            backdrop-filter: blur(10px);
            font-size: 0.9rem;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 2000);
    }

    // Refresh application data
    async refreshApps() {
        try {
            await this.loadConfig();
            this.renderApps();
            console.log('Apps refreshed successfully');
        } catch (error) {
            this.showError('Failed to refresh apps: ' + error.message);
        }
    }
}

// Initialize application when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new EasyHTUI();
    app.init();
    
    // Export for global access AFTER app is created
    window.app = app;
    window.AppState = AppState;
});

// Clean up weather on page unload
window.addEventListener('beforeunload', () => {
    if (app?.weather) {
        app.weather.cleanup();
    }
});

// Legacy global functions for backwards compatibility
window.closeModal = () => app?.admin.closeModal();
window.refreshApps = () => app?.refreshApps();