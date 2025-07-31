// Admin module - handles admin mode, CRUD operations, and forms
import { AppState } from '../app.js';

export class AdminManager {
    constructor(app) {
        this.app = app;
    }

    // Setup admin toggle button
    setupAdminToggle() {
        const adminToggle = document.querySelector('.admin-toggle');
        if (adminToggle) {
            adminToggle.addEventListener('click', () => this.toggleAdminMode());
        } else {
            console.warn('Admin toggle element not found.');
        }
    }

    // Toggle admin mode
    toggleAdminMode() {
        AppState.isAdminMode = !AppState.isAdminMode;
        document.body.classList.toggle('admin-mode', AppState.isAdminMode);
        
        const toggle = document.querySelector('.admin-toggle');
        toggle.classList.toggle('active', AppState.isAdminMode);
        
        this.app.renderApps();

        if (AppState.isAdminMode) {
            this.showAdminPanel();
        } else {
            this.hideAdminPanel();
        }
    }

    // Show admin panel
    showAdminPanel() {
        const existing = document.getElementById('admin-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.id = 'admin-panel';
        panel.className = 'admin-panel';
        panel.innerHTML = `
            <h3>Admin Panel</h3>
            <button onclick="window.app.admin.showAddAppForm()">Add New App</button>
            <button onclick="window.app.admin.showAddCategoryForm()">Add New Category</button>
            <button onclick="window.app.weather.showSettings()">Weather Settings</button>
            <button onclick="window.app.admin.exportConfig()">Export Config</button>
            <button onclick="window.app.admin.showImportConfig()">Import Config</button>
            <button onclick="window.app.admin.cleanupLaunchers()">Cleanup Launchers</button>
        `;
        
        document.body.appendChild(panel);
    }

    // Hide admin panel
    hideAdminPanel() {
        const panel = document.getElementById('admin-panel');
        if (panel) panel.remove();
    }

    // Create category header with admin controls
    createCategoryHeader(categoryName, categoryStyle) {
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        
        const categoryTitle = document.createElement('h2');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = categoryName;
        
        categoryHeader.appendChild(categoryTitle);

        const categoryAdminControls = document.createElement('div');
        categoryAdminControls.className = 'category-admin-controls';
        
        categoryHeader.appendChild(categoryAdminControls);

        requestAnimationFrame(() => {
            const width = categoryTitle.offsetWidth;
            categoryAdminControls.style.left = width + 60 + 'px';
        });
        
        if (AppState.isAdminMode) {
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
                this.changeCategoryStyle(categoryName, e.target.value);
            };
            categoryAdminControls.appendChild(styleSelector);
            
            const deleteCategory = document.createElement('button');
            deleteCategory.textContent = '×';
            deleteCategory.className = 'delete-category-btn';
            deleteCategory.onclick = (e) => {
                e.stopPropagation();
                this.deleteCategory(categoryName);
            };
            categoryAdminControls.appendChild(deleteCategory);
        }

        
        
        return categoryHeader;
    }

