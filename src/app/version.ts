// Version file for tracking builds and forcing cache invalidation
export const VERSION = `v${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

// Function to get the current timestamp as a readable string
export const getTimestamp = () => {
  const now = new Date();
  return now.toISOString();
};

// Debug information for console
export const BUILD_INFO = {
  version: VERSION,
  timestamp: getTimestamp(),
  environment: process.env.NODE_ENV || 'development',
};

// Log build info during server startup
if (typeof window === 'undefined') {
  console.log('🚀 Build info:', BUILD_INFO);
} 