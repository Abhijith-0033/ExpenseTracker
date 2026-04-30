import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { Brain } from 'lucide-react-native';
import { PressableScale } from '../components/ui/PressableScale';
import { useSatisfaction } from './useSatisfaction';
import SatisfactionModal from './SatisfactionModal';

export default function SatisfactionCard() {
  const { score, status, loading, metrics, insights, recompute } = useSatisfaction('month');
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <PressableScale 
        style={[styles.metricCardFull, { backgroundColor: Colors.accent.lavender }]} 
        onPress={() => !loading && setModalVisible(true)}
      >
        <View style={styles.metricCardIconRow}>
          <View style={[styles.metricCardIcon, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
            <Brain size={20} color={Colors.primary[600]} />
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.metricTitle}>Financial Health</Text>
            {status && !loading && (
              <View style={[styles.badge, { backgroundColor: `${status.color}20` }]}>
                <Text style={[styles.badgeText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            )}
          </View>
          
          {loading ? (
            <View style={styles.skeletonContainer}>
              <View style={styles.skeleton} />
            </View>
          ) : (
            <Text style={[styles.metricValue, { color: Colors.primary[700] }]}>
              {score !== null ? `${score}/100` : '--/100'}
            </Text>
          )}
        </View>
      </PressableScale>

      <SatisfactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        score={score}
        status={status}
        metrics={metrics}
        insights={insights}
        recompute={recompute}
      />
    </>
  );
}

const styles = StyleSheet.create({
  metricCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 24,
    ...Layout.shadows.sm,
  },
  metricCardIconRow: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricTitle: {
    fontFamily: Typography.family.medium,
    fontSize: Typography.size.xs,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  metricValue: {
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.lg,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Typography.family.bold,
    textTransform: 'uppercase',
  },
  skeletonContainer: {
    height: 24,
    justifyContent: 'center',
  },
  skeleton: {
    height: 16,
    width: 60,
    backgroundColor: Colors.gray[200],
    borderRadius: 8,
  },
});
