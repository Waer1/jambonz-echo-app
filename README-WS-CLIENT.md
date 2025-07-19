# Jambonz WebSocket Client Server

This file (`server-ws-client.js`) demonstrates the correct approach to handling Jambonz WebSocket connections using the `@jambonz/node-client-ws` package following the official documentation.

## Key Differences from server.js

### 1. **WebSocket Implementation**

- **server.js**: Uses the raw `ws` package to create a WebSocket server
- **server-ws-client.js**: Uses `@jambonz/node-client-ws` package with `createEndpoint` and session-based approach

### 2. **Connection Handling**

- **server.js**: Creates a WebSocket server that listens on a specific port
- **server-ws-client.js**: Uses `createEndpoint` to create a Jambonz service that handles sessions

### 3. **Port Configuration**

- **server.js**: Runs on ports 3000 (HTTP) and 8080 (WebSocket)
- **server-ws-client.js**: Runs on port 3001 (HTTP only, WebSocket handled by the service)

### 4. **Architecture**

- **server.js**: Traditional WebSocket server architecture
- **server-ws-client.js**: Session-based architecture using Jambonz service

## Features

Both servers provide the same functionality:

1. **Echo Audio**: Receives audio from Jambonz and echoes it back
2. **Redirect Command**: After 5 seconds, sends a redirect command to dial another number
3. **Call State Management**: Tracks call states and connection status
4. **Health Check**: Provides health check endpoint
5. **Status Callbacks**: Handles Jambonz status callbacks

## Usage

### Running the WebSocket Client Server

```bash
# Production
yarn start-ws-client

# Development with auto-restart
yarn dev-ws-client
```

### Configuration

The server uses the following configuration:

```javascript
const AppConfig = {
  PORT: 3001,
  BACKEND_URL: 'http://51.136.97.170:3001',
};
```

### Endpoints

- **Webhook**: `POST /jambonz/webhook` - Handles incoming Jambonz webhooks
- **Status**: `POST /jambonz/status` - Handles Jambonz status callbacks
- **Health**: `GET /health` - Health check endpoint
- **WebSocket**: `GET /audio-stream` - WebSocket endpoint for audio streaming (handled by Jambonz service)

## Session Events

The Jambonz service provides the following session events:

- `session:new`: Fired when a new call session is created
- `message`: Fired when audio data is received
- `close`: Fired when the session is closed
- `error`: Fired when an error occurs in the session

## Code Structure

The server follows the official `@jambonz/node-client-ws` pattern:

```javascript
// Create HTTP server
const { createServer } = require('http');
const server = createServer(app);

// Create Jambonz WebSocket endpoint
const { createEndpoint } = require('@jambonz/node-client-ws');
const makeService = createEndpoint({ server });

// Create a Jambonz application listening for requests
const svc = makeService({ path: '/audio-stream' });

// Listen for new calls to the service
svc.on('session:new', (session) => {
  console.log(`new incoming call: ${session.call_sid}`);

  // Set up event handlers for this session
  session
    .on('close', onClose.bind(null, session))
    .on('error', onError.bind(null, session))
    .on('message', onMessage.bind(null, session));
});
```

## Advantages of Using @jambonz/node-client-ws

1. **Official API**: Uses the official Jambonz WebSocket client API
2. **Session-Based**: Clean session-based architecture for handling calls
3. **Better Integration**: Better integration with Jambonz services
4. **Simplified API**: Provides a cleaner API for WebSocket operations
5. **Built-in Features**: Includes Jambonz-specific features and optimizations

## Running Both Servers

You can run both servers simultaneously since they use different ports:

```bash
# Terminal 1 - Original server
yarn dev

# Terminal 2 - WebSocket client server
yarn dev-ws-client
```

## Testing

Both servers can be tested using the same Jambonz webhook configuration, just update the URLs to point to the appropriate server:

- Original server: `http://localhost:3000/jambonz/webhook`
- WebSocket client server: `http://localhost:3001/jambonz/webhook`
