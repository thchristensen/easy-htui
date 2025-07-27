// Enhanced script.js with keyboard navigation, CRUD functionality, position reordering, and dynamic gradients

// Global variables
let config = {};
let allApps = [];
let currentFocusIndex = 0;
let focusableElements = [];
let isNavigationMode = false;
let isAdminMode = false;

// DOM elements
const loadingScreen = document.getElementById('loading-screen');
const mainContent = document.getElementById('main-content');
const searchInput = document.getElementById('search-input');
const errorModal = document.getElementById('error-modal');
const errorMessage = document.getElementById('error-message');

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadConfig();
        renderApps();
        setupEventListeners();
        initializeTimeDisplay();
        setupAdminToggle();
        
        // Initialize weather after config is loaded
        await initializeWeather();
        
        hideLoadingScreen();
    } catch (error) {
        showError('Failed to load configuration: ' + error.message);
        hideLoadingScreen();
    }
});

// Update cleanup on page unload
window.addEventListener('beforeunload', () => {
    cleanupWeather();
});

// Show weather settings form
function showWeatherSettings() {
    const weatherConfig = config.weather || { enabled: false, apiKey: '', location: '', units: 'metric' };
    
    const formHtml = `
        <div class="form-container">
            <h3>Weather Settings</h3>
            <form id="weather-settings-form">
                <label>
                    <input type="checkbox" name="enabled" ${weatherConfig.enabled ? 'checked' : ''}> 
                    Enable Weather Display
                </label>
                <label>OpenWeather API Key: 
                    <input type="text" name="apiKey" value="${weatherConfig.apiKey || ''}" placeholder="Get free API key from openweathermap.org">
                    <small style="color: rgba(255,255,255,0.7); font-size: 0.8rem;">
                        Sign up for free at <a href="https://openweathermap.org/api" target="_blank" style="color: rgba(122, 146, 199, 1);">openweathermap.org</a>
                    </small>
                </label>
                <label>Location: 
                    <input type="text" name="location" value="${weatherConfig.location || ''}" placeholder="City,Country (e.g. Manchester,GB)">
                </label>
                <label>Units: 
                    <select name="units">
                        <option value="metric" ${weatherConfig.units === 'metric' ? 'selected' : ''}>Celsius</option>
                        <option value="imperial" ${weatherConfig.units === 'imperial' ? 'selected' : ''}>Fahrenheit</option>
                        <option value="standard" ${weatherConfig.units === 'standard' ? 'selected' : ''}>Kelvin</option>
                    </select>
                </label>
                <div class="form-buttons">
                    <button type="submit">Save Settings</button>
                    <button type="button" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    showFormModal(formHtml);
    
    document.getElementById('weather-settings-form').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const weatherSettings = {
            enabled: formData.has('enabled'),
            apiKey: formData.get('apiKey'),
            location: formData.get('location'),
            units: formData.get('units'),
            updateInterval: 600000 // 10 minutes
        };
        
        try {
            // Update config
            config.weather = weatherSettings;
            
            const response = await fetch('/api/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            if (response.ok) {
                closeModal();
                showMessage('Weather settings saved! Weather will update shortly.');
                
                // Reinitialize weather with new settings
                cleanupWeather();
                await initializeWeather();
            } else {
                const error = await response.json();
                showError(error.error || 'Failed to save weather settings');
            }
        } catch (error) {
            showError('Failed to save weather settings: ' + error.message);
        }
    };
}

// Setup admin toggle button
function setupAdminToggle() {
    const adminToggle = document.querySelector('.admin-toggle');
    if (adminToggle) {
        adminToggle.addEventListener('click', toggleAdminMode);
    } else {
        console.warn('Admin toggle element not found.');
    }
}

// Toggle admin mode
function toggleAdminMode() {
    isAdminMode = !isAdminMode;
    document.body.classList.toggle('admin-mode', isAdminMode);
    
    const toggle = document.querySelector('.admin-toggle');
    toggle.classList.toggle('active', isAdminMode);
    
    renderApps();

    if (isAdminMode) {
        showAdminPanel();
    } else {
        hideAdminPanel();
    }
}

// Show admin panel
function showAdminPanel() {
    const existing = document.getElementById('admin-panel');
    if (existing) existing.remove();
    
    const panel = document.createElement('div');
    panel.id = 'admin-panel';
    panel.className = 'admin-panel';
    panel.innerHTML = `
        <h3>Admin Panel</h3>
        <button onclick="showAddAppForm()">Add New App</button>
        <button onclick="showAddCategoryForm()">Add New Category</button>
        <button onclick="showWeatherSettings()">Weather Settings</button>
        <button onclick="exportConfig()">Export Config</button>
        <button onclick="showImportConfig()">Import Config</button>
        <button onclick="cleanupLaunchers()">Cleanup Launchers</button>
    `;
    
    document.body.appendChild(panel);
}

// Hide admin panel
function hideAdminPanel() {
    const panel = document.getElementById('admin-panel');
    if (panel) panel.remove();
}

// Load configuration from API
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        config = await response.json();
        
        // Set page title
        if (config.title) {
            document.title = config.title;
        }
        
        // Flatten all apps for search functionality
        allApps = [];
        for (const [categoryName, apps] of Object.entries(config.categories)) {
            apps.forEach(app => {
                allApps.push({
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

// Fetch Steam game data
async function fetchSteamGameData(appId) {
    try {
        const response = await fetch(`/api/steam/${appId}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch Steam data');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching Steam data:', error);
        throw error;
    }
}

