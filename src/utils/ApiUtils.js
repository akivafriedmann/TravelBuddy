import Constants from 'expo-constants';

const getApiBaseUrl = () => {
  if (__DEV__) {
    return 'https://crave-craving-life.replit.app/api';
  }
  return 'https://crave-craving-life.replit.app/api';
};

const API_BASE_URL = getApiBaseUrl();

export const apiCall = async (endpoint, params = {}) => {
  try {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: 'An unknown error occurred'
      }));
      throw new Error(errorData.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API call error (${endpoint}):`, error);
    throw error;
  }
};
