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
- **Premium Guidebook Lists**: Slide-over drawer with glassmorphism styling replaces center modal, guidebook cards display background images from first restaurant, hover reveals share/delete buttons, "Save" button in place details modal with popup for list selection or quick-create, share button copies text summary to clipboard.
- **Interactive Maps**: Custom marker clustering, advanced marker elements, and customizable map styles (e.g., "Architectural," "Soft Premium," "Premium Charcoal Dark Mode").
- **UI/UX**: Modern, minimalist luxury design ("Crave" brand), responsive layouts, dark mode, skeleton loading for perceived performance, and a redesigned "magazine editorial" details modal with hero image carousels, serif typography (Playfair Display), compact metadata row (rating • price • status), icon pill action buttons, solid brand green TripAdvisor CTA, and truncated reviews with "Read more" functionality.
- **Security**: XSS protection using DOMPurify, updated dependencies (axios, urllib3) for vulnerability fixes, and secure handling of API keys.
- **Search Experience**: Separated search bars for location (geocoding) and specific places (restaurants/attractions) to improve user clarity.
- **Sorting & Filtering**: Options to sort results by rating, reviews, distance, or name, with category filter pills.
- **Vibe Filters**: Mood-based search options including:
  - **Date Dinner**: Romantic candlelit restaurants (fa-utensils + fa-heart)
  - **Date Drinks**: Cocktail bars, wine bars, speakeasies with special bar-type filtering (fa-martini-glass + fa-heart)
  - **Trendy**: Popular modern hotspots
  - **Business**: Quiet professional lunch spots
  - **Views**: Rooftop/view restaurants
  - **Hidden Gem**: Local favorites off the beaten path
- **Smart Snippets**: Result cards display contextual review excerpts or editorial summaries matching search keywords, with special prioritization for date bar keywords (intimate, cozy, speakeasy, dim lighting).
- **Premium Date Spot Badge**: $$$ and $$$$ bars in Date Drinks mode display a glowing purple "Premium Date Spot" badge.
- **Speakeasy Boost**: Places with "speakeasy" in their name are prioritized in Date Drinks mode.
- **Accessibility**: Mobile responsiveness improvements including stacked inputs, compact cards, and optimized modal displays.
- **Shareable URLs**: Hash routing (#/place/{place_id}) enables sharing links that open directly to a place's details modal.
- **Travel Essentials Modal**: Header button with eSIM (Airalo) and Travel Insurance (SafetyWing) affiliate cards for passive revenue.
- **Google Analytics (GA4)**: Event tracking for filter selections (select_content) and lead generation (generate_lead) on Booking.com, TripAdvisor, eSIM, and Insurance button clicks. Placeholder ID: G-XXXXXXXXXX.

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