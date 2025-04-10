const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const bodyParser = require('body-parser');

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