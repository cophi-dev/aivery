#!/usr/bin/env node

/**
 * This script helps fix the MongoDB Buffer serialization warnings
 * by patching MongoDB's toJSON methods to be safer with Next.js
 */

console.log('🔧 Setting up safer MongoDB serialization for Next.js...');

// Monkey patch the global Object prototype to add a safer toJSON for MongoDB objects
const originalObjectToJSON = Object.prototype.toJSON;

// This runs before MongoDB objects are loaded
Object.prototype.toJSON = function() {
  // Handle Buffer objects which cause issues with Next.js serialization
  if (this && this.buffer && this.buffer instanceof Uint8Array) {
    return this.toString();
  }
  
  // Use the original toJSON if available
  if (originalObjectToJSON) {
    return originalObjectToJSON.call(this);
  }
  
  // Otherwise return the object itself
  return this;
};

console.log('✅ MongoDB serialization patch applied!');
console.log('🚀 Starting Next.js development server...');

// Now start the Next.js server
require('../node_modules/.bin/next'); 