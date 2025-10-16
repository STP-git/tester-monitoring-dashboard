# Updated Tester Monitoring Design Based on Actual HTML Structure

## Analysis of Actual HTML Structure

From the sample HTML data, I can see the real structure is much more detailed than initially understood:

### Key Components Identified:
1. **Tester Name**: "ESS08" (line 4)
2. **Status Counters**: Testing, Failing, Aborted, Failed, Passed (lines 8-17)
3. **Slot Structure**: 16 main slots (SLOT01-SLOT16) + 1 CHAMBER01
4. **Each Slot Contains**:
   - Slot name and status (testing/default)
   - Test time (e.g., "0:46:43")
   - Main serial number (e.g., "332404254207412")
   - 4 sub-slots (SLOT01_01, SLOT01_02, etc.)
   - Production info and software version

## Updated Data Model

### Tester Configuration
```json
{
  "testers": [
    {
      "id": "ess08",
      "name": "ESS08",
      "url": "http://192.168.140.103:8080",
      "enabled": true,
      "testerNameSelector": ".btn.btn-dark.fs-6",
      "statusCountersSelector": "#teststatusdiv",
      "slotsContainerSelector": "#uutList"
    }
  ]
}
```

### Parsed Tester Data Structure
```json
{
  "id": "ess08",
  "name": "ESS08",
  "url": "http://192.168.140.103:8080",
  "timestamp": "2023-10-16T07:10:00.000Z",
  "status": "success",
  "counters": {
    "testing": 0,
    "failing": 0,
    "aborted": 0,
    "failed": 0,
    "passed": 0
  },
  "slots": [
    {
      "id": "slot-1",
      "name": "SLOT01",
      "status": "testing",
      "testTime": "0:46:43",
      "serialNumber": "332404254207412",
      "subSlots": [
        {"name": "SLOT01", "status": "active"},
        {"name": "SLOT01_01", "status": "inactive"},
        {"name": "SLOT01_02", "status": "inactive"},
        {"name": "SLOT01_03", "status": "inactive"},
        {"name": "SLOT01_04", "status": "inactive"}
      ],
      "productionInfo": "Production",
      "softwareVersion": "AZ3324_2025.10.08-01"
    }
  ]
}
```

## Updated Backend Implementation

