import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { styles as globalStyles } from '../styles/styles';

const PlaceDetails = ({ place, onClose }) => {
  // Format price level
  const getPriceLevel = (priceLevel) => {
    if (!priceLevel && priceLevel !== 0) return 'Price not available';
    const priceLevels = ['Free', '$', '$$', '$$$', '$$$$'];
    return priceLevels[priceLevel] || 'Price not available';
  };

  // Format rating stars
  const renderRatingStars = (rating) => {
    if (!rating) return 'No ratings yet';
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <View style={styles.ratingContainer}>
        {[...Array(fullStars)].map((_, i) => (
          <Feather key={`full-${i}`} name="star" size={16} color="#FFC107" />
        ))}
        {hasHalfStar && <Feather name="star" size={16} color="#FFC107" style={{ opacity: 0.5 }} />}
        {[...Array(emptyStars)].map((_, i) => (
          <Feather key={`empty-${i}`} name="star" size={16} color="#E0E0E0" />
        ))}
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      </View>
    );
  };

  // Open directions in Google Maps
  const openInMaps = () => {
    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q='
    });
    const latLng = `${place.geometry.location.lat},${place.geometry.location.lng}`;
    const label = place.name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>{place.name}</Text>
          <Text style={styles.type}>
            {place.types?.map(type => type.replace('_', ' ')).join(', ')}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Feather name="x" size={24} color="#212121" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={20} color="#2196F3" style={styles.icon} />
            <Text style={styles.address}>{place.vicinity || place.formatted_address}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Feather name="star" size={20} color="#2196F3" style={styles.icon} />
            <View>
              {renderRatingStars(place.rating)}
              <Text style={styles.reviewCount}>
                {place.user_ratings_total
                  ? `${place.user_ratings_total} reviews`
                  : 'No reviews yet'}
              </Text>
            </View>
          </View>
          
          {(place.price_level !== undefined) && (
            <View style={styles.infoRow}>
              <Feather name="dollar-sign" size={20} color="#2196F3" style={styles.icon} />
              <Text style={styles.priceLevel}>{getPriceLevel(place.price_level)}</Text>
            </View>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={openInMaps}>
          <Feather name="navigation" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginTop: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 5,
  },
  type: {
    fontSize: 14,
    color: '#757575',
    textTransform: 'capitalize',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    marginTop: 15,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  icon: {
    marginRight: 15,
    marginTop: 2,
  },
  address: {
    flex: 1,
    fontSize: 16,
    color: '#212121',
    lineHeight: 22,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 5,
    fontSize: 16,
    color: '#212121',
    fontWeight: '500',
  },
  reviewCount: {
    fontSize: 14,
    color: '#757575',
    marginTop: 3,
  },
  priceLevel: {
    fontSize: 16,
    color: '#212121',
  },
  actionsContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    flex: 1,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
});

export default PlaceDetails;
