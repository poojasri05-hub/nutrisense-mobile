import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, Linking
} from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import COLORS from '../theme/colors';

export default function RestaurantScreen() {
  const [location, setLocation]       = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [view, setView]               = useState('list');
  const [filter, setFilter]           = useState('all');

  useEffect(() => {
    getLocationAndFetch();
  }, []);

  const getLocationAndFetch = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location access is needed to find nearby restaurants');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc.coords);
      await fetchRestaurants(loc.coords.latitude, loc.coords.longitude);
    } catch (e) {
      Alert.alert('Error', 'Could not get location');
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurants = async (lat, lon) => {
    try {
      const query = `
        [out:json][timeout:25];
        (
          node["amenity"="restaurant"](around:5000,${lat},${lon});
          node["amenity"="cafe"](around:5000,${lat},${lon});
          node["amenity"="fast_food"](around:5000,${lat},${lon});
        );
        out body 30;
      `;

      const urls = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      ];

      let data = null;

      for (const url of urls) {
        try {
          console.log('Trying:', url);
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(query)}`,
          });

          const text = await response.text();
          console.log('Response start:', text.slice(0, 100));

          if (text.trim().startsWith('{')) {
            data = JSON.parse(text);
            console.log('Success from:', url, 'Elements:', data.elements?.length);
            break;
          } else {
            console.log('Not JSON from:', url);
          }
        } catch (e) {
          console.log('Failed:', url, e.message);
        }
      }

      if (!data || !data.elements) {
        throw new Error('All APIs failed');
      }

      const places = data.elements
        .filter(el => el.tags?.name)
        .map(el => ({
          id:       el.id.toString(),
          name:     el.tags.name,
          type:     el.tags.amenity,
          cuisine:  el.tags.cuisine || 'Restaurant',
          address:  el.tags['addr:street'] || el.tags['addr:full'] || 'Nearby',
          phone:    el.tags.phone || null,
          website:  el.tags.website || null,
          veggie:   el.tags.diet_vegetarian === 'yes' || el.tags.diet_vegan === 'yes',
          lat:      el.lat,
          lon:      el.lon,
          distance: getDistance(lat, lon, el.lat, el.lon),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20);

      if (places.length === 0) {
        console.log('No OSM results, using mock data');
        setRestaurants(getMockRestaurants(lat, lon));
      } else {
        setRestaurants(places);
      }

    } catch (e) {
      console.error('Restaurant fetch error:', e);
      setRestaurants(getMockRestaurants(lat, lon));
    }
  };

  const getMockRestaurants = (lat, lon) => [
    { id: '1', name: 'Murugan Idli Shop',       type: 'restaurant', cuisine: 'South Indian', address: 'Town Hall Road',      veggie: true,  lat: lat + 0.002, lon: lon + 0.001, distance: 220  },
    { id: '2', name: 'Annapoorna Restaurant',    type: 'restaurant', cuisine: 'South Indian', address: 'Nethaji Road',        veggie: true,  lat: lat - 0.001, lon: lon + 0.002, distance: 350  },
    { id: '3', name: 'Junior Kuppanna',          type: 'restaurant', cuisine: 'Tamil Nadu',   address: 'Bypass Road',        veggie: false, lat: lat + 0.003, lon: lon - 0.001, distance: 480  },
    { id: '4', name: 'Saravana Bhavan',          type: 'restaurant', cuisine: 'South Indian', address: 'Simakkal',           veggie: true,  lat: lat - 0.002, lon: lon - 0.002, distance: 560  },
    { id: '5', name: 'Hotel Tamilnadu',          type: 'restaurant', cuisine: 'Indian',       address: 'Madurai Main Road',  veggie: false, lat: lat + 0.004, lon: lon + 0.003, distance: 720  },
    { id: '6', name: 'Subways',                  type: 'fast_food',  cuisine: 'Sandwiches',   address: 'Mall Road',          veggie: false, lat: lat - 0.003, lon: lon + 0.004, distance: 890  },
    { id: '7', name: 'Green Leaf Cafe',          type: 'cafe',       cuisine: 'Healthy',      address: 'Anna Nagar',         veggie: true,  lat: lat + 0.005, lon: lon - 0.002, distance: 1050 },
    { id: '8', name: 'Juice Junction',           type: 'cafe',       cuisine: 'Beverages',    address: 'KK Nagar',           veggie: true,  lat: lat - 0.004, lon: lon - 0.003, distance: 1200 },
    { id: '9', name: 'Amma Mess',                type: 'restaurant', cuisine: 'South Indian', address: 'Tallakulam',         veggie: false, lat: lat + 0.006, lon: lon + 0.002, distance: 1350 },
    { id: '10', name: 'Sri Krishna Sweet Stall', type: 'fast_food',  cuisine: 'Sweets',       address: 'West Masi Street',   veggie: true,  lat: lat - 0.005, lon: lon + 0.003, distance: 1480 },
  ];

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const openMaps = (restaurant) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${restaurant.lat},${restaurant.lon}`;
    Linking.openURL(url);
  };

  const getTypeIcon = (type) => {
    if (type === 'cafe')      return '☕';
    if (type === 'fast_food') return '🍔';
    return '🍽️';
  };

  const getTypeLabel = (type) => {
    if (type === 'cafe')      return 'Café';
    if (type === 'fast_food') return 'Fast Food';
    return 'Restaurant';
  };

  const filteredRestaurants = restaurants.filter(r => {
    if (filter === 'veg')     return r.veggie;
    if (filter === 'healthy') return r.type === 'restaurant';
    return true;
  });

  const getMapHTML = () => {
    if (!location) return '<h3>Loading map...</h3>';

    const markers = filteredRestaurants.map(r => `
      L.marker([${r.lat}, ${r.lon}])
        .addTo(map)
        .bindPopup('<b>${r.name.replace(/'/g, "\\'")}</b><br>${getTypeLabel(r.type)}<br>${r.distance}m away');
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { width: 100vw; height: 100vh; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([${location.latitude}, ${location.longitude}], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          L.circleMarker([${location.latitude}, ${location.longitude}], {
            radius: 10, fillColor: '#4CAF50', color: '#fff',
            weight: 2, opacity: 1, fillOpacity: 0.9
          }).addTo(map).bindPopup('<b>You are here</b>');

          ${markers}
        </script>
      </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Finding restaurants near you...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Nearby Restaurants</Text>
          <Text style={styles.headerSub}>
            {restaurants.length} places within 5km
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={getLocationAndFetch}>
          <Text style={styles.refreshText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* View Toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, view === 'list' && styles.tabActive]}
          onPress={() => setView('list')}
        >
          <Text style={[styles.tabText, view === 'list' && styles.tabTextActive]}>
            📋 List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, view === 'map' && styles.tabActive]}
          onPress={() => setView('map')}
        >
          <Text style={[styles.tabText, view === 'map' && styles.tabTextActive]}>
            🗺️ Map
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      {view === 'list' && (
        <View style={styles.filterRow}>
          {[
            { id: 'all',     label: '🍽️ All'        },
            { id: 'healthy', label: '🥗 Restaurants'  },
            { id: 'veg',     label: '🌱 Vegetarian'   },
          ].map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Map View */}
      {view === 'map' && location && (
        <WebView
          source={{ html: getMapHTML() }}
          style={styles.map}
          javaScriptEnabled
        />
      )}

      {/* List View */}
      {view === 'list' && (
        filteredRestaurants.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyText}>No restaurants found</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={getLocationAndFetch}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredRestaurants}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => openMaps(item)}>
                <View style={styles.cardIcon}>
                  <Text style={styles.cardIconText}>{getTypeIcon(item.type)}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    {item.veggie && (
                      <View style={styles.vegBadge}>
                        <Text style={styles.vegBadgeText}>🌱 Veg</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardType}>
                    {getTypeLabel(item.type)}
                    {item.cuisine !== 'Restaurant' ? ` · ${item.cuisine}` : ''}
                  </Text>
                  <Text style={styles.cardAddress} numberOfLines={1}>
                    📍 {item.address}
                  </Text>
                </View>
                <View style={styles.distBadge}>
                  <Text style={styles.distValue}>
                    {item.distance >= 1000
                      ? `${(item.distance / 1000).toFixed(1)}km`
                      : `${item.distance}m`}
                  </Text>
                  <Text style={styles.distLabel}>away</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText:      { marginTop: 12, fontSize: 15, color: COLORS.textSecondary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: COLORS.card,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border || '#eee',
  },
  headerTitle:      { fontSize: 17, fontWeight: '700', color: COLORS.text },
  headerSub:        { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  refreshBtn:       { padding: 8 },
  refreshText:      { fontSize: 20 },
  tabRow: {
    flexDirection: 'row', margin: 12, marginBottom: 0,
    backgroundColor: COLORS.card, borderRadius: 12, padding: 4,
  },
  tab:              { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive:        { backgroundColor: COLORS.primary },
  tabText:          { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  tabTextActive:    { color: '#fff', fontWeight: '600' },
  filterRow:        { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  filterChip: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 0.5, borderColor: COLORS.border || '#eee',
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText:       { fontSize: 13, color: COLORS.textSecondary },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  map:              { flex: 1, margin: 12, borderRadius: 16, overflow: 'hidden' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 14,
    padding: 12, marginBottom: 10,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  cardIconText:     { fontSize: 22 },
  cardInfo:         { flex: 1 },
  cardTitleRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardName:         { fontSize: 15, fontWeight: '600', color: COLORS.text, flex: 1 },
  vegBadge: {
    backgroundColor: '#E8F5E9', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  vegBadgeText:     { fontSize: 11, color: '#2E7D32' },
  cardType:         { fontSize: 12, color: COLORS.textSecondary, marginBottom: 2 },
  cardAddress:      { fontSize: 12, color: COLORS.textSecondary },
  distBadge:        { alignItems: 'center', marginLeft: 8 },
  distValue:        { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  distLabel:        { fontSize: 11, color: COLORS.textSecondary },
  emptyIcon:        { fontSize: 48, marginBottom: 12 },
  emptyText:        { fontSize: 16, color: COLORS.text, marginBottom: 16 },
  retryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 32,
  },
  retryText:        { color: '#fff', fontWeight: '600' },
});