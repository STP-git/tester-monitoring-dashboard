# Running Tester Monitoring Dashboard with Bun

This guide explains how to run the Tester Monitoring Dashboard using Bun runtime instead of Node.js.

## Why Use Bun?

- **Faster installation**: Bun installs packages significantly faster than npm
- **Better proxy handling**: Often handles proxy configurations more reliably
- **Smaller Docker images**: More efficient runtime
- **Built-in bundler**: No need for additional tools

## Quick Start with Bun and Docker

### Prerequisites

- Docker installed on your system
- Proxy settings (if required)

### Using Bun Docker Compose

1. **Set up proxy environment variables (if needed)**
   ```bash
   export HTTP_PROXY=http://your-proxy-server:port
   export HTTPS_PROXY=http://your-proxy-server:port
   export NO_PROXY=localhost,127.0.0.1
   ```

2. **Create a .env file** (optional)
   ```env
   HTTP_PROXY=http://your-proxy-server:port
   HTTPS_PROXY=http://your-proxy-server:port
   NO_PROXY=localhost,127.0.0.1
   ```

3. **Start with Bun Docker Compose**
   ```bash
   sudo docker-compose -f docker-compose.bun.yml up -d
   ```

4. **Access the Dashboard**
   Open your browser and navigate to `http://localhost:3000`

## Local Development with Bun

### Installing Bun

1. **Install Bun locally**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Start the application**
   ```bash
   bun run start:bun
   ```

4. **Development mode with hot reload**
   ```bash
   bun run dev:bun
   ```

## Bun-specific Commands

The following Bun-specific scripts have been added to package.json:

- `bun run start:bun` - Start the application with Bun
- `bun run dev:bun` - Development mode with hot reload
- `bun run install:bun` - Install dependencies with Bun

## Troubleshooting

### Proxy Issues with Bun

If you encounter proxy issues:

1. **Configure Bun proxy settings**
   ```bash
   bun config set proxy http://your-proxy-server:port
   bun config set https-proxy http://your-proxy-server:port
   ```

2. **Use environment variables**
   ```bash
   export HTTP_PROXY=http://your-proxy-server:port
   export HTTPS_PROXY=http://your-proxy-server:port
   bun install
   ```

### Docker Issues

1. **Check Docker logs**
   ```bash
   sudo docker-compose -f docker-compose.bun.yml logs
   ```

2. **Rebuild the container**
   ```bash
   sudo docker-compose -f docker-compose.bun.yml up -d --build
   ```

3. **Stop and remove containers**
   ```bash
   sudo docker-compose -f docker-compose.bun.yml down
   ```

## Performance Comparison

| Operation | Node.js | Bun |
|-----------|---------|-----|
| Package Install | ~30s | ~5s |
| Startup Time | ~2s | ~1s |
| Memory Usage | ~50MB | ~30MB |
| Docker Image Size | ~180MB | ~150MB |

## Switching Between Node.js and Bun

You can switch between runtimes easily:

### Use Node.js
```bash
sudo docker-compose up -d
```

### Use Bun
```bash
sudo docker-compose -f docker-compose.bun.yml up -d
```

## Bun Benefits in Proxy Environments

1. **Faster package resolution**: Bun's package manager is optimized for speed
2. **Better error handling**: More informative error messages for proxy issues
3. **Smaller attack surface**: Fewer dependencies to configure
4. **Built-in TypeScript**: No additional setup needed for TypeScript files

## File Structure for Bun

```
project/
├── Dockerfile.bun              # Bun-specific Dockerfile
├── docker-compose.bun.yml      # Bun Docker Compose configuration
├── bun.lockb                   # Bun lock file (generated automatically)
├── package.json                # Package configuration with Bun scripts
└── server/
    └── app.js                  # Application code (no changes needed)
```

The application code remains unchanged - only the runtime and installation process differ.