// Render all apps in categories
function renderApps(appsToRender = null) {
    mainContent.innerHTML = '';
    
    const appsData = appsToRender || config.categories;
    
    for (const [categoryName, apps] of Object.entries(appsData)) {
        if (apps.length === 0 && !isAdminMode) continue;
        
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';
        categoryDiv.setAttribute('data-category', categoryName);
        
        // Apply custom style if set
        const categoryStyle = config.categoryStyles && config.categoryStyles[categoryName];
        if (categoryStyle) {
            categoryDiv.setAttribute('data-style', categoryStyle);
        }
        
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        
        const categoryTitle = document.createElement('h2');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = categoryName;
        
        categoryHeader.appendChild(categoryTitle);
        
        if (isAdminMode) {
            // Add style selector dropdown
            const styleSelector = document.createElement('select');
            styleSelector.className = 'style-selector';
            styleSelector.innerHTML = `
                <option value="">Default</option>
                <option value="compact">Compact</option>
                <option value="portrait">Portrait</option>
                <option value="list">List</option>
                <option value="large">Large</option>
                <option value="minimal">Minimal</option>
            `;
            styleSelector.value = categoryStyle || '';
            styleSelector.onclick = (e) => e.stopPropagation();
            styleSelector.onchange = (e) => {
                e.stopPropagation();
                changeCategoryStyle(categoryName, e.target.value);
            };
            categoryHeader.appendChild(styleSelector);
            
            const deleteCategory = document.createElement('button');
            deleteCategory.textContent = '×';
            deleteCategory.className = 'delete-category-btn';
            deleteCategory.onclick = (e) => {
                e.stopPropagation();
                deleteCategoryHandler(categoryName);
            };
            categoryHeader.appendChild(deleteCategory);
        }
        
        const appsGrid = document.createElement('div');
        appsGrid.className = 'apps-grid';
        
        apps.forEach((app, index) => {
            const appCard = createAppCard(app, categoryName, index, apps.length);
            appsGrid.appendChild(appCard);
        });
        
        categoryDiv.appendChild(categoryHeader);
        categoryDiv.appendChild(appsGrid);
        mainContent.appendChild(categoryDiv);
    }
    
    // Update focusable elements after rendering
    updateFocusableElements();
}

// Create individual app card with move arrows and dynamic gradients
function createAppCard(app, categoryName, currentIndex, totalApps) {
    const card = document.createElement('div');
    card.className = 'app-card';
    card.onclick = () => {
        if (isAdminMode) {
            showEditAppForm(app);
        } else {
            launchApp(app);
        }
    };
    
    // Apply dynamic gradient background (except for Games category)
    if (categoryName !== 'Games' && app.color1 && app.color2) {
        card.style.background = `linear-gradient(135deg, ${app.color1} 0%, ${app.color2} 100%)`;
        
        // Adjust text color based on background brightness
        const textColor = getContrastingTextColor(app.color1, app.color2);
        card.style.color = textColor;
        
        // Ensure app name background provides good contrast
        card.style.setProperty('--app-name-bg', textColor === '#000000' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)');
        card.style.setProperty('--app-name-color', textColor === '#000000' ? '#000000' : '#ffffff');
    }
    
    // Make card focusable for keyboard navigation
    card.tabIndex = 0;
    card.setAttribute('data-app-name', app.name);
    card.setAttribute('data-app-id', app.id);
    
    // Add keyboard event listeners
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isAdminMode) {
                showEditAppForm(app);
            } else {
                launchApp(app);
            }
        }
    });
    
    // Create icon
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
    
    // Create name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'app-name';
    nameDiv.textContent = app.name;
    
    // Apply custom text color for app name if set
    if (card.style.getPropertyValue('--app-name-bg')) {
        nameDiv.style.background = card.style.getPropertyValue('--app-name-bg');
        nameDiv.style.color = card.style.getPropertyValue('--app-name-color');
    }
    
    card.appendChild(iconDiv);
    card.appendChild(nameDiv);
    
    // Add admin controls with move arrows
    if (isAdminMode) {
        const adminControls = document.createElement('div');
        adminControls.className = 'admin-controls';
        
        // Move arrows (only show if there are multiple apps)
        if (totalApps > 1) {
            // Move left arrow (only show if not first item)
            if (currentIndex > 0) {
                const moveLeftBtn = document.createElement('button');
                moveLeftBtn.innerHTML = '←';
                moveLeftBtn.className = 'move-btn move-left-btn';
                moveLeftBtn.title = 'Move left';
                moveLeftBtn.onclick = (e) => {
                    e.stopPropagation();
                    moveApp(app.id, categoryName, 'left');
                };
                adminControls.appendChild(moveLeftBtn);
            }
            
            // Move right arrow (only show if not last item)
            if (currentIndex < totalApps - 1) {
                const moveRightBtn = document.createElement('button');
                moveRightBtn.innerHTML = '→';
                moveRightBtn.className = 'move-btn move-right-btn';
                moveRightBtn.title = 'Move right';
                moveRightBtn.onclick = (e) => {
                    e.stopPropagation();
                    moveApp(app.id, categoryName, 'right');
                };
                adminControls.appendChild(moveRightBtn);
            }
        }
        
        const editBtn = document.createElement('button');
        editBtn.textContent = '✎';
        editBtn.className = 'edit-btn';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            showEditAppForm(app);
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteApp(app.id);
        };
        
        adminControls.appendChild(editBtn);
        adminControls.appendChild(deleteBtn);
        card.appendChild(adminControls);
    }
    
    return card;
}

