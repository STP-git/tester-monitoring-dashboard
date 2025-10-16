const axios = require('axios');
const cheerio = require('cheerio');

class EnhancedTesterScraper {
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

        try {
            const response = await axios.get(testerConfig.url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            const data = {
                id: testerConfig.id,
                name: testerConfig.name,
                url: testerConfig.url,
                timestamp: new Date().toISOString(),
                status: 'success',
                counters: this.extractStatusCounters($),
                slots: this.extractSlots($)
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            const errorData = {
                id: testerConfig.id,
                name: testerConfig.name,
                url: testerConfig.url,
                timestamp: new Date().toISOString(),
                status: 'error',
                error: error.message,
                counters: {},
                slots: []
            };

            // Cache error result for shorter time
            this.cache.set(cacheKey, {
                data: errorData,
                timestamp: Date.now()
            });

            return errorData;
        }
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

    extractSlots($) {
        const slots = [];
        
        try {
            // Find all slot divs within the uutList container
            $('#uutList > div[id^="slot-"]').each((index, element) => {
                const $slot = $(element);
                const slotId = $slot.attr('id');
                
                // Extract slot name from the chassisname link
                let slotName = '';
                $slot.find('.chassisname a').each((i, el) => {
                    const text = $(el).text().trim();
                    if (text && text.startsWith('SLOT')) {
                        slotName = text;
                        return false; // break the loop
                    }
                });
                
                // If no slot name found, try to extract from ID
                if (!slotName) {
                    const idMatch = slotId.match(/slot-(\d+)/);
                    if (idMatch) {
                        const slotNum = idMatch[1].padStart(2, '0');
                        slotName = `SLOT${slotNum}`;
                    }
                }
                
                // Extract slot status from CSS classes
                let slotStatus = 'available';
                if ($slot.hasClass('testing')) {
                    slotStatus = 'testing';
                } else if ($slot.hasClass('failing')) {
                    slotStatus = 'failing';
                } else if ($slot.hasClass('aborted')) {
                    slotStatus = 'aborted';
                } else if ($slot.hasClass('failed')) {
                    slotStatus = 'failed';
                } else if ($slot.hasClass('passed')) {
                    slotStatus = 'passed';
                }
                
                // Extract test time
                let testTime = 'N/A';
                $slot.find('.testtime').each((i, el) => {
                    const time = $(el).text().trim();
                    if (time) {
                        testTime = time;
                        return false; // break the loop
                    }
                });
                
                // Extract serial number from the first panel-body
                let serialNumber = 'N/A';
                $slot.find('.panel-body').first().find('.slot-sn a').each((i, el) => {
                    const sn = $(el).text().trim();
                    // Check if it looks like a serial number (numeric and longer than 6 digits)
                    if (sn && /^\d{7,}$/.test(sn)) {
                        serialNumber = sn;
                        return false; // break the loop
                    }
                });
                
                // Extract sub-slots
                const subSlots = [];
                $slot.find('.panel-body').each((i, panelElement) => {
                    const $panel = $(panelElement);
                    $panel.find('.slot-sn a').each((j, el) => {
                        const subSlotName = $(el).text().trim();
                        const subSlotColor = $(el).css('color');
                        
                        // Only include sub-slots that have proper names
                        if (subSlotName && (subSlotName.includes('_') || subSlotName.startsWith('SLOT'))) {
                            const subSlotStatus = subSlotColor === 'rgb(170, 170, 170)' || 
                                                  subSlotColor === '#aaa' ? 'inactive' : 'active';
                            
                            // Avoid duplicates
                            if (!subSlots.find(sub => sub.name === subSlotName)) {
                                subSlots.push({
                                    name: subSlotName,
                                    status: subSlotStatus
                                });
                            }
                        }
                    });
                });
                
                // Extract production info and software version from panel-footer
                let productionInfo = 'N/A';
                let softwareVersion = 'N/A';
                
                const footerTexts = [];
                $slot.find('.panel-footer .slot-sn.fw-bold').each((i, el) => {
                    const text = $(el).text().trim();
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
                
                // Only add slot if we have a name
                if (slotName) {
                    slots.push({
                        id: slotId,
                        name: slotName,
                        status: slotStatus,
                        testTime: testTime,
                        serialNumber: serialNumber,
                        subSlots: subSlots,
                        productionInfo: productionInfo,
                        softwareVersion: softwareVersion
                    });
                }
            });
        } catch (error) {
            console.error('Error extracting slots:', error);
        }
        
        return slots;
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

module.exports = new EnhancedTesterScraper();