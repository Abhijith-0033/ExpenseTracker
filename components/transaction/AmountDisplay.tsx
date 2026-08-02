import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography } from '../../constants/Theme';

export interface AmountDisplayProps {
  display: string;
  typeColor: string;
  expressionText?: string;
  hasError?: boolean;
  errorMessage?: string;
}

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  display,
  typeColor,
  expressionText,
  hasError = false,
  errorMessage,
}) => {
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [cursorOpacity]);

  const isZero = display === '0' || !display;

  let amountColor = typeColor;
  if (hasError) {
    amountColor = Colors.danger[600];
  } else if (isZero) {
    amountColor = Colors.gray[300];
  }

  return (
    <View style={styles.container}>
      {/* Expression Line (e.g., "100 + 50") */}
      {!!expressionText && (
        <Text style={styles.expressionText} numberOfLines={1}>
          {expressionText}
        </Text>
      )}

      {/* Hero Amount Row */}
      <View style={styles.amountRow}>
        <Text style={styles.currencySymbol}>₹</Text>
        <Text
          style={[styles.amountText, { color: amountColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.4}
        >
          {display || '0'}
        </Text>

        {/* Blinking Cursor */}
        <Animated.View
          style={[
            styles.cursor,
            { backgroundColor: typeColor, opacity: cursorOpacity },
          ]}
        />
      </View>

      {/* Error Message */}
      {hasError && !!errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 90,
  },
  expressionText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
    marginBottom: 4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 28,
    fontFamily: Typography.family.regular,
    color: Colors.gray[400],
    marginRight: 4,
    marginBottom: 8,
  },
  amountText: {
    fontSize: 52,
    fontFamily: Typography.family.bold,
    letterSpacing: -1,
  },
  cursor: {
    width: 3,
    height: 44,
    borderRadius: 1.5,
    marginLeft: 4,
    marginBottom: 6,
  },
  errorText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.danger[600],
    marginTop: 6,
  },
});
