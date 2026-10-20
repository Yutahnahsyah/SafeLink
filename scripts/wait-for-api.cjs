const net = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');

// server.js only opens this port after MongoDB has connected.
async function waitForApi({ host = '127.0.0.1', port = 5000, timeoutMs = 60000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const connected = await new Promise(resolve => {
      const socket = net.createConnection({ host, port });
      const finish = ready => { socket.destroy(); resolve(ready); };
      socket.setTimeout(Math.min(1000, Math.max(1, deadline - Date.now())));
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
      socket.once('timeout', () => finish(false));
    });
    if (connected) return;
    await delay(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
  }
  throw new Error(`SafeLink API did not start at ${host}:${port} within ${timeoutMs / 1000}s. Check the SERVER output and MongoDB connection. Run npm run dev from the project root to start both services.`);
}

if (require.main === module) {
  console.log('Waiting for SafeLink API at 127.0.0.1:5000 before starting Vite...');
  waitForApi().then(() => console.log('SafeLink API is ready. Starting Vite.')).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { waitForApi };
