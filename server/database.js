/**
 * Simple database module for PostgreSQL connection
 */
const { Client } = require('pg');

// Create a PostgreSQL client
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database connection
async function initDatabase() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');
    
    // Create tables if they don't exist
    await createTables();
    
    return true;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return false;
  }
}

// Create necessary tables
async function createTables() {
  try {
    // Create itineraries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS itineraries (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create places table to store places in itineraries
    await client.query(`
      CREATE TABLE IF NOT EXISTS itinerary_places (
        id SERIAL PRIMARY KEY,
        itinerary_id INTEGER NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
        place_id TEXT NOT NULL,
        name TEXT NOT NULL,
        vicinity TEXT,
        types TEXT[],
        rating NUMERIC,
        photo_url TEXT,
        position INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database tables created or already exist');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

// Save itinerary to database
async function saveItinerary(name, places) {
  try {
    await client.query('BEGIN');
    
    // Insert itinerary
    const itineraryResult = await client.query(
      'INSERT INTO itineraries (name) VALUES ($1) RETURNING id', 
      [name]
    );
    
    const itineraryId = itineraryResult.rows[0].id;
    
    // Insert places
    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      await client.query(
        `INSERT INTO itinerary_places 
        (itinerary_id, place_id, name, vicinity, types, rating, photo_url, position) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          itineraryId, 
          place.place_id, 
          place.name, 
          place.vicinity || '', 
          place.types || [], 
          place.rating || 0,
          place.photo || null,
          i  // Position in the itinerary
        ]
      );
    }
    
    await client.query('COMMIT');
    return itineraryId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving itinerary:', error);
    throw error;
  }
}

// Get all itineraries
async function getItineraries() {
  try {
    const result = await client.query('SELECT * FROM itineraries ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Error getting itineraries:', error);
    throw error;
  }
}

// Get a specific itinerary with its places
async function getItinerary(id) {
  try {
    // Get the itinerary
    const itineraryResult = await client.query('SELECT * FROM itineraries WHERE id = $1', [id]);
    
    if (itineraryResult.rows.length === 0) {
      return null;
    }
    
    const itinerary = itineraryResult.rows[0];
    
    // Get the places for this itinerary
    const placesResult = await client.query(
      'SELECT * FROM itinerary_places WHERE itinerary_id = $1 ORDER BY position',
      [id]
    );
    
    itinerary.places = placesResult.rows;
    
    return itinerary;
  } catch (error) {
    console.error('Error getting itinerary:', error);
    throw error;
  }
}

// Initialize on module load
initDatabase().catch(console.error);

module.exports = {
  client,
  saveItinerary,
  getItineraries,
  getItinerary
};