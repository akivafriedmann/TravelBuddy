import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

const BRAND_COLOR = '#1B4D3E';

const PlaceDetails = ({ place, onClose, onViewDetails }) => {
  const getPriceLevel = (priceLevel) => {
    if (!priceLevel && priceLevel !== 0) return '';
    const priceLevels = ['Free', '$', '$$', '$$$', '$$$$'];
    return priceLevels[priceLevel] || '';
  };

  const renderRatingStars = (rating) => {
    if (!rating) return <Text style={styles.noRating}>No ratings yet</Text>;
    
    const fullStars = Math.floor(rating);
    
    return (
      <View style={styles.ratingContainer}>
        {[...Array(5)].map((_, i) => (
          <Feather 
            key={i} 
            name="star" 
            size={16} 
            color={i < fullStars ? '#FFD700' : '#E0E0E0'} 
          />
        ))}
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      </View>
    );
  };

  const openInMaps = () => {
    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q='
    });
    const latLng = `${place.geometry?.location?.lat},${place.geometry?.location?.lng}`;
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
          {place.types && (
            <Text style={styles.type}>
              {place.types.slice(0, 2).map(type => type.replace(/_/g, ' ')).join(' • ')}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Feather name="x" size={24} color="#212121" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={18} color={BRAND_COLOR} style={styles.icon} />
            <Text style={styles.address}>{place.vicinity || place.formatted_address}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Feather name="star" size={18} color={BRAND_COLOR} style={styles.icon} />
            <View>
              {renderRatingStars(place.rating)}
              <Text style={styles.reviewCount}>
                {place.user_ratings_total
                  ? `${place.user_ratings_total} reviews`
                  : 'No reviews yet'}
              </Text>
            </View>
          </View>
          
          {place.price_level !== undefined && (
            <View style={styles.infoRow}>
              <Feather name="dollar-sign" size={18} color={BRAND_COLOR} style={styles.icon} />
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
    fontSize: 13,
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
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  address: {
    flex: 1,
    fontSize: 15,
    color: '#212121',
    lineHeight: 20,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 6,
    fontSize: 15,
    color: '#212121',
    fontWeight: '500',
  },
  noRating: {
    fontSize: 14,
    color: '#757575',
  },
  reviewCount: {
    fontSize: 13,
    color: '#757575',
    marginTop: 2,
  },
  priceLevel: {
    fontSize: 15,
    color: '#212121',
    fontWeight: '500',
  },
  actionsContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    backgroundColor: BRAND_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
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
