import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, View, StyleSheet, Modal, Text, TouchableOpacity, Dimensions } from 'react-native';
import { LayoutDashboard, Calendar, Plus, PieChart, Settings, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react-native';
import { Colors, Layout } from '../../constants/Theme';

export default function TabLayout() {
  const router = useRouter();
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  const handleAddPress = (e: any) => {
    e.preventDefault();
    setIsAddModalVisible(true);
  };

  const navigateToAdd = (type: 'expense' | 'income') => {
    setIsAddModalVisible(false);
    if (type === 'expense') {
      router.push('/(tabs)/add');
    } else {
      router.push('/add-income');
    }
  };

  return (
    <>
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
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.1,
                shadowRadius: 20,
              },
              android: {
                height: 70,
                paddingBottom: 10,
                paddingTop: 10,
                backgroundColor: Colors.white,
                elevation: 10,
                borderTopWidth: 0,
              },
            }),
            backgroundColor: Colors.white,
          },
          tabBarShowLabel: false,
          tabBarActiveTintColor: Colors.primary[600],
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
                backgroundColor: Colors.primary[600],
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: Platform.OS === 'android' ? 30 : 20,
                ...Layout.shadows.lg,
                shadowColor: Colors.primary[600],
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
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
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
    fontWeight: 'bold',
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
    fontWeight: '600',
    color: Colors.gray[800],
  },
});
