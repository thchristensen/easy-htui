const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const https = require('https'); // Add for Steam API calls

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join(__dirname, 'config', 'config.json');
const BACKUP_DIR = path.join(__dirname, 'config', 'backups');
const ASSETS_DIR = path.join(__dirname, 'assets');
const LOGS_DIR = path.join(__dirname, 'logs');
const LAUNCHERS_DIR = path.join(__dirname, 'launchers');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from root directory for main app files
app.use(express.static(__dirname, {
    index: false
}));

// Serve assets with proper caching
app.use('/assets', express.static(ASSETS_DIR, {
    maxAge: '1d',
    etag: true
}));

// Steam API helper function
async function fetchSteamAppDetails(appId) {
    return new Promise((resolve, reject) => {
        const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    const appData = response[appId];
                    
                    if (appData && appData.success && appData.data) {
                        const gameData = appData.data;
                        resolve({
                            success: true,
                            name: gameData.name,
                            icon: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
                            description: gameData.short_description,
                            developer: gameData.developers?.[0],
                            publisher: gameData.publishers?.[0],
                            releaseDate: gameData.release_date?.date,
                            genres: gameData.genres?.map(g => g.description).join(', '),
                            steamUrl: `https://store.steampowered.com/app/${appId}/`,
                            appId: appId
                        });
                    } else {
                        resolve({
                            success: false,
                            error: 'Game not found or not available'
                        });
                    }
                } catch (error) {
                    reject(new Error('Failed to parse Steam API response'));
                }
            });
        }).on('error', (error) => {
            reject(new Error('Failed to fetch from Steam API: ' + error.message));
        });
    });
}

// Ensure required directories exist
async function ensureDirectories() {
    const dirs = [
        path.join(__dirname, 'config'),
        BACKUP_DIR,
        path.join(ASSETS_DIR, 'images'),
        path.join(ASSETS_DIR, 'icons'),
        LOGS_DIR,
        LAUNCHERS_DIR
    ];
    
    for (const dir of dirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.error(`Error creating directory ${dir}:`, error);
            }
        }
    }
}

// Logging utility
async function logMessage(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}\n`;
    
    try {
        const logFile = path.join(LOGS_DIR, level === 'error' ? 'error.log' : 'server.log');
        await fs.appendFile(logFile, logEntry);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
    
    console.log(logEntry.trim());
}

// Utility function to read config
async function readConfig() {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        await logMessage(`Error reading config: ${error.message}`, 'error');
        
        const oldConfigPath = path.join(__dirname, 'config.json');
        try {
            const oldData = await fs.readFile(oldConfigPath, 'utf8');
            await logMessage('Found config in old location, migrating...', 'info');
            await fs.writeFile(CONFIG_FILE, oldData);
            await fs.unlink(oldConfigPath);
            return JSON.parse(oldData);
        } catch (migrationError) {
            await logMessage('No config found, creating default', 'info');
            throw new Error('Configuration file not found');
        }
    }
}

// Utility function to write config with backup
async function writeConfig(config) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const backupFile = path.join(BACKUP_DIR, `config-${timestamp}.json`);
        
        try {
            const currentConfig = await fs.readFile(CONFIG_FILE, 'utf8');
            await fs.writeFile(backupFile, currentConfig);
            await logMessage(`Config backed up to ${backupFile}`, 'info');
        } catch (backupError) {
            await logMessage(`Backup failed: ${backupError.message}`, 'error');
        }
        
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        await logMessage('Configuration updated successfully', 'info');
    } catch (error) {
        await logMessage(`Error writing config: ${error.message}`, 'error');
        throw new Error('Failed to write configuration');
    }
}

// Generate unique ID for new apps
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Create .bat file for executable apps
async function createBatFile(appId, executablePath, appName) {
    try {
        const batFileName = `${appId}.bat`;
        const batFilePath = path.join(LAUNCHERS_DIR, batFileName);
        
        const escapedPath = executablePath.replace(/"/g, '""');
        
        const batContent = `@echo off
REM Auto-generated launcher for ${appName}
REM Generated on ${new Date().toISOString()}
title Launching ${appName}...

echo Launching ${appName}...
start "" "${escapedPath}"

