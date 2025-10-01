const express = require('express');
const path = require('path');
const app = express();
const port = 3002;

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// CORS headers for electron-updater
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.listen(port, () => {
  console.log(`🚀 Update server running at http://localhost:${port}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, 'dist')}`);
});