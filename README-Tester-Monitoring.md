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
- **Storage**: LocalStorage for configuration

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
  - Green: Running normally
  - Red: Failing/Error state
  - Gray: Available/Idle

## Data Structure

### Tester Configuration
```json
{
  "testers": [
    {
      "id": "ess08",
      "name": "ESS08",
      "url": "http://192.168.140.103:8080",
      "enabled": true,
      "selector": "#CS8210_ESS08_add_table"
    }
  ]
}
```

### Parsed Slot Data
The system extracts the following information from each tester:
- **Slot Name**: SLOT01-SLOT16, CHAMBER01
- **Status**: Running, Failing, or Available
- **Test Time**: Current test duration or "Available"
- **Status Class**: CSS class for visual indication

## Project Structure

```
tester-monitoring-dashboard/
├── server/
│   ├── app.js                    # Main server application
│   ├── tester-scraper.js         # Tester-specific scraping module
│   ├── config.js                 # Configuration management
│   └── scheduler.js              # Task scheduler
├── public/
│   ├── index.html                # Main dashboard
│   ├── css/
│   │   └── style.css             # Styles for tester cards and UI
│   └── js/
│       └── tester-dashboard.js   # Dashboard functionality
└── package.json                  # Dependencies
```

## API Endpoints

- `GET /api/tester/:testerId` - Get data for a specific tester
- `POST /api/testers/batch` - Get data for multiple testers
- `GET /events` - Server-Sent Events for real-time updates
- `GET /health` - Health check endpoint

## Supported Tester Interface Format

The dashboard is designed to work with HTML structures similar to the provided sample:

```html
<div class="card">
  <div class="card-body">
    <h6 id="CS8210_ESS07_header_name">CS8210_ESS07</h6>
    <div id="CS8210_ESS07_add_table">
      <table>
        <tbody>
          <tr>
            <td>
              <a href="http://192.168.140.102:8080" target="_blank">
                SLOT01
                <br>
                2:28:50
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
```

## Configuration Options

### Refresh Interval
- Default: 60 seconds
- Can be modified in the server configuration

### Timeout Settings
- Request timeout: 10 seconds
- Maximum retries: 3

### Visual Indicators
- **Running**: Green background (btn-normal or no class)
- **Failing**: Red background (btn-failing class)
- **Available**: Gray background (btn-secondary class)

## Deployment Options

### Local Development
```bash
npm run dev
```

### Docker
```bash
docker build -t tester-monitoring-dashboard .
docker run -p 3000:3000 tester-monitoring-dashboard
```

### Production with PM2
```bash
npm install -g pm2
pm2 start server/app.js --name tester-monitoring
pm2 startup
pm2 save
```

## Troubleshooting

### Common Issues

#### No Data Displayed
1. Verify the tester URL is accessible
2. Check if the HTML structure matches the expected format
3. Ensure the CSS selector is correct for the specific tester

#### Connection Errors
1. Check network connectivity to tester URLs
2. Verify firewall settings
3. Ensure testers are running and accessible

#### Incorrect Status Display
1. Check if the CSS classes match the expected patterns
2. Verify the text parsing logic for slot names and times

### Debug Mode
Enable debug logging by setting the environment variable:
```bash
DEBUG=tester-monitoring:* npm start
```

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Security Considerations

- Tester URLs should be accessible from the server
- No authentication is built-in (add if needed)
- All connections use HTTP (upgrade to HTTPS if required)

## Performance Considerations

- Each tester request is made sequentially to prevent overwhelming the network
- Data is cached for 30 seconds to prevent excessive requests
- Automatic cleanup of old data
- Connection pooling for HTTP requests

## Future Enhancements

- [ ] Authentication and user management
- [ ] Historical data tracking
- [ ] Advanced alerting options
- [ ] Mobile responsive design improvements
- [ ] Export functionality for test data
- [ ] Integration with monitoring systems

## Support

For support and questions:
1. Check the troubleshooting section
2. Verify tester URL accessibility
3. Ensure HTML structure compatibility
4. Create an issue in the repository

## License

This project is licensed under the MIT License - see the LICENSE file for details.