// Calculate contrasting text color based on background colors
function getContrastingTextColor(color1, color2) {
    // Convert hex to RGB
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return '#ffffff'; // Default to white if conversion fails
    
    // Calculate average brightness
    const avgBrightness = ((rgb1.r + rgb2.r) / 2 * 0.299 + 
                          (rgb1.g + rgb2.g) / 2 * 0.587 + 
                          (rgb1.b + rgb2.b) / 2 * 0.114) / 255;
    
    // Return black text for light backgrounds, white for dark
    return avgBrightness > 0.5 ? '#000000' : '#ffffff';
}

// Convert hex color to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

async function moveApp(appId, categoryName, direction) {
    try {
        const response = await fetch(`/api/apps/${appId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: categoryName,
                direction: direction
            })
        });
        
        if (response.ok) {
            await loadConfig();
            renderApps();
            showBriefMessage(`App moved ${direction}`);
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to move app');
        }
    } catch (error) {
        showError('Failed to move app: ' + error.message);
    }
}

// Show add app form with enhanced Steam functionality and color pickers
function showAddAppForm() {
    const formHtml = `
        <div class="form-container">
            <h3>Add New App</h3>
            <form id="add-app-form">
                <label>Name: <input type="text" name="name" required></label>
                <label>Type: 
                    <select name="type" onchange="toggleAppTypeFields(this)" required>
                        <option value="website">Website</option>
                        <option value="steam">Steam Game</option>
                        <option value="epic">Epic Games</option>
                        <option value="executable">Executable (.exe)</option>
                    </select>
                </label>
                
                <!-- Steam App ID field - initially hidden -->
                <div id="steam-fields" style="display: none;">
                    <label>Steam App ID: 
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="text" id="steam-app-id" placeholder="e.g., 1086940 for Baldur's Gate 3" style="flex: 1;">
                            <button type="button" id="fetch-steam-btn" onclick="fetchAndPopulateSteamData()">Fetch Info</button>
                        </div>
                        <small style="color: rgba(255,255,255,0.7); font-size: 0.8rem;">
                            Find the App ID in the Steam store URL: store.steampowered.com/app/<strong>1086940</strong>/
                        </small>
                    </label>
                    <div id="steam-loading" style="display: none; text-align: center; padding: 10px;">
                        <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <span style="margin-left: 10px;">Fetching Steam data...</span>
                    </div>
                </div>
                
                <label>URL/Path: <input type="text" name="path" id="path-input" placeholder="URL or file path" required></label>
                <label>Icon URL: <input type="text" name="icon" id="icon-input" placeholder="Optional icon URL"></label>
                
                <label id="colors-label">Background Colors (not applied to Games):
                    <div class="color-inputs">
                        <div class="color-input-group">
                            <label>Color 1</label>
                            <input type="color" name="color1" value="#2196F3">
                        </div>
                        <div class="color-input-group">
                            <label>Color 2</label>
                            <input type="color" name="color2" value="#1976D2">
                        </div>
                    </div>
                </label>
                
                <label>Category: 
                    <select name="category" id="category-select" onchange="toggleColorInputs(this)" required>
                        ${Object.keys(config.categories).map(cat => 
                            `<option value="${cat}">${cat}</option>`
                        ).join('')}
                    </select>
                </label>
                <div class="form-buttons">
                    <button type="submit">Add App</button>
                    <button type="button" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    showFormModal(formHtml);
    
    // Initialize color input visibility
    setTimeout(() => {
        const categorySelect = document.getElementById('category-select');
        toggleColorInputs(categorySelect);
    }, 10);
    
    document.getElementById('add-app-form').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const appData = Object.fromEntries(formData);
        
        // Convert path to url for website type
        if (appData.type === 'website') {
            appData.url = appData.path;
            delete appData.path;
        }
        
        // Remove color properties for Games category
        if (appData.category === 'Games') {
            delete appData.color1;
            delete appData.color2;
        }
        
        try {
            const response = await fetch('/api/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: appData.category,
                    app: appData
                })
            });
            
            if (response.ok) {
                await loadConfig();
                renderApps();
                closeModal();
                if (appData.type === 'executable') {
                    showMessage('App added successfully! A launcher file has been created for your executable.');
                } else {
                    showMessage('App added successfully!');
                }
            } else {
                const error = await response.json();
                showError(error.error || 'Failed to add app');
            }
        } catch (error) {
            showError('Failed to add app: ' + error.message);
        }
    };
}

// Toggle color inputs based on category selection
function toggleColorInputs(selectElement) {
    const colorsLabel = document.getElementById('colors-label');
    if (colorsLabel) {
        if (selectElement.value === 'Games') {
            colorsLabel.style.display = 'none';
        } else {
            colorsLabel.style.display = 'block';
        }
    }
}

