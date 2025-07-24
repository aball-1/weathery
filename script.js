class WeatherApp {
    constructor() {
        this.currentLocation = null;
        this.currentCoordinates = null;
        this.initializeApp();
        this.bindEvents();
        this.initializeTheme();
    }

    initializeApp() {
        this.displayCurrentDate();
        this.loadDefaultWeather();
    }

    bindEvents() {
        const zipInput = document.getElementById('zipCodeInput');
        const searchBtn = document.getElementById('searchBtn');

        // Search button click
        searchBtn.addEventListener('click', () => {
            this.handleSearch();
        });

        // Enter key press on input
        zipInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        // Input validation - only allow numbers
        zipInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
    }

    displayCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
    }

    async loadDefaultWeather() {
        // Default to Seguin, Texas coordinates as in the original Python code
        const defaultLat = 29.500749;
        const defaultLon = -98.128094;
        
        this.showLoading(true);
        this.hideError();
        
        try {
            // Get location name for default coordinates
            const locationName = await this.reverseGeocode(defaultLat, defaultLon);
            this.displayLocation(locationName || 'Seguin, Texas');
            
            const weatherData = await this.getWeather(defaultLat, defaultLon);
            this.displayWeatherData(weatherData);
        } catch (error) {
            this.showError('Failed to load default weather data. Please try entering a ZIP code.');
        } finally {
            this.showLoading(false);
        }
    }

    async handleSearch() {
        const zipCode = document.getElementById('zipCodeInput').value.trim();
        
        if (!zipCode) {
            this.showError('Please enter a ZIP code');
            return;
        }

        if (!/^\d{5}$/.test(zipCode)) {
            this.showError('Please enter a valid 5-digit ZIP code');
            return;
        }

        this.showLoading(true);
        this.hideError();

        try {
            const coordinates = await this.getCoordinatesFromZip(zipCode);
            const weatherData = await this.getWeather(coordinates.lat, coordinates.lon);
            this.displayLocation(coordinates.location);
            this.displayWeatherData(weatherData);
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async getCoordinatesFromZip(zipCode) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${zipCode}+USA&limit=1`,
                {
                    headers: {
                        'User-Agent': 'WeatherApp/1.0'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Geocoding service unavailable');
            }

            const data = await response.json();

            if (!data || data.length === 0) {
                throw new Error('ZIP code not found. Please check and try again.');
            }

            const location = data[0];
            return {
                lat: parseFloat(location.lat),
                lon: parseFloat(location.lon),
                location: location.display_name
            };
        } catch (error) {
            if (error.message.includes('ZIP code not found')) {
                throw error;
            }
            throw new Error('Unable to find location for this ZIP code. Please try again.');
        }
    }

    async reverseGeocode(lat, lon) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
                {
                    headers: {
                        'User-Agent': 'WeatherApp/1.0'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                return data.display_name;
            }
        } catch (error) {
            console.warn('Reverse geocoding failed:', error);
        }
        return null;
    }

    async getWeather(lat, lon) {
        try {
            // Get the forecast URLs from the NWS points API
            const pointsResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
            
            if (!pointsResponse.ok) {
                if (pointsResponse.status === 404) {
                    throw new Error('Weather data not available for this location. The National Weather Service only covers the United States.');
                }
                throw new Error(`Weather service error: ${pointsResponse.status}`);
            }

            const pointsData = await pointsResponse.json();
            const forecastUrl = pointsData.properties.forecast;

            // Get the forecast data
            const forecastResponse = await fetch(forecastUrl);
            
            if (!forecastResponse.ok) {
                throw new Error('Failed to retrieve weather forecast');
            }

            const forecastData = await forecastResponse.json();
            return this.processForecastData(forecastData.properties.periods);
        } catch (error) {
            if (error.message.includes('Weather data not available') || 
                error.message.includes('National Weather Service')) {
                throw error;
            }
            throw new Error('Unable to retrieve weather data. Please try again later.');
        }
    }

    processForecastData(periods) {
        const processedData = {};
        
        // Process the periods into daily forecasts
        periods.forEach(period => {
            const startTime = new Date(period.startTime);
            const dayKey = this.formatDateKey(startTime);
            
            if (!processedData[dayKey]) {
                processedData[dayKey] = {
                    date: startTime,
                    high: '',
                    low: '',
                    precipitation: '',
                    wind: '',
                    description: ''
                };
            }

            const temp = `${period.temperature}°`;
            const wind = period.windSpeed || '';
            const precip = period.probabilityOfPrecipitation?.value;
            const precipValue = (precip && precip > 0) ? `${precip}%` : '';

            // Determine if this is a day or night period
            const isNight = period.name.toLowerCase().includes('night');
            
            if (isNight) {
                processedData[dayKey].low = temp;
            } else {
                processedData[dayKey].high = temp;
            }

            // Update other fields (use the most recent data)
            if (precipValue) {
                processedData[dayKey].precipitation = precipValue;
            }
            if (wind) {
                processedData[dayKey].wind = wind;
            }
            if (period.shortForecast) {
                processedData[dayKey].description = period.shortForecast;
            }
        });

        // Convert to array and limit to 10 days
        return Object.values(processedData).slice(0, 10);
    }

    formatDateKey(date) {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    formatDisplayDate(date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        } else {
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }
    }

    displayLocation(locationName) {
        // Clean up the location name for better display
        const cleanedName = this.cleanLocationName(locationName);
        document.getElementById('locationName').textContent = `Showing weather for ${cleanedName}`;
        document.getElementById('locationSection').style.display = 'block';
    }

    cleanLocationName(locationName) {
        if (!locationName) return 'Unknown Location';
        
        // Extract city and state from the full location name
        const parts = locationName.split(',');
        if (parts.length >= 3) {
            // Usually format: "City, County, State, Country"
            const city = parts[0].trim();
            const state = parts[2].trim();
            return `${city}, ${state}`;
        }
        
        return locationName;
    }

    displayWeatherData(weatherData) {
        const tableBody = document.getElementById('forecastTableBody');
        tableBody.innerHTML = '';

        if (!weatherData || weatherData.length === 0) {
            this.showError('No weather data available for this location');
            return;
        }

        weatherData.forEach(day => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td><strong>${this.formatDisplayDate(day.date)}</strong></td>
                <td class="temp-high">${day.high || '--'}</td>
                <td class="temp-low">${day.low || '--'}</td>
                <td class="precipitation">${day.precipitation || '--'}</td>
                <td class="wind-speed">${day.wind || '--'}</td>
                <td>${day.description || '--'}</td>
            `;
            
            tableBody.appendChild(row);
        });

        document.getElementById('forecastSection').style.display = 'block';
    }

    showLoading(show) {
        const loading = document.getElementById('loadingIndicator');
        loading.style.display = show ? 'block' : 'none';
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Hide forecast section on error
        document.getElementById('forecastSection').style.display = 'none';
    }

    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }

    initializeTheme() {
        // Load saved theme preference or default to light mode
        const savedTheme = localStorage.getItem('weatherAppTheme') || 'light';
        this.setTheme(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        const body = document.body;
        const themeToggle = document.getElementById('themeToggle');
        const icon = themeToggle.querySelector('i');

        if (theme === 'dark') {
            body.classList.add('dark-mode');
            icon.className = 'fas fa-sun';
            themeToggle.title = 'Switch to light mode';
        } else {
            body.classList.remove('dark-mode');
            icon.className = 'fas fa-moon';
            themeToggle.title = 'Switch to dark mode';
        }

        // Save theme preference
        localStorage.setItem('weatherAppTheme', theme);
    }
}

// Initialize the weather app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});
