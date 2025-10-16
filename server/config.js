const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../public/config.json');
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                return JSON.parse(configData);
            } else {
                return this.getDefaultConfig();
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            return this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            testers: [
                {
                    id: 'ess08',
                    name: 'ESS08',
                    url: 'http://192.168.140.103:8080',
                    enabled: true,
                    selectors: {
                        testerName: '.btn.btn-dark.fs-6',
                        statusCounters: '#teststatusdiv',
                        slotsContainer: '#uutList'
                    }
                }
            ],
            refreshInterval: 60000,
            maxRetries: 3,
            timeout: 10000
        };
    }

    getAllTesters() {
        return this.config.testers || [];
    }

    getTester(testerId) {
        return this.config.testers.find(tester => tester.id === testerId);
    }

    addTester(tester) {
        // Validate required fields
        if (!tester.id || !tester.name || !tester.url) {
            throw new Error('Tester must have id, name, and url');
        }

        // Check for duplicate ID
        if (this.getTester(tester.id)) {
            throw new Error(`Tester with ID '${tester.id}' already exists`);
        }

        // Validate URL format
        try {
            new URL(tester.url);
        } catch (error) {
            throw new Error('Invalid URL format');
        }

        // Add default selectors if not provided
        if (!tester.selectors) {
            tester.selectors = {
                testerName: '.btn.btn-dark.fs-6',
                statusCounters: '#teststatusdiv',
                slotsContainer: '#uutList'
            };
        }

        this.config.testers.push(tester);
        this.saveConfig();
        return tester;
    }

    updateTester(testerId, updates) {
        const index = this.config.testers.findIndex(tester => tester.id === testerId);
        
        if (index === -1) {
            throw new Error(`Tester with ID '${testerId}' not found`);
        }

        // Validate URL if being updated
        if (updates.url) {
            try {
                new URL(updates.url);
            } catch (error) {
                throw new Error('Invalid URL format');
            }
        }

        // Merge updates with existing tester
        this.config.testers[index] = { ...this.config.testers[index], ...updates };
        this.saveConfig();
        return this.config.testers[index];
    }

    deleteTester(testerId) {
        const index = this.config.testers.findIndex(tester => tester.id === testerId);
        
        if (index === -1) {
            throw new Error(`Tester with ID '${testerId}' not found`);
        }

        const deletedTester = this.config.testers.splice(index, 1)[0];
        this.saveConfig();
        return deletedTester;
    }

    updateTesters(testers) {
        // Validate all testers
        for (const tester of testers) {
            if (!tester.id || !tester.name || !tester.url) {
                throw new Error('All testers must have id, name, and url');
            }

            // Validate URL format
            try {
                new URL(tester.url);
            } catch (error) {
                throw new Error(`Invalid URL format for tester '${tester.name}'`);
            }
        }

        this.config.testers = testers;
        this.saveConfig();
    }

    getEnabledTesters() {
        return this.config.testers.filter(tester => tester.enabled !== false);
    }

    getRefreshInterval() {
        return this.config.refreshInterval || 60000;
    }

    setRefreshInterval(interval) {
        if (typeof interval !== 'number' || interval < 10000) {
            throw new Error('Refresh interval must be at least 10000ms (10 seconds)');
        }
        this.config.refreshInterval = interval;
        this.saveConfig();
    }

    getMaxRetries() {
        return this.config.maxRetries || 3;
    }

    setMaxRetries(retries) {
        if (typeof retries !== 'number' || retries < 0 || retries > 10) {
            throw new Error('Max retries must be between 0 and 10');
        }
        this.config.maxRetries = retries;
        this.saveConfig();
    }

    getTimeout() {
        return this.config.timeout || 10000;
    }

    setTimeout(timeout) {
        if (typeof timeout !== 'number' || timeout < 1000 || timeout > 60000) {
            throw new Error('Timeout must be between 1000ms and 60000ms');
        }
        this.config.timeout = timeout;
        this.saveConfig();
    }

    saveConfig() {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write configuration file
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving configuration:', error);
            throw new Error('Failed to save configuration');
        }
    }

    initializeDefaultConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                this.config = this.getDefaultConfig();
                this.saveConfig();
                console.log('Initialized default configuration');
            }
        } catch (error) {
            console.error('Error initializing default configuration:', error);
        }
    }

    validateConfig() {
        const errors = [];

        if (!Array.isArray(this.config.testers)) {
            errors.push('testers must be an array');
        } else {
            this.config.testers.forEach((tester, index) => {
                if (!tester.id) {
                    errors.push(`Tester at index ${index} is missing id`);
                }
                if (!tester.name) {
                    errors.push(`Tester at index ${index} is missing name`);
                }
                if (!tester.url) {
                    errors.push(`Tester at index ${index} is missing url`);
                } else {
                    try {
                        new URL(tester.url);
                    } catch (error) {
                        errors.push(`Tester at index ${index} has invalid URL`);
                    }
                }
            });
        }

        if (this.config.refreshInterval && (typeof this.config.refreshInterval !== 'number' || this.config.refreshInterval < 10000)) {
            errors.push('refreshInterval must be at least 10000ms');
        }

        if (this.config.maxRetries && (typeof this.config.maxRetries !== 'number' || this.config.maxRetries < 0 || this.config.maxRetries > 10)) {
            errors.push('maxRetries must be between 0 and 10');
        }

        if (this.config.timeout && (typeof this.config.timeout !== 'number' || this.config.timeout < 1000 || this.config.timeout > 60000)) {
            errors.push('timeout must be between 1000ms and 60000ms');
        }

        return errors;
    }

    exportConfig() {
        return JSON.stringify(this.config, null, 2);
    }

    importConfig(configJson) {
        try {
            const importedConfig = JSON.parse(configJson);
            
            // Validate imported config
            const tempConfig = this.config;
            this.config = importedConfig;
            const errors = this.validateConfig();
            
            if (errors.length > 0) {
                this.config = tempConfig; // Restore original config
                throw new Error(`Invalid configuration: ${errors.join(', ')}`);
            }
            
            this.saveConfig();
            return true;
        } catch (error) {
            throw new Error(`Failed to import configuration: ${error.message}`);
        }
    }
}

module.exports = new ConfigManager();