# Travel Planner App

## Overview

This is a comprehensive travel planning application that combines a React Native mobile app with a web-based frontend and Express.js backend. The application helps users discover and explore nearby restaurants, hotels, and other points of interest using Google Maps integration. The system provides location-based search, place details with ratings and reviews, and enhanced features like TripAdvisor data integration and weather information.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Multi-Platform Approach**: The application supports both mobile (React Native/Expo) and web platforms, sharing core functionality while providing platform-specific user experiences.

**React Native Mobile App**:
- Built with Expo framework for cross-platform iOS/Android deployment
- Uses React Navigation with stack navigator for screen management
- Integrates react-native-maps for native map functionality
- Implements location services for user positioning
- Configured for both development and production builds with proper app metadata

**Web Frontend**:
- Vanilla JavaScript with Bootstrap 5 for responsive UI
- Google Maps JavaScript API integration for interactive mapping
- Real-time search and filtering capabilities
- Dark mode support and responsive design
- Progressive enhancement approach for broad browser compatibility

**Map Integration Strategy**:
- Google Maps serves as the primary mapping provider
- Places API integration for location search and discovery
- Custom marker system for place visualization
- Interactive hover and click events for enhanced user experience
- Geolocation API for user positioning

### Backend Architecture

**Express.js Server Framework**:
- RESTful API design with modular route structure
- CORS enabled for cross-origin requests from web frontend
- Static file serving for web application assets
- Request logging and caching control middleware

**API Proxy Pattern**:
- Server-side API key management for security
- Proxied requests to Google Maps APIs (Places, Geocoding, Photos)
- Rate limiting and error handling for external API calls
- Response caching for improved performance

**Route Organization**:
- `/api/nearby` - Place discovery and search (uses New Places API v1 with locationRestriction)
- `/api/geocode` - Address to coordinates conversion
- `/api/details` - Detailed place information
- `/api/photo` - Image proxy for place photos (legacy format)
- `/api/photo-v2` - Image proxy for Places API v1 photos
- `/api/weather` - Weather data integration
- `/api/tripadvisor` - Third-party review data

### Data Storage Solutions

**Client-Side Storage**:
- LocalStorage for user preferences and bookmarks
- Session storage for temporary search state
- Click tracking for personalization features

**Database Architecture**:
- PostgreSQL with connection pooling for scalability
- Drizzle ORM for type-safe database operations
- Neon database service integration for serverless deployment
- Schema-based data modeling with shared types

**Caching Strategy**:
- In-memory caching for frequently accessed API responses
- Photo URL caching to reduce external API calls
- Weather data caching with expiration policies

### Authentication and Authorization

**API Security**:
- Environment-based API key management
- Google Maps API key restrictions by domain/platform
- Server-side proxy to hide sensitive credentials from client
- CORS policies for controlled access

### External Service Integrations

**Google Maps Platform**:
- Maps JavaScript API for web mapping
- Places API for location discovery and details
- Geocoding API for address resolution
- Photos API for place imagery

**Enhanced Data Sources**:
- TripAdvisor integration via web scraping for additional reviews
- OpenWeather API for location-based weather data
- Booking.com integration planning for hotel availability

**Third-Party Services**:
- ScrapingBee API for reliable web scraping
- Bootstrap CDN for UI components
- FontAwesome for icons and visual elements

## Recent Changes (January 2026)

- **Upgraded to New Places API (v1)**: The `/api/nearby` endpoint now uses the New Places API with `locationRestriction` parameter for accurate geographic search results. This ensures searches for restaurants in Amsterdam return Amsterdam restaurants (not US locations).
- **Added Photo API v2 Endpoint**: New `/api/photo-v2` endpoint handles the Places API v1 photo format using the media endpoint.
- **Added Legacy API Fallback**: If the New Places API fails or returns an error, the system automatically falls back to the legacy Text Search API.
- **Cleaned Up Workflows**: Removed unused/broken workflows (BasicServer, ModernPlacesApp).

### Latest Updates (January 16, 2026)

