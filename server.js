const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const bodyParser = require('body-parser');

// Import and load the LLM standardization module
// This needs to be loaded prior to Next.js initialization
console.log('🔄 Loading LLM configuration...');
try {
  // Will be built by Next.js during development/build
  const llmConfig = require('./src/lib/services/llm-config');
  
  // Standardize all LLM models to use a consistent provider/model
  llmConfig.ensureStandardModels();
  
  // Validate OpenAI API key is present
  if (!llmConfig.validateApiKeyConfig()) {
    console.warn('\n⚠️  WARNING: OPENAI_API_KEY is not properly configured in environment variables!');
    console.warn('   LLM features may not work correctly.');
    
    // Set up backup API keys if available
    if (process.env.GROK_API_KEY) {
      console.log('🔑 Found GROK_API_KEY, will use as fallback');
      process.env.LLM_PROVIDER = 'grok';
      process.env.LLM_PROVIDER_CHAT = 'grok';
    } else if (process.env.GEMINI_API_KEY) {
      console.log('🔑 Found GEMINI_API_KEY, will use as fallback');
      // Note: Gemini support is currently stubbed in the llm.ts service
      process.env.LLM_PROVIDER = 'gemini';
      process.env.LLM_PROVIDER_CHAT = 'gemini';
    } else {
      console.warn('❌ No fallback API keys found. Chat functionality will use generic responses.');
    }
  } else {
    console.log(`✅ LLM standardized to ${llmConfig.getStandardProvider()} (${llmConfig.getStandardModel()})`);
  }
} catch (error) {
  console.error('❌ Failed to load LLM configuration:', error.message);
  console.warn('⚠️  WARNING: LLM standardization failed! Features may use inconsistent models.');
  console.log('🔄 Continuing server startup with default configuration...');
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // Be sure to pass `true` as the second argument to `url.parse`.
      // This tells it to parse the query portion of the URL.
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      // Special handling for the Strava import endpoint to support large uploads
      // This overrides the default 4MB limit of Next.js API routes
      if (pathname === '/api/strava/import' || pathname.startsWith('/api/strava/import/')) {
        console.log('Using custom request handling for Strava import with increased size limit');
        res.setHeader('x-handled-by', 'custom-server');
        
        // Increase the limit to 50MB for this specific endpoint
        bodyParser.json({ limit: '50mb' })(req, res, (err) => {
          if (err) {
            console.error('Error parsing JSON:', err);
            res.statusCode = 413;
            res.end('Request Entity Too Large');
            return;
          }
          
          // Pass off to normal Next.js handler after pre-processing
          handle(req, res, parsedUrl);
        });
      } else {
        // For all other routes, use the standard Next.js handler
        await handle(req, res, parsedUrl);
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
}); 