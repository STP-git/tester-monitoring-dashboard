# Testing and Deployment Guide

## Testing Strategy

### 1. Unit Testing

#### Backend Testing
```javascript
// tests/scraper.test.js
const scraper = require('../server/scraper');

describe('Web Scraper', () => {
  test('should extract data from HTML', async () => {
    const siteConfig = {
      name: 'Test Site',
      url: 'https://example.com',
      selector: 'h1'
    };
    
    const result = await scraper.scrapeSite(siteConfig);
    expect(result.name).toBe('Test Site');
    expect(result.status).toBe('success');
    expect(result.data).toBeTruthy();
  });

  test('should handle errors gracefully', async () => {
    const siteConfig = {
      name: 'Invalid Site',
      url: 'https://invalid-url-that-does-not-exist.com',
      selector: 'h1'
    };
    
    const result = await scraper.scrapeSite(siteConfig);
    expect(result.status).toBe('error');
    expect(result.error).toBeTruthy();
  });
});
```

#### Frontend Testing
```javascript
// tests/dashboard.test.js
describe('Dashboard', () => {
  test('should update site card with new data', () => {
    // Create mock DOM elements
    document.body.innerHTML = `
      <div id="dashboard-grid"></div>
      <div id="connection-status"></div>
      <div id="last-update"></div>
    `;
    
    const dashboard = new Dashboard();
    const mockData = [{
      name: 'Test Site',
      url: 'https://example.com',
      data: 'Test Data',
      status: 'success',
      timestamp: new Date().toISOString()
    }];
    
    dashboard.updateDashboard(mockData);
    
    const card = document.getElementById('card-Test-Site');
    expect(card).toBeTruthy();
    expect(card.querySelector('.site-data').textContent).toBe('Test Data');
  });
});
```

### 2. Integration Testing

#### End-to-End Testing with Puppeteer
```javascript
// tests/e2e.test.js
const puppeteer = require('puppeteer');

describe('Monitoring Dashboard E2E', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('should load dashboard and display data', async () => {
    await page.goto('http://localhost:3000');
    
    // Wait for initial data load
    await page.waitForSelector('.site-card');
    
    // Check if site cards are displayed
    const siteCards = await page.$$('.site-card');
    expect(siteCards.length).toBeGreaterThan(0);
    
    // Check connection status
    const connectionStatus = await page.$eval('#connection-status', el => el.textContent);
    expect(connectionStatus).toBe('Connected');
  });

  test('should update data in real-time', async () => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('.site-card');
    
    // Get initial timestamp
    const initialTimestamp = await page.$eval('.site-timestamp', el => el.textContent);
    
    // Wait for update (at least 1 minute based on our interval)
    await page.waitForFunction(
      (initial) => {
        const current = document.querySelector('.site-timestamp').textContent;
        return current !== initial;
      },
      {},
      initialTimestamp
    );
    
    // Verify data was updated
    const newTimestamp = await page.$eval('.site-timestamp', el => el.textContent);
    expect(newTimestamp).not.toBe(initialTimestamp);
  });
});
```

### 3. Performance Testing

#### Load Testing with Artillery
```yaml
# tests/load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100

scenarios:
  - name: "Load Dashboard"
    weight: 70
    flow:
      - get:
          url: "/"
  
  - name: "API Status Check"
    weight: 20
    flow:
      - get:
          url: "/api/status"
  
  - name: "Real-time Updates"
    weight: 10
    flow:
      - get:
          url: "/events"
```

#### Memory Usage Monitoring
```javascript
// tests/memory-monitor.js
const memoryUsage = () => {
  const used = process.memoryUsage();
  return {
    rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(used.external / 1024 / 1024 * 100) / 100
  };
};

// Monitor memory every 30 seconds
setInterval(() => {
  const mem = memoryUsage();
  console.log(`Memory Usage: RSS=${mem.rss}MB, Heap=${mem.heapUsed}MB/${mem.heapTotal}MB`);
  
  // Alert if memory usage is too high
  if (mem.heapUsed > 100) {
    console.warn('High memory usage detected!');
  }
}, 30000);
```

## Deployment Options

### 1. Local Development Setup

#### Prerequisites
- Node.js 14+ installed
- Git for version control

#### Setup Steps
```bash
# Clone the repository
git clone <repository-url>
cd monitoring-dashboard

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:3000
```

### 2. Docker Deployment

#### Dockerfile
```dockerfile
FROM node:16-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

CMD ["node", "server/app.js"]
```

#### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  monitoring-dashboard:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    volumes:
      - ./data:/app/data
      - ./public/config.json:/app/public/config.json
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/status"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### Deployment Commands
```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### 3. Cloud Deployment

#### Vercel (Serverless)
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "server/app.js",
      "use": "@vercel/node"
    },
    {
      "src": "public/**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/app.js"
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ]
}
```

#### Heroku
```javascript
// server/app.js - Add for Heroku
const PORT = process.env.PORT || 3000;

// Add at the end of app.js
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    scheduler.start();
  });
} else {
  // Heroku will bind to the port automatically
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    scheduler.start();
  });
}
```

#### AWS EC2 Deployment Script
```bash
#!/bin/bash
# deploy-ec2.sh

# Update system
sudo yum update -y

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone repository
git clone <repository-url> /home/ec2-user/monitoring-dashboard
cd /home/ec2-user/monitoring-dashboard

# Install dependencies
npm install

# Start application with PM2
pm2 start server/app.js --name "monitoring-dashboard"

# Setup PM2 to start on boot
pm2 startup
pm2 save
```

### 4. Reverse Proxy Configuration

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/monitoring-dashboard
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # For SSE endpoint
    location /events {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }
}
```

### 5. SSL/HTTPS Setup

#### Let's Encrypt with Certbot
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring and Maintenance

### 1. Application Monitoring

#### Health Check Endpoint
```javascript
// Add to server/app.js
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeConnections: scheduler.subscribers.size
  });
});
```

#### Logging Strategy
```javascript
// server/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

### 2. Backup Strategy

#### Configuration Backup
```bash
#!/bin/bash
# backup-config.sh

DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backups/monitoring-dashboard"

mkdir -p $BACKUP_DIR

# Backup configuration
cp public/config.json $BACKUP_DIR/config-$DATE.json

# Backup data if using file persistence
cp -r data/ $BACKUP_DIR/data-$DATE/

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.json" -mtime +30 -delete
find $BACKUP_DIR -name "data-*" -mtime +30 -exec rm -rf {} +
```

### 3. Update Process

#### Zero-Downtime Deployment
```bash
#!/bin/bash
# deploy.sh

# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Reload application with PM2 (zero downtime)
pm2 reload monitoring-dashboard

# Verify deployment
curl -f http://localhost:3000/health || {
  echo "Deployment failed - rolling back"
  pm2 reload monitoring-dashboard --update-env
  exit 1
}

echo "Deployment successful"
```

## Security Considerations

### 1. Input Validation
```javascript
// server/validation.js
const validateSiteConfig = (config) => {
  const errors = [];
  
  if (!config.name || typeof config.name !== 'string') {
    errors.push('Name is required and must be a string');
  }
  
  if (!config.url || !isValidUrl(config.url)) {
    errors.push('Valid URL is required');
  }
  
  if (!config.selector || typeof config.selector !== 'string') {
    errors.push('CSS selector is required and must be a string');
  }
  
  return errors;
};

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

module.exports = { validateSiteConfig };
```

### 2. Rate Limiting
```javascript
// server/app.js - Add rate limiting
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', apiLimiter);
```

This comprehensive testing and deployment guide ensures your monitoring dashboard is reliable, performant, and secure in production environments.