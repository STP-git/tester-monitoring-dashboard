const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import modules
const enhancedScraper = require('./enhanced-tester-scraper');
const config = require('./config');
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Store SSE connections
const sseConnections = new Set();

// SSE endpoint for real-time updates
app.get('/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    // Add client to subscribers
    sseConnections.add(res);

    // Send initial connection message
    res.write('data: {"type": "connected", "message": "Connected to monitoring dashboard"}\n\n');

    // Remove client on disconnect
    req.on('close', () => {
        sseConnections.delete(res);
    });

    // Handle connection errors
    req.on('error', () => {
        sseConnections.delete(res);
    });
});

// API endpoint for specific tester data
app.get('/api/tester/:testerId', async (req, res) => {
    try {
        const testerId = req.params.testerId;
        const tester = config.getTester(testerId);
        
        if (!tester) {
            return res.status(404).json({ error: 'Tester not found' });
        }
        
        const data = await enhancedScraper.scrapeTesterData(tester);
        res.json(data);
    } catch (error) {
        console.error(`Error fetching data for tester ${req.params.testerId}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint for all selected testers
app.post('/api/testers/batch', async (req, res) => {
    try {
        const { testerIds } = req.body;
        
        if (!testerIds || !Array.isArray(testerIds)) {
            return res.status(400).json({ error: 'Invalid tester IDs' });
        }
        
        const results = [];
        
        // Process testers sequentially to avoid overwhelming the network
        for (const testerId of testerIds) {
            const tester = config.getTester(testerId);
            if (tester) {
                try {
                    const data = await enhancedScraper.scrapeTesterData(tester);
                    results.push(data);
                } catch (error) {
                    console.error(`Error fetching data for ${tester.name}:`, error);
                    results.push({
                        id: tester.id,
                        name: tester.name,
                        url: tester.url,
                        timestamp: new Date().toISOString(),
                        status: 'error',
                        error: error.message,
                        counters: {},
                        slots: []
                    });
                }
            }
        }
        
        res.json(results);
    } catch (error) {
        console.error('Error in batch request:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint for configuration
app.get('/api/config', (req, res) => {
    try {
        const configData = config.getAllTesters();
        res.json(configData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to update configuration
app.post('/api/config', (req, res) => {
    try {
        const { testers } = req.body;
        
        if (!testers || !Array.isArray(testers)) {
            return res.status(400).json({ error: 'Invalid configuration' });
        }
        
        config.updateTesters(testers);
        res.json({ success: true, message: 'Configuration updated' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// API endpoint to add a new tester
app.post('/api/tester', (req, res) => {
    try {
        const tester = req.body;
        const newTester = config.addTester(tester);
        res.json({ success: true, tester: newTester });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// API endpoint to update a tester
app.put('/api/tester/:testerId', (req, res) => {
    try {
        const testerId = req.params.testerId;
        const updates = req.body;
        const updatedTester = config.updateTester(testerId, updates);
        res.json({ success: true, tester: updatedTester });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// API endpoint to delete a tester
app.delete('/api/tester/:testerId', (req, res) => {
    try {
        const testerId = req.params.testerId;
        const deletedTester = config.deleteTester(testerId);
        res.json({ success: true, tester: deletedTester });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// API endpoint to export configuration
app.get('/api/config/export', (req, res) => {
    try {
        const configData = config.exportConfig();
        res.json(JSON.parse(configData));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to import configuration
app.post('/api/config/import', (req, res) => {
    try {
        const configData = req.body;
        config.importConfig(JSON.stringify(configData));
        res.json({ success: true, message: 'Configuration imported' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// API endpoint to start scheduler
app.post('/api/scheduler/start', async (req, res) => {
    try {
        const { testerIds } = req.body;
        
        if (!testerIds || !Array.isArray(testerIds)) {
            return res.status(400).json({ error: 'Invalid tester IDs' });
        }
        
        scheduler.setActiveTesters(testerIds);
        scheduler.start();
        
        res.json({ success: true, message: 'Scheduler started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to stop scheduler
app.post('/api/scheduler/stop', (req, res) => {
    try {
        scheduler.stop();
        res.json({ success: true, message: 'Scheduler stopped' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get scheduler status
app.get('/api/scheduler/status', (req, res) => {
    try {
        const status = scheduler.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeConnections: sseConnections.size,
        version: require('../package.json').version
    });
});

// Broadcast function for SSE
function broadcast(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    
    sseConnections.forEach(client => {
        try {
            client.write(message);
        } catch (error) {
            // Remove dead connections
            sseConnections.delete(client);
        }
    });
}

// Make broadcast available to other modules
global.broadcast = broadcast;

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Tester Monitoring Dashboard running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
    
    // Ensure public directory exists
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Initialize default configuration if it doesn't exist
    config.initializeDefaultConfig();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    
    // Close all SSE connections
    sseConnections.forEach(client => {
        try {
            client.end();
        } catch (error) {
            // Ignore errors during shutdown
        }
    });
    
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    
    // Close all SSE connections
    sseConnections.forEach(client => {
        try {
            client.end();
        } catch (error) {
            // Ignore errors during shutdown
        }
    });
    
    process.exit(0);
});

module.exports = app;