const express = require('express');
const cors = require('cors');
const placesRoutes = require('./routes/places');
const geocodingRoutes = require('./routes/geocoding');

const app = express();
const PORT = process.env.PORT || 8000;

// Enable cross-origin requests
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// API routes
app.use('/api/places', placesRoutes);
app.use('/api/geocoding', geocodingRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Root endpoint for checking if server is running
app.get('/', (req, res) => {
  res.status(200).send('Travel API Server is running.');
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
