const enhancedScraper = require('./enhanced-tester-scraper');
const pythonScraper = require('./python-scraper-wrapper');
const config = require('./config');

class ScraperDiagnostic {
    constructor() {
        this.results = {
            javascript: null,
            python: null,
            comparison: null
        };
    }

    async runDiagnostic(testerId) {
        const tester = config.getTester(testerId);
        if (!tester) {
            throw new Error(`Tester with ID '${testerId}' not found`);
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`SCRAPER DIAGNOSTIC FOR ${tester.name} (${tester.url})`);
        console.log(`${'='.repeat(60)}`);

        // Enable Python fallback for comparison
        enhancedScraper.setPythonFallback(false);

        try {
            // Run JavaScript scraper
            console.log("\n1. Running JavaScript scraper...");
            const jsStart = Date.now();
            this.results.javascript = await enhancedScraper.scrapeWithJavaScript(tester);
            const jsTime = Date.now() - jsStart;
            console.log(`   JavaScript scraper completed in ${jsTime}ms`);
            console.log(`   Found ${this.results.javascript.slots.length} slots`);
            console.log(`   Status: ${this.results.javascript.status}`);

            // Run Python scraper
            console.log("\n2. Running Python scraper...");
            const pyStart = Date.now();
            this.results.python = await pythonScraper.scrapeTesterData(tester);
            const pyTime = Date.now() - pyStart;
            console.log(`   Python scraper completed in ${pyTime}ms`);
            console.log(`   Found ${this.results.python.slots.length} slots`);
            console.log(`   Status: ${this.results.python.status}`);

            // Compare results
            console.log("\n3. Comparing results...");
            this.results.comparison = this.compareResults();

            // Print detailed comparison
            this.printComparison();

            return this.results;
        } catch (error) {
            console.error(`Diagnostic failed: ${error.message}`);
            throw error;
        }
    }

    compareResults() {
        const js = this.results.javascript;
        const py = this.results.python;

        const comparison = {
            slotCountMatch: js.slots.length === py.slots.length,
            statusCountMatch: this.compareStatusCounters(js.counters, py.counters),
            slotDetailsMatch: this.compareSlotDetails(js.slots, py.slots),
            performance: {
                jsSlotsPerSecond: js.slots.length / (jsTime / 1000),
                pySlotsPerSecond: py.slots.length / (pyTime / 1000)
            }
        };

        return comparison;
    }

    compareStatusCounters(jsCounters, pyCounters) {
        const keys = ['testing', 'failing', 'aborted', 'failed', 'passed'];
        const match = {};
        let allMatch = true;

        keys.forEach(key => {
            const jsVal = jsCounters[key] || 0;
            const pyVal = pyCounters[key] || 0;
            match[key] = jsVal === pyVal;
            if (!match[key]) allMatch = false;
        });

        return { allMatch, details: match };
    }

    compareSlotDetails(jsSlots, pySlots) {
        const comparison = {
            matchingSlots: 0,
            missingInJs: [],
            missingInPy: [],
            statusMismatches: [],
            snMismatches: []
        };

        // Create maps for easier comparison
        const jsSlotsMap = new Map(jsSlots.map(slot => [slot.name, slot]));
        const pySlotsMap = new Map(pySlots.map(slot => [slot.name, slot]));

        // Check for missing slots and status mismatches
        for (const [slotName, jsSlot] of jsSlotsMap) {
            const pySlot = pySlotsMap.get(slotName);
            if (!pySlot) {
                comparison.missingInPy.push(slotName);
            } else {
                comparison.matchingSlots++;
                
                if (jsSlot.status !== pySlot.status) {
                    comparison.statusMismatches.push({
                        slotName,
                        jsStatus: jsSlot.status,
                        pyStatus: pySlot.status
                    });
                }
                
                if (jsSlot.serialNumber !== pySlot.serialNumber) {
                    comparison.snMismatches.push({
                        slotName,
                        jsSN: jsSlot.serialNumber,
                        pySN: pySlot.serialNumber
                    });
                }
            }
        }

        // Check for slots missing in JavaScript
        for (const [slotName] of pySlotsMap) {
            if (!jsSlotsMap.has(slotName)) {
                comparison.missingInJs.push(slotName);
            }
        }

        return comparison;
    }