// Fetch and populate Steam data
async function fetchAndPopulateSteamData() {
    const appIdInput = document.getElementById('steam-app-id');
    const loadingDiv = document.getElementById('steam-loading');
    const fetchBtn = document.getElementById('fetch-steam-btn');
    const nameInput = document.querySelector('input[name="name"]');
    const pathInput = document.getElementById('path-input');
    const iconInput = document.getElementById('icon-input');
    
    const appId = appIdInput.value.trim();
    
    if (!appId) {
        showError('Please enter a Steam App ID');
        return;
    }
    
    if (!/^\d+$/.test(appId)) {
        showError('Steam App ID must be a number');
        return;
    }
    
    // Show loading state
    loadingDiv.style.display = 'block';
    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Fetching...';
    
    try {
        const steamData = await fetchSteamGameData(appId);
        
        // Populate form fields
        nameInput.value = steamData.name;
        pathInput.value = `steam://rungameid/${appId}`;
        iconInput.value = steamData.icon;
        
        // Set category to "Games" if it exists, otherwise use the first available category
        const categorySelect = document.getElementById('category-select');
        const gamesOption = Array.from(categorySelect.options).find(option => 
            option.value.toLowerCase().includes('game'));
        if (gamesOption) {
            categorySelect.value = gamesOption.value;
            toggleColorInputs(categorySelect);
        }
        
        showBriefMessage(`Successfully loaded: ${steamData.name}`);
        
    } catch (error) {
        showError(`Failed to fetch Steam data: ${error.message}`);
    } finally {
        // Hide loading state
        loadingDiv.style.display = 'none';
        fetchBtn.disabled = false;
        fetchBtn.textContent = 'Fetch Info';
    }
}

// Enhanced toggle function for app type fields
function toggleAppTypeFields(selectElement) {
    const steamFields = document.getElementById('steam-fields');
    const pathInput = document.getElementById('path-input');
    
    if (!pathInput) return;
    
    // Show/hide Steam fields
    if (selectElement.value === 'steam') {
        steamFields.style.display = 'block';
    } else {
        steamFields.style.display = 'none';
    }
    
    // Update path placeholder
    switch (selectElement.value) {
        case 'website':
            pathInput.placeholder = 'https://example.com';
            break;
        case 'steam':
            pathInput.placeholder = 'steam://rungameid/12345 (auto-filled when you fetch Steam data)';
            break;
        case 'epic':
            pathInput.placeholder = 'com.epicgames.launcher://apps/AppName';
            break;
        case 'executable':
            pathInput.placeholder = 'C:\\Program Files\\MyApp\\app.exe';
            break;
        default:
            pathInput.placeholder = 'URL or file path';
    }
}

// Show edit app form with color pickers - FIXED VERSION
function showEditAppForm(app) {
    // Find which category this app belongs to
    let currentCategory = '';
    for (const [categoryName, apps] of Object.entries(config.categories)) {
        if (apps.find(a => a.id === app.id)) {
            currentCategory = categoryName;
            break;
        }
    }
    
    const formHtml = `
        <div class="form-container">
            <h3>Edit App</h3>
            <form id="edit-app-form">
                <label>Name: <input type="text" name="name" value="${app.name}" required></label>
                <label>Type: 
                    <select name="type" onchange="togglePathPlaceholder(this)" required>
                        <option value="website" ${app.type === 'website' ? 'selected' : ''}>Website</option>
                        <option value="steam" ${app.type === 'steam' ? 'selected' : ''}>Steam Game</option>
                        <option value="epic" ${app.type === 'epic' ? 'selected' : ''}>Epic Games</option>
                        <option value="executable" ${app.type === 'executable' ? 'selected' : ''}>Executable (.exe)</option>
                    </select>
                </label>
                <label>URL/Path: <input type="text" name="path" id="path-input" value="${app.path || app.url || ''}" required></label>
                <label>Icon URL: <input type="text" name="icon" value="${app.icon || ''}" placeholder="Optional icon URL"></label>
                
                <label id="colors-label">Background Colors (not applied to Games):
                    <div class="color-inputs">
                        <div class="color-input-group">
                            <label>Color 1</label>
                            <input type="color" name="color1" value="${app.color1 || '#2196F3'}">
                        </div>
                        <div class="color-input-group">
                            <label>Color 2</label>
                            <input type="color" name="color2" value="${app.color2 || '#1976D2'}">
                        </div>
                    </div>
                </label>
                
                <label>Category: 
                    <select name="category" id="category-select" onchange="toggleColorInputs(this)" required>
                        ${Object.keys(config.categories).map(cat => 
                            `<option value="${cat}" ${cat === currentCategory ? 'selected' : ''}>${cat}</option>`
                        ).join('')}
                    </select>
                </label>
                <div class="form-buttons">
                    <button type="submit">Update App</button>
                    <button type="button" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    showFormModal(formHtml);
    
    // Set initial placeholder and color input visibility
    setTimeout(() => {
        const typeSelect = document.querySelector('select[name="type"]');
        const categorySelect = document.getElementById('category-select');
        togglePathPlaceholder(typeSelect);
        toggleColorInputs(categorySelect);
    }, 10);
    
    document.getElementById('edit-app-form').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const appData = Object.fromEntries(formData);
        
        // Convert path to url for website type
        if (appData.type === 'website') {
            appData.url = appData.path;
            delete appData.path;
        }
        
        // Remove color properties for Games category
        if (appData.category === 'Games') {
            delete appData.color1;
            delete appData.color2;
        }
        
        try {
            const response = await fetch(`/api/apps/${app.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: appData.category,
                    app: appData
                })
            });
            
            if (response.ok) {
                await loadConfig();
                renderApps();
                closeModal();
                if (appData.type === 'executable' && app.type !== 'executable') {
                    showMessage('App updated successfully! A launcher file has been created for your executable.');
                } else {
                    showMessage('App updated successfully!');
                }
            } else {
                const error = await response.json();
                showError(error.error || 'Failed to update app');
            }
        } catch (error) {
            showError('Failed to update app: ' + error.message);
        }
    };
}

