import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/auth-store';
import { authService } from '../services/auth';
import { LoginScreen } from '../screens/LoginScreen';
import { MainTabs } from './MainTabs';
import { StoreDetailScreen } from '../screens/StoreDetailScreen';
import { NewOrderScreen } from '../screens/NewOrderScreen';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  StoreDetail: { storeId: string };
  NewOrder: { storeId?: string; storeName?: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, setUser, setToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await authService.getToken();
        if (token) {
          const user = await authService.getStoredUser();
          if (user) {
            setToken(token);
            setUser(user);
          }
        }
      } catch {
        // Token expired or invalid — stay on login
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [setToken, setUser]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#F8FAFC' },
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="StoreDetail"
            component={StoreDetailScreen}
            options={{
              headerShown: true,
              headerTitle: 'Store Details',
              headerStyle: { backgroundColor: '#1E40AF' },
              headerTintColor: '#FFFFFF',
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
          <Stack.Screen
            name="NewOrder"
            component={NewOrderScreen}
            options={{
              headerShown: true,
              headerTitle: 'New Order',
              headerStyle: { backgroundColor: '#1E40AF' },
              headerTintColor: '#FFFFFF',
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});