REM Exit after a brief delay
timeout /t 2 /nobreak >nul
exit
`;
        
        await fs.writeFile(batFilePath, batContent, 'utf8');
        await logMessage(`Created launcher: ${batFileName} for ${appName}`, 'info');
        
        return batFilePath;
    } catch (error) {
        await logMessage(`Failed to create .bat file for ${appName}: ${error.message}`, 'error');
        throw error;
    }
}

// Delete .bat file for executable apps
async function deleteBatFile(appId) {
    try {
        const batFileName = `${appId}.bat`;
        const batFilePath = path.join(LAUNCHERS_DIR, batFileName);
        
        try {
            await fs.access(batFilePath);
            await fs.unlink(batFilePath);
            await logMessage(`Deleted launcher: ${batFileName}`, 'info');
        } catch (accessError) {
            if (accessError.code !== 'ENOENT') {
                throw accessError;
            }
        }
    } catch (error) {
        await logMessage(`Failed to delete .bat file for app ID ${appId}: ${error.message}`, 'error');
    }
}

app.get('/api/steam/:appId', async (req, res) => {
    try {
        const { appId } = req.params;
        
        if (!appId || !/^\d+$/.test(appId)) {
            return res.status(400).json({ error: 'Invalid Steam App ID' });
        }
        
        await logMessage(`Fetching Steam data for App ID: ${appId}`, 'info');
        const steamData = await fetchSteamAppDetails(appId);
        
        if (steamData.success) {
            await logMessage(`Successfully fetched Steam data for: ${steamData.name}`, 'info');
            res.json(steamData);
        } else {
            res.status(404).json({ error: steamData.error || 'Game not found' });
        }
    } catch (error) {
        await logMessage(`Steam API error: ${error.message}`, 'error');
        res.status(500).json({ error: 'Failed to fetch Steam game data' });
    }
});

// API Routes

// Get current configuration
app.get('/api/config', async (req, res) => {
    try {
        const config = await readConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update entire configuration
app.put('/api/config', async (req, res) => {
    try {
        await writeConfig(req.body);
        res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get configuration backups
app.get('/api/backups', async (req, res) => {
    try {
        const files = await fs.readdir(BACKUP_DIR);
        const backups = files
            .filter(file => file.startsWith('config-') && file.endsWith('.json'))
            .map(file => ({
                filename: file,
                date: file.replace('config-', '').replace('.json', '')
            }))
            .sort((a, b) => b.date.localeCompare(a.date));
        
        res.json(backups);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

// Restore from backup
app.post('/api/restore/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const backupFile = path.join(BACKUP_DIR, filename);
        
        const backupData = await fs.readFile(backupFile, 'utf8');
        const backupConfig = JSON.parse(backupData);
        
        await writeConfig(backupConfig);
        await logMessage(`Restored configuration from backup: ${filename}`, 'info');
        
        res.json({ success: true, message: 'Configuration restored successfully' });
    } catch (error) {
        await logMessage(`Restore failed: ${error.message}`, 'error');
        res.status(500).json({ error: 'Failed to restore backup' });
    }
});

// Add new app to a category
app.post('/api/apps', async (req, res) => {
    try {
        const { category, app } = req.body;
        
        if (!category || !app) {
            return res.status(400).json({ error: 'Category and app data are required' });
        }

        const config = await readConfig();
        
        if (!config.categories[category]) {
            config.categories[category] = [];
        }

        app.id = generateId();
        
        if (app.type === 'executable' && app.path) {
            try {
                const batFilePath = await createBatFile(app.id, app.path, app.name);
                app.batFile = path.relative(__dirname, batFilePath);
                await logMessage(`Created .bat launcher for executable: ${app.name}`, 'info');
            } catch (batError) {
                await logMessage(`Failed to create .bat file for ${app.name}: ${batError.message}`, 'error');
                return res.status(500).json({ error: 'Failed to create launcher file for executable' });
            }
        }
        
        config.categories[category].push(app);
        
        await writeConfig(config);
        await logMessage(`Added app "${app.name}" to category "${category}"`, 'info');
        
        res.json({ success: true, message: 'App added successfully', app });
    } catch (error) {
        await logMessage(`Failed to add app: ${error.message}`, 'error');
        res.status(500).json({ error: error.message });
    }
});

// Update existing app
app.put('/api/apps/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { category, app } = req.body;
        
        const config = await readConfig();
        let found = false;
        let oldCategory = '';
        let oldApp = null;
        
        for (const [catName, apps] of Object.entries(config.categories)) {
            const appIndex = apps.findIndex(a => a.id === id);
            if (appIndex !== -1) {
                oldCategory = catName;
                oldApp = apps[appIndex];
                
                if (app.type === 'executable' && app.path) {
                    await deleteBatFile(id);
                    
                    try {
                        const batFilePath = await createBatFile(id, app.path, app.name);
                        app.batFile = path.relative(__dirname, batFilePath);
                    } catch (batError) {
                        await logMessage(`Failed to create .bat file for ${app.name}: ${batError.message}`, 'error');
                        return res.status(500).json({ error: 'Failed to create launcher file for executable' });
                    }
                } else if (oldApp.type === 'executable') {
                    await deleteBatFile(id);
                    delete app.batFile;
                }
                
                if (category && category !== catName) {
                    apps.splice(appIndex, 1);
                    if (!config.categories[category]) {
                        config.categories[category] = [];
                    }
                    config.categories[category].push({ ...app, id });
                } else {
                    config.categories[catName][appIndex] = { ...app, id };
                }
                found = true;
                break;
            }
        }
        
        if (!found) {
            return res.status(404).json({ error: 'App not found' });
        }
        
        await writeConfig(config);
        await logMessage(`Updated app "${app.name}" (moved from "${oldCategory}" to "${category}")`, 'info');
        
        res.json({ success: true, message: 'App updated successfully' });
    } catch (error) {
        await logMessage(`Failed to update app: ${error.message}`, 'error');
        res.status(500).json({ error: error.message });
    }
});

// Move app within category
app.post('/api/apps/:id/move', async (req, res) => {
    try {
        const { id } = req.params;
        const { category, direction } = req.body;
        
        if (!category || !direction || !['left', 'right'].includes(direction)) {
            return res.status(400).json({ error: 'Category and valid direction (left/right) are required' });
        }

        const config = await readConfig();
        
        if (!config.categories[category]) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const apps = config.categories[category];
        const currentIndex = apps.findIndex(app => app.id === id);
        
        if (currentIndex === -1) {
            return res.status(404).json({ error: 'App not found in specified category' });
        }

        let newIndex;
        if (direction === 'left') {
            newIndex = currentIndex - 1;
        } else { // direction === 'right'
            newIndex = currentIndex + 1;
        }

        // Check if move is valid
        if (newIndex < 0 || newIndex >= apps.length) {
            return res.status(400).json({ error: `Cannot move app ${direction} - already at boundary` });
        }

        // Swap the apps
        [apps[currentIndex], apps[newIndex]] = [apps[newIndex], apps[currentIndex]];
        
        await writeConfig(config);
        await logMessage(`Moved app "${apps[newIndex].name}" ${direction} in category "${category}"`, 'info');
        
        res.json({ 
            success: true, 
            message: `App moved ${direction} successfully`,
            newPosition: newIndex
        });
    } catch (error) {
        await logMessage(`Failed to move app: ${error.message}`, 'error');
        res.status(500).json({ error: error.message });
    }
});

// Delete app
app.delete('/api/apps/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const config = await readConfig();
        let found = false;
        let deletedApp = null;
        
        for (const [catName, apps] of Object.entries(config.categories)) {
            const appIndex = apps.findIndex(a => a.id === id);
            if (appIndex !== -1) {
                deletedApp = apps[appIndex];
                
                if (deletedApp.type === 'executable') {
                    await deleteBatFile(id);
                }
                
                apps.splice(appIndex, 1);
                found = true;
                break;
            }
        }
        
        if (!found) {
            return res.status(404).json({ error: 'App not found' });
        }
        
        await writeConfig(config);
        await logMessage(`Deleted app "${deletedApp.name}" and associated launcher`, 'info');
        
        res.json({ success: true, message: 'App deleted successfully' });
    } catch (error) {
        await logMessage(`Failed to delete app: ${error.message}`, 'error');
        res.status(500).json({ error: error.message });
    }
});

// Create new category
app.post('/api/categories', async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const config = await readConfig();
        
        if (config.categories[name]) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        config.categories[name] = [];
        await writeConfig(config);
        await logMessage(`Created category "${name}"`, 'info');
        
        res.json({ success: true, message: 'Category created successfully' });
    } catch (error) {
        await logMessage(`Failed to create category: ${error.message}`, 'error');
        res.status(500).json({ error: error.message });
    }
});

// Delete category
app.delete('/api/categories/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const config = await readConfig();
        
        if (!config.categories[name]) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const apps = config.categories[name];
        for (const app of apps) {
            if (app.type === 'executable') {
                await deleteBatFile(app.id);
            }
        }

        const appCount = apps.length;
        delete config.categories[name];
        await writeConfig(config);
        await logMessage(`Deleted category "${name}" with ${appCount} apps and associated launchers`, 'info');
        
        res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        await logMessage(`Failed to delete category: ${error.message}`, 'error');
        res.status(500).json({ error: error.message });
    }
});

// Update category style
app.put('/api/categories/:name/style', async (req, res) => {
    try {
        const { name } = req.params;
        const { style } = req.body;
        const config = await readConfig();
        if (!config.categories[name]) {
            return res.status(404).json({ error: 'Category not found' });
        }
        const allowedStyles = ['', 'compact', 'portrait', 'landscape', 'list', 'large', 'minimal'];
        if (!allowedStyles.includes(style)) {
            return res.status(400).json({ error: `Invalid style. Must be one of: ${allowedStyles.join(', ')}` });
        }
        config.categoryStyles[name] = style;
        await writeConfig(config);
        await logMessage(`Updated style for category "${name}" to "${style}"`, 'info');
        res.json({ success: true, message: `Category "${name}" style updated to "${style}"` });
    } catch (error) {
        await logMessage(`Failed to update category style: ${error.message}`, 'error');
        res.status(500).json({ error: error.message });
    }
});

// Launch application endpoint
app.post('/api/launch/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const config = await readConfig();
        
        let targetApp = null;
        for (const apps of Object.values(config.categories)) {
            const app = apps.find(a => a.id === id);
            if (app) {
                targetApp = app;
                break;
            }
        }
        
        if (!targetApp) {
            return res.status(404).json({ error: 'App not found' });
        }
        
        if (targetApp.type === 'executable') {
            const batFileName = `${id}.bat`;
            const batFilePath = path.join(LAUNCHERS_DIR, batFileName);
            
            try {
                await fs.access(batFilePath);
            } catch (accessError) {
                await logMessage(`Launcher file not found: ${batFilePath}`, 'error');
                return res.status(404).json({ error: 'Launcher file not found. Try editing and re-saving this app.' });
            }
            
            try {
                const child = spawn('cmd.exe', ['/c', batFilePath], {
                    detached: true,
                    stdio: 'ignore'
                });
                
                child.unref();
                
                await logMessage(`Launched executable: ${targetApp.name} via ${batFileName}`, 'info');
                res.json({ success: true, message: `Launched ${targetApp.name}` });
                
            } catch (execError) {
                await logMessage(`Failed to execute ${batFileName}: ${execError.message}`, 'error');
                res.status(500).json({ error: 'Failed to launch application' });
            }
        } else {
            res.status(400).json({ error: 'App is not an executable type' });
        }
        
    } catch (error) {
        await logMessage(`Launch endpoint error: ${error.message}`, 'error');
        res.status(500).json({ error: 'Failed to launch application' });
    }
});

// Get server status and stats
app.get('/api/status', async (req, res) => {
    try {
        const config = await readConfig();
        const totalApps = Object.values(config.categories).reduce((sum, apps) => sum + apps.length, 0);
        const totalCategories = Object.keys(config.categories).length;
        
        let backupCount = 0;
        try {
            const backupFiles = await fs.readdir(BACKUP_DIR);
            backupCount = backupFiles.filter(f => f.endsWith('.json')).length;
        } catch (e) {}
        
        let launcherCount = 0;
        try {
            const launcherFiles = await fs.readdir(LAUNCHERS_DIR);
            launcherCount = launcherFiles.filter(f => f.endsWith('.bat')).length;
        } catch (e) {}
        
        res.json({
            status: 'running',
            uptime: process.uptime(),
            stats: {
                totalApps,
                totalCategories,
                backupCount,
                launcherCount
            },
            version: require('./package.json').version
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get server status' });
    }
});

// Clean up orphaned .bat files
app.post('/api/cleanup-launchers', async (req, res) => {
    try {
        const config = await readConfig();
        const activeAppIds = new Set();
        
        for (const apps of Object.values(config.categories)) {
            for (const app of apps) {
                if (app.type === 'executable') {
                    activeAppIds.add(app.id);
                }
            }
        }
        
        const launcherFiles = await fs.readdir(LAUNCHERS_DIR);
        const batFiles = launcherFiles.filter(file => file.endsWith('.bat'));
        
        let deletedCount = 0;
        for (const batFile of batFiles) {
            const appId = path.basename(batFile, '.bat');
            if (!activeAppIds.has(appId)) {
                await fs.unlink(path.join(LAUNCHERS_DIR, batFile));
                deletedCount++;
                await logMessage(`Cleaned up orphaned launcher: ${batFile}`, 'info');
            }
        }
        
        res.json({ 
            success: true, 
            message: `Cleaned up ${deletedCount} orphaned launcher files`,
            deletedCount 
        });
    } catch (error) {
        await logMessage(`Failed to cleanup launchers: ${error.message}`, 'error');
        res.status(500).json({ error: 'Failed to cleanup launcher files' });
    }
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    logMessage(`Server error: ${err.message}`, 'error');
    res.status(500).json({ error: 'Internal server error' });
});

// Weather API helper function
async function fetchWeatherData(apiKey, location, units = 'metric') {
    return new Promise((resolve, reject) => {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=${units}`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (response.cod === 200) {
                        resolve({
                            success: true,
                            location: response.name,
                            country: response.sys.country,
                            temperature: Math.round(response.main.temp),
                            description: response.weather[0].description,
                            icon: response.weather[0].icon,
                            humidity: response.main.humidity,
                            windSpeed: response.wind.speed,
                            units: units
                        });
                    } else {
                        resolve({
                            success: false,
                            error: response.message || 'Weather data not available'
                        });
                    }
                } catch (error) {
                    reject(new Error('Failed to parse weather API response'));
                }
            });
        }).on('error', (error) => {
            reject(new Error('Failed to fetch weather data: ' + error.message));
        });
    });
}

