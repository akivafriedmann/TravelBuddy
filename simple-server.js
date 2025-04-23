// Simple server implementation
const express = require('express');
const app = express();
const path = require('path');

// Load API key from environment or use default
const API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyCcFIrPb2u_y-T_efsH-XaJyc_eQUsYMB8';

// Middleware for parsing JSON
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Nearby places search endpoint
app.get('/api/nearby', async (req, res) => {
  try {
    const { lat, lng, type } = req.query;
    const searchType = type || 'restaurant';
    
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1500&type=${searchType}&key=${API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      error: 'Failed to fetch nearby places' 
    });
  }
});

// Place details endpoint
app.get('/api/details', async (req, res) => {
  try {
    const { place_id } = req.query;
    
    const fields = [
      'name',
      'rating',
      'formatted_address',
      'photos',
      'formatted_phone_number',
      'website',
      'price_level',
      'types',
      'reviews',
      'user_ratings_total'
    ].join(',');
    
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching place details:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      error: 'Failed to fetch place details' 
    });
  }
});

// Photo proxy endpoint
app.get('/api/photo', (req, res) => {
  try {
    const { photoreference, maxwidth } = req.query;
    const width = maxwidth || 400;
    
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?photoreference=${photoreference}&maxwidth=${width}&key=${API_KEY}`;
    
    res.redirect(photoUrl);
  } catch (error) {
    console.error('Error with photo proxy:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      error: 'Failed to proxy photo request' 
    });
  }
});

// Handle all other routes by serving the main HTML file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Travel Planner server running on http://0.0.0.0:${PORT}`);
});