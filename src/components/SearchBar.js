import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { searchPlace } from '../services/GeocodingService';
import { styles as globalStyles } from '../styles/styles';

const SearchBar = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      const results = await searchPlace(searchQuery);
      if (results && results.length > 0) {
        // Pass the first result to the parent component
        onSearch({
          name: results[0].formatted_address,
          location: {
            latitude: results[0].geometry.location.lat,
            longitude: results[0].geometry.location.lng,
          },
        });
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#757575" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Search for places..."
          placeholderTextColor="#757575"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Feather name="x" size={18} color="#757575" />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity 
        onPress={handleSearch} 
        style={styles.searchButton}
        disabled={loading || !searchQuery.trim()}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Feather name="search" size={20} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#212121',
  },
  clearButton: {
    padding: 5,
  },
  searchButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 10,
    marginLeft: 10,
    height: 48,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
});

export default SearchBar;
