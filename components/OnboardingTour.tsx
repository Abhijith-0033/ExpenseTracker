import React, { useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Animated, Modal, Platform 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  TrendingUp, Plus, Target, Bell, Lock, ChevronRight 
} from 'lucide-react-native';
import { Colors, Typography, Layout } from '../constants/Theme';
import { LinearGradient } from 'expo-linear-gradient';



interface OnboardingTourProps {
  visible: boolean;
  onClose: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ visible, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Animation Values
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const slides = [
    {
      title: 'Welcome to Gastos',
      subtitle: 'Smart Personal Finance',
      description: 'Track every rupee, manage your accounts, and get a clear picture of your net worth in real-time.',
      icon: <TrendingUp size={48} color={Colors.primary[600]} />,
      bgColors: [Colors.primary[50], '#FFF0EC'] as [string, string],
      iconBg: Colors.primary[100],
    },
    {
      title: 'Fast Transaction Entry',
      subtitle: 'Log in Seconds',
      description: 'Tap the "+" button to record expenses, income, or transfers. Split bills with groups or automate with scheduled entries.',
      icon: <Plus size={48} color="#059669" />,
      bgColors: ['#EBF7F0', '#D1F2E0'] as [string, string],
      iconBg: '#ADDDC0',
    },
    {
      title: 'Budgets & Sinking Funds',
      subtitle: 'Plan Ahead',
      description: 'Set smart category budgets to avoid overspending. Build Sinking Funds to save gradually for predictable big expenses.',
      icon: <Target size={48} color="#7C3AED" />,
      bgColors: ['#F3E8FF', '#E9D5FF'] as [string, string],
      iconBg: '#D8B4FE',
    },
    {
      title: 'Smart Bills & Alerts',
      subtitle: 'Never Miss a Payment',
      description: 'Get automated notifications 7, 3, 2 days before bills are due. Mark as paid in one click to silently log transactions.',
      icon: <Bell size={48} color="#D97706" />,
      bgColors: ['#FDF8EC', '#FEF3C7'] as [string, string],
      iconBg: '#FDE68A',
    },
    {
      title: 'Premium Power-Ups',
      subtitle: 'Unlock Advanced Modules',
      description: 'Get full access to Tax Planner, Sinking Funds, Cloud Backups, Unlimited Accounts, and the Upcoming Bills Manager.',
      icon: <Lock size={48} color={Colors.primary[600]} />,
      bgColors: [Colors.primary[50], '#FFF0EC'] as [string, string],
      iconBg: Colors.primary[100],
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      // Fade out, change slide, fade in
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSlide(currentSlide + 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem('onboarding_complete_v1', 'true');
    } catch (e) {
      console.warn(e);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide">
      <LinearGradient 
        colors={slides[currentSlide].bgColors} 
        style={styles.container}
      >
        {/* Top Header Row */}
        <View style={styles.header}>
          <Text style={styles.logoText}>Gastos</Text>
          {currentSlide < slides.length - 1 && (
            <TouchableOpacity 
              style={styles.skipBtn} 
              onPress={handleComplete}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Slide Body */}
        <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
          {/* Animated Large Icon Wrapper */}
          <View style={[styles.iconWrapper, { backgroundColor: slides[currentSlide].iconBg }]}>
            {slides[currentSlide].icon}
          </View>

          {/* Texts */}
          <Text style={styles.subtitle}>{slides[currentSlide].subtitle}</Text>
          <Text style={styles.title}>{slides[currentSlide].title}</Text>
          <Text style={styles.description}>{slides[currentSlide].description}</Text>
        </Animated.View>

        {/* Footer Row */}
        <View style={styles.footer}>
          {/* Progress Indicators */}
          <View style={styles.dotsContainer}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  currentSlide === index && styles.activeDot,
                  currentSlide === index && { backgroundColor: Colors.primary[600] }
                ]}
              />
            ))}
          </View>

          {/* Action Buttons */}
          <TouchableOpacity 
            style={[styles.nextBtn, currentSlide === slides.length - 1 && styles.getStartedBtn]} 
            onPress={handleNext}
          >
            <Text style={styles.nextBtnText}>
              {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            {currentSlide < slides.length - 1 && (
              <ChevronRight size={16} color="white" style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
  },
  logoText: {
    fontSize: 22,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    letterSpacing: -0.5,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Layout.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  skipText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[600],
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    ...Layout.shadows.md,
    elevation: 4,
  },
  subtitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.primary[600],
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.regular,
    color: Colors.gray[600],
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 60,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gray[300],
  },
  activeDot: {
    width: 20,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray[900],
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: Layout.radius.xl,
    ...Layout.shadows.md,
    elevation: 3,
  },
  getStartedBtn: {
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 24,
  },
  nextBtnText: {
    color: 'white',
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.sm,
  },
});
