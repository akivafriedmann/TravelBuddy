import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MapScreen from './src/screens/MapScreen';
import PlaceDetailsScreen from './src/screens/PlaceDetailsScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator 
          initialRouteName="Map"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1B4D3E',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontFamily: 'System',
            },
          }}
        >
          <Stack.Screen 
            name="Map" 
            component={MapScreen} 
            options={{ 
              title: 'Crave',
              headerTitleStyle: {
                fontWeight: 'bold',
                fontSize: 22,
              },
            }}
          />
          <Stack.Screen 
            name="PlaceDetails" 
            component={PlaceDetailsScreen} 
            options={({ route }) => ({ 
              title: route.params?.place?.name || 'Details',
            })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
