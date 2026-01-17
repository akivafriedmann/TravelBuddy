import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

const BRAND_COLOR = '#1B4D3E';

const LoadingIndicator = ({ message = 'Finding great places...' }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={BRAND_COLOR} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#757575',
  },
});

export default LoadingIndicator;