// Weather API endpoint
app.get('/api/weather', async (req, res) => {
    try {
        const config = await readConfig();
        
        if (!config.weather || !config.weather.enabled) {
            return res.status(404).json({ error: 'Weather feature is disabled' });
        }
        
        if (!config.weather.apiKey || config.weather.apiKey === 'YOUR_OPENWEATHER_API_KEY') {
            return res.status(400).json({ error: 'Weather API key not configured' });
        }
        
        if (!config.weather.location) {
            return res.status(400).json({ error: 'Weather location not configured' });
        }
        

        const weatherData = await fetchWeatherData(
            config.weather.apiKey, 
            config.weather.location, 
            config.weather.units || 'metric'
        );
        
        if (weatherData.success) {
            res.json(weatherData);
        } else {
            res.status(404).json({ error: weatherData.error });
        }
    } catch (error) {
        await logMessage(`Weather API error: ${error.message}`, 'error');
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});

app.get('/api/weather/test', async (req, res) => {
    try {
        const config = await readConfig();
        
        const testResult = {
            timestamp: new Date().toISOString(),
            configExists: !!config.weather,
            weatherEnabled: config.weather?.enabled || false,
            hasApiKey: !!(config.weather?.apiKey && config.weather.apiKey !== 'YOUR_OPENWEATHER_API_KEY'),
            apiKeyLength: config.weather?.apiKey?.length || 0,
            location: config.weather?.location || 'Not set',
            units: config.weather?.units || 'Not set',
            updateInterval: config.weather?.updateInterval || 'Not set'
        };
        
        console.log('Weather test result:', testResult);
        
        // If everything looks good, try a test API call
        if (testResult.weatherEnabled && testResult.hasApiKey && config.weather.location) {
            try {
                console.log('Attempting test weather API call...');
                const weatherData = await fetchWeatherData(
                    config.weather.apiKey,
                    config.weather.location,
                    config.weather.units || 'metric'
                );
                testResult.apiCallResult = weatherData.success ? 'SUCCESS' : 'FAILED';
                testResult.apiError = weatherData.success ? null : weatherData.error;
                testResult.weatherData = weatherData.success ? weatherData : null;
            } catch (apiError) {
                testResult.apiCallResult = 'ERROR';
                testResult.apiError = apiError.message;
            }
        } else {
            testResult.apiCallResult = 'SKIPPED';
            testResult.apiError = 'Missing required configuration';
        }
        
        res.json(testResult);
    } catch (error) {
        console.error('Weather test endpoint error:', error);
        res.status(500).json({ 
            error: 'Test failed', 
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Initialize and start server
async function startServer() {
    try {
        await ensureDirectories();
        await logMessage('Easy HTUI server starting...', 'info');
        
        app.listen(PORT, () => {
            logMessage(`Server running on http://localhost:${PORT}`, 'info');
            console.log('Access the app at: http://localhost:' + PORT);
        });
    } catch (error) {
        await logMessage(`Failed to start server: ${error.message}`, 'error');
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    await logMessage('Shutting down server...', 'info');
    process.exit(0);
});

startServer();