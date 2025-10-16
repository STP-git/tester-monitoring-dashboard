const enhancedScraper = require('./enhanced-tester-scraper');
const config = require('./config');

class Scheduler {
    constructor() {
        this.interval = null;
        this.activeTesters = new Set();
        this.isRunning = false;
        this.refreshInterval = config.getRefreshInterval();
        this.previousData = new Map();
    }

    start() {
        if (this.isRunning) {
            console.log('Scheduler is already running');
            return;
        }

        this.isRunning = true;
        this.refreshInterval = config.getRefreshInterval();
        
        console.log(`Starting scheduler with ${this.refreshInterval}ms interval`);
        
        // Initial check
        this.checkAllTesters();
        
        // Set up recurring checks
        this.interval = setInterval(() => {
            this.checkAllTesters();
        }, this.refreshInterval);
    }

    stop() {
        if (!this.isRunning) {
            console.log('Scheduler is not running');
            return;
        }

        this.isRunning = false;
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        console.log('Scheduler stopped');
    }

    restart() {
        this.stop();
        this.start();
    }

    setActiveTesters(testerIds) {
        this.activeTesters = new Set(testerIds);
        console.log(`Active testers: ${Array.from(this.activeTesters).join(', ')}`);
    }

    addActiveTester(testerId) {
        this.activeTesters.add(testerId);
        console.log(`Added active tester: ${testerId}`);
    }

    removeActiveTester(testerId) {
        this.activeTesters.delete(testerId);
        console.log(`Removed active tester: ${testerId}`);
    }

    getActiveTesters() {
        return Array.from(this.activeTesters);
    }

    async checkAllTesters() {
        if (!this.isRunning || this.activeTesters.size === 0) {
            return;
        }

        console.log(`Checking ${this.activeTesters.size} active testers...`);
        
        const results = [];
        
        // Process testers sequentially to avoid overwhelming the network
        for (const testerId of this.activeTesters) {
            const tester = config.getTester(testerId);
            if (tester) {
                try {
                    const data = await enhancedScraper.scrapeTesterData(tester);
                    results.push(data);
                    
                    // Check for changes and broadcast updates
                    this.checkForChanges(data);
                    
                } catch (error) {
                    console.error(`Error checking tester ${tester.name}:`, error);
                    const errorData = {
                        id: tester.id,
                        name: tester.name,
                        url: tester.url,
                        timestamp: new Date().toISOString(),
                        status: 'error',
                        error: error.message,
                        counters: {},
                        slots: []
                    };
                    results.push(errorData);
                    this.broadcastUpdate(errorData);
                }
            }
        }
        
        // Broadcast batch update
        if (results.length > 0 && global.broadcast) {
            global.broadcast({
                type: 'batch-update',
                data: results,
                timestamp: new Date().toISOString()
            });
        }
    }

    checkForChanges(currentData) {
        const previousData = this.previousData.get(currentData.id);
        
        if (!previousData) {
            // First time seeing this tester
            this.previousData.set(currentData.id, currentData);
            this.broadcastUpdate(currentData);
            return;
        }

        // Check for significant changes
        const changes = this.detectChanges(previousData, currentData);
        
        if (changes.hasChanges) {
            this.previousData.set(currentData.id, currentData);
            this.broadcastUpdate(currentData, changes);
        }
    }

    detectChanges(previous, current) {
        const changes = {
            hasChanges: false,
            statusChanged: false,
            countersChanged: false,
            slotsChanged: false,
            newFailingSlots: [],
            newPassedSlots: [],
            newTestingSlots: []
        };

        // Check status change
        if (previous.status !== current.status) {
            changes.hasChanges = true;
            changes.statusChanged = true;
        }

        // Check counters change
        const countersChanged = Object.keys(current.counters).some(key => 
            previous.counters[key] !== current.counters[key]
        );
        
        if (countersChanged) {
            changes.hasChanges = true;
            changes.countersChanged = true;
        }

        // Check slots change
        if (previous.slots.length !== current.slots.length) {
            changes.hasChanges = true;
            changes.slotsChanged = true;
        } else {
            // Check individual slot changes
            const previousSlotsMap = new Map(previous.slots.map(slot => [slot.name, slot]));
            const currentSlotsMap = new Map(current.slots.map(slot => [slot.name, slot]));

            for (const [slotName, currentSlot] of currentSlotsMap) {
                const previousSlot = previousSlotsMap.get(slotName);
                
                if (!previousSlot) {
                    // New slot
                    changes.hasChanges = true;
                    changes.slotsChanged = true;
                } else if (previousSlot.status !== currentSlot.status) {
                    // Slot status changed
                    changes.hasChanges = true;
                    changes.slotsChanged = true;
                    
                    // Track specific status changes
                    if (currentSlot.status === 'failing' && previousSlot.status !== 'failing') {
                        changes.newFailingSlots.push(slotName);
                    } else if (currentSlot.status === 'passed' && previousSlot.status !== 'passed') {
                        changes.newPassedSlots.push(slotName);
                    } else if (currentSlot.status === 'testing' && previousSlot.status !== 'testing') {
                        changes.newTestingSlots.push(slotName);
                    }
                } else if (previousSlot.testTime !== currentSlot.testTime) {
                    // Test time changed (slot is still running)
                    changes.hasChanges = true;
                    changes.slotsChanged = true;
                }
            }
        }

        return changes;
    }

    broadcastUpdate(data, changes = null) {
        if (!global.broadcast) {
            return;
        }

        const message = {
            type: 'tester-update',
            data: data,
            timestamp: new Date().toISOString()
        };

        if (changes) {
            message.changes = changes;
        }

        global.broadcast(message);
    }

    checkSingleTester(testerId) {
        const tester = config.getTester(testerId);
        if (!tester) {
            throw new Error(`Tester with ID '${testerId}' not found`);
        }

        return this.checkTester(tester);
    }

    async checkTester(tester) {
        try {
            const data = await enhancedScraper.scrapeTesterData(tester);
            this.checkForChanges(data);
            return data;
        } catch (error) {
            console.error(`Error checking tester ${tester.name}:`, error);
            const errorData = {
                id: tester.id,
                name: tester.name,
                url: tester.url,
                timestamp: new Date().toISOString(),
                status: 'error',
                error: error.message,
                counters: {},
                slots: []
            };
            this.broadcastUpdate(errorData);
            return errorData;
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            activeTesters: this.activeTesters.size,
            refreshInterval: this.refreshInterval,
            nextCheck: this.isRunning ? new Date(Date.now() + this.refreshInterval).toISOString() : null,
            previousDataCount: this.previousData.size
        };
    }

    clearHistory() {
        this.previousData.clear();
        console.log('Cleared scheduler history');
    }

    clearHistoryForTester(testerId) {
        this.previousData.delete(testerId);
        console.log(`Cleared history for tester: ${testerId}`);
    }

    getPreviousData(testerId) {
        return this.previousData.get(testerId);
    }

    getAllPreviousData() {
        return Array.from(this.previousData.entries()).map(([testerId, data]) => ({
            testerId,
            data
        }));
    }
}

module.exports = new Scheduler();