    printComparison() {
        const { javascript, python, comparison } = this.results;

        console.log("\n" + "=".repeat(60));
        console.log("COMPARISON RESULTS");
        console.log("=".repeat(60));

        // Slot count comparison
        console.log(`\nSlot Count:`);
        console.log(`  JavaScript: ${javascript.slots.length}`);
        console.log(`  Python:     ${python.slots.length}`);
        console.log(`  Match:       ${comparison.slotCountMatch ? '✅' : '❌'}`);

        // Status counter comparison
        console.log(`\nStatus Counters:`);
        const keys = ['testing', 'failing', 'aborted', 'failed', 'passed'];
        keys.forEach(key => {
            const jsVal = javascript.counters[key] || 0;
            const pyVal = python.counters[key] || 0;
            const match = jsVal === pyVal;
            console.log(`  ${key.charAt(0).toUpperCase() + key.slice(1)}: JS=${jsVal}, PY=${pyVal} ${match ? '✅' : '❌'}`);
        });

        // Slot details comparison
        console.log(`\nSlot Details:`);
        console.log(`  Matching slots: ${comparison.slotDetailsMatch.matchingSlots}`);
        
        if (comparison.slotDetailsMatch.missingInJs.length > 0) {
            console.log(`  Missing in JavaScript: ${comparison.slotDetailsMatch.missingInJs.join(', ')}`);
        }
        
        if (comparison.slotDetailsMatch.missingInPy.length > 0) {
            console.log(`  Missing in Python: ${comparison.slotDetailsMatch.missingInPy.join(', ')}`);
        }
        
        if (comparison.slotDetailsMatch.statusMismatches.length > 0) {
            console.log(`  Status mismatches:`);
            comparison.slotDetailsMatch.statusMismatches.forEach(mismatch => {
                console.log(`    ${mismatch.slotName}: JS="${mismatch.jsStatus}" vs PY="${mismatch.pyStatus}"`);
            });
        }
        
        if (comparison.slotDetailsMatch.snMismatches.length > 0) {
            console.log(`  Serial number mismatches:`);
            comparison.slotDetailsMatch.snMismatches.forEach(mismatch => {
                console.log(`    ${mismatch.slotName}: JS="${mismatch.jsSN}" vs PY="${mismatch.pySN}"`);
            });
        }

        // Sample slot comparison
        if (javascript.slots.length > 0 && python.slots.length > 0) {
            console.log(`\nSample Slot Comparison (first slot):`);
            const jsSlot = javascript.slots[0];
            const pySlot = python.slots.find(s => s.name === jsSlot.name) || python.slots[0];
            
            console.log(`  JavaScript slot: ${JSON.stringify(jsSlot, null, 2)}`);
            console.log(`  Python slot:     ${JSON.stringify(pySlot, null, 2)}`);
        }

        console.log("\n" + "=".repeat(60));
    }

    async runDiagnosticForAllTesters() {
        const testers = config.getAllTesters();
        const allResults = {};

        for (const tester of testers) {
            try {
                console.log(`\nRunning diagnostic for ${tester.name}...`);
                allResults[tester.id] = await this.runDiagnostic(tester.id);
            } catch (error) {
                console.error(`Failed to run diagnostic for ${tester.name}: ${error.message}`);
                allResults[tester.id] = { error: error.message };
            }
        }

        return allResults;
    }
}

// Export for use in other modules
module.exports = new ScraperDiagnostic();

// Allow running directly from command line
if (require.main === module) {
    const args = process.argv.slice(2);
    const testerId = args[0];

    if (testerId) {
        // Run diagnostic for specific tester
        ScraperDiagnostic.runDiagnostic(testerId)
            .then(() => console.log('\nDiagnostic completed successfully'))
            .catch(error => console.error(`Diagnostic failed: ${error.message}`));
    } else {
        // Run diagnostic for all testers
        ScraperDiagnostic.runDiagnosticForAllTesters()
            .then(() => console.log('\nAll diagnostics completed successfully'))
            .catch(error => console.error(`Diagnostics failed: ${error.message}`));
    }
}