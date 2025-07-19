# Jambonz WebSocket Streaming App

This Node.js application provides a webhook endpoint for Jambonz using the official Jambonz SDK and WebSocket streaming functionality for real-time audio processing.

## Features

- **Jambonz SDK Integration**: Uses `@jambonz/node-client` for proper webhook responses
- **Jambonz Webhook Endpoint**: Receives webhook calls from Jambonz and returns a `listen` command with bidirectional audio streaming
- **WebSocket Audio Streaming**: Handles real-time audio streaming from Jambonz with proper configuration
- **Status Callbacks**: Handles Jambonz status callbacks for streaming events
- **Call Redirect**: Automatically redirects calls to a specified phone number after processing audio
- **Real-time Audio Processing**: Processes incoming audio streams without saving to disk
- **Health Check**: Simple health monitoring endpoint

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## Endpoints

### HTTP Endpoints

#### POST /jambonz-webhook
- **Purpose**: Webhook endpoint for Jambonz using SDK WebhookResponse
- **Response**: Returns a properly formatted `listen` verb with bidirectional audio streaming
- **Example Response**:
```json
[
  {
    "verb": "listen",
    "url": "ws://localhost:8001/audio-stream/call_123456",
    "mixType": "mono",
    "actionHook": "http://localhost:8000/jambonz/status",
    "sampleRate": 16000,
    "bidirectionalAudio": {
      "enabled": true,
      "streaming": true,
      "sampleRate": 16000
    }
  }
]
```

#### POST /jambonz/status
- **Purpose**: Status callback endpoint for Jambonz streaming events
- **Handles**: `started`, `finished`, `error` status events
- **Response**: Empty WebhookResponse array

#### GET /health
- **Purpose**: Health check endpoint
- **Response**: Server status and active connections count

### WebSocket Endpoints

#### ws://localhost:3001/audio-stream/{callSid}
- **Purpose**: Audio streaming endpoint for each call
- **Functionality**:
  - Receives real-time audio data from Jambonz
  - Saves audio chunks to `audio_chunks/` directory
  - Provides foundation for real-time audio processing

## Configuration

### Environment Variables

- `PORT`: HTTP server port (default: 3000)
- `WS_PORT`: WebSocket server port (default: 3001)

### Example
```bash
PORT=4000 WS_PORT=4001 npm start
```

## How It Works

1. **Webhook Flow**:
   - Jambonz sends a POST request to `/jambonz-webhook`
   - The server responds with a `listen` command containing the WebSocket URL
   - Jambonz connects to the specified WebSocket URL

2. **Audio Streaming**:
   - Jambonz establishes a WebSocket connection
   - Real-time audio data is streamed through the WebSocket
   - Audio chunks are saved to files for processing
   - Connection is tracked and managed

3. **Processing**:
   - Audio chunks are saved to `audio_chunks/` directory
   - Each chunk is named with call ID and timestamp
   - Foundation provided for real-time audio processing

## Directory Structure

```
.
├── server.js              # Main application file
├── package.json           # Dependencies and scripts
├── audio_chunks/          # Directory for saved audio chunks (auto-created)
└── README.md             # This file
```

## Testing

### Test the Webhook Endpoint
```bash
curl -X POST http://localhost:3000/jambonz-webhook \
  -H "Content-Type: application/json" \
  -d '{"call_sid": "test_call_123"}'
```

### Test Health Check
```bash
curl http://localhost:3000/health
```

### Test WebSocket Connection
You can use a WebSocket client to connect to:
```
ws://localhost:3001/audio-stream/test_call_123
```

## Integration with Jambonz

To integrate this with Jambonz:

1. Configure your Jambonz application to use the webhook URL:
   ```
   http://your-server-domain:3000/jambonz-webhook
   ```

2. Jambonz will automatically connect to the WebSocket URL returned by the webhook

3. Audio will be streamed in real-time through the WebSocket connection

## Customization

### Audio Processing
Modify the WebSocket message handler in `server.js` to add your custom audio processing logic:

```javascript
ws.on('message', (data) => {
  // Your custom audio processing here
  processAudioData(data, callSid);
});
```

### Response Format
Customize the webhook response by modifying the response object in the `/jambonz-webhook` endpoint.

## License

MIT
