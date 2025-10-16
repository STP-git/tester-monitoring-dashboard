# Implementation Plan for Lightweight Monitoring Dashboard

## Phase 1: Project Setup and Dependencies

### Minimal Package.json
```json
{
  "name": "lightweight-monitoring-dashboard",
  "version": "1.0.0",
  "description": "Lightweight dashboard for monitoring website data",
  "main": "server/app.js",
  "scripts": {
    "start": "node server/app.js",
    "dev": "nodemon server/app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.5.0",
    "cheerio": "^1.0.0-rc.12",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

## Phase 2: Backend Implementation

### 1. Main Server (server/app.js)
```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const scraper = require('./scraper');
const scheduler = require('./scheduler');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// SSE endpoint for real-time updates
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Add client to subscribers
  scheduler.addSubscriber(res);

  // Remove client on disconnect
  req.on('close', () => {
    scheduler.removeSubscriber(res);
  });
});

// API endpoints
app.get('/api/status', async (req, res) => {
  try {
    const data = await scraper.getAllData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/config', (req, res) => {
  res.json(config.getSites());
});

app.post('/api/config', (req, res) => {
  try {
    config.updateSites(req.body);
    scheduler.restart();
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduler.start();
});
```

### 2. Web Scraper (server/scraper.js)
```javascript
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('./config');

class WebScraper {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  async scrapeSite(siteConfig) {
    const cacheKey = `${siteConfig.url}-${siteConfig.selector}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await axios.get(siteConfig.url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const extractedData = $(siteConfig.selector).text().trim();
      
      const result = {
        name: siteConfig.name,
        url: siteConfig.url,
        data: extractedData,
        timestamp: new Date().toISOString(),
        status: 'success'
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      return {
        name: siteConfig.name,
        url: siteConfig.url,
        data: null,
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message
      };
    }
  }

  async getAllData() {
    const sites = config.getSites();
    const promises = sites.map(site => this.scrapeSite(site));
    return Promise.all(promises);
  }
}

module.exports = new WebScraper();
```

### 3. Scheduler (server/scheduler.js)
```javascript
const scraper = require('./scraper');
const alerts = require('./alerts');

class Scheduler {
  constructor() {
    this.interval = null;
    this.subscribers = new Set();
    this.previousData = new Map();
  }

  start() {
    const sites = require('./config').getSites();
    const interval = sites.refreshInterval || 60000; // Default 1 minute
    
    this.interval = setInterval(async () => {
      await this.checkAllSites();
    }, interval);
    
    // Initial check
    this.checkAllSites();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  restart() {
    this.stop();
    this.start();
  }

  async checkAllSites() {
    try {
      const data = await scraper.getAllData();
      
      // Check for alerts
      data.forEach(siteData => {
        const previous = this.previousData.get(siteData.url);
        if (previous && previous.data !== siteData.data) {
          alerts.checkAlerts(siteData, previous);
        }
        this.previousData.set(siteData.url, siteData);
      });

      // Send updates to all subscribers
      this.broadcastUpdate(data);
    } catch (error) {
      console.error('Error checking sites:', error);
    }
  }

  broadcastUpdate(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    
    this.subscribers.forEach(subscriber => {
      try {
        subscriber.write(message);
      } catch (error) {
        // Remove dead connections
        this.subscribers.delete(subscriber);
      }
    });
  }

  addSubscriber(res) {
    this.subscribers.add(res);
  }

  removeSubscriber(res) {
    this.subscribers.delete(res);
  }
}

module.exports = new Scheduler();
```

## Phase 3: Frontend Implementation

### 1. HTML Structure (public/index.html)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monitoring Dashboard</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>Monitoring Dashboard</h1>
            <div class="status-indicator">
                <span id="connection-status">Connected</span>
                <span id="last-update">Never</span>
            </div>
        </header>

        <main>
            <div class="dashboard-grid" id="dashboard-grid">
                <!-- Site cards will be dynamically added here -->
            </div>

            <div class="alerts-section">
                <h2>Recent Alerts</h2>
                <div id="alerts-container">
                    <!-- Alerts will be displayed here -->
                </div>
            </div>

            <div class="config-section">
                <h2>Configuration</h2>
                <button id="config-toggle">Manage Sites</button>
                <div id="config-panel" class="hidden">
                    <!-- Configuration form will be here -->
                </div>
            </div>
        </main>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="js/dashboard.js"></script>
</body>
</html>
```

### 2. CSS Styling (public/css/style.css)
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #f5f5f5;
    color: #333;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 1px solid #ddd;
}

.status-indicator {
    display: flex;
    gap: 15px;
    font-size: 14px;
}

#connection-status {
    padding: 4px 8px;
    border-radius: 4px;
    background-color: #4CAF50;
    color: white;
}

#connection-status.disconnected {
    background-color: #f44336;
}

.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.site-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s;
}

.site-card:hover {
    transform: translateY(-2px);
}

.site-card.error {
    border-left: 4px solid #f44336;
}

.site-card.success {
    border-left: 4px solid #4CAF50;
}

.site-name {
    font-weight: bold;
    margin-bottom: 10px;
}

.site-url {
    font-size: 12px;
    color: #666;
    margin-bottom: 15px;
}

.site-data {
    font-size: 18px;
    margin-bottom: 10px;
}

.site-timestamp {
    font-size: 12px;
    color: #999;
}

.alerts-section {
    background: white;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 30px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.alert-item {
    padding: 10px;
    margin-bottom: 10px;
    border-radius: 4px;
    background-color: #fff3cd;
    border-left: 4px solid #ffc107;
}

.config-section {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.hidden {
    display: none;
}

#config-toggle {
    background-color: #2196F3;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
}

#config-toggle:hover {
    background-color: #1976D2;
}

.chart-container {
    margin-top: 15px;
    height: 150px;
}
```

### 3. Dashboard JavaScript (public/js/dashboard.js)
```javascript
class Dashboard {
  constructor() {
    this.eventSource = null;
    this.sites = new Map();
    this.charts = new Map();
    this.init();
  }

  init() {
    this.connectEventSource();
    this.loadInitialData();
    this.setupEventListeners();
  }

  connectEventSource() {
    this.eventSource = new EventSource('/events');
    
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.updateDashboard(data);
    };

    this.eventSource.onerror = () => {
      document.getElementById('connection-status').textContent = 'Disconnected';
      document.getElementById('connection-status').classList.add('disconnected');
    };

    this.eventSource.onopen = () => {
      document.getElementById('connection-status').textContent = 'Connected';
      document.getElementById('connection-status').classList.remove('disconnected');
    };
  }

  async loadInitialData() {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      this.updateDashboard(data);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  updateDashboard(siteData) {
    const grid = document.getElementById('dashboard-grid');
    
    siteData.forEach(site => {
      let card = document.getElementById(`card-${site.name.replace(/\s+/g, '-')}`);
      
      if (!card) {
        card = this.createSiteCard(site);
        grid.appendChild(card);
      }
      
      this.updateSiteCard(card, site);
      this.updateChart(site);
    });

    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
  }

  createSiteCard(site) {
    const card = document.createElement('div');
    card.id = `card-${site.name.replace(/\s+/g, '-')}`;
    card.className = `site-card ${site.status}`;
    
    card.innerHTML = `
      <div class="site-name">${site.name}</div>
      <div class="site-url">${site.url}</div>
      <div class="site-data">${site.data || 'No data'}</div>
      <div class="site-timestamp">${new Date(site.timestamp).toLocaleString()}</div>
      <div class="chart-container">
        <canvas id="chart-${site.name.replace(/\s+/g, '-')}"></canvas>
      </div>
    `;
    
    return card;
  }

  updateSiteCard(card, site) {
    card.className = `site-card ${site.status}`;
    card.querySelector('.site-data').textContent = site.data || 'No data';
    card.querySelector('.site-timestamp').textContent = new Date(site.timestamp).toLocaleString();
  }

  updateChart(site) {
    const chartId = `chart-${site.name.replace(/\s+/g, '-')}`;
    let chart = this.charts.get(chartId);
    
    if (!chart) {
      const ctx = document.getElementById(chartId);
      if (ctx) {
        chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: [],
            datasets: [{
              label: 'Data Value',
              data: [],
              borderColor: '#2196F3',
              borderWidth: 2,
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
        this.charts.set(chartId, chart);
      }
    }
    
    if (chart) {
      const now = new Date().toLocaleTimeString();
      chart.data.labels.push(now);
      chart.data.datasets[0].data.push(site.data);
      
      // Keep only last 10 data points
      if (chart.data.labels.length > 10) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      
      chart.update('none'); // Update without animation for performance
    }
  }

  setupEventListeners() {
    document.getElementById('config-toggle').addEventListener('click', () => {
      const panel = document.getElementById('config-panel');
      panel.classList.toggle('hidden');
    });
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new Dashboard();
});
```

## Phase 4: Configuration and Alert Systems

### 1. Configuration Manager (server/config.js)
```javascript
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../public/config.json');

class ConfigManager {
  constructor() {
    this.sites = this.loadConfig();
  }

  loadConfig() {
    try {
      const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      return this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      sites: [
        {
          name: "Example Site",
          url: "https://example.com",
          selector: "h1",
          alertThresholds: {
            enabled: true,
            conditions: ["contains:error", "equals:down"]
          }
        }
      ],
      refreshInterval: 60000,
      maxRetries: 3,
      timeout: 10000
    };
  }

  getSites() {
    return this.sites.sites || [];
  }

  updateSites(newSites) {
    this.sites.sites = newSites;
    this.saveConfig();
  }

  saveConfig() {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.sites, null, 2));
  }
}

module.exports = new ConfigManager();
```

### 2. Alert System (server/alerts.js)
```javascript
class AlertManager {
  constructor() {
    this.alertHistory = [];
    this.maxHistory = 50;
  }

  checkAlerts(currentData, previousData) {
    const config = require('./config').getSites();
    const siteConfig = config.find(site => site.url === currentData.url);
    
    if (!siteConfig || !siteConfig.alertThresholds || !siteConfig.alertThresholds.enabled) {
      return;
    }

    const conditions = siteConfig.alertThresholds.conditions;
    const currentValue = currentData.data;
    const previousValue = previousData.data;

    conditions.forEach(condition => {
      if (this.evaluateCondition(condition, currentValue, previousValue)) {
        this.triggerAlert({
          site: currentData.name,
          url: currentData.url,
          condition: condition,
          currentValue: currentValue,
          previousValue: previousValue,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  evaluateCondition(condition, current, previous) {
    if (condition.startsWith('contains:')) {
      const value = condition.substring(9);
      return current && current.includes(value);
    }
    
    if (condition.startsWith('equals:')) {
      const value = condition.substring(7);
      return current === value;
    }
    
    if (condition.startsWith('changed')) {
      return current !== previous;
    }
    
    return false;
  }

  triggerAlert(alert) {
    this.alertHistory.unshift(alert);
    
    if (this.alertHistory.length > this.maxHistory) {
      this.alertHistory.pop();
    }
    
    console.log(`ALERT: ${alert.site} - ${alert.condition} - Current: ${alert.currentValue}`);
    
    // Broadcast alert to all subscribers
    const scheduler = require('./scheduler');
    scheduler.broadcastAlert(alert);
  }

  getRecentAlerts(limit = 10) {
    return this.alertHistory.slice(0, limit);
  }
}

module.exports = new AlertManager();
```

## Phase 5: Performance Optimizations

### 1. Caching Strategy
- Implement request caching with TTL
- Use conditional requests with ETags
- Cache parsed data to avoid re-parsing

### 2. Resource Management
- Limit concurrent requests
- Implement connection pooling
- Set appropriate timeouts
- Monitor memory usage

### 3. Frontend Optimization
- Debounce visual updates
- Use virtual scrolling for large datasets
- Implement lazy loading for charts
- Minimize DOM manipulations

## Deployment Instructions

### Local Development
1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Open browser to: `http://localhost:3000`

### Production Deployment
1. Set NODE_ENV=production
2. Use PM2 for process management: `pm2 start server/app.js`
3. Configure reverse proxy (nginx) if needed
4. Set up SSL for HTTPS

This implementation provides a lightweight, efficient monitoring dashboard that meets all your requirements while maintaining minimal resource usage.