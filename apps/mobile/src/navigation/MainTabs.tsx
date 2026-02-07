import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { StoresScreen } from '../screens/StoresScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

export type MainTabParamList = {
  Home: undefined;
  Tasks: undefined;
  Stores: undefined;
  Orders: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

interface TabIconProps {
  label: string;
  iconChar: string;
  focused: boolean;
  color: string;
}

const TabIcon: React.FC<TabIconProps> = ({ iconChar, focused, color }) => (
  <View style={styles.iconContainer}>
    <Text style={[styles.iconText, { color }]}>{iconChar}</Text>
    {focused && <View style={styles.activeIndicator} />}
  </View>
);

export const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1E40AF',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        tabBarActiveTintColor: '#1E40AF',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: 'OpenSalesAI',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="Home" iconChar={'\u2302'} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          headerTitle: 'My Tasks',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="Tasks" iconChar={'\u2611'} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Stores"
        component={StoresScreen}
        options={{
          headerTitle: 'Stores',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="Stores" iconChar={'\u{1F3EA}'} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          headerTitle: 'Orders',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="Orders" iconChar={'\u{1F4E6}'} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: 'My Profile',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="Profile" iconChar={'\u{1F464}'} focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1E40AF',
    marginTop: 2,
  },
});
