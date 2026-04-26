import { Tabs, useRouter, usePathname } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import { Platform, View, StyleSheet, Modal, Text, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { LayoutDashboard, Calendar, Plus, PieChart, Settings, X, ArrowUpCircle, ArrowDownCircle, ArrowDownUp } from 'lucide-react-native';
import { Colors, Layout } from '../../constants/Theme';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ROUTES = ['/(tabs)/', '/(tabs)/calendar', '/(tabs)/analytics', '/(tabs)/settings'];

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  // Swipe Navigation Logic
  const currentIndex = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const routeMap: Record<string, number> = {
      '/(tabs)/': 0,
      '/(tabs)/calendar': 1,
      '/(tabs)/analytics': 2,
      '/(tabs)/settings': 3,
      '/': 0,
      '/calendar': 1,
      '/analytics': 2,
      '/settings': 3
    };
    // Clean pathname for mapping
    const cleanPath = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
    const idx = routeMap[cleanPath] ?? 0;
    currentIndex.current = idx;
  }, [pathname]);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      const THRESHOLD = SCREEN_WIDTH * 0.25;
      const VELOCITY_THRESHOLD = 500;

      let nextIndex = currentIndex.current;

      if (translationX < -THRESHOLD || velocityX < -VELOCITY_THRESHOLD) {
        nextIndex = Math.min(currentIndex.current + 1, ROUTES.length - 1);
      } else if (translationX > THRESHOLD || velocityX > VELOCITY_THRESHOLD) {
        nextIndex = Math.max(currentIndex.current - 1, 0);
      }

      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();

      if (nextIndex !== currentIndex.current) {
        router.navigate(ROUTES[nextIndex] as any);
      }
    }
  };

  const clampedTranslateX = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [-60, 0, 60],
    extrapolate: 'clamp',
  });

  const handleAddPress = (e: any) => {
    e.preventDefault();
    setIsAddModalVisible(true);
  };

  const navigateToAdd = (type: 'expense' | 'income' | 'transfer') => {
    setIsAddModalVisible(false);
    if (type === 'expense') {
      router.push('/(tabs)/add');
    } else if (type === 'income') {
      router.push('/add-income');
    } else {
      router.push('/add-transfer');
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler
        activeOffsetX={[-20, 20]}
        failOffsetY={[-15, 15]}
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View style={{ flex: 1, transform: [{ translateX: clampedTranslateX }] }}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                ...Platform.select({
                  ios: {
                    position: 'absolute',
                    bottom: 20,
                    left: 20,
                    right: 20,
                    borderRadius: 30,
                    height: 60,
                    borderTopWidth: 0,
                  },
                  android: {
                    height: 70,
                    paddingBottom: 10,
                    paddingTop: 10,
                    elevation: 0,
                    borderTopWidth: 1,
                    borderTopColor: Colors.gray[200],
                  },
                }),
                backgroundColor: Colors.gray[50], // Warm white
              },
              tabBarShowLabel: false,
              tabBarActiveTintColor: Colors.primary[500],
              tabBarInactiveTintColor: Colors.gray[400],
            }}>
            <Tabs.Screen
              name="index"
              options={{
                title: 'Dashboard',
                tabBarIcon: ({ color, focused }) => <LayoutDashboard size={24} color={color} strokeWidth={focused ? 3 : 2} />,
              }}
            />
            <Tabs.Screen
              name="calendar"
              options={{
                title: 'Calendar',
                tabBarIcon: ({ color, focused }) => <Calendar size={24} color={color} strokeWidth={focused ? 3 : 2} />,
              }}
            />

            <Tabs.Screen
              name="add"
              listeners={{
                tabPress: handleAddPress,
              }}
              options={{
                title: 'Add',
                tabBarIcon: ({ focused }) => (
                  <View style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: Colors.primary[500],
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: Platform.OS === 'android' ? 30 : 20,
                    ...Layout.shadows.lg,
                    shadowColor: Colors.primary[500],
                    shadowOpacity: 0.4,
                  }}>
                    <Plus size={32} color={Colors.white} strokeWidth={3} />
                  </View>
                ),
              }}
            />
            <Tabs.Screen
              name="analytics"
              options={{
                title: 'Analytics',
                tabBarIcon: ({ color, focused }) => <PieChart size={24} color={color} strokeWidth={focused ? 3 : 2} />,
              }}
            />
            <Tabs.Screen
              name="settings"
              options={{
                title: 'Settings',
                tabBarIcon: ({ color, focused }) => <Settings size={24} color={color} strokeWidth={focused ? 3 : 2} />,
              }}
            />
          </Tabs>
        </Animated.View>
      </PanGestureHandler>

      <Modal visible={isAddModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsAddModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Transaction</Text>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                <X size={24} color={Colors.gray[500]} />
              </TouchableOpacity>
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigateToAdd('expense')}>
                <View style={[styles.iconCircle, { backgroundColor: Colors.danger.bg }]}>
                  <ArrowUpCircle size={32} color={Colors.danger[500]} />
                </View>
                <Text style={styles.actionText}>Expense</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={() => navigateToAdd('income')}>
                <View style={[styles.iconCircle, { backgroundColor: Colors.success.bg }]}>
                  <ArrowDownCircle size={32} color={Colors.success[500]} />
                </View>
                <Text style={styles.actionText}>Income</Text>
              </TouchableOpacity>

              {/* v2.0.0: Transfer option */}
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigateToAdd('transfer')}>
                <View style={[styles.iconCircle, { backgroundColor: Colors.primary[50] }]}>
                  <ArrowDownUp size={32} color={Colors.primary[500]} />
                </View>
                <Text style={styles.actionText}>Transfer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: Colors.gray[900],
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionBtn: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: Colors.gray[800],
  },
});