### 1. Enhanced Tester Scraper
```javascript
// server/enhanced-tester-scraper.js
const axios = require('axios');
const cheerio = require('cheerio');

class EnhancedTesterScraper {
    async scrapeTesterData(testerConfig) {
        try {
            const response = await axios.get(testerConfig.url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            return {
                id: testerConfig.id,
                name: testerConfig.name,
                url: testerConfig.url,
                timestamp: new Date().toISOString(),
                status: 'success',
                counters: this.extractStatusCounters($),
                slots: this.extractSlots($)
            };
        } catch (error) {
            return {
                id: testerConfig.id,
                name: testerConfig.name,
                url: testerConfig.url,
                timestamp: new Date().toISOString(),
                status: 'error',
                error: error.message,
                counters: {},
                slots: []
            };
        }
    }

    extractStatusCounters($) {
        const counters = {};
        
        // Extract all status counters
        $('#testing-counter').each((i, el) => {
            counters.testing = parseInt($(el).text()) || 0;
        });
        
        $('#failing-counter').each((i, el) => {
            counters.failing = parseInt($(el).text()) || 0;
        });
        
        $('#aborted-counter').each((i, el) => {
            counters.aborted = parseInt($(el).text()) || 0;
        });
        
        $('#failed-counter').each((i, el) => {
            counters.failed = parseInt($(el).text()) || 0;
        });
        
        $('#passed-counter').each((i, el) => {
            counters.passed = parseInt($(el).text()) || 0;
        });
        
        return counters;
    }

    extractSlots($) {
        const slots = [];
        
        // Find all slot divs
        $('#uutList > div[id^="slot-"]').each((index, element) => {
            const $slot = $(element);
            const slotId = $slot.attr('id');
            
            // Extract slot name
            const slotName = $slot.find('.chassisname a').first().text().trim();
            
            // Extract status
            const slotStatus = $slot.hasClass('testing') ? 'testing' : 
                              $slot.hasClass('failing') ? 'failing' : 
                              $slot.hasClass('aborted') ? 'aborted' : 
                              $slot.hasClass('failed') ? 'failed' : 
                              $slot.hasClass('passed') ? 'passed' : 'available';
            
            // Extract test time
            const testTime = $slot.find('.testtime').text().trim();
            
            // Extract serial number
            const serialNumber = $slot.find('.panel-body:first .slot-sn a').first().text().trim();
            
            // Extract sub-slots
            const subSlots = [];
            $slot.find('.panel-body').slice(1).each((i, subSlotElement) => {
                const $subSlot = $(subSlotElement);
                const subSlotName = $subSlot.find('.slot-sn a').text().trim();
                const subSlotStatus = $subSlot.find('.slot-sn a').css('color') === 'rgb(170, 170, 170)' ? 'inactive' : 'active';
                
                if (subSlotName) {
                    subSlots.push({
                        name: subSlotName,
                        status: subSlotStatus
                    });
                }
            });
            
            // Extract production info
            const productionInfo = $slot.find('.panel-footer .slot-sn.fw-bold').first().text().trim();
            
            // Extract software version
            const softwareVersion = $slot.find('.panel-footer .slot-sn.fw-bold').eq(1).text().trim();
            
            slots.push({
                id: slotId,
                name: slotName,
                status: slotStatus,
                testTime: testTime || 'N/A',
                serialNumber: serialNumber || 'N/A',
                subSlots: subSlots,
                productionInfo: productionInfo || 'N/A',
                softwareVersion: softwareVersion || 'N/A'
            });
        });
        
        return slots;
    }
}

module.exports = new EnhancedTesterScraper();
```

## Updated Frontend Design

### 1. Enhanced Tester Card Template
```html
<!-- Template for enhanced tester card -->
<template id="enhanced-tester-card-template">
    <div class="tester-card" data-tester-id="">
        <div class="card-header">
            <h3 class="tester-name"></h3>
            <button class="url-btn" title="Open Tester URL">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15,3 21,3 21,9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
            </button>
            <div class="tester-status">
                <span class="status-indicator"></span>
                <span class="last-update"></span>
            </div>
        </div>
        
        <!-- Status Counters -->
        <div class="status-counters">
            <div class="counter">
                <span class="counter-label">Testing</span>
                <span class="counter-value testing">0</span>
            </div>
            <div class="counter">
                <span class="counter-label">Failing</span>
                <span class="counter-value failing">0</span>
            </div>
            <div class="counter">
                <span class="counter-label">Passed</span>
                <span class="counter-value passed">0</span>
            </div>
            <div class="counter">
                <span class="counter-label">Failed</span>
                <span class="counter-value failed">0</span>
            </div>
            <div class="counter">
                <span class="counter-label">Aborted</span>
                <span class="counter-value aborted">0</span>
            </div>
        </div>
        
        <div class="card-body">
            <div class="slots-container">
                <!-- Slots will be populated here -->
            </div>
        </div>
    </div>
</template>

<!-- Template for enhanced slot -->
<template id="enhanced-slot-template">
    <div class="slot" data-slot-id="">
        <div class="slot-header">
            <div class="slot-name"></div>
            <div class="slot-status"></div>
            <div class="slot-time"></div>
        </div>
        <div class="slot-details">
            <div class="serial-number">
                <span class="label">SN:</span>
                <span class="value"></span>
            </div>
            <div class="sub-slots">
                <div class="sub-slot-grid">
                    <!-- Sub-slots will be populated here -->
                </div>
            </div>
            <div class="production-info">
                <div class="info-row">
                    <span class="label">Type:</span>
                    <span class="value production-type"></span>
                </div>
                <div class="info-row">
                    <span class="label">Version:</span>
                    <span class="value software-version"></span>
                </div>
            </div>
        </div>
    </div>
</template>
```

