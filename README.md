# Tester Monitoring Dashboard

A lightweight web application designed specifically for monitoring test equipment with multiple slots. The dashboard scrapes HTML data from tester interfaces and displays real-time slot status, test times, and provides easy access to tester URLs.

## Features

- **Tester-Specific Design**: Optimized for monitoring test equipment with multiple slots (SLOT01-SLOT16, CHAMBER01)
- **Real-time Updates**: Data refreshed every minute with Server-Sent Events
- **Visual Status Indicators**: Color-coded slots showing running, failing, and available states
- **Interactive Cards**: Clickable tester cards that open the tester's URL in a new tab
- **Configuration Management**: Add, edit, and delete testers through a simple interface
- **Selective Monitoring**: Choose which testers to monitor with checkbox selection
- **Auto-Refresh**: Automatically updates data every minute once monitoring starts
- **Lightweight Design**: Minimal dependencies and resource usage

## Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Web Scraping**: Axios + Cheerio
- **Real-time Communication**: Server-Sent Events
- **Storage**: JSON file configuration

## Quick Start

### Prerequisites
- Node.js 14+ installed

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd tester-monitoring-dashboard

# Install dependencies
npm install

# Start the application
npm start
```

### Access the Dashboard
Open your browser and navigate to `http://localhost:3000`

## How to Use

### 1. Configure Testers
1. Click the "Configuration" button in the top right
2. Click "Add Tester" to add a new tester:
   - **ID**: Unique identifier (e.g., "ess08")
   - **Display Name**: The name to show on the card (e.g., "ESS08")
   - **URL**: The full URL of the tester interface (e.g., "http://192.168.140.103:8080")
3. Use Edit/Delete buttons to modify existing testers
4. Close the configuration modal when done

### 2. Monitor Testers
1. Select testers to monitor using the checkboxes
2. Use "Select All" or "Deselect All" for quick selection
3. Click "Start Monitoring" to begin data collection
4. The dashboard will:
   - Display cards for selected testers
   - Show slot status and test times
   - Update automatically every minute
   - Indicate connection status

### 3. Interact with Tester Cards
- **Click the card** or **URL button** to open the tester interface in a new tab
- **Card colors** indicate overall status:
  - Green: At least one slot is running
  - Red: At least one slot is failing
  - Yellow: No failing slots, but none running
- **Slot colors** indicate individual status:
  - Blue: Running normally
  - Red: Failing/Error state
  - Orange: Failed
  - Purple: Aborted
  - Green: Passed
  - Gray: Available/Idle

## Project Structure

```
tester-monitoring-dashboard/
├── server/
│   ├── app.js                    # Main server application
│   ├── enhanced-tester-scraper.js # Tester-specific scraping module
│   ├── config.js                 # Configuration management
│   └── scheduler.js              # Task scheduler
├── public/
│   ├── index.html                # Main dashboard
│   ├── css/
│   │   └── style.css             # Styles for tester cards and UI
│   ├── js/
│   │   └── enhanced-tester-dashboard.js # Dashboard functionality
│   └── config.json               # Default configuration
├── package.json                  # Dependencies
└── README.md                     # This file
```

## API Endpoints

- `GET /api/tester/:testerId` - Get data for a specific tester
- `POST /api/testers/batch` - Get data for multiple testers
- `GET /api/config` - Get current configuration
- `POST /api/config` - Update configuration
- `POST /api/tester` - Add new tester
- `PUT /api/tester/:testerId` - Update tester
- `DELETE /api/tester/:testerId` - Delete tester
- `GET /api/config/export` - Export configuration
- `POST /api/config/import` - Import configuration
- `POST /api/scheduler/start` - Start monitoring
- `POST /api/scheduler/stop` - Stop monitoring
- `GET /api/scheduler/status` - Get scheduler status
- `GET /events` - Server-Sent Events for real-time updates
- `GET /health` - Health check endpoint

## Supported Tester Interface Format

The dashboard is designed to work with HTML structures similar to the provided sample. It extracts:

- **Tester Name**: From `.btn.btn-dark.fs-6` element
- **Status Counters**: From `#testing-counter`, `#failing-counter`, etc.
- **Slot Information**: From `#uutList` container with slot divs
- **Slot Names**: From `.chassisname a` elements
- **Serial Numbers**: From numeric links in slot bodies
- **Sub-slots**: From `.slot-sn a` elements with color coding
- **Production Info**: From `.panel-footer .slot-sn.fw-bold` elements

## Configuration Options

### Refresh Interval
- Default: 60 seconds
- Can be modified in the configuration

### Timeout Settings
- Request timeout: 10 seconds
- Maximum retries: 3

### Visual Indicators
- **Testing**: Blue background (testing class)
- **Failing**: Red background (failing class)
- **Passed**: Green background (passed class)
- **Failed**: Orange background (failed class)
- **Aborted**: Purple background (aborted class)
- **Available**: Gray background (default class)

## Deployment Options

### Local Development
```bash
npm run dev
```

### Production with PM2
```bash
npm install -g pm2
pm2 start server/app.js --name tester-monitoring
pm2 startup
pm2 save
```

### Docker
```bash
# Build image
docker build -t tester-monitoring-dashboard .

# Run container
docker run -p 3000:3000 tester-monitoring-dashboard
```

### Docker Compose
```bash
docker-compose up -d
```

## Troubleshooting

### Common Issues

#### No Data Displayed
1. Verify the tester URL is accessible from the server
2. Check if the HTML structure matches the expected format
3. Ensure the CSS selectors are correct for the specific tester
4. Check browser console for JavaScript errors
5. Check server logs for scraping errors

#### Connection Errors
1. Check network connectivity to tester URLs
2. Verify firewall settings
3. Ensure testers are running and accessible
4. Check if CORS is configured properly

#### Incorrect Status Display
1. Check if the CSS classes match the expected patterns
2. Verify the text parsing logic for slot names and times
3. Ensure status counters are being extracted correctly

### Debug Mode
Enable debug logging by setting the environment variable:
```bash
DEBUG=tester-monitoring:* npm start
```

### Logs
Check the server console for:
- Scraping errors
- Network timeouts
- Parsing issues
- Configuration problems

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Security Considerations

- Tester URLs should be accessible from the server
- No authentication is built-in (add if needed)
- All connections use HTTP (upgrade to HTTPS if required)
- Input validation for configuration data
- Request timeouts prevent hanging

## Performance Considerations

- Each tester request is made sequentially to prevent overwhelming the network
- Data is cached for 30 seconds to prevent excessive requests
- Automatic cleanup of old data
- Connection pooling for HTTP requests
- Efficient DOM updates

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
1. Check the troubleshooting section
2. Verify tester URL accessibility
3. Ensure HTML structure compatibility
4. Check server logs for errors
5. Create an issue in the repository