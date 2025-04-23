import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { styles as globalStyles } from '../styles/styles';

const LoadingIndicator = ({ message = 'Loading...' }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2196F3" />
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
