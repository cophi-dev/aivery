#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to manifest file
const manifestPath = path.join(__dirname, '../public/manifest.json');

try {
  // Read the current manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Generate unique build ID
  const buildId = `build-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  
  // Update the manifest
  manifest.version = `1.0.${Date.now()}`;
  manifest.build_id = buildId;
  manifest.timestamp = new Date().toISOString();
  
  // Write the updated manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  
  console.log(`✅ Manifest updated with build ID: ${buildId}`);
} catch (error) {
  console.error('❌ Error updating manifest:', error);
  process.exit(1);
} 