const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const { WebhookResponse } = require('@jambonz/node-client');
const { createEndpoint } = require('@jambonz/node-client-ws');

const app = express();

// Configuration object (similar to AppConfig)
const AppConfig = {
  PORT: 3001, // Different port to avoid conflicts
  BACKEND_URL: 'http://51.136.97.170:3001',
};

console.log('AppConfig', AppConfig);

const port = AppConfig.PORT;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.raw({ type: 'audio/*' }));

// Store active sessions and call states
const activeSessions = new Map();
const callStates = new Map(); // Track call processing states

// Create HTTP server
const server = createServer(app);

// Create Jambonz WebSocket endpoint
const makeService = createEndpoint({ server });

// Create a Jambonz application listening for requests with URL path '/audio-stream'
const svc = makeService({ path: '/audio' });

// Jambonz webhook endpoint
app.post('/jambonz/webhook', (req, res) => {
  console.log('Received Jambonz webhook:', req.body);

  // Get call SID or create a unique identifier
  const callSid = req.body.call_sid || req.body.callSid || `call_${Date.now()}`;
  const wsUrl = `${AppConfig.BACKEND_URL}/audio-stream`;

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
    activeSessions: activeSessions.size,
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
      if (activeSessions.has(callSid)) {
        const session = activeSessions.get(callSid);
        session.close();
        activeSessions.delete(callSid);
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

// Listen for new calls to the service
svc.on('session:new', (session) => {
  /* the 'session' object has all of the properties of the incoming call */
  console.log({ session }, `new incoming call: ${session.call_sid}`);

  // Store the session and initialize call state
  activeSessions.set(session.call_sid, session);
  callStates.set(session.call_sid, {
    redirectSent: false,
    audioChunksReceived: 0,
    startTime: Date.now(),
  });

  /* set up some event handlers for this session */
  session
    .on('close', onClose.bind(null, session))
    .on('error', onError.bind(null, session))
    .on('message', onMessage.bind(null, session));

  // Send initial connection acknowledgment
  session.send(
    JSON.stringify({
      type: 'connection_ack',
      callSid: session.call_sid,
      message: 'WebSocket connection established for audio streaming',
    }),
  );

  // Set up timer to send redirect command after 5 seconds
  setTimeout(() => {
    const callState = callStates.get(session.call_sid);
    if (
      callState &&
      !callState.redirectSent &&
      activeSessions.has(session.call_sid)
    ) {
      console.log('Sending redirect command for call: ', session.call_sid);

      session.dial({
        answerOnBridge: true,
        target: [
          {
            type: 'phone',
            number: '1111962797073022',
          },
        ],
      });
    }
  }, 5000); // 5 seconds delay
});

// Handle incoming audio data from Jambonz
const onMessage = (session, data) => {
  const callState = callStates.get(session.call_sid);
  if (!callState) return;

  // Echo: Send the received audio data back to Jambonz
  if (Buffer.isBuffer(data)) {
    callState.audioChunksReceived++;

    // Echo the audio back
    session.send(data, (err) => {
      if (err) {
        console.error(`Error echoing audio for call ${session.call_sid}:`, err);
      } else {
        console.log(`Audio echoed back for call ${session.call_sid}`);
      }
    });
  }
};

const onClose = (session, code, reason) => {
  console.log({ session, code, reason }, `session ${session.call_sid} closed`);
  activeSessions.delete(session.call_sid);
  callStates.delete(session.call_sid); // Clean up call state
};

const onError = (session, err) => {
  console.log({ err }, `session ${session.call_sid} received error`);
  activeSessions.delete(session.call_sid);
  callStates.delete(session.call_sid); // Clean up call state
};

// Start the HTTP server
server.listen(port, () => {
  console.log(`Jambonz webhook server (WS Client) running on port ${port}`);
  console.log(`Webhook endpoint: http://localhost:${port}/jambonz/webhook`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`WebSocket endpoint: http://localhost:${port}/audio-stream`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down servers...');

  // Close all active sessions
  activeSessions.forEach((session) => {
    session.close();
  });

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = { app, server, svc };
