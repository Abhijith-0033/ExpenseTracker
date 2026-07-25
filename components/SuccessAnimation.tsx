import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import { Colors, Typography } from '../constants/Theme';

interface SuccessAnimationProps {
  visible: boolean;
  onAnimationFinish: () => void;
  message?: string;
}

export const SuccessAnimation = ({ visible, onAnimationFinish, message = "Success!" }: SuccessAnimationProps) => {
  const animationRef = useRef<LottieView>(null);

  useEffect(() => {
    if (visible) {
      animationRef.current?.play();
      // Safety fallback: always dismiss after 2.5 seconds
      const timer = setTimeout(() => {
        onAnimationFinish?.();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible, onAnimationFinish]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LottieView
            ref={animationRef}
            source={require('../assets/animations/success.json')}
            autoPlay={false}
            loop={false}
            onAnimationFinish={onAnimationFinish}
            style={styles.lottie}
            resizeMode="contain"
          />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 180,
    height: 180,
    backgroundColor: Colors.white,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  lottie: {
    width: 120,
    height: 120,
  },
  message: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginTop: -4,
  }
});
