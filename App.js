import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Image, TouchableOpacity, View, StyleSheet } from 'react-native';
import { NativeWindStyleSheet } from "nativewind";
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/HomeScreen';
import SpamScreen from './src/screens/SpamScreen';
import HamScreen from './src/screens/HamScreen';
import SmsScreen from './src/screens/SmsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// NativeWindStyleSheet.setOutput({
//   default: "native",
// });

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          let iconSource;
          if (route.name === 'Home') {
            iconSource = require('./src/assets/icons/home.png');
          } else if (route.name === 'Spam') {
            iconSource = require('./src/assets/icons/spam.png');
          } else if (route.name === 'Ham') {
            iconSource = require('./src/assets/icons/ham.png');
          }
          return (
            <Image
              source={iconSource}
              style={{ width: 24, height: 24, tintColor: focused ? '#7C3AED' : '#ffffff' }}
              resizeMode="contain"
            />
          );
        },
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: '#ffffff',
        tabBarShowLabel: true,
        tabBarStyle: {
          position: 'absolute',
          left: 45,
          right: 45,
          bottom: 16,
          borderRadius: 12,
          backgroundColor: '#151312',
          height: 70,
          paddingBottom: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 8,
          borderTopWidth: 0,
        },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 4,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          marginTop: 2,
          fontWeight: '600',
        },
        headerShown: false,
        tabBarButton: (props) => {
          const { accessibilityState, children, onPress } = props;
          const selected = accessibilityState?.selected;
          return (
            <TouchableOpacity
              onPress={onPress}
              activeOpacity={0.85}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
                marginVertical: 6,
                marginHorizontal: 2,
              }}
            >
              {selected && (
                <Image
                  source={require('./src/assets/images/highlight.png')}
                  style={styles.tabHighlight}
                  resizeMode="contain"
                />
              )}
              <View style={{ zIndex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
            </TouchableOpacity>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Spam" component={SpamScreen} />
      <Tab.Screen name="Ham" component={HamScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabHighlight: {
    position: 'absolute',
    width: 48,
    height: 48,
    top: 6,
    left: '50%',
    marginLeft: -24,
    zIndex: 0,
  },
});

const App = () => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="Sms" component={SmsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App; 