- **Google Photos API Attribution Compliance**:
  - Backend now extracts authorAttributions from Places API v1 responses
  - Photo objects include html_attributions array with clickable contributor links
  - Restaurant cards display photo credits as overlay on thumbnail images
  - Details modal carousel shows photo attribution on each slide
  - CSS styling for attribution overlays with semi-transparent backgrounds

- **TripAdvisor Integration (Cost-Optimized)**:
  - On-demand "Show Rating" button on restaurant cards (API call only when clicked)
  - Displays official TripAdvisor bubble rating image with review count and attribution
  - Uses TripAdvisor owl logo (brand-compliant) for button icon
  - Loading spinner during API fetch, graceful fallback link if API fails
  - Details modal still shows TripAdvisor data with "Read Full Reviews" external link
  - Minimalist styling: white background, thin grey border, dark mode support
  - Domain craving.life approved by TripAdvisor for API access

- **Security Improvements**:
  - Added DOMPurify library for XSS protection on all innerHTML operations
  - Wrapped critical innerHTML usages with sanitizeHTML() to prevent cross-site scripting attacks
  - Updated axios from 1.8.4 to 1.13.2 to fix security vulnerabilities
  - Updated urllib3 from 2.4.0 to 2.6.3 for Python dependencies
  - Removed backup files containing hardcoded API keys

- **Bug Fixes and Code Quality Improvements**:
  - Added new `/api/search` endpoint for place search by name using Google Places Text Search API
  - Fixed TripAdvisor API error handling - gracefully handles 403/unavailable responses without console spam
  - Fixed JSON parse errors when TripAdvisor returns non-JSON responses
  - Migrated from deprecated `google.maps.Marker` to `google.maps.marker.AdvancedMarkerElement`
  - Added proper response validation (status codes, content-type) before parsing API responses

- **Separated Search Bars**: Clear separation between location and restaurant search:
  - Location search bar: Only geocodes cities, addresses, and regions - just moves the map
  - Restaurant search bar: Finds specific restaurants and attractions - shows details card
  - Prevents confusion like searching for "Dijon" and getting a deli instead of the city

- **Mobile Responsiveness Improvements**:
  - Search inputs stack vertically on screens < 768px
  - Map uses disableDefaultUI: true to remove clutter (zoom, street view buttons) on mobile
  - Restaurant cards have compact 180px image height and 16px padding on mobile
  - Action buttons (Near Me, Saved, Filters) use space-evenly distribution on mobile
  - TripAdvisor "Show Rating" button now uses brand green (#00AA6C) instead of gray

- **Soft Premium Map Style**: Updated light mode map style with vivid natural colors:
  - Water areas display with bright sky blue (#4FC3F7) - canals and rivers are clearly visible
  - Parks show with light green (#90EE90) - Vondelpark, Oosterpark visible on map
  - Fixed both initMap and toggleDarkMode to use consistent styling
  - No saturation filters - explicit colors for maximum visibility
  - Clean white roads with simplified highway visibility

- **Premium Charcoal Dark Mode Enhancements**:
  - Deep charcoal background (#121212) for body in dark mode
  - Card backgrounds set to #1E1E1E for subtle contrast
  - Search inputs styled with #2C2C2C background and #E0E0E0 text
  - Header background matches dark theme with #121212
  - Note: Map styling requires Google Cloud Console configuration when using mapId for AdvancedMarkerElement

- **"Crave" Luxury Minimalist Redesign**: Complete UI transformation from Travel Planner to premium "Crave" brand:
  - Playfair Display serif font for headings, Inter for body text
  - Premium color palette: off-white (#F9F9F9), dark charcoal (#1A1A1A), deep teal accent (#1B4D3E)
  - Unified search bar combining location and restaurant search
  - Action buttons row (Near Me, Saved, Filters, Dark mode toggle)
  - Collapsible Filters panel hidden behind Filters button
  - Weather displayed as elegant glassmorphism pill on map
  - Silver/desaturated Google Maps style with hidden POI icons
  - Premium card styling with 200px images, soft shadows, hover lift effect
  - Clean map floating buttons
  - Full-width header and map sections (edge-to-edge)
  - Centered content container (max-width 1300px, 20px side padding) for search, filters, and cards
  - Results section with 40px top padding and #FAFAFA off-white background
  - Category filter pills: no borders, #f0f0f0 background, brand teal when active
  - Weather widget: glassmorphism pill (90% white, blur, subtle shadow)

### Previous Updates (January 13, 2026)

- **Restaurant Card Photos**: Added thumbnail images to all restaurant cards with hover zoom effect
- **Sorting Options**: New dropdown to sort by Rating (highest), Most Reviews, Distance, or Name (A-Z)
- **Results Count**: Shows number of places found (e.g., "19 places found")
- **New Cuisine Categories**: Added French, Thai, Chinese, and Fine Dining filter pills
- **Default Sort**: Results are now sorted by rating (highest first) by default
- **Restaurant Name Search**: Added search box to find specific restaurants by name (e.g., 'Nobu', 'Pizza Hut')
- **My Lists Feature**: Create, rename, and delete custom restaurant lists stored in localStorage
- **Add to List Button**: Purple (+) button on restaurant cards to save to personal lists
- **List View**: Shows saved restaurants with thumbnail photos, addresses, map links, and details button

- **Restaurant Details Modal Redesign**: Complete mobile-app-style redesign:
  - Hero image carousel at top, edge-to-edge, with overlay close (X) button
  - Clean title section with restaurant name, rating badge, price level, and address
  - Action buttons row with circular icons for Call, Website, Directions, Share
  - Collapsible opening hours - shows today's status with accordion to expand full week
  - Removed heavy table borders, using whitespace for cleaner layout
  - Share button copies shareable URL to clipboard
  - Full dark mode support for all modal elements

### Previous Updates (January 4, 2026)

- **Modern UI Overhaul**: Complete redesign inspired by Airbnb/Google Maps with:
  - Horizontal scrollable category pills (rounded, minimal icons)
  - Clean place cards with soft shadows, 16px rounded corners, increased padding
  - Floating favorite heart button on card top-right
  - Clickable cards that open details directly
  - Improved typography (bold names, gray addresses, highlighted ratings)
  - Modern action buttons with icon-only design
  - Map container with rounded corners and shadow
  - CSS variables for consistent theming
  - Full dark mode support
- **TripAdvisor Integration**: Backend ready with Content API integration (requires API key configuration)
- **Favorites System**: Heart icons on place cards to save favorites to localStorage
- **Share Button**: Copy current URL to clipboard with toast notification
- **Browser History Support**: Back/Forward buttons restore previous search state
- **Marker Clustering**: Custom cluster renderer with place count labels and color-coding
- **Shareable URLs**: Implemented URL query parameters (lat, lng, type) that auto-restore search location and type when sharing or bookmarking pages.
- **Skeleton Loading**: Added skeleton card placeholders with CSS animations during data fetching for better perceived performance.
- **Marker Clustering**: Integrated @googlemaps/markerclusterer CDN library to group nearby markers for cleaner map display.
- **Mobile Bottom Sheet**: Added responsive CSS styling for mobile screens (<768px) with bottom sheet layout for place listings.
- **Modular Architecture**: Created ES6 module structure (public/services/, public/ui/) for future code organization improvements.

## External Dependencies

### Core APIs
- **Google Maps Platform**: Maps JavaScript API, Places API (v1 and legacy), Geocoding API, Photos API
- **OpenWeather API**: Weather data service
- **TripAdvisor**: Review and rating data (via web scraping)

### Development Framework
- **React Native/Expo**: Mobile app framework
- **Express.js**: Backend web framework
- **PostgreSQL/Neon**: Database services

### UI/UX Libraries
- **Bootstrap 5**: CSS framework for responsive design
- **FontAwesome**: Icon library
- **React Navigation**: Mobile navigation framework
- **Google Maps React Native**: Native map components

### Build and Deployment
- **Babel**: JavaScript transpilation
- **Metro**: React Native bundler
- **Node.js**: Runtime environment
- **npm**: Package management

### Optional Services
- **ScrapingBee**: Web scraping API service
- **Booking.com API**: Hotel booking integration (planned)
- **Flight APIs**: Flight search integration (experimental)