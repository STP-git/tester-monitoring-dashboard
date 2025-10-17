const { spawn } = require('child_process');
const path = require('path');
const config = require('./config');

class PythonScraperWrapper {
    constructor() {
        this.pythonScript = path.join(__dirname, 'fetch_status.py');
    }

    async scrapeTesterData(testerConfig) {
        return new Promise((resolve, reject) => {
            console.log(`[Python Wrapper] Starting Python scraper for ${testerConfig.name} (${testerConfig.url})`);
            
            const pythonProcess = spawn('python', [this.pythonScript]);
            
            let stdout = '';
            let stderr = '';
            
            // Send the URL to the Python script
            pythonProcess.stdin.write(`${testerConfig.url.replace('http://', '').replace('https://', '')}\n`);
            pythonProcess.stdin.write('8080\n'); // Default port
            pythonProcess.stdin.end();
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error(`[Python Wrapper] Python script exited with code ${code}`);
                    console.error(`[Python Wrapper] Error: ${stderr}`);
                    return reject(new Error(`Python script failed: ${stderr}`));
                }
                
                try {
                    // Extract JSON from the output
                    const jsonMatch = stdout.match(/---> Final JSON Output:\s*\n([\s\S]*?)$/);
                    if (jsonMatch) {
                        const jsonData = JSON.parse(jsonMatch[1]);
                        console.log(`[Python Wrapper] Successfully parsed ${jsonData.length} slots from Python script`);
                        
                        // Transform the data to match the expected format
                        const transformedData = this.transformPythonData(jsonData, testerConfig);
                        resolve(transformedData);
                    } else {
                        throw new Error('Could not find JSON output in Python script response');
                    }
                } catch (error) {
                    console.error(`[Python Wrapper] Error parsing Python output: ${error.message}`);
                    console.error(`[Python Wrapper] Raw output: ${stdout}`);
                    reject(error);
                }
            });
            
            pythonProcess.on('error', (error) => {
                console.error(`[Python Wrapper] Failed to start Python process: ${error.message}`);
                reject(error);
            });
        });
    }
    
    transformPythonData(pythonData, testerConfig) {
        // Transform Python data format to match JavaScript format
        const slots = pythonData.map(slot => ({
            id: slot.id,
            name: slot.name || slot.slot_name,
            status: slot.status,
            testTime: slot.test_time,
            serialNumber: slot.sn,
            subSlots: slot.subSlots || [],
            productionInfo: slot.productionInfo || 'N/A',
            softwareVersion: slot.softwareVersion || 'N/A'
        }));
        
        // Extract status counters from the slots
        const counters = {
            testing: 0,
            failing: 0,
            aborted: 0,
            failed: 0,
            passed: 0
        };
        
        slots.forEach(slot => {
            const status = slot.status.toLowerCase();
            if (counters.hasOwnProperty(status)) {
                counters[status]++;
            }
        });
        
        return {
            id: testerConfig.id,
            name: testerConfig.name,
            url: testerConfig.url,
            timestamp: new Date().toISOString(),
            status: 'success',
            pageData: {
                title: 'Tester Status',
                stationName: slots.length > 0 ? slots[0].station || testerConfig.name : testerConfig.name
            },
            counters: counters,
            slots: slots,
            units: []
        };
    }
}

module.exports = new PythonScraperWrapper();