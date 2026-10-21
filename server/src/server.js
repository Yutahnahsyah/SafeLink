require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');
const server = require('http').createServer(app);
require('./services/realtime').attachRealtime(server);

const PORT = process.env.PORT || 5000;
const HOST = process.env.API_HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB Connected successfully for SafeLink');
    require('./utils/auditLog').startAuditRecovery();
    await require('./services/userRetention').startUserRetention();
    server.listen(PORT, HOST, () => {
      console.log(`SafeLink Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection error:', err);
  });
