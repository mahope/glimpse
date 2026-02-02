#!/usr/bin/env node

/**
 * Health check script for Docker container
 * Verifies that the Next.js server is responding
 */

const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  timeout: 5000,
  method: 'GET'
};

const request = http.request(options, (res) => {
  console.log(`Health check response: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('timeout', () => {
  console.error('Health check timeout');
  process.exit(1);
});

request.on('error', (err) => {
  console.error('Health check error:', err.message);
  process.exit(1);
});

request.end();