// Toggle path input placeholder based on app type (legacy function for edit form)
function togglePathPlaceholder(selectElement) {
    const pathInput = document.getElementById('path-input');
    if (!pathInput) return;
    
    switch (selectElement.value) {
        case 'website':
            pathInput.placeholder = 'https://example.com';
            break;
        case 'steam':
            pathInput.placeholder = 'steam://rungameid/12345';
            break;
        case 'epic':
            pathInput.placeholder = 'com.epicgames.launcher://apps/AppName';
            break;
        case 'executable':
            pathInput.placeholder = 'C:\\Program Files\\MyApp\\app.exe';
            break;
        default:
            pathInput.placeholder = 'URL or file path';
    }
}

// Delete app
async function deleteApp(appId) {
    if (!confirm('Are you sure you want to delete this app?')) return;
    
    try {
        const response = await fetch(`/api/apps/${appId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadConfig();
            renderApps();
            showMessage('App deleted successfully!');
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to delete app');
        }
    } catch (error) {
        showError('Failed to delete app: ' + error.message);
    }
}

// Change category style
async function changeCategoryStyle(categoryName, style) {
    try {
        const response = await fetch(`/api/categories/${encodeURIComponent(categoryName)}/style`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ style })
        });

        const result = await response.json();
        if (response.ok) {
            config.categoryStyles[categoryName] = style;
            renderApps(); // re-render to apply updated style
        } else {
            alert(`Failed to update style: ${result.error}`);
        }
    } catch (err) {
        console.error('Error updating category style:', err);
        alert('An error occurred while updating the style.');
    }
}

// Show add category form
function showAddCategoryForm() {
    const formHtml = `
        <div class="form-container">
            <h3>Add New Category</h3>
            <form id="add-category-form">
                <label>Category Name: <input type="text" name="name" required></label>
                <div class="form-buttons">
                    <button type="submit">Add Category</button>
                    <button type="button" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    showFormModal(formHtml);
    
    document.getElementById('add-category-form').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const { name } = Object.fromEntries(formData);
        
        try {
            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            
            if (response.ok) {
                await loadConfig();
                renderApps();
                closeModal();
            } else {
                const error = await response.json();
                showError(error.error || 'Failed to add category');
            }
        } catch (error) {
            showError('Failed to add category: ' + error.message);
        }
    };
}

// Delete category
async function deleteCategoryHandler(categoryName) {
    if (!confirm(`Are you sure you want to delete the "${categoryName}" category and all its apps?`)) return;
    
    try {
        const response = await fetch(`/api/categories/${encodeURIComponent(categoryName)}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadConfig();
            renderApps();
            showMessage('Category deleted successfully!');
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to delete category');
        }
    } catch (error) {
        showError('Failed to delete category: ' + error.message);
    }
}

// Cleanup orphaned launcher files
async function cleanupLaunchers() {
    if (!confirm('This will remove any orphaned launcher files. Continue?')) return;
    
    try {
        const response = await fetch('/api/cleanup-launchers', {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            showMessage(result.message);
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to cleanup launchers');
        }
    } catch (error) {
        showError('Failed to cleanup launchers: ' + error.message);
    }
}

// Export configuration
function exportConfig() {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'easy-htui-config.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
}

// Show import config form
function showImportConfig() {
    const formHtml = `
        <div class="form-container">
            <h3>Import Configuration</h3>
            <form id="import-config-form">
                <label>Select Config File: <input type="file" name="configFile" accept=".json" required></label>
                <div class="form-buttons">
                    <button type="submit">Import Config</button>
                    <button type="button" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    showFormModal(formHtml);
    
    document.getElementById('import-config-form').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const file = formData.get('configFile');
        
        if (!file) return;
        
        try {
            const text = await file.text();
            const importedConfig = JSON.parse(text);
            
            const response = await fetch('/api/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(importedConfig)
            });
            
            if (response.ok) {
                await loadConfig();
                renderApps();
                closeModal();
                showMessage('Configuration imported successfully!');
            } else {
                const error = await response.json();
                showError(error.error || 'Failed to import config');
            }
        } catch (error) {
            showError('Failed to import config: ' + error.message);
        }
    };
}

// Show form modal
function showFormModal(html) {
    const existing = document.getElementById('form-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'form-modal';
    modal.className = 'modal form-modal';
    modal.innerHTML = `<div class="modal-content">${html}</div>`;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

// Close modal
function closeModal() {
    const formModal = document.getElementById('form-modal');
    if (formModal) formModal.remove();
    
    const errorModal = document.getElementById('error-modal');
    if (errorModal) errorModal.classList.add('hidden');
}

// Update list of focusable elements
function updateFocusableElements() {
    focusableElements = Array.from(document.querySelectorAll('.app-card'));
    currentFocusIndex = 0;
    
    // Focus first element if in navigation mode
    if (isNavigationMode && focusableElements.length > 0) {
        focusElement(0);
    }
}

// Focus on specific element by index with centered scrolling
function focusElement(index) {
    if (index < 0 || index >= focusableElements.length) return;
    
    // Remove focus from current element
    if (focusableElements[currentFocusIndex]) {
        focusableElements[currentFocusIndex].classList.remove('focused');
        const currentCategory = focusableElements[currentFocusIndex].closest('.category');
        if (currentCategory) {
            currentCategory.classList.remove('focused-category');
        }
    }
    
    currentFocusIndex = index;
    const element = focusableElements[currentFocusIndex];
    
    if (element) {
        element.focus();
        element.classList.add('focused');
        const category = element.closest('.category');
        if (category) {
            category.classList.add('focused-category');
        }
        centerElementInView(element);
    }
}

// Center an element vertically in the viewport
let currentScrollAnimation = null;

function centerElementInView(element) {
    if (currentScrollAnimation) {
        cancelAnimationFrame(currentScrollAnimation);
        currentScrollAnimation = null;
    }
    
    const elementRect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    const elementCenter = elementRect.top + elementRect.height / 2;
    const targetScrollTop = window.pageYOffset + elementCenter - (viewportHeight / 2);
    
    const startScrollTop = window.pageYOffset;
    const distance = targetScrollTop - startScrollTop;
    
    if (Math.abs(distance) < 20) return;
    
    const duration = 1000 * Math.min(1, Math.abs(distance) / viewportHeight);
    const startTime = performance.now();
    
    function animateScroll(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOut = 1 - (1 - progress) * (1 - progress);
        const currentScrollTop = startScrollTop + (distance * easeOut);
        
        window.scrollTo(0, currentScrollTop);
        
        if (progress < 1) {
            currentScrollAnimation = requestAnimationFrame(animateScroll);
        } else {
            currentScrollAnimation = null;
        }
    }
    
    currentScrollAnimation = requestAnimationFrame(animateScroll);
}

// Navigate using proper grid position calculation
function navigateGrid(direction) {
    if (focusableElements.length === 0) return;

    const currentElement = focusableElements[currentFocusIndex];
    const currentCategory = currentElement.closest('.category');
    if (!currentCategory) return;

    const categories = Array.from(document.querySelectorAll('.category'));
    const currentCategoryIndex = categories.indexOf(currentCategory);

    let allowedCategories = [currentCategory];

    if (direction === 'up' && currentCategoryIndex > 0) {
        allowedCategories.push(categories[currentCategoryIndex - 1]);
    } else if (direction === 'down' && currentCategoryIndex < categories.length - 1) {
        allowedCategories.push(categories[currentCategoryIndex + 1]);
    }

    const currentRect = currentElement.getBoundingClientRect();
    const currentCenter = {
        x: currentRect.left + currentRect.width / 2,
        y: currentRect.top + currentRect.height / 2
    };

    let bestElement = null;
    let bestDistance = Infinity;
    let bestIndex = -1;

    if (direction === 'up' || direction === 'down') {
        // Vertical navigation with category restrictions
        focusableElements.forEach((element, index) => {
            if (index === currentFocusIndex) return;

            const category = element.closest('.category');
            if (!allowedCategories.includes(category)) return;

            const rect = element.getBoundingClientRect();
            const center = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };

            if (direction === 'up' && center.y >= currentCenter.y - 10) return;
            if (direction === 'down' && center.y <= currentCenter.y + 10) return;

            const horizontalDistance = Math.abs(center.x - currentCenter.x);
            const verticalDistance = Math.abs(center.y - currentCenter.y);
            const distance = horizontalDistance * 2 + verticalDistance;

            if (distance < bestDistance) {
                bestDistance = distance;
                bestElement = element;
                bestIndex = index;
            }
        });
    } else if (direction === 'left') {
        bestIndex = currentFocusIndex > 0 ? currentFocusIndex - 1 : currentFocusIndex;
    } else if (direction === 'right') {
        bestIndex = currentFocusIndex < focusableElements.length - 1 ? currentFocusIndex + 1 : currentFocusIndex;
    }

    if (bestIndex !== -1 && bestIndex !== currentFocusIndex) {
        focusElement(bestIndex);
    }
}


// Get default icon based on app type
function getDefaultIcon(type) {
    const icons = {
        'executable': '🎮',
        'website': '🌐',
        'steam': '🎮',
        'epic': '🎯',
        'folder': '📁',
        'default': '📱'
    };
    return icons[type] || icons.default;
}

// Launch application based on type
async function launchApp(app) {
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
                // Use server endpoint to launch executable
                try {
                    const response = await fetch(`/api/launch/${app.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log(`Successfully launched: ${app.name}`);
                        // Optional: Show brief success message
                        showBriefMessage(`Launching ${app.name}...`);
                    } else {
                        const error = await response.json();
                        throw new Error(error.error || 'Failed to launch application');
                    }
                } catch (fetchError) {
                    if (fetchError.message.includes('launcher file not found')) {
                        showError('Launcher file not found. Try editing and re-saving this app to regenerate the launcher.');
                    } else {
                        throw fetchError;
                    }
                }
                break;
                
            case 'steam':
            case 'epic':
            default:
                throw new Error(`Unknown app type: ${app.type}`);
        }
    } catch (error) {
        console.error('Error launching app:', error);
        showError(`Failed to launch ${app.name}: ${error.message}`);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    searchInput.addEventListener('input', handleSearch);
    
    // Enhanced keyboard navigation
    document.addEventListener('keydown', (e) => {
        // Admin mode shortcut
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            toggleAdminMode();
            return;
        }
        
        // Don't interfere with search input or form inputs
        if (document.activeElement === searchInput || 
            document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'SELECT') {
            if (e.key === 'Escape') {
                searchInput.value = '';
                handleSearch();
                searchInput.blur();
                enterNavigationMode();
            } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                }
                searchInput.blur();
                enterNavigationMode();
            }
            return;
        }
        
        // Navigation mode controls
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                enterNavigationMode();
                navigateGrid('up');
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                enterNavigationMode();
                navigateGrid('down');
                break;
                
            case 'ArrowLeft':
                e.preventDefault();
                enterNavigationMode();
                navigateGrid('left');
                break;
                
            case 'ArrowRight':
                e.preventDefault();
                enterNavigationMode();
                navigateGrid('right');
                break;
                
            case 'Enter':
            case ' ':
                if (isNavigationMode && focusableElements[currentFocusIndex]) {
                    e.preventDefault();
                    focusableElements[currentFocusIndex].click();
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                exitNavigationMode();
                closeModal();
                break;
                
            case '/':
            case 'f':
                e.preventDefault();
                exitNavigationMode();
                searchInput.focus();
                if (e.key === '/') {
                    searchInput.value = '';
                }
                break;
                
            default:
                // Start typing to search
                if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
                    exitNavigationMode();
                    searchInput.focus();
                    searchInput.value = e.key;
                    handleSearch();
                }
                break;
        }
    });
    
    // Handle gamepad input
    setupGamepadSupport();
    
    // Click to exit navigation mode
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !e.target.closest('.app-card')) {
            exitNavigationMode();
        }
    });
}

// Enter navigation mode
function enterNavigationMode() {
    if (!isNavigationMode) {
        isNavigationMode = true;
        document.body.classList.add('navigation-mode');
        updateFocusableElements();
        if (focusableElements.length > 0) {
            focusElement(0);
        }
    }
}

// Exit navigation mode
function exitNavigationMode() {
    isNavigationMode = false;
    document.body.classList.remove('navigation-mode');
    
    // Remove focus from current element
    if (focusableElements[currentFocusIndex]) {
        focusableElements[currentFocusIndex].classList.remove('focused');
        focusableElements[currentFocusIndex].blur();
        const currentCategory = focusableElements[currentFocusIndex].closest('.category');
        if (currentCategory) {
            currentCategory.classList.remove('focused-category');
        }
    }
}

// Gamepad support
function setupGamepadSupport() {
    let gamepadIndex = -1;
    let lastButtonStates = {};
    
    function pollGamepad() {
        const gamepads = navigator.getGamepads();
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!gamepad) continue;
            
            if (gamepadIndex === -1) {
                gamepadIndex = i;
                console.log('Gamepad connected:', gamepad.id);
            }
            
            if (i === gamepadIndex) {
                handleGamepadInput(gamepad);
            }
        }
        
        requestAnimationFrame(pollGamepad);
    }
    
    function handleGamepadInput(gamepad) {
        const threshold = 0.5;
        
        // D-pad and left stick
        if (gamepad.axes[0] < -threshold || gamepad.buttons[14]?.pressed) { // Left
            if (!lastButtonStates.left) {
                enterNavigationMode();
                navigateGrid('left');
                lastButtonStates.left = true;
            }
        } else {
            lastButtonStates.left = false;
        }
        
        if (gamepad.axes[0] > threshold || gamepad.buttons[15]?.pressed) { // Right
            if (!lastButtonStates.right) {
                enterNavigationMode();
                navigateGrid('right');
                lastButtonStates.right = true;
            }
        } else {
            lastButtonStates.right = false;
        }
        
        if (gamepad.axes[1] < -threshold || gamepad.buttons[12]?.pressed) { // Up
            if (!lastButtonStates.up) {
                enterNavigationMode();
                navigateGrid('up');
                lastButtonStates.up = true;
            }
        } else {
            lastButtonStates.up = false;
        }
        
        if (gamepad.axes[1] > threshold || gamepad.buttons[13]?.pressed) { // Down
            if (!lastButtonStates.down) {
                enterNavigationMode();
                navigateGrid('down');
                lastButtonStates.down = true;
            }
        } else {
            lastButtonStates.down = false;
        }
        
        // A button (usually button 0) to activate
        if (gamepad.buttons[0]?.pressed) {
            if (!lastButtonStates.a && isNavigationMode && focusableElements[currentFocusIndex]) {
                focusableElements[currentFocusIndex].click();
                lastButtonStates.a = true;
            }
        } else {
            lastButtonStates.a = false;
        }
        
        // B button (usually button 1) to go back/escape
        if (gamepad.buttons[1]?.pressed) {
            if (!lastButtonStates.b) {
                exitNavigationMode();
                lastButtonStates.b = true;
            }
        } else {
            lastButtonStates.b = false;
        }
    }
    
    // Start polling
    pollGamepad();
}

// Handle search functionality
function handleSearch() {
    const query = searchInput.value.toLowerCase().trim();
    
    if (!query) {
        renderApps();
        return;
    }
    
    const filteredApps = allApps.filter(app => 
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
    
    renderApps(filteredCategories);
}

// Function to update the current time display
function updateTime() {
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

function initializeTimeDisplay() {
    updateTime();
    setInterval(updateTime, 1000);
}

function hideLoadingScreen() {
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 500);
}

function showError(message) {
    errorMessage.textContent = message;
    errorModal.classList.remove('hidden');
}

function showMessage(message) {
    // Create a success modal similar to error modal
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
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (modal.parentNode) {
            modal.remove();
        }
    }, 3000);
}

function showBriefMessage(message) {
    // Create a brief toast-style message
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
    
    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto-remove after 2 seconds
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

// Weather functionality
let weatherUpdateTimer = null;

// Fetch weather data from server
async function fetchWeatherData() {
    try {
        const response = await fetch('/api/weather');
        if (!response.ok) {
            if (response.status === 404) {
                // Weather feature disabled
                return null;
            }
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch weather');
        }
        return await response.json();
    } catch (error) {
        console.error('Weather fetch error:', error);
        throw error;
    }
}

// Update weather display
function updateWeatherDisplay(weatherData) {
    const container = document.getElementById('weather-container');
    const icon = document.getElementById('weather-icon');
    const temp = document.getElementById('weather-temp');
    const desc = document.getElementById('weather-desc');
    
    if (!container || !icon || !temp || !desc) return;
    
    if (weatherData) {
        // Set weather icon from OpenWeather
        icon.src = `https://openweathermap.org/img/wn/${weatherData.icon}@2x.png`;
        icon.alt = weatherData.description;
        
        // Set temperature with unit
        const unit = weatherData.units === 'metric' ? '°C' : 
                    weatherData.units === 'imperial' ? '°F' : 'K';
        temp.textContent = `${weatherData.temperature}${unit}`;
        
        // Set description
        desc.textContent = weatherData.description;
        
        // Show container and remove error state
        container.style.display = 'flex';
        container.classList.remove('error', 'loading');
        
        console.log(`Weather updated: ${weatherData.temperature}${unit}, ${weatherData.description}`);
    } else {
        // Hide weather if not available
        container.style.display = 'none';
    }
}

// Show weather error state
function showWeatherError(message) {
    const container = document.getElementById('weather-container');
    const temp = document.getElementById('weather-temp');
    const desc = document.getElementById('weather-desc');
    
    if (!container || !temp || !desc) return;
    
    container.style.display = 'flex';
    container.classList.add('error');
    container.classList.remove('loading');
    
    temp.textContent = '--°';
    desc.textContent = message || 'Weather unavailable';
}

// Show weather loading state
function showWeatherLoading() {
    const container = document.getElementById('weather-container');
    const temp = document.getElementById('weather-temp');
    const desc = document.getElementById('weather-desc');
    
    if (!container || !temp || !desc) return;
    
    container.style.display = 'flex';
    container.classList.add('loading');
    container.classList.remove('error');
    
    temp.textContent = '--°';
    desc.textContent = 'Loading...';
}

// Initialize weather updates
async function initializeWeather() {
    if (!config.weather || !config.weather.enabled) {
        // Weather disabled, hide container
        const container = document.getElementById('weather-container');
        if (container) container.style.display = 'none';
        return;
    }
    
    showWeatherLoading();
    
    try {
        const weatherData = await fetchWeatherData();
        updateWeatherDisplay(weatherData);
        
        // Set up periodic updates
        const updateInterval = config.weather.updateInterval || 600000; // Default 10 minutes
        
        if (weatherUpdateTimer) {
            clearInterval(weatherUpdateTimer);
        }
        
        weatherUpdateTimer = setInterval(async () => {
            try {
                const weatherData = await fetchWeatherData();
                updateWeatherDisplay(weatherData);
            } catch (error) {
                console.error('Weather update failed:', error);
                showWeatherError('Update failed');
            }
        }, updateInterval);
        
    } catch (error) {
        console.error('Weather initialization failed:', error);
        showWeatherError('Setup failed');
    }
}

// Clean up weather timer
function cleanupWeather() {
    if (weatherUpdateTimer) {
        clearInterval(weatherUpdateTimer);
        weatherUpdateTimer = null;
    }
}

async function refreshApps() {
    try {
        await loadConfig();
        renderApps();
        console.log('Apps refreshed successfully');
    } catch (error) {
        showError('Failed to refresh apps: ' + error.message);
    }
}

// Make functions globally available
window.refreshApps = refreshApps;
window.closeModal = closeModal;
window.togglePathPlaceholder = togglePathPlaceholder;
window.toggleAppTypeFields = toggleAppTypeFields;
window.toggleColorInputs = toggleColorInputs;
window.fetchAndPopulateSteamData = fetchAndPopulateSteamData;
window.showWeatherSettings = showWeatherSettings;

window.appLauncher = {
    config,
    allApps,
    refreshApps,
    launchApp,
    enterNavigationMode,
    exitNavigationMode,
    isAdminMode,
    toggleAdminMode,
    fetchSteamGameData,
    moveApp,
    getContrastingTextColor,
    hexToRgb
};