const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const placesRoutes = require('./routes/places');
const geocodingRoutes = require('./routes/geocoding');
const itineraryRoutes = require('./routes/itineraries');

const app = express();
const PORT = process.env.PORT || 8000;

// Enable cross-origin requests
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Log all requests and disable caching
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  // Disable caching to ensure fresh content
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Serve static files from the public directory with no caching
app.use(express.static(path.join(__dirname, '../public'), {
  etag: false,
  lastModified: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Dynamically inject the Google Maps API key into the HTML
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    const filePath = path.join(__dirname, '../public/index.html');
    
    // Always read the file directly to get the latest version (no caching)
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading index.html:', err);
        return next();
      }
      
      // Replace the placeholders with the actual API key
      const html = data
        .replace('GOOGLE_MAPS_API_KEY_PLACEHOLDER', process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8')
        .replace('const googleMapsApiKey = \'\';', `const googleMapsApiKey = '${process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8'}';`);
      
      // Ensure we're sending the latest content
      res.type('text/html');
      res.send(html);
      console.log('Sent fresh index.html with injected API key');
    });
  } else {
    next();
  }
});

// API routes - update to non-prefixed paths for client compatibility
app.use('/places', placesRoutes);
app.use('/geocoding', geocodingRoutes);
app.use('/itineraries', itineraryRoutes);

// Keep prefixed routes for backward compatibility
app.use('/api/places', placesRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/itineraries', itineraryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Handle server errors
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
