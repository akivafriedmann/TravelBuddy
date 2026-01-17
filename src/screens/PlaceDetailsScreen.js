import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  Linking, 
  Platform,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getPlaceDetails } from '../services/PlacesService';

const { width } = Dimensions.get('window');

const PlaceDetailsScreen = ({ route, navigation }) => {
  const { place } = route.params;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    loadDetails();
  }, []);

  const loadDetails = async () => {
    try {
      const placeDetails = await getPlaceDetails(place.place_id || place.id);
      setDetails(placeDetails);
    } catch (error) {
      console.error('Error loading details:', error);
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = () => {
    const lat = place.geometry?.location?.lat;
    const lng = place.geometry?.location?.lng;
    if (!lat || !lng) return;
    
    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q='
    });
    const latLng = `${lat},${lng}`;
    const label = place.name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    
    Linking.openURL(url);
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating || 0);
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Feather 
          key={i} 
          name="star" 
          size={18} 
          color={i < fullStars ? '#FFD700' : '#E0E0E0'} 
        />
      );
    }
    return stars;
  };

  const data = details || place;
  const photos = data.photos || [];

  return (
    <ScrollView style={styles.container}>
      {photos.length > 0 ? (
        <View style={styles.photoContainer}>
          <Image 
            source={{ uri: photos[currentPhotoIndex]?.url || `https://crave-craving-life.replit.app${photos[currentPhotoIndex]?.url}` }} 
            style={styles.heroImage}
            resizeMode="cover"
          />
          {photos.length > 1 && (
            <View style={styles.photoIndicator}>
              <Text style={styles.photoIndicatorText}>{currentPhotoIndex + 1} / {photos.length}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.heroImage, styles.noImage]}>
          <Feather name="image" size={48} color="#ccc" />
          <Text style={styles.noImageText}>No photos available</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.name}>{data.name}</Text>
        
        <View style={styles.ratingRow}>
          <View style={styles.stars}>{renderStars(data.rating)}</View>
          <Text style={styles.ratingText}>{data.rating?.toFixed(1) || 'N/A'}</Text>
          <Text style={styles.reviewCount}>({data.user_ratings_total || 0} reviews)</Text>
        </View>

        <View style={styles.infoRow}>
          <Feather name="map-pin" size={18} color="#1B4D3E" />
          <Text style={styles.address}>{data.vicinity || data.formatted_address}</Text>
        </View>

        {data.opening_hours && (
          <View style={styles.infoRow}>
            <Feather name="clock" size={18} color="#1B4D3E" />
            <Text style={[styles.openStatus, { color: data.opening_hours.open_now ? '#4CAF50' : '#F44336' }]}>
              {data.opening_hours.open_now ? 'Open Now' : 'Closed'}
            </Text>
          </View>
        )}

        {data.formatted_phone_number && (
          <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${data.formatted_phone_number}`)}>
            <Feather name="phone" size={18} color="#1B4D3E" />
            <Text style={styles.phone}>{data.formatted_phone_number}</Text>
          </TouchableOpacity>
        )}

        {data.website && (
          <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(data.website)}>
            <Feather name="globe" size={18} color="#1B4D3E" />
            <Text style={styles.website} numberOfLines={1}>Visit Website</Text>
          </TouchableOpacity>
        )}

        {loading && (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color="#1B4D3E" />
            <Text style={styles.loadingText}>Loading more details...</Text>
          </View>
        )}

        <TouchableOpacity style={styles.directionsButton} onPress={openInMaps}>
          <Feather name="navigation" size={20} color="#fff" />
          <Text style={styles.directionsText}>Get Directions</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  photoContainer: {
    position: 'relative',
  },
  heroImage: {
    width: width,
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  noImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    marginTop: 8,
    color: '#999',
  },
  photoIndicator: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoIndicatorText: {
    color: '#fff',
    fontSize: 12,
  },
  content: {
    padding: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stars: {
    flexDirection: 'row',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#1a1a1a',
  },
  reviewCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  address: {
    flex: 1,
    fontSize: 15,
    color: '#444',
    marginLeft: 12,
  },
  openStatus: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 12,
  },
  phone: {
    fontSize: 15,
    color: '#1B4D3E',
    marginLeft: 12,
  },
  website: {
    fontSize: 15,
    color: '#1B4D3E',
    marginLeft: 12,
    textDecorationLine: 'underline',
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
  },
  directionsButton: {
    backgroundColor: '#1B4D3E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 24,
  },
  directionsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default PlaceDetailsScreen;
