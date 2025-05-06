/**
 * Seed Insights Script
 * This script tests the /api/daily-insight endpoint to verify that
 * the daily insights component is working correctly.
 */

const fetch = require('node-fetch');

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

async function testDailyInsight() {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  console.log(`${colors.cyan}Testing Daily Insight API${colors.reset}`);
  console.log(`Base URL: ${baseUrl}`);

  try {
    // Get session cookie first (if needed)
    console.log(`${colors.blue}Fetching API response...${colors.reset}`);
    const response = await fetch(`${baseUrl}/api/daily-insight`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Format and display the results
    console.log('\n');
    console.log(`${colors.green}✓ API Response Successful${colors.reset}`);
    console.log('\n');
    console.log(`${colors.magenta}=== DAILY INSIGHT CONTENT ===${colors.reset}`);
    console.log(`${colors.yellow}Title:${colors.reset} ${data.title}`);
    console.log(`${colors.yellow}Description:${colors.reset} ${data.description}`);
    console.log(`${colors.yellow}Insight:${colors.reset} ${data.insight}`);
    
    if (data.error) {
      console.log(`${colors.red}Error:${colors.reset} ${data.error.message} (${data.error.type})`);
    }
    
    console.log('\n');
    console.log(`${colors.green}Daily insight test completed successfully!${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset} ${error.message}`);
    process.exit(1);
  }
}

// Run the test
testDailyInsight(); 