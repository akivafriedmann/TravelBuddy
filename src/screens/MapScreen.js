import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Platform, Dimensions, TouchableOpacity, Text } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { getInitialLocation } from '../services/LocationService';
import { searchNearbyPlaces } from '../services/PlacesService';
import SearchBar from '../components/SearchBar';
import LoadingIndicator from '../components/LoadingIndicator';
import { useNavigation } from '@react-navigation/native';

const BRAND_COLOR = '#1B4D3E';
const HOTEL_COLOR = '#5B3B8C';

const MapScreen = () => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState([]);
  const [region, setRegion] = useState(null);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('restaurant');
  const mapRef = useRef(null);
  const lastSearchedRegion = useRef(null);
  const navigation = useNavigation();

  const categories = [
    { id: 'restaurant', label: 'Restaurants', icon: 'coffee' },
    { id: 'lodging', label: 'Hotels', icon: 'home' },
    { id: 'cafe', label: 'Cafes', icon: 'coffee' },
    { id: 'bar', label: 'Bars', icon: 'moon' },
  ];

  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    try {
      setLoading(true);
      const initialLocation = await getInitialLocation();
      if (initialLocation) {
        setLocation(initialLocation);
        const newRegion = {
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        setRegion(newRegion);
        lastSearchedRegion.current = newRegion;
        await fetchNearbyPlaces(initialLocation);
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyPlaces = async (loc, type = selectedCategory) => {
    try {
      const nearbyPlaces = await searchNearbyPlaces(loc, 1500, type);
      setPlaces(nearbyPlaces);
      setShowSearchButton(false);
    } catch (error) {
      console.error('Failed to load nearby places:', error.message);
    }
  };

  const handleRegionChangeComplete = (newRegion) => {
    if (lastSearchedRegion.current) {
      const distance = getDistance(
        lastSearchedRegion.current.latitude,
        lastSearchedRegion.current.longitude,
        newRegion.latitude,
        newRegion.longitude
      );
      if (distance > 200) {
        setShowSearchButton(true);
      }
    }
    setRegion(newRegion);
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleSearchThisArea = async () => {
    if (region) {
      lastSearchedRegion.current = region;
      await fetchNearbyPlaces({ latitude: region.latitude, longitude: region.longitude });
    }
  };

  const handleMarkerPress = (place) => {
    navigation.navigate('PlaceDetails', { place });
  };

  const handleSearch = async (searchResult) => {
    if (searchResult && searchResult.location) {
      const newRegion = {
        latitude: searchResult.location.latitude,
        longitude: searchResult.location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setRegion(newRegion);
      lastSearchedRegion.current = newRegion;
      mapRef.current?.animateToRegion(newRegion, 1000);
      await fetchNearbyPlaces(searchResult.location);
    }
  };

  const handleCategoryChange = async (categoryId) => {
    setSelectedCategory(categoryId);
    if (region) {
      await fetchNearbyPlaces({ latitude: region.latitude, longitude: region.longitude }, categoryId);
    }
  };

  const getMarkerColor = (place) => {
    if (place.types?.includes('lodging') || place.types?.includes('hotel')) {
      return HOTEL_COLOR;
    }
    return BRAND_COLOR;
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <SearchBar onSearch={handleSearch} />
      </View>

      <View style={styles.categoryContainer}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryPill,
              selectedCategory === cat.id && styles.categoryPillActive
            ]}
            onPress={() => handleCategoryChange(cat.id)}
          >
            <Feather 
              name={cat.icon} 
              size={14} 
              color={selectedCategory === cat.id ? '#fff' : BRAND_COLOR} 
            />
            <Text style={[
              styles.categoryText,
              selectedCategory === cat.id && styles.categoryTextActive
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {region && (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={region}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {places.map((place, index) => (
            <Marker
              key={place.id || place.place_id || index}
              coordinate={{
                latitude: place.geometry?.location?.lat || 0,
                longitude: place.geometry?.location?.lng || 0,
              }}
              title={place.name}
              description={`${place.rating ? '★ ' + place.rating.toFixed(1) : ''} ${place.vicinity || ''}`}
              onPress={() => handleMarkerPress(place)}
              pinColor={getMarkerColor(place)}
            />
          ))}
        </MapView>
      )}

      {showSearchButton && (
        <TouchableOpacity style={styles.searchAreaButton} onPress={handleSearchThisArea}>
          <Feather name="refresh-cw" size={16} color={BRAND_COLOR} />
          <Text style={styles.searchAreaText}>Search This Area</Text>
        </TouchableOpacity>
      )}

      <View style={styles.resultsCount}>
        <Text style={styles.resultsText}>{places.length} places found</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  searchBarContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 10,
    width: '90%',
    alignSelf: 'center',
    zIndex: 10,
  },
  categoryContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 65,
    flexDirection: 'row',
    paddingHorizontal: 16,
    zIndex: 10,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: BRAND_COLOR,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: BRAND_COLOR,
  },
  categoryTextActive: {
    color: '#fff',
  },
  searchAreaButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 115,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    gap: 8,
    zIndex: 10,
  },
  searchAreaText: {
    color: BRAND_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  resultsCount: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  resultsText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default MapScreen;
