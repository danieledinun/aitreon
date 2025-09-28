#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Kill any existing processes
const { exec } = require('child_process');

console.log('🔄 Starting Aitrion Development Server...');
console.log('📍 Working Directory:', process.cwd());

// Clean up any existing processes
exec('pkill -f "next-server" && pkill -f "npm.*dev"', (error) => {
  if (error) {
    console.log('⚠️  No existing processes to clean up');
  } else {
    console.log('✅ Cleaned up existing processes');
  }
  
  setTimeout(() => {
    startServer();
  }, 2000);
});

function startServer() {
  const port = process.env.PORT || 3001;
  console.log(`🚀 Starting Next.js development server on port ${port}...`);
  
  // Start the Next.js development server
  const server = spawn('npx', ['next', 'dev', '--port', port], {
    stdio: 'inherit',
    env: { ...process.env, PORT: port }
  });
  
  server.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
  
  server.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ Server process exited with code ${code}`);
      console.log('🔄 Attempting to restart...');
      setTimeout(() => {
        startServer();
      }, 3000);
    }
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('⚠️  Received SIGTERM, shutting down gracefully...');
    server.kill('SIGTERM');
  });
  
  process.on('SIGINT', () => {
    console.log('⚠️  Received SIGINT, shutting down gracefully...');
    server.kill('SIGINT');
    process.exit(0);
  });
  
  console.log('✅ Server started successfully');
  console.log(`🌐 Open http://localhost:${port}/creator to view dashboard`);
}