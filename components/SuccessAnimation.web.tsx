import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { CheckCircle2 } from 'lucide-react-native';
import { Colors } from '../constants/Theme';

interface SuccessAnimationProps {
  visible: boolean;
  onAnimationFinish: () => void;
  message?: string;
}

export const SuccessAnimation = ({ visible, onAnimationFinish, message = 'Success!' }: SuccessAnimationProps) => {
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(onAnimationFinish, 900);
    return () => clearTimeout(timer);
  }, [visible, onAnimationFinish]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(180)}
          style={styles.container}
        >
          <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.iconWrap}>
            <CheckCircle2 size={86} color={Colors.success[600]} strokeWidth={2.5} />
          </Animated.View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  iconWrap: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.gray[900],
    marginTop: -10,
  },
});
