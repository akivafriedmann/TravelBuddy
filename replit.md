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
- `/api/nearby` - Place discovery and search
- `/api/geocode` - Address to coordinates conversion
- `/api/details` - Detailed place information
- `/api/photo` - Image proxy for place photos
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

## External Dependencies

### Core APIs
- **Google Maps Platform**: Maps JavaScript API, Places API, Geocoding API, Photos API
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