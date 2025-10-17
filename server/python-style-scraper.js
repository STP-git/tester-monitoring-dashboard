const axios = require('axios');
const cheerio = require('cheerio');

class PythonStyleScraper {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds
    }

    async scrapeTesterData(testerConfig) {
        const cacheKey = `${testerConfig.id}-${testerConfig.url}`;
        const cached = this.cache.get(cacheKey);
        
        // Return cached data if still valid
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        console.log(`\n---> Fetching data from: ${testerConfig.url}`);
        
        try {
            // Step 1: Make the GET request to the target server with proper headers
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            };
            
            const response = await axios.get(testerConfig.url, {
                timeout: 10000,
                headers: headers
            });
            
            console.log(`---  Status Code: ${response.status}`);

            // Proceed only if the request was successful (HTTP 200 OK)
            if (response.status_code !== 200 && response.status !== 200) {
                console.log(`---! Received a non-200 status code. Cannot parse.`);
                return this.createErrorData(testerConfig, 'Non-200 status code');
            }

            // Step 2: Parse the HTML content using Cheerio
            const $ = cheerio.load(response.data);

            // Get the station name (applies to all slots on the page)
            const stationTag = $("button.fs-6");
            const stationName = stationTag.text().trim() || "Unknown Station";

            // Find the main container for all tester slots
            const uutList = $("#uutList");
            if (!uutList.length) {
                console.log("---! Could not find the main 'uutList' container. The page structure may be different.");
                return this.createErrorData(testerConfig, 'Could not find uutList container');
            }

            // Find all individual slot divs
            const slotDivs = uutList.find("div[id^='slot-']");
            console.log(`---  Found ${slotDivs.length} slots to process.`);

            // Step 3: Loop through each slot and extract its data
            const allSlotsData = [];
            slotDivs.each((index, element) => {
                const slotData = this.extractSlotData($(element), stationName, testerConfig.url);
                if (slotData) {
                    allSlotsData.push(slotData);
                }
            });

            // Extract status counters from the page
            const counters = this.extractStatusCounters($);

            const data = {
                id: testerConfig.id,
                name: testerConfig.name,
                url: testerConfig.url,
                timestamp: new Date().toISOString(),
                status: 'success',
                pageData: {
                    title: $('title').text().trim(),
                    stationName: stationName
                },
                counters: counters,
                slots: allSlotsData,
                units: []
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.log(`---! ERROR: Could not connect to the server. It may be offline.`);
            console.log(`   Details: ${error.message}`);
            return this.createErrorData(testerConfig, error.message);
        }
    }

    extractSlotData(slot, stationName, url) {
        const slotId = slot.attr('id') || '';
        
        // Extract slot name from the chassisname link
        let slotName = '';
        const slotNameTag = slot.find("span.chassisname");
        if (slotNameTag.length) {
            const link = slotNameTag.find('a');
            if (link.length) {
                slotName = link.text().trim();
            } else {
                slotName = slotNameTag.text().trim();
            }
        }
        
        // If no slot name found, try to extract from ID
        if (!slotName) {
            const idMatch = slotId.match(/slot-(\d+)/);
            if (idMatch) {
                const slotNum = idMatch[1].padStart(2, '0');
                slotName = `SLOT${slotNum}`;
            }
        }
        
        // Extract slot status from CSS classes and chassisstatus element
        let slotStatus = "available";  // Default status
        
        // Check for status classes in order of priority
        const statusClasses = ['testing', 'failing', 'aborted', 'failed', 'passed', 'default'];
        for (const status of statusClasses) {
            if (slot.hasClass(status)) {
                slotStatus = status;
                break;
            }
        }
        
        // Also try to extract status from the chassisstatus element
        const chassisStatus = slot.find("span.chassisstatus");
        if (chassisStatus.length && chassisStatus.text().trim()) {
            const chassisStatusText = chassisStatus.text().trim().toLowerCase();
            if (chassisStatusText) {
                slotStatus = chassisStatusText;
            }
        }
        
        // Extract test time
        let testTime = "N/A";
        const testTimeTag = slot.find("span.testtime");
        if (testTimeTag.length && testTimeTag.text().trim()) {
            testTime = testTimeTag.text().trim();
        }
        
        // Extract serial number from the first panel-body
        let serialNumber = "N/A";
        
        // Look specifically in the first panel-body for the main serial number
        const firstPanelBody = slot.find('.panel-body').first();
        const snLink = firstPanelBody.find('.slot-sn a').first();
        
        if (snLink.length) {
            const sn = snLink.text().trim();
            console.log(`---  Found potential SN in first panel-body: "${sn}" (length: ${sn.length})`);
            
            // Check if it looks like a serial number
            // Serial numbers can be alphanumeric and typically 10+ characters
            // Examples: C8210F2B03254214T9560, 332404254207412
            if (sn && sn.length >= 10) {
                // Exclude slot names like SLOT01, SLOT01_01 and chamber names
                if (!sn.match(/^SLOT\d+(_\d+)?$/) && 
                    !sn.match(/^CHAMBER\d+$/) &&
                    !sn.match(/^[A-Z]+\d+$/)) { // Also exclude patterns like SFT
                    serialNumber = sn;
                    console.log(`---  Accepted SN: "${serialNumber}" for slot ${slotName}`);
                } else {
                    console.log(`---  Rejected SN (slot name pattern): "${sn}"`);
                }
            } else {
                console.log(`---  Rejected SN (too short): "${sn}"`);
            }
        } else {
            console.log(`---  No SN link found in first panel-body for slot ${slotName}`);
        }
        
        // Extract sub-slots
        const subSlots = [];
        const allPanelBodies = slot.find('.panel-body');
        allPanelBodies.each((i, panel) => {
            const $panel = $(panel);
            const snTags = $panel.find('span.slot-sn');
            snTags.each((j, snTag) => {
                const $snTag = $(snTag);
                const link = $snTag.find('a');
                if (link.length) {
                    const subSlotName = link.text().trim();
                    const subSlotStyle = link.attr('style') || '';
                    
                    // Only include sub-slots that have proper names
                    if (subSlotName && ('_' in subSlotName || subSlotName.startsWith('SLOT'))) {
                        // Determine status from inline style color
                        let subSlotStatus = 'active';
                        if (subSlotStyle.includes('#AAA') || subSlotStyle.includes('#aaa') ||
                            subSlotStyle.includes('rgb(170, 170, 170)')) {
                            subSlotStatus = 'inactive';
                        }
                        
                        // Avoid duplicates and the main serial number
                        if (!subSlots.find(sub => sub.name === subSlotName) && subSlotName !== serialNumber) {
                            subSlots.push({
                                name: subSlotName,
                                status: subSlotStatus
                            });
                        }
                    }
                }
            });
        });
        
        // Extract production info and software version from panel-footer
        let productionInfo = "N/A";
        let softwareVersion = "N/A";
        
        const panelFooter = slot.find("div.panel-footer");
        if (panelFooter.length) {
            const footerTexts = [];
            const fwBoldTags = panelFooter.find("span.slot-sn.fw-bold");
            fwBoldTags.each((i, tag) => {
                const text = $(tag).text().trim();
                if (text) {
                    footerTexts.push(text);
                }
            });
            
            if (footerTexts.length >= 1) {
                productionInfo = footerTexts[0];
            }
            if (footerTexts.length >= 2) {
                softwareVersion = footerTexts[1];
            }
        }
        
        // Determine if slot is active based on status
        const isActive = !['available', 'empty', ''].includes(slotStatus);
        
        // Assemble the data into the desired dictionary format
        return {
            id: slotId,
            name: slotName,
            status: slotStatus,
            testTime: testTime,
            serialNumber: serialNumber,
            subSlots: subSlots,
            productionInfo: productionInfo,
            softwareVersion: softwareVersion,
            led: false,  // No LED indicator found in the new HTML, defaulting to False
            result: isActive ? slotStatus : "empty",
            slot_name: slotName,
            sn: serialNumber,
            station: stationName,
            test_time: testTime,
            url: url
        };
    }

    extractStatusCounters($) {
        const counters = {
            testing: 0,
            failing: 0,
            aborted: 0,
            failed: 0,
            passed: 0
        };
        
        try {
            // Extract status counters from the page
            $('#testing-counter').each((i, el) => {
                const value = parseInt($(el).text().trim()) || 0;
                counters.testing = value;
            });
            
            $('#failing-counter').each((i, el) => {
                const value = parseInt($(el).text().trim()) || 0;
                counters.failing = value;
            });
            
            $('#aborted-counter').each((i, el) => {
                const value = parseInt($(el).text().trim()) || 0;
                counters.aborted = value;
            });
            
            $('#failed-counter').each((i, el) => {
                const value = parseInt($(el).text().trim()) || 0;
                counters.failed = value;
            });
            
            $('#passed-counter').each((i, el) => {
                const value = parseInt($(el).text().trim()) || 0;
                counters.passed = value;
            });
        } catch (error) {
            console.error('Error extracting status counters:', error);
        }
        
        return counters;
    }

    createErrorData(testerConfig, errorMessage) {
        return {
            id: testerConfig.id,
            name: testerConfig.name,
            url: testerConfig.url,
            timestamp: new Date().toISOString(),
            status: 'error',
            error: errorMessage,
            counters: {
                testing: 0,
                failing: 0,
                aborted: 0,
                failed: 0,
                passed: 0
            },
            slots: [{
                led: false,
                result: "empty",
                slot_name: "Offline",
                sn: "",
                station: "Offline",
                test_time: "N/A",
                url: testerConfig.url,
                id: "error",
                name: "Offline",
                status: "error",
                testTime: "N/A",
                serialNumber: "",
                subSlots: [],
                productionInfo: "N/A",
                softwareVersion: "N/A"
            }],
            units: [],
            pageData: {}
        };
    }

    // Clear cache for a specific tester
    clearCache(testerId) {
        for (const [key, value] of this.cache.entries()) {
            if (key.startsWith(`${testerId}-`)) {
                this.cache.delete(key);
            }
        }
    }

    // Clear all cache
    clearAllCache() {
        this.cache.clear();
    }

    // Get cache statistics
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.entries()).map(([key, value]) => ({
                key,
                timestamp: value.timestamp,
                age: Date.now() - value.timestamp
            }))
        };
    }
}

module.exports = new PythonStyleScraper();