    // Create admin controls for app cards
    createAdminControls(app, categoryName, currentIndex, totalApps) {
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
                    this.moveApp(app.id, categoryName, 'left');
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
                    this.moveApp(app.id, categoryName, 'right');
                };
                adminControls.appendChild(moveRightBtn);
            }
        }
        
        const editBtn = document.createElement('button');
        editBtn.textContent = '✎';
        editBtn.className = 'edit-btn';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            this.showEditAppForm(app);
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteApp(app.id);
        };
        
        adminControls.appendChild(editBtn);
        adminControls.appendChild(deleteBtn);
        
        return adminControls;
    }

    // Move app within category
    async moveApp(appId, categoryName, direction) {
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
                await this.app.loadConfig();
                this.app.renderApps();
                this.app.showBriefMessage(`App moved ${direction}`);
            } else {
                const error = await response.json();
                this.app.showError(error.error || 'Failed to move app');
            }
        } catch (error) {
            this.app.showError('Failed to move app: ' + error.message);
        }
    }

    // Show add app form
    showAddAppForm() {
        const formHtml = `
            <div class="form-container">
                <h3>Add New App</h3>
                <form id="add-app-form">
                    <label>Name: <input type="text" name="name" required></label>
                    <label>Type: 
                        <select name="type" onchange="window.app.admin.toggleAppTypeFields(this)" required>
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
                                <button type="button" id="fetch-steam-btn" onclick="window.app.admin.fetchAndPopulateSteamData()">Fetch Info</button>
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
                        <select name="category" id="category-select" onchange="window.app.admin.toggleColorInputs(this)" required>
                            ${Object.keys(AppState.config.categories).map(cat => 
                                `<option value="${cat}">${cat}</option>`
                            ).join('')}
                        </select>
                    </label>
                    <div class="form-buttons">
                        <button type="submit">Add App</button>
                        <button type="button" onclick="window.app.admin.closeModal()">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        
        this.showFormModal(formHtml);
        
        // Initialize color input visibility
        setTimeout(() => {
            const categorySelect = document.getElementById('category-select');
            this.toggleColorInputs(categorySelect);
        }, 10);
        
        document.getElementById('add-app-form').onsubmit = async (e) => {
            e.preventDefault();
            await this.handleAddApp(e);
        };
    }

    // Handle add app form submission
    async handleAddApp(event) {
        const formData = new FormData(event.target);
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
                await this.app.loadConfig();
                this.app.renderApps();
                this.closeModal();
                if (appData.type === 'executable') {
                    this.app.showMessage('App added successfully! A launcher file has been created for your executable.');
                } else {
                    this.app.showMessage('App added successfully!');
                }
            } else {
                const error = await response.json();
                this.app.showError(error.error || 'Failed to add app');
            }
        } catch (error) {
            this.app.showError('Failed to add app: ' + error.message);
        }
    }

    // Show edit app form
    showEditAppForm(app) {
        // Find which category this app belongs to
        let currentCategory = '';
        for (const [categoryName, apps] of Object.entries(AppState.config.categories)) {
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
                        <select name="type" onchange="window.app.admin.togglePathPlaceholder(this)" required>
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
                        <select name="category" id="category-select" onchange="window.app.admin.toggleColorInputs(this)" required>
                            ${Object.keys(AppState.config.categories).map(cat => 
                                `<option value="${cat}" ${cat === currentCategory ? 'selected' : ''}>${cat}</option>`
                            ).join('')}
                        </select>
                    </label>
                    <div class="form-buttons">
                        <button type="submit">Update App</button>
                        <button type="button" onclick="window.app.admin.closeModal()">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        
        this.showFormModal(formHtml);
        
        // Set initial placeholder and color input visibility
        setTimeout(() => {
            const typeSelect = document.querySelector('select[name="type"]');
            const categorySelect = document.getElementById('category-select');
            this.togglePathPlaceholder(typeSelect);
            this.toggleColorInputs(categorySelect);
        }, 10);
        
        document.getElementById('edit-app-form').onsubmit = async (e) => {
            e.preventDefault();
            await this.handleEditApp(e, app.id);
        };
    }

    // Handle edit app form submission
    async handleEditApp(event, appId) {
        const formData = new FormData(event.target);
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
            const response = await fetch(`/api/apps/${appId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: appData.category,
                    app: appData
                })
            });
            
            if (response.ok) {
                await this.app.loadConfig();
                this.app.renderApps();
                this.closeModal();
                this.app.showMessage('App updated successfully!');
            } else {
                const error = await response.json();
                this.app.showError(error.error || 'Failed to update app');
            }
        } catch (error) {
            this.app.showError('Failed to update app: ' + error.message);
        }
    }

    // Delete app
    async deleteApp(appId) {
        if (!confirm('Are you sure you want to delete this app?')) return;
        
        try {
            const response = await fetch(`/api/apps/${appId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await this.app.loadConfig();
                this.app.renderApps();
                this.app.showMessage('App deleted successfully!');
            } else {
                const error = await response.json();
                this.app.showError(error.error || 'Failed to delete app');
            }
        } catch (error) {
            this.app.showError('Failed to delete app: ' + error.message);
        }
    }

    // Show add category form
    showAddCategoryForm() {
        const formHtml = `
            <div class="form-container">
                <h3>Add New Category</h3>
                <form id="add-category-form">
                    <label>Category Name: <input type="text" name="name" required></label>
                    <div class="form-buttons">
                        <button type="submit">Add Category</button>
                        <button type="button" onclick="window.app.admin.closeModal()">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        
        this.showFormModal(formHtml);
        
        document.getElementById('add-category-form').onsubmit = async (e) => {
            e.preventDefault();
            await this.handleAddCategory(e);
        };
    }

    // Handle add category form submission
    async handleAddCategory(event) {
        const formData = new FormData(event.target);
        const { name } = Object.fromEntries(formData);
        
        try {
            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            
            if (response.ok) {
                await this.app.loadConfig();
                this.app.renderApps();
                this.closeModal();
                this.app.showMessage('Category added successfully!');
            } else {
                const error = await response.json();
                this.app.showError(error.error || 'Failed to add category');
            }
        } catch (error) {
            this.app.showError('Failed to add category: ' + error.message);
        }
    }

    // Delete category
    async deleteCategory(categoryName) {
        if (!confirm(`Are you sure you want to delete the "${categoryName}" category and all its apps?`)) return;
        
        try {
            const response = await fetch(`/api/categories/${encodeURIComponent(categoryName)}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await this.app.loadConfig();
                this.app.renderApps();
                this.app.showMessage('Category deleted successfully!');
            } else {
                const error = await response.json();
                this.app.showError(error.error || 'Failed to delete category');
            }
        } catch (error) {
            this.app.showError('Failed to delete category: ' + error.message);
        }
    }

    // Change category style
    async changeCategoryStyle(categoryName, style) {
        try {
            const response = await fetch(`/api/categories/${encodeURIComponent(categoryName)}/style`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ style })
            });

            const result = await response.json();
            if (response.ok) {
                AppState.config.categoryStyles[categoryName] = style;
                this.app.renderApps();
                this.app.showBriefMessage(`Style updated to ${style || 'default'}`);
            } else {
                this.app.showError(`Failed to update style: ${result.error}`);
            }
        } catch (err) {
            console.error('Error updating category style:', err);
            this.app.showError('An error occurred while updating the style.');
        }
    }

    // Steam integration functions
    async fetchSteamGameData(appId) {
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

    async fetchAndPopulateSteamData() {
        const appIdInput = document.getElementById('steam-app-id');
        const loadingDiv = document.getElementById('steam-loading');
        const fetchBtn = document.getElementById('fetch-steam-btn');
        const nameInput = document.querySelector('input[name="name"]');
        const pathInput = document.getElementById('path-input');
        const iconInput = document.getElementById('icon-input');
        
        const appId = appIdInput.value.trim();
        
        if (!appId) {
            this.app.showError('Please enter a Steam App ID');
            return;
        }
        
        if (!/^\d+$/.test(appId)) {
            this.app.showError('Steam App ID must be a number');
            return;
        }
        
        // Show loading state
        loadingDiv.style.display = 'block';
        fetchBtn.disabled = true;
        fetchBtn.textContent = 'Fetching...';
        
        try {
            const steamData = await this.fetchSteamGameData(appId);
            
            // Populate form fields
            nameInput.value = steamData.name;
            pathInput.value = `steam://rungameid/${appId}`;
            iconInput.value = steamData.icon;
            
            // Set category to "Games" if it exists
            const categorySelect = document.getElementById('category-select');
            const gamesOption = Array.from(categorySelect.options).find(option => 
                option.value.toLowerCase().includes('game'));
            if (gamesOption) {
                categorySelect.value = gamesOption.value;
                this.toggleColorInputs(categorySelect);
            }
            
            this.app.showBriefMessage(`Successfully loaded: ${steamData.name}`);
            
        } catch (error) {
            this.app.showError(`Failed to fetch Steam data: ${error.message}`);
        } finally {
            // Hide loading state
            loadingDiv.style.display = 'none';
            fetchBtn.disabled = false;
            fetchBtn.textContent = 'Fetch Info';
        }
    }

    // Form helper functions
    toggleAppTypeFields(selectElement) {
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
        this.updatePathPlaceholder(selectElement, pathInput);
    }

    togglePathPlaceholder(selectElement) {
        const pathInput = document.getElementById('path-input');
        if (!pathInput) return;
        
        this.updatePathPlaceholder(selectElement, pathInput);
    }

    updatePathPlaceholder(selectElement, pathInput) {
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

    toggleColorInputs(selectElement) {
        const colorsLabel = document.getElementById('colors-label');
        if (colorsLabel) {
            if (selectElement.value === 'Games') {
                colorsLabel.style.display = 'none';
            } else {
                colorsLabel.style.display = 'block';
            }
        }
    }

    // Import/Export functions
    exportConfig() {
        const dataStr = JSON.stringify(AppState.config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'easy-htui-config.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        this.app.showBriefMessage('Configuration exported successfully!');
    }

    showImportConfig() {
        const formHtml = `
            <div class="form-container">
                <h3>Import Configuration</h3>
                <form id="import-config-form">
                    <label>Select Config File: <input type="file" name="configFile" accept=".json" required></label>
                    <div class="form-buttons">
                        <button type="submit">Import Config</button>
                        <button type="button" onclick="window.app.admin.closeModal()">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        
        this.showFormModal(formHtml);
        
        document.getElementById('import-config-form').onsubmit = async (e) => {
            e.preventDefault();
            await this.handleImportConfig(e);
        };
    }

    async handleImportConfig(event) {
        const formData = new FormData(event.target);
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
                await this.app.loadConfig();
                this.app.renderApps();
                this.closeModal();
                this.app.showMessage('Configuration imported successfully!');
            } else {
                const error = await response.json();
                this.app.showError(error.error || 'Failed to import config');
            }
        } catch (error) {
            this.app.showError('Failed to import config: ' + error.message);
        }
    }

    // Cleanup functions
    async cleanupLaunchers() {
        if (!confirm('This will remove any orphaned launcher files. Continue?')) return;
        
        try {
            const response = await fetch('/api/cleanup-launchers', {
                method: 'POST'
            });
            
            if (response.ok) {
                const result = await response.json();
                this.app.showMessage(result.message);
            } else {
                const error = await response.json();
                this.app.showError(error.error || 'Failed to cleanup launchers');
            }
        } catch (error) {
            this.app.showError('Failed to cleanup launchers: ' + error.message);
        }
    }

    // Modal functions
    showFormModal(html) {
        const existing = document.getElementById('form-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'form-modal';
        modal.className = 'modal form-modal';
        modal.innerHTML = `<div class="modal-content">${html}</div>`;
        
        document.body.appendChild(modal);

        // Disable scrolling on body
        document.body.classList.add('modal-open');

        
    }

    closeModal() {
        const formModal = document.getElementById('form-modal');
        if (formModal) formModal.remove();
        
        const errorModal = document.getElementById('error-modal');
        if (errorModal) errorModal.classList.add('hidden');

        document.body.classList.remove('modal-open');
    }
}