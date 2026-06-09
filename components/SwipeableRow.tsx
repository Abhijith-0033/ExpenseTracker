import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Trash2, Edit2, Copy, Repeat } from 'lucide-react-native';
import {  Typography } from '../constants/Theme';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onRepeat?: () => void;
  deleteConfirmTitle?: string;
  deleteConfirmMessage?: string;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onDelete,
  onEdit,
  onDuplicate,
  onRepeat,
  deleteConfirmTitle = "Delete Item",
  deleteConfirmMessage = "Are you sure you want to delete this?"
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const _trans = dragX.interpolate({
      inputRange: [-144, 0],
      outputRange: [0, 144],
    });

    return (
      <View style={{ width: 144, flexDirection: 'row' }}>
        <Animated.View style={{ flex: 1, transform: [{ translateX: 0 }] }}>
          <TouchableOpacity 
            style={[styles.action, { backgroundColor: '#2D6EF5' }]}
            onPress={() => { 
              swipeableRef.current?.close(); 
              onEdit?.(); 
            }}
          >
            <Edit2 size={20} color="white" />
            <Text style={styles.actionLabel}>Edit</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View style={{ flex: 1, transform: [{ translateX: 0 }] }}>
          <TouchableOpacity 
            style={[styles.action, { backgroundColor: '#F04438' }]}
            onPress={() => {
              swipeableRef.current?.close();
              onDelete?.();
            }}
          >
            <Trash2 size={20} color="white" />
            <Text style={styles.actionLabel}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    return (
      <View style={{ width: 152, flexDirection: 'row' }}>
         <TouchableOpacity 
          style={[styles.action, { backgroundColor: '#12B76A', width: 72 }]}
          onPress={() => { 
            swipeableRef.current?.close(); 
            onDuplicate?.(); 
          }}
        >
          <Copy size={20} color="white" />
          <Text style={styles.actionLabel}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.action, { backgroundColor: '#6941C6', width: 80 }]}
          onPress={() => { 
            swipeableRef.current?.close(); 
            onRepeat?.(); 
          }}
        >
          <Repeat size={20} color="white" />
          <Text style={styles.actionLabel}>Repeat</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={30}
      rightThreshold={40}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootFriction={8}
    >
      {children}
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  action: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  actionLabel: {
    color: 'white',
    fontSize: 10,
    fontFamily: Typography.family.bold,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
