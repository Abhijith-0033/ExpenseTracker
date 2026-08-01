import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Trash2, Edit2, Copy, Repeat } from 'lucide-react-native';
import { Typography } from '../constants/Theme';
import { useTheme } from '../context/ThemeContext';

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
}) => {
  const swipeableRef = useRef<Swipeable>(null);
  const { colors } = useTheme();

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const actionsCount = (onEdit ? 1 : 0) + (onDelete ? 1 : 0);
    if (actionsCount === 0) return null;
    const width = actionsCount * 72;

    return (
      <View style={{ width, flexDirection: 'row' }}>
        {onEdit && (
          <View style={{ flex: 1 }}>
            <TouchableOpacity 
              style={[styles.action, { backgroundColor: colors.primary[600] }]}
              onPress={() => { 
                swipeableRef.current?.close(); 
                onEdit?.(); 
              }}
            >
              <Edit2 size={20} color="white" />
              <Text style={styles.actionLabel}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
        {onDelete && (
          <View style={{ flex: 1 }}>
            <TouchableOpacity 
              style={[styles.action, { backgroundColor: colors.danger[500] || '#F04438' }]}
              onPress={() => {
                swipeableRef.current?.close();
                onDelete?.();
              }}
            >
              <Trash2 size={20} color="white" />
              <Text style={styles.actionLabel}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const hasLeft = onDuplicate || onRepeat;
    if (!hasLeft) return null;

    return (
      <View style={{ flexDirection: 'row' }}>
        {onDuplicate && (
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
        )}
        {onRepeat && (
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
        )}
      </View>
    );
  };

  const hasLeft = Boolean(onDuplicate || onRepeat);
  const hasRight = Boolean(onEdit || onDelete);

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={30}
      rightThreshold={40}
      renderLeftActions={hasLeft ? renderLeftActions : undefined}
      renderRightActions={hasRight ? renderRightActions : undefined}
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
