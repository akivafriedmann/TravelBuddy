const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// API key (from environment or default value)
const API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';

// MIME types for serving static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Server port
const PORT = 5000;

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  
  console.log(`${new Date().toISOString()} - ${req.method} ${pathname}`);

  // API routes
  if (pathname === '/api/nearby') {
    try {
      const { lat, lng, type = 'restaurant' } = query;
      
      if (!lat || !lng) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ERROR', error: 'Missing required parameters' }));
        return;
      }
      
      const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1500&type=${type}&key=${API_KEY}`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (error) {
      console.error('Error fetching nearby places:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ERROR', error: 'Failed to fetch nearby places' }));
    }
    return;
  }
  
  // Place details endpoint
  if (pathname === '/api/details') {
    try {
      const { place_id } = query;
      
      if (!place_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ERROR', error: 'Missing place_id parameter' }));
        return;
      }
      
      const fields = [
        'name', 'rating', 'formatted_address', 'photos',
        'formatted_phone_number', 'website', 'price_level',
        'types', 'reviews', 'user_ratings_total'
      ].join(',');
      
      const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${API_KEY}`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (error) {
      console.error('Error fetching place details:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ERROR', error: 'Failed to fetch place details' }));
    }
    return;
  }
  
  // Photo proxy endpoint
  if (pathname === '/api/photo') {
    try {
      const { photoreference, maxwidth = 400 } = query;
      
      if (!photoreference) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ERROR', error: 'Missing photoreference parameter' }));
        return;
      }
      
      const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?photoreference=${photoreference}&maxwidth=${maxwidth}&key=${API_KEY}`;
      
      // Redirect to Google's photo URL
      res.writeHead(302, { 'Location': photoUrl });
      res.end();
    } catch (error) {
      console.error('Error with photo proxy:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ERROR', error: 'Failed to proxy photo request' }));
    }
    return;
  }
  
  // Serve static files from public directory
  let filePath = pathname;
  
  // Convert URL path to file path
  if (pathname === '/') {
    filePath = '/index.html';
  }
  
  filePath = path.join(__dirname, 'public', filePath);
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // File not found, serve index.html (for SPA routing)
      const indexPath = path.join(__dirname, 'public', 'index.html');
      
      fs.readFile(indexPath, (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }
    
    // Read and serve the file
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }
      
      // Determine content type based on file extension
      const extname = path.extname(filePath);
      const contentType = MIME_TYPES[extname] || 'application/octet-stream';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Travel Planner server running on http://0.0.0.0:${PORT}`);
});