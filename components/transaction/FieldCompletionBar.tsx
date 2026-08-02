import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/Theme';

export interface FieldCompletionBarProps {
  typeColor: string;
  filledCount: number;
  totalRequired: number;
}

export const FieldCompletionBar: React.FC<FieldCompletionBarProps> = ({
  typeColor,
  filledCount,
  totalRequired,
}) => {
  const isComplete = filledCount >= totalRequired;

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {Array.from({ length: totalRequired }).map((_, index) => {
          const isFilled = index < filledCount;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                isFilled
                  ? { backgroundColor: typeColor, width: 20 }
                  : styles.emptyDot,
              ]}
            />
          );
        })}
      </View>
      <Text
        style={[
          styles.text,
          isComplete ? { color: typeColor, fontWeight: '700' } : styles.incompleteText,
        ]}
      >
        {isComplete
          ? 'Ready to save ✓'
          : `${filledCount} of ${totalRequired} required`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  dot: {
    height: 4,
    width: 12,
    borderRadius: 2,
  },
  emptyDot: {
    backgroundColor: Colors.gray[200],
  },
  text: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
  },
  incompleteText: {
    color: Colors.gray[400],
  },
});
