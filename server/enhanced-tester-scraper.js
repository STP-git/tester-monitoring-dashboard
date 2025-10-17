const axios = require('axios');
const cheerio = require('cheerio');
const pythonScraper = require('./python-scraper-wrapper');
const pythonStyleScraper = require('./python-style-scraper');

class EnhancedTesterScraper {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds
        this.usePythonFallback = false; // Set to true to use Python as fallback
        this.usePythonStyle = true; // Use the new Python-style scraper by default
    }

    async scrapeTesterData(testerConfig) {
        const cacheKey = `${testerConfig.id}-${testerConfig.url}`;
        const cached = this.cache.get(cacheKey);
        
        // Return cached data if still valid
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            let data;
            
            // Use Python-style scraper by default
            if (this.usePythonStyle) {
                try {
                    data = await pythonStyleScraper.scrapeTesterData(testerConfig);
                    console.log(`[Python-Style Scraper] Successfully scraped ${testerConfig.name}`);
                } catch (error) {
                    console.error(`[Python-Style Scraper] Failed for ${testerConfig.name}:`, error.message);
                    throw error;
                }
            } else {
                // Try original JavaScript scraper first
                try {
                    data = await this.scrapeWithJavaScript(testerConfig);
                    console.log(`[JS Scraper] Successfully scraped ${testerConfig.name} with JavaScript`);
                } catch (jsError) {
                    console.error(`[JS Scraper] JavaScript scraping failed for ${testerConfig.name}:`, jsError.message);
                    
                    // If Python fallback is enabled, try Python scraper
                    if (this.usePythonFallback) {
                        console.log(`[JS Scraper] Falling back to Python scraper for ${testerConfig.name}`);
                        try {
                            data = await pythonScraper.scrapeTesterData(testerConfig);
                            console.log(`[JS Scraper] Python fallback succeeded for ${testerConfig.name}`);
                        } catch (pythonError) {
                            console.error(`[JS Scraper] Python fallback also failed for ${testerConfig.name}:`, pythonError.message);
                            throw new Error(`Both JavaScript and Python scrapers failed. JS: ${jsError.message}, Python: ${pythonError.message}`);
                        }
                    } else {
                        throw jsError;
                    }
                }
            }

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
                slots: [],
                units: [],
                pageData: {}
            };

            // Cache error result for shorter time
            this.cache.set(cacheKey, {
                data: errorData,
                timestamp: Date.now()
            });

            return errorData;
        }
    }
    
    async scrapeWithJavaScript(testerConfig) {
        const response = await axios.get(testerConfig.url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        
        return {
            id: testerConfig.id,
            name: testerConfig.name,
            url: testerConfig.url,
            timestamp: new Date().toISOString(),
            status: 'success',
            // Extract all data according to the guide
            pageData: this.extractPageData($),
            counters: this.extractStatusCounters($),
            slots: this.extractSlots($),
            units: this.extractUnits($)
        };
    }
    
    // Method to toggle Python fallback
    setPythonFallback(enabled) {
        this.usePythonFallback = enabled;
        console.log(`[Scraper] Python fallback ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // Method to toggle Python-style scraper
    setPythonStyle(enabled) {
        this.usePythonStyle = enabled;
        console.log(`[Scraper] Python-style scraper ${enabled ? 'enabled' : 'disabled'}`);
    }

    extractPageData($) {
        const pageData = {};
        
        try {
            // Extract page title
            pageData.title = $('title').text().trim();
            
            // Extract station name from button
            pageData.stationName = $('div.container > div.row > div.col-3 > button').text().trim();
            
            // Extract configuration variables from script tag
            pageData.config = {};
            const scripts = $('script').filter((i, el) => {
                const scriptText = $(el).html();
                return scriptText && (scriptText.includes('max_slots') || scriptText.includes('test_station'));
            });
            
            if (scripts.length > 0) {
                const scriptText = $(scripts[0]).html();
                
                // Extract common configuration variables
                const configVars = [
                    'max_slots', 'test_station', 'interval', 'station_id',
                    'station_type', 'location', 'version', 'build_date'
                ];
                
                configVars.forEach(varName => {
                    const regex = new RegExp(`(?:const|var|let)\\s+${varName}\\s*=\\s*['"]([^'"]+)['"]`);
                    const match = scriptText.match(regex);
                    if (match) {
                        pageData.config[varName] = match[1];
                    }
                });
                
                // Try to extract numeric values
                const numericVars = ['max_slots', 'interval'];
                numericVars.forEach(varName => {
                    const regex = new RegExp(`(?:const|var|let)\\s+${varName}\\s*=\\s*(\\d+)`);
                    const match = scriptText.match(regex);
                    if (match) {
                        pageData.config[varName] = parseInt(match[1]);
                    }
                });
            }
        } catch (error) {
            console.error('Error extracting page data:', error);
        }
        
        return pageData;
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
                    if (text) {
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
                
                // Extract slot status from CSS classes (improved detection)
                let slotStatus = 'available';
                
                // Check for status classes in order of priority
                const statusClasses = ['testing', 'failing', 'aborted', 'failed', 'passed', 'default'];
                for (const status of statusClasses) {
                    if ($slot.hasClass(status)) {
                        slotStatus = status;
                        break;
                    }
                }
                
                // Also try to extract status from the chassisstatus element
                if (slotStatus === 'available') {
                    const chassisStatus = $slot.find('.chassisstatus').text().trim();
                    if (chassisStatus) {
                        slotStatus = chassisStatus.toLowerCase();
                    }
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
                
                // Look specifically in the first panel-body for the main serial number
                const firstPanelBody = $slot.find('.panel-body').first();
                const snLink = firstPanelBody.find('.slot-sn a').first();
                
                if (snLink.length > 0) {
                    const sn = snLink.text().trim();
                    console.log(`[Scraper] Found potential SN in first panel-body: "${sn}" (length: ${sn.length})`);
                    
                    // Check if it looks like a serial number
                    // Serial numbers can be alphanumeric and typically 10+ characters
                    // Examples: C8210F2B03254214T9560, 332404254207412
                    if (sn && sn.length >= 10) {
                        // Exclude slot names like SLOT01, SLOT01_01 and chamber names
                        if (!sn.match(/^SLOT\d+(_\d+)?$/) &&
                            !sn.match(/^CHAMBER\d+$/) &&
                            !sn.match(/^[A-Z]+\d+$/)) { // Also exclude patterns like SFT
                            serialNumber = sn;
                            console.log(`[Scraper] Accepted SN: "${serialNumber}" for slot ${slotName}`);
                        } else {
                            console.log(`[Scraper] Rejected SN (slot name pattern): "${sn}"`);
                        }
                    } else {
                        console.log(`[Scraper] Rejected SN (too short): "${sn}"`);
                    }
                } else {
                    console.log(`[Scraper] No SN link found in first panel-body for slot ${slotName}`);
                }
                
                // Extract sub-slots (improved)
                const subSlots = [];
                $slot.find('.panel-body').each((i, panelElement) => {
                    const $panel = $(panelElement);
                    $panel.find('.slot-sn a').each((j, el) => {
                        const subSlotName = $(el).text().trim();
                        const subSlotStyle = $(el).attr('style') || '';
                        
                        // Only include sub-slots that have proper names
                        if (subSlotName && (subSlotName.includes('_') || subSlotName.startsWith('SLOT'))) {
                            // Determine status from inline style color
                            let subSlotStatus = 'active';
                            if (subSlotStyle.includes('#AAA') || subSlotStyle.includes('#aaa') ||
                                subSlotStyle.includes('rgb(170, 170, 170)')) {
                                subSlotStatus = 'inactive';
                            }
                            
                            // Avoid duplicates and the main serial number
                            if (!subSlots.find(sub => sub.name === subSlotName) &&
                                subSlotName !== serialNumber) {
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

    extractUnits($) {
        const units = [];
        
        try {
            // Extract comprehensive unit data from checkoutbatch modal
            $('#checkoutbatch form[id^="message-add-"]').each((index, formElement) => {
                const $form = $(formElement);
                const unit = {};
                
                // Extract all hidden input fields
                $form.find('input[type="hidden"]').each((i, inputElement) => {
                    const $input = $(inputElement);
                    const name = $input.attr('name');
                    const value = $input.val();
                    
                    if (name && value) {
                        unit[name] = value;
                    }
                });
                
                // Only add unit if we have essential data
                if (unit.serial_number || unit.product_name) {
                    // Add form ID as reference
                    unit.formId = $form.attr('id');
                    
                    // Parse numeric values
                    if (unit.slot_no) {
                        unit.slot_no = parseInt(unit.slot_no);
                    }
                    
                    // Add parsed timestamp if available
                    if (unit.timestamp) {
                        unit.parsedTimestamp = new Date(unit.timestamp).toISOString();
                    }
                    
                    units.push(unit);
                }
            });
        } catch (error) {
            console.error('Error extracting units:', error);
        }
        
        return units;
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