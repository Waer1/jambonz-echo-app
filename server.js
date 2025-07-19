const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const { WebhookResponse } = require('@jambonz/node-client');

const app = express();

// Configuration object (similar to AppConfig)
const AppConfig = {
  PORT: 3000,
  WS_PORT: 8080,
  BACKEND_URL: 'http://51.136.97.170:3000',
  WS_URL: 'ws://51.136.97.170:8080',
};

console.log('AppConfig', AppConfig);

const port = AppConfig.PORT;
const wsPort = AppConfig.WS_PORT;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.raw({ type: 'audio/*' }));

// Store active WebSocket connections and call states
const activeConnections = new Map();
const callStates = new Map(); // Track call processing states

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ port: wsPort });

// Jambonz webhook endpoint
app.post('/jambonz/webhook', (req, res) => {
  console.log('Received Jambonz webhook:', req.body);

  // Get call SID or create a unique identifier
  const callSid = req.body.call_sid || req.body.callSid || `call_${Date.now()}`;
  const wsUrl = `${AppConfig.WS_URL}/audio-stream/${callSid}`;

  // Create WebhookResponse using Jambonz SDK
  const response = new WebhookResponse();

  // Add a listen verb to the response
  response.listen({
    url: wsUrl,
    mixType: 'mono',
    actionHook: `${AppConfig.BACKEND_URL}/jambonz/status`,
    sampleRate: 16000,
    bidirectionalAudio: {
      enabled: true,
      streaming: true,
      sampleRate: 16000,
    },
  });

  console.log('Sending WebhookResponse to Jambonz:', response.toJSON());

  // Send the response as JSON
  res.json(response.toJSON());
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeConnections: activeConnections.size,
  });
});

// Jambonz status endpoint (called by actionHook)
app.post('/jambonz/status', (req, res) => {
  console.log('Received Jambonz status callback:', req.body);

  const callSid = req.body.call_sid || req.body.callSid;
  const status = req.body.listen_status || req.body.status;

  // Handle different status events
  switch (status) {
    case 'started':
      console.log(`Audio streaming started for call: ${callSid}`);
      break;
    case 'finished':
      console.log(`Audio streaming finished for call: ${callSid}`);
      // Clean up if needed
      if (activeConnections.has(callSid)) {
        activeConnections.get(callSid).close();
        activeConnections.delete(callSid);
      }
      callStates.delete(callSid); // Clean up call state
      break;
    case 'error':
      console.error(`Audio streaming error for call: ${callSid}`, req.body);
      break;
    default:
      console.log(`Unknown status for call: ${callSid}`, req.body);
  }

  // Return empty response or additional actions
  const response = new WebhookResponse();
  res.json(response.toJSON());
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const url = req.url;
  const pathParts = url.split('/');
  const callSid = pathParts[pathParts.length - 1];

  console.log(`WebSocket connected for call: ${callSid}`);

  // Store the connection and initialize call state
  activeConnections.set(callSid, ws);
  callStates.set(callSid, {
    redirectSent: false,
    audioChunksReceived: 0,
    startTime: Date.now(),
  });

  // Set up timer to send redirect command after 5 seconds
  setTimeout(() => {
    const callState = callStates.get(callSid);
    if (
      callState &&
      !callState.redirectSent &&
      activeConnections.has(callSid)
    ) {
      console.log('Sending redirect command for call: ', callSid);

      const redirectCommand = {
        type: 'command',
        command: 'redirect',
        queueCommand: false,
        data: [
          {
            verb: 'dial',
            answerOnBridge: true,
            target: [
              {
                type: 'phone',
                number: '1111962797073022',
              },
            ],
          },
        ],
      };

      ws.send(JSON.stringify(redirectCommand), (err) => {
        if (err) {
          console.error(
            `Error sending redirect command for call ${callSid}:`,
            err,
          );
        } else {
          console.log(
            `Redirect command sent for call ${callSid} after 5 seconds`,
          );
          callState.redirectSent = true;
        }
      });
    }
  }, 5000); // 5 seconds delay

  // Handle incoming audio data from Jambonz
  ws.on('message', (data) => {
    const callState = callStates.get(callSid);
    if (!callState) return;

    // Echo: Send the received audio data back to Jambonz
    if (Buffer.isBuffer(data)) {
      callState.audioChunksReceived++;

      // Echo the audio back
      ws.send(data, (err) => {
        if (err) {
          console.error(`Error echoing audio for call ${callSid}:`, err);
        } else {
          console.log(`Audio echoed back for call ${callSid}`);
        }
      });
    }
  }); // Handle WebSocket close
  ws.on('close', () => {
    console.log(`WebSocket disconnected for call: ${callSid}`);
    activeConnections.delete(callSid);
    callStates.delete(callSid); // Clean up call state
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for call ${callSid}:`, error);
    activeConnections.delete(callSid);
    callStates.delete(callSid); // Clean up call state
  });

  // Send initial connection acknowledgment
  ws.send(
    JSON.stringify({
      type: 'connection_ack',
      callSid: callSid,
      message: 'WebSocket connection established for audio streaming',
    }),
  );
});

// Start the HTTP server
server.listen(port, () => {
  console.log(`Jambonz webhook server running on port ${port}`);
  console.log(`WebSocket server running on port ${wsPort}`);
  console.log(`Webhook endpoint: http://localhost:${port}/jambonz-webhook`);
  console.log(`Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down servers...');

  // Close all WebSocket connections
  activeConnections.forEach((ws) => {
    ws.close();
  });

  wss.close(() => {
    console.log('WebSocket server closed');
  });

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = { app, wss };
