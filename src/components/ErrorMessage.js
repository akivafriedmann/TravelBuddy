import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { styles as globalStyles } from '../styles/styles';

const ErrorMessage = ({ message, onRetry }) => {
  return (
    <View style={styles.container}>
      <Feather name="alert-circle" size={60} color="#f44336" />
      <Text style={styles.errorTitle}>Oops!</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Feather name="refresh-cw" size={18} color="#FFFFFF" style={styles.retryIcon} />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    marginTop: 20,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryIcon: {
    marginRight: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorMessage;
