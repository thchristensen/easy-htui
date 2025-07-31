// Weather module - handles weather display and API calls
import { AppState } from '../app.js';

export class WeatherManager {
    constructor(app) {
        this.app = app;
        this.updateTimer = null;
        this.container = document.getElementById('weather-container');
        this.icon = document.getElementById('weather-icon');
        this.temp = document.getElementById('weather-temp');
        this.desc = document.getElementById('weather-desc');
    }

    // Initialize weather functionality
    async initialize() {
        if (!AppState.config.weather || !AppState.config.weather.enabled) {
            // Weather disabled, hide container
            if (this.container) this.container.style.display = 'none';
            return;
        }
        
        this.showLoading();
        
        try {
            const weatherData = await this.fetchWeatherData();
            this.updateDisplay(weatherData);
            
            // Set up periodic updates
            const updateInterval = AppState.config.weather.updateInterval || 600000; // Default 10 minutes
            
            if (this.updateTimer) {
                clearInterval(this.updateTimer);
            }
            
            this.updateTimer = setInterval(async () => {
                try {
                    const weatherData = await this.fetchWeatherData();
                    this.updateDisplay(weatherData);
                } catch (error) {
                    console.error('Weather update failed:', error);
                    this.showError('Update failed');
                }
            }, updateInterval);
            
        } catch (error) {
            console.error('Weather initialization failed:', error);
            this.showError('Setup failed');
        }
    }

    // Fetch weather data from server
    async fetchWeatherData() {
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
    updateDisplay(weatherData) {
        if (!this.container || !this.icon || !this.temp || !this.desc) return;
        
        if (weatherData) {
            // Set weather icon from OpenWeather
            this.icon.src = `https://openweathermap.org/img/wn/${weatherData.icon}@2x.png`;
            this.icon.alt = weatherData.description;
            
            // Set temperature with unit
            const unit = weatherData.units === 'metric' ? '°C' : 
                        weatherData.units === 'imperial' ? '°F' : 'K';
            this.temp.textContent = `${weatherData.temperature}${unit}`;
            
            // Set description
            this.desc.textContent = weatherData.description;
            
            // Show container and remove error state
            this.container.style.display = 'flex';
            this.container.classList.remove('error', 'loading');
            
        } else {
            // Hide weather if not available
            this.container.style.display = 'none';
        }
    }

    // Show weather error state
    showError(message) {
        if (!this.container || !this.temp || !this.desc) return;
        
        this.container.style.display = 'flex';
        this.container.classList.add('error');
        this.container.classList.remove('loading');
        
        this.temp.textContent = '--°';
        this.desc.textContent = message || 'Weather unavailable';
    }

    // Show weather loading state
    showLoading() {
        if (!this.container || !this.temp || !this.desc) return;
        
        this.container.style.display = 'flex';
        this.container.classList.add('loading');
        this.container.classList.remove('error');
        
        this.temp.textContent = '--°';
        this.desc.textContent = 'Loading...';
    }

    // Show weather settings form
    showSettings() {
        const weatherConfig = AppState.config.weather || { 
            enabled: false, 
            apiKey: '', 
            location: '', 
            units: 'metric' 
        };
        
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
        
        this.app.admin.showFormModal(formHtml);
        
        document.getElementById('weather-settings-form').onsubmit = async (e) => {
            e.preventDefault();
            await this.saveSettings(e);
        };
    }

    // Save weather settings
    async saveSettings(event) {
        const formData = new FormData(event.target);
        const weatherSettings = {
            enabled: formData.has('enabled'),
            apiKey: formData.get('apiKey'),
            location: formData.get('location'),
            units: formData.get('units'),
            updateInterval: 600000 // 10 minutes
        };
        
        try {
            // Update config
            AppState.config.weather = weatherSettings;
            
            const response = await fetch('/api/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(AppState.config)
            });
            
            if (response.ok) {
                this.app.admin.closeModal();
                this.app.showMessage('Weather settings saved! Weather will update shortly.');
                
                // Reinitialize weather with new settings
                this.cleanup();
                await this.initialize();
            } else {
                const error = await response.json();
                this.app.showError(error.error || 'Failed to save weather settings');
            }
        } catch (error) {
            this.app.showError('Failed to save weather settings: ' + error.message);
        }
    }

    // Test weather configuration
    async testConfiguration() {
        try {
            const response = await fetch('/api/weather/test');
            const result = await response.json();
            
            console.log('Weather test result:', result);
            
            if (result.apiCallResult === 'SUCCESS') {
                this.app.showMessage('Weather configuration test successful!');
                return result.weatherData;
            } else {
                this.app.showError(`Weather test failed: ${result.apiError || 'Unknown error'}`);
                return null;
            }
        } catch (error) {
            this.app.showError('Weather test failed: ' + error.message);
            return null;
        }
    }

    // Clean up weather timer
    cleanup() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    // Force refresh weather data
    async refresh() {
        if (!AppState.config.weather || !AppState.config.weather.enabled) {
            return;
        }
        
        this.showLoading();
        
        try {
            const weatherData = await this.fetchWeatherData();
            this.updateDisplay(weatherData);
            this.app.showBriefMessage('Weather refreshed');
        } catch (error) {
            console.error('Weather refresh failed:', error);
            this.showError('Refresh failed');
        }
    }

    // Get current weather status
    getStatus() {
        const isEnabled = AppState.config.weather?.enabled || false;
        const hasApiKey = !!(AppState.config.weather?.apiKey && 
                           AppState.config.weather.apiKey !== 'YOUR_OPENWEATHER_API_KEY');
        const hasLocation = !!(AppState.config.weather?.location);
        
        return {
            enabled: isEnabled,
            configured: hasApiKey && hasLocation,
            location: AppState.config.weather?.location || 'Not set',
            units: AppState.config.weather?.units || 'metric',
            updateInterval: AppState.config.weather?.updateInterval || 600000
        };
    }
}