### 2. Enhanced CSS for Detailed Slots
```css
/* Enhanced Tester Card Styles */
.tester-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;
    margin-bottom: 20px;
}

.tester-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
}

.tester-card.error {
    border-top: 4px solid #dc3545;
}

.tester-card.warning {
    border-top: 4px solid #ffc107;
}

.tester-card.success {
    border-top: 4px solid #28a745;
}

.card-header {
    background-color: #f8f9fa;
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #dee2e6;
}

.tester-name {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #495057;
}

.url-btn {
    background: none;
    border: none;
    color: #007bff;
    cursor: pointer;
    padding: 5px;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.url-btn:hover {
    background-color: #e9ecef;
}

.tester-status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.875rem;
    color: #6c757d;
}

.status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #28a745;
}

.status-indicator.error {
    background-color: #dc3545;
}

.status-indicator.warning {
    background-color: #ffc107;
}

/* Status Counters */
.status-counters {
    display: flex;
    justify-content: space-around;
    padding: 15px 20px;
    background-color: #ffffff;
    border-bottom: 1px solid #dee2e6;
}

.counter {
    text-align: center;
}

.counter-label {
    display: block;
    font-size: 0.75rem;
    color: #6c757d;
    margin-bottom: 5px;
}

.counter-value {
    display: block;
    font-size: 1.25rem;
    font-weight: 600;
}

.counter-value.testing {
    color: #007bff;
}

.counter-value.failing {
    color: #dc3545;
}

.counter-value.passed {
    color: #28a745;
}

.counter-value.failed {
    color: #fd7e14;
}

.counter-value.aborted {
    color: #6f42c1;
}

/* Enhanced Slots */
.slots-container {
    padding: 20px;
    max-height: 600px;
    overflow-y: auto;
}

.slot {
    background-color: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 15px;
    overflow: hidden;
    border: 1px solid #dee2e6;
}

.slot.testing {
    border-left: 4px solid #007bff;
}

.slot.failing {
    border-left: 4px solid #dc3545;
}

.slot.passed {
    border-left: 4px solid #28a745;
}

.slot.failed {
    border-left: 4px solid #fd7e14;
}

.slot.aborted {
    border-left: 4px solid #6f42c1;
}

.slot.available {
    border-left: 4px solid #6c757d;
}

.slot-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    background-color: #e9ecef;
    border-bottom: 1px solid #dee2e6;
}

.slot-name {
    font-weight: 600;
    font-size: 0.875rem;
}

.slot-status {
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 12px;
    background-color: #6c757d;
    color: white;
}

.slot-status.testing {
    background-color: #007bff;
}

.slot-status.failing {
    background-color: #dc3545;
}

.slot-status.passed {
    background-color: #28a745;
}

.slot-status.failed {
    background-color: #fd7e14;
}

.slot-status.aborted {
    background-color: #6f42c1;
}

.slot-status.available {
    background-color: #6c757d;
}

.slot-time {
    font-size: 0.75rem;
    color: #6c757d;
    font-weight: 500;
}

.slot-details {
    padding: 15px;
}

.serial-number {
    margin-bottom: 10px;
    font-size: 0.875rem;
}

.serial-number .label {
    font-weight: 600;
    color: #495057;
}

.serial-number .value {
    color: #007bff;
    font-family: monospace;
}

.sub-slots {
    margin-bottom: 15px;
}

.sub-slot-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 5px;
    margin-top: 5px;
}

.sub-slot {
    padding: 5px;
    text-align: center;
    font-size: 0.7rem;
    border-radius: 4px;
    background-color: #e9ecef;
    color: #6c757d;
}

.sub-slot.active {
    background-color: #d4edda;
    color: #155724;
}

.sub-slot.inactive {
    background-color: #f8d7da;
    color: #721c24;
}

.production-info {
    font-size: 0.75rem;
    color: #6c757d;
}

.info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
}

.info-row .label {
    font-weight: 600;
}

.info-row .value {
    color: #495057;
}

.production-type {
    color: #28a745;
    font-weight: 500;
}

.software-version {
    font-family: monospace;
    color: #007bff;
}
```

### 3. Updated JavaScript for Enhanced Display
```javascript
// js/enhanced-tester-dashboard.js
class EnhancedTesterDashboard extends TesterDashboard {
    createTesterCard(tester) {
        const template = document.getElementById('enhanced-tester-card-template');
        const clone = template.content.cloneNode(true);
        
        const card = clone.querySelector('.tester-card');
        card.dataset.testerId = tester.id;
        
        clone.querySelector('.tester-name').textContent = tester.name;
        
        // Add click handler for opening URL
        clone.querySelector('.url-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(tester.url, '_blank');
        });
        
        // Add click handler for the entire card
        card.addEventListener('click', () => {
            window.open(tester.url, '_blank');
        });
        
        document.getElementById('tester-dashboard').appendChild(clone);
    }

    updateTesterCard(testerId, data) {
        const card = document.querySelector(`[data-tester-id="${testerId}"]`);
        if (!card) return;

        // Update status indicator
        const statusIndicator = card.querySelector('.status-indicator');
        const lastUpdate = card.querySelector('.last-update');
        
        statusIndicator.className = 'status-indicator';
        lastUpdate.textContent = new Date(data.timestamp).toLocaleTimeString();

        // Update status counters
        this.updateStatusCounters(card, data.counters);

        // Determine overall status based on counters
        let overallStatus = 'available';
        if (data.counters.failing > 0 || data.counters.failed > 0) {
            overallStatus = 'error';
            statusIndicator.classList.add('error');
            card.className = 'tester-card error';
        } else if (data.counters.testing > 0) {
            overallStatus = 'success';
            statusIndicator.classList.add('success');
            card.className = 'tester-card success';
        } else if (data.counters.passed > 0) {
            overallStatus = 'warning';
            statusIndicator.classList.add('warning');
            card.className = 'tester-card warning';
        }

        // Update slots
        const slotsContainer = card.querySelector('.slots-container');
        slotsContainer.innerHTML = '';

        data.slots.forEach(slot => {
            const slotElement = this.createEnhancedSlotElement(slot);
            slotsContainer.appendChild(slotElement);
        });
    }

    updateStatusCounters(card, counters) {
        card.querySelector('.counter-value.testing').textContent = counters.testing || 0;
        card.querySelector('.counter-value.failing').textContent = counters.failing || 0;
        card.querySelector('.counter-value.passed').textContent = counters.passed || 0;
        card.querySelector('.counter-value.failed').textContent = counters.failed || 0;
        card.querySelector('.counter-value.aborted').textContent = counters.aborted || 0;
    }

    createEnhancedSlotElement(slot) {
        const template = document.getElementById('enhanced-slot-template');
        const clone = template.content.cloneNode(true);
        
        const slotElement = clone.querySelector('.slot');
        slotElement.dataset.slotId = slot.id;
        slotElement.className = `slot ${slot.status}`;
        
        clone.querySelector('.slot-name').textContent = slot.name;
        clone.querySelector('.slot-status').textContent = slot.status;
        clone.querySelector('.slot-status').className = `slot-status ${slot.status}`;
        clone.querySelector('.slot-time').textContent = slot.testTime;
        
        clone.querySelector('.serial-number .value').textContent = slot.serialNumber;
        
        // Add sub-slots
        const subSlotGrid = clone.querySelector('.sub-slot-grid');
        slot.subSlots.forEach(subSlot => {
            const subSlotElement = document.createElement('div');
            subSlotElement.className = `sub-slot ${subSlot.status}`;
            subSlotElement.textContent = subSlot.name;
            subSlotGrid.appendChild(subSlotElement);
        });
        
        clone.querySelector('.production-type').textContent = slot.productionInfo;
        clone.querySelector('.software-version').textContent = slot.softwareVersion;
        
        return clone;
    }
}

// Override the base dashboard with enhanced version
document.addEventListener('DOMContentLoaded', () => {
    new EnhancedTesterDashboard();
});
```

This updated design now accurately reflects the actual HTML structure you provided, with detailed slot information, status counters, and a more comprehensive display of the tester data.