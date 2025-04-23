/**
 * Itinerary routes for saving and retrieving travel itineraries
 */
const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * Get all itineraries
 * GET /itineraries
 */
router.get('/', async (req, res) => {
  try {
    const itineraries = await db.getItineraries();
    res.json(itineraries);
  } catch (error) {
    console.error('Error retrieving itineraries:', error);
    res.status(500).json({ error: 'Failed to retrieve itineraries' });
  }
});

/**
 * Get a specific itinerary by ID
 * GET /itineraries/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const itinerary = await db.getItinerary(req.params.id);
    
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }
    
    res.json(itinerary);
  } catch (error) {
    console.error('Error retrieving itinerary:', error);
    res.status(500).json({ error: 'Failed to retrieve itinerary' });
  }
});

/**
 * Save a new itinerary
 * POST /itineraries
 * Body: { name: string, places: Array }
 */
router.post('/', async (req, res) => {
  try {
    const { name, places } = req.body;
    
    if (!name || !places || !Array.isArray(places) || places.length === 0) {
      return res.status(400).json({ error: 'Invalid itinerary data. Name and places are required.' });
    }
    
    const itineraryId = await db.saveItinerary(name, places);
    res.status(201).json({ id: itineraryId, message: 'Itinerary saved successfully' });
  } catch (error) {
    console.error('Error saving itinerary:', error);
    res.status(500).json({ error: 'Failed to save itinerary' });
  }
});

module.exports = router;