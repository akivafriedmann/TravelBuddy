import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { getInitialLocation } from '../services/LocationService';
import { searchNearbyPlaces } from '../services/PlacesService';
import SearchBar from '../components/SearchBar';
import PlaceDetails from '../components/PlaceDetails';
import ErrorMessage from '../components/ErrorMessage';
import LoadingIndicator from '../components/LoadingIndicator';
import { styles as globalStyles } from '../styles/styles';

const MapScreen = () => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [region, setRegion] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    // Initialize location on component mount
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    try {
      setLoading(true);
      const initialLocation = await getInitialLocation();
      if (initialLocation) {
        setLocation(initialLocation);
        setRegion({
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        // Load nearby places when location is available
        await fetchNearbyPlaces(initialLocation);
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyPlaces = async (location) => {
    try {
      const nearbyPlaces = await searchNearbyPlaces(location);
      setPlaces(nearbyPlaces);
    } catch (error) {
      setErrorMsg(`Failed to load nearby places: ${error.message}`);
    }
  };

  const handleMapRegionChange = (newRegion) => {
    setRegion(newRegion);
  };

  const handleMapRegionChangeComplete = async (newRegion) => {
    // Refresh places when map has stopped moving
    try {
      const centerLocation = {
        latitude: newRegion.latitude,
        longitude: newRegion.longitude,
      };
      await fetchNearbyPlaces(centerLocation);
    } catch (error) {
      setErrorMsg(`Failed to update places: ${error.message}`);
    }
  };

  const handleMarkerPress = (place) => {
    setSelectedPlace(place);
  };

  const handleCloseDetails = () => {
    setSelectedPlace(null);
  };

  const handleSearch = async (searchResult) => {
    if (searchResult && searchResult.location) {
      // Update map region to show search result
      const newRegion = {
        latitude: searchResult.location.latitude,
        longitude: searchResult.location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
      
      // Load places around the searched location
      await fetchNearbyPlaces(searchResult.location);
    }
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  if (errorMsg && !location) {
    return <ErrorMessage message={errorMsg} onRetry={initializeLocation} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <SearchBar onSearch={handleSearch} />
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
          onRegionChange={handleMapRegionChange}
          onRegionChangeComplete={handleMapRegionChangeComplete}
        >
          {places.map((place) => (
            <Marker
              key={place.id}
              coordinate={{
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
              }}
              title={place.name}
              description={place.vicinity}
              onPress={() => handleMarkerPress(place)}
              pinColor={place.types.includes('restaurant') ? 'red' : 'blue'}
            />
          ))}
        </MapView>
      )}
      
      {selectedPlace && (
        <PlaceDetails place={selectedPlace} onClose={handleCloseDetails} />
      )}
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
    top: Platform.OS === 'ios' ? 40 : 20,
    width: '90%',
    alignSelf: 'center',
    zIndex: 5,
  },
});

export default MapScreen;
