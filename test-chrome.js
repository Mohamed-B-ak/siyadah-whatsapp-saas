#!/usr/bin/env node

// Test script to verify Chrome can launch on Render.com
const { deploymentConfig, getBrowserArgs } = require('./server/config/environment.ts');

console.log('=== Chrome Launch Test ===');
console.log('Platform:', deploymentConfig.platform);
console.log('Chrome Path:', deploymentConfig.chromeExecutablePath);
console.log('Browser Args:', getBrowserArgs(deploymentConfig.platform).join(' '));

// Test basic Chrome execution
const { spawn } = require('child_process');

const chrome = spawn(deploymentConfig.chromeExecutablePath, [
  '--version'
], { stdio: 'pipe' });

chrome.stdout.on('data', (data) => {
  console.log('✅ Chrome version:', data.toString().trim());
});

chrome.stderr.on('data', (data) => {
  console.log('❌ Chrome error:', data.toString().trim());
});

chrome.on('close', (code) => {
  console.log(`Chrome test exited with code: ${code}`);
  if (code === 0) {
    console.log('✅ Chrome executable is working');
  } else {
    console.log('❌ Chrome executable failed');
  }
});