import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import { Colors } from '../constants/Theme';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

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
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <Animated.View 
          entering={FadeIn.duration(300)} 
          exiting={FadeOut.duration(300)}
          style={styles.container}
        >
          <LottieView
            ref={animationRef}
            source={require('../assets/animations/success.json')}
            autoPlay={false}
            loop={false}
            onAnimationFinish={onAnimationFinish}
            style={styles.lottie}
          />
          <Text style={styles.message}>{message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    width: 250,
    height: 250,
    backgroundColor: 'white',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  lottie: {
    width: 150,
    height: 150,
  },
  message: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.gray[900],
    marginTop: -10,
  }
});
