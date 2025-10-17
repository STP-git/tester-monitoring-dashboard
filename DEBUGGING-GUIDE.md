# Debugging Guide for Fetching Issues

This guide explains the debugging approach for the fetching issues in the tester monitoring system and how to use the new diagnostic tools.

## Problem Analysis

After analyzing the Python script (`fetch_status.py`) and comparing it with the JavaScript implementation (`enhanced-tester-scraper.js`), we identified several potential issues:

### Most Likely Sources of Problems

1. **Different CSS selectors and element extraction logic** - The Python script uses different selectors compared to the JavaScript version, which could lead to missing data or incorrect parsing.

2. **Inconsistent handling of empty slots** - The Python script has different logic for determining when a slot is empty vs. active, which could cause discrepancies in the data.

### Other Potential Issues

3. Different data extraction logic between Python and JavaScript implementations
4. CSS selector inconsistencies between the two scrapers
5. Error handling differences when pages don't load correctly
6. Timeout and retry mechanism variations
7. Different approaches to handling special cases like chambers vs. regular slots

## Solutions Implemented

### 1. Improved Python Script (`server/fetch_status.py`)

- Updated to align with JavaScript implementation
- Fixed regex pattern matching for slot IDs
- Fixed JavaScript syntax errors in Python code
- Added comprehensive debugging information
- Improved error handling and logging

### 2. Python Wrapper (`server/python-scraper-wrapper.js`)

- Created a Node.js wrapper to call the Python script
- Transforms Python output to match JavaScript format
- Enables fallback to Python scraper when JavaScript fails

### 3. Enhanced JavaScript Scraper (`server/enhanced-tester-scraper.js`)

- Added option to use Python as fallback
- Separated JavaScript scraping logic for better debugging
- Added method to toggle Python fallback

### 4. Diagnostic Tool (`server/scraper-diagnostic.js`)

- Compares outputs from both scrapers
- Identifies discrepancies in slot counts, status counters, and details
- Provides detailed comparison reports
- Can run for individual testers or all testers

### 5. Diagnostic API Endpoint (`/api/diagnostic`)

- Added to the main application for web-based diagnostics
- Can be triggered from the frontend or via API calls

## How to Use the Diagnostic Tools

### Command Line

1. Run diagnostic for a specific tester:
```bash
cd server
node scraper-diagnostic.js ess08
```

2. Run diagnostic for all testers:
```bash
cd server
node scraper-diagnostic.js
```

### API Endpoint

1. Run diagnostic for a specific tester:
```bash
curl -X POST http://localhost:3000/api/diagnostic \
  -H "Content-Type: application/json" \
  -d '{"testerId": "ess08"}'
```

2. Run diagnostic for all testers:
```bash
curl -X POST http://localhost:3000/api/diagnostic \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Using Python Script Directly

1. Run the Python script directly:
```bash
cd server
python fetch_status.py
```
Then enter the IP address and port when prompted.

## Interpreting Diagnostic Results

The diagnostic tool provides a detailed comparison between the JavaScript and Python scrapers:

### Slot Count Comparison
- Checks if both scrapers find the same number of slots
- Discrepancies indicate issues with slot detection logic

### Status Counter Comparison
- Compares the counts of different statuses (testing, failing, etc.)
- Mismatches suggest issues with status detection

### Slot Details Comparison
- Identifies missing slots in either scraper
- Highlights status mismatches for the same slots
- Detects serial number discrepancies

### Performance Metrics
- Shows processing speed comparison
- Helps identify performance bottlenecks

## Troubleshooting Steps

1. **Run the diagnostic tool** to identify specific issues
2. **Check the detailed comparison** to understand what differs
3. **Examine the sample slot data** to see the exact differences
4. **Fix the identified issues** in the appropriate scraper
5. **Re-run the diagnostic** to verify the fixes

## Enabling Python Fallback

If you want to use the Python scraper as a fallback when JavaScript fails:

```javascript
// In enhanced-tester-scraper.js
enhancedScraper.setPythonFallback(true);
```

This will automatically try the Python scraper if the JavaScript scraper fails.

## Recommendations

1. **Use the diagnostic tool regularly** to catch scraping issues early
2. **Monitor the logs** for error messages from both scrapers
3. **Keep both scrapers updated** when the target website structure changes
4. **Consider using Python fallback** in production for reliability
5. **Test with different target URLs** to ensure compatibility

## Next Steps

1. Run the diagnostic tool on your system to identify current issues
2. Fix any discrepancies found in the comparison
3. Test the fixes with the diagnostic tool
4. Consider enabling Python fallback for production use
5. Set up regular diagnostic checks to prevent future issues