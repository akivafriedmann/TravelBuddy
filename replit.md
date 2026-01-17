# Travel Planner App

## Overview
This project is a comprehensive travel planning application featuring a React Native mobile app and a web-based frontend with an Express.js backend. It enables users to discover restaurants, hotels, and points of interest using Google Maps integration. Key capabilities include location-based search, detailed place information with ratings and reviews, TripAdvisor data, and weather information. The business vision is to provide a seamless and enhanced travel discovery experience, aiming for market potential in both local exploration and travel planning sectors.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application uses a multi-platform approach with React Native/Expo for mobile (iOS/Android) and vanilla JavaScript with Bootstrap 5 for the web frontend. Both share core functionality while providing platform-specific experiences. Google Maps Platform is central, integrating Maps JavaScript API, Places API for search, custom markers, and interactive map features, alongside geolocation for user positioning. UI/UX focuses on a minimalist luxury design, dark mode support, and responsive layouts, employing Playfair Display and Inter fonts, and a premium color palette.

### Backend Architecture
An Express.js server provides a RESTful API, acting as an API proxy for secure and rate-limited access to external services. It features modular routes, CORS enablement, static file serving, and response caching. Key routes handle nearby place discovery (using New Places API v1 with fallback to legacy Text Search), geocoding, place details, photo proxies (for both v1 and legacy Places API formats), weather data, and TripAdvisor integration.

### Data Storage and Caching
Client-side storage utilizes LocalStorage for preferences and bookmarks, and sessionStorage for temporary states. The database architecture relies on PostgreSQL with Drizzle ORM and Neon for serverless deployment, using a schema-based data model. Caching strategies include in-memory caching for API responses, photo URL caching, and time-based expiration for weather data.

### Authentication and Authorization
API security is managed through environment-based API keys, Google Maps API key restrictions, and a server-side proxy to safeguard credentials. CORS policies enforce controlled access.

### Core Features
- **Place Search & Discovery**: Location-based search with `locationRestriction` for accuracy.
- **Detailed Place Information**: Provides ratings, reviews, opening hours, contact info, and photos.
- **Enhanced Data**: Integrates TripAdvisor reviews (on-demand via "Show Rating" button for cost optimization) and OpenWeather API for local weather.
- **User Personalization**: Favorites system via localStorage, custom lists, and shareable URLs.
- **Interactive Maps**: Custom marker clustering, advanced marker elements, and customizable map styles (e.g., "Architectural," "Soft Premium," "Premium Charcoal Dark Mode").
- **UI/UX**: Modern, minimalist luxury design ("Crave" brand), responsive layouts, dark mode, skeleton loading for perceived performance, and a redesigned mobile-app-style details modal with hero image carousels.
- **Security**: XSS protection using DOMPurify, updated dependencies (axios, urllib3) for vulnerability fixes, and secure handling of API keys.
- **Search Experience**: Separated search bars for location (geocoding) and specific places (restaurants/attractions) to improve user clarity.
- **Sorting & Filtering**: Options to sort results by rating, reviews, distance, or name, with category filter pills.
- **Accessibility**: Mobile responsiveness improvements including stacked inputs, compact cards, and optimized modal displays.

## External Dependencies

### Core APIs
- **Google Maps Platform**: Maps JavaScript API, Places API (v1 and legacy), Geocoding API, Photos API.
- **OpenWeather API**: For fetching weather data.
- **TripAdvisor**: For review and rating data (integrated via web scraping).

### Development Frameworks
- **React Native/Expo**: For mobile application development.
- **Express.js**: For the backend web server.
- **PostgreSQL/Neon**: For database services.

### UI/UX Libraries
- **Bootstrap 5**: CSS framework.
- **FontAwesome**: Icon library.
- **React Navigation**: For mobile app navigation.
- **Google Maps React Native**: For native map components in React Native.

### Optional Services
- **ScrapingBee**: Used for reliable web scraping for services like TripAdvisor.

## Mobile App (React Native/Expo)

### Testing the Mobile App
1. Open the Expo Go app on your phone (download from App Store/Play Store)
2. The CraveMobile workflow shows a QR code in the console logs
3. Scan the QR code with Expo Go (Android) or Camera app (iOS)
4. The Crave mobile app will load on your device

### Mobile App Features
- **Map View**: Full-screen Google Maps with restaurant/hotel markers
- **Category Pills**: Filter by Restaurants, Hotels, Cafes, Bars
- **Search This Area**: Button appears when you pan the map to search new locations
- **Place Details**: Tap any marker to see full details including photos, ratings, hours
- **Directions**: Get directions to any place via native maps app
- **Brand Colors**: Deep emerald green (#1B4D3E) for restaurants, purple (#5B3B8C) for hotels

### Mobile App Architecture
- **App.js**: Main entry with Stack Navigator
- **src/screens/MapScreen.js**: Main map view with markers and search
- **src/screens/PlaceDetailsScreen.js**: Detailed place info with photos
- **src/services/PlacesService.js**: API calls to backend
- **src/services/LocationService.js**: Device GPS handling

### Backend API (Production)
The mobile app connects to: https://crave-craving-life.replit.app/api