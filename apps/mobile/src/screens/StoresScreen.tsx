import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { StoreCard, StoreCardData } from '../components/StoreCard';
import { useAuthStore } from '../store/auth-store';
import { useLocationStore } from '../store/location-store';
import { apiGet } from '../services/api';
import { calculateDistance } from '../services/location';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type StoresNavProp = StackNavigationProp<RootStackParamList, 'Main'>;

export const StoresScreen: React.FC = () => {
  const navigation = useNavigation<StoresNavProp>();
  const { user } = useAuthStore();
  const { currentLocation } = useLocationStore();
  const isHindi = user?.preferred_language === 'hi';

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: stores,
    isLoading,
    refetch,
  } = useQuery<StoreCardData[]>({
    queryKey: ['stores', user?.company_id, user?.territory_id],
    queryFn: async () => {
      const data = await apiGet<StoreCardData[]>(
        `/stores?company_id=${user?.company_id}&territory_id=${user?.territory_id}`
      );
      return data;
    },
    enabled: !!user?.company_id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Compute distances and filter by search
  const processedStores = useMemo(() => {
    if (!stores) return [];

    let result = stores.map((store) => {
      let distance_meters = store.distance_meters;
      if (currentLocation) {
        distance_meters = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          store.latitude,
          store.longitude
        );
      }
      return { ...store, distance_meters };
    });

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.owner_name.toLowerCase().includes(query) ||
          s.address.toLowerCase().includes(query)
      );
    }

    // Sort by distance (nearest first)
    result.sort((a, b) => (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity));

    return result;
  }, [stores, searchQuery, currentLocation]);

  const handleStorePress = useCallback(
    (store: StoreCardData) => {
      navigation.navigate('StoreDetail', { storeId: store.id });
    },
    [navigation]
  );

  const renderStore = useCallback(
    ({ item }: { item: StoreCardData }) => (
      <StoreCard store={item} onPress={handleStorePress} />
    ),
    [handleStorePress]
  );

  const keyExtractor = useCallback((item: StoreCardData) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>{'\u{1F50D}'}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={
              isHindi
                ? '\u0926\u0941\u0915\u093E\u0928 \u0916\u094B\u091C\u0947\u0902...'
                : 'Search stores...'
            }
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Text
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              {'\u2715'}
            </Text>
          )}
        </View>
        <Text style={styles.resultCount}>
          {processedStores.length}{' '}
          {isHindi ? '\u0926\u0941\u0915\u093E\u0928\u0947\u0902' : 'stores'}
        </Text>
      </View>

      {/* Store List */}
      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : (
        <FlatList
          data={processedStores}
          renderItem={renderStore}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1E40AF"
              colors={['#1E40AF']}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Text style={styles.emptyIcon}>{'\u{1F3EA}'}</Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? isHindi
                    ? '\u0915\u094B\u0908 \u0926\u0941\u0915\u093E\u0928 \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u0940'
                    : 'No stores found'
                  : isHindi
                    ? '\u0906\u092A\u0915\u0947 \u0915\u094D\u0937\u0947\u0924\u094D\u0930 \u092E\u0947\u0902 \u0915\u094B\u0908 \u0926\u0941\u0915\u093E\u0928 \u0928\u0939\u0940\u0902'
                    : 'No stores in your territory'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
  },
  clearButton: {
    fontSize: 14,
    color: '#94A3B8',
    padding: 4,
  },
  resultCount: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
    fontWeight: '500',
  },
  listContent: {
    paddingVertical: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
