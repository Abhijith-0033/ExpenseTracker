import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Animated, Dimensions, TouchableWithoutFeedback
} from 'react-native';
import { Trash2, Edit2, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../constants/Theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ConfirmActionType = 'delete' | 'edit' | 'approve' | 'warning' | 'pay';

interface ConfirmActionSheetProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor?: string;
  actionType?: ConfirmActionType;
  onConfirm: () => void;
  onCancel: () => void;
}

const ICONS: Record<ConfirmActionType, React.ReactNode> = {
  delete:  <Trash2 size={28} color={Colors.danger[600]} />,
  edit:    <Edit2 size={28} color={Colors.primary[600]} />,
  approve: <CheckCircle2 size={28} color={Colors.success[600]} />,
  warning: <AlertTriangle size={28} color={Colors.warning[600]} />,
  pay:     <CheckCircle2 size={28} color={Colors.success[600]} />,
};

const ICON_BG: Record<ConfirmActionType, string> = {
  delete:  Colors.danger[50],
  edit:    Colors.primary[50],
  approve: Colors.success[50],
  warning: '#FEF9C3',
  pay:     Colors.success[50],
};

export const ConfirmActionSheet: React.FC<ConfirmActionSheetProps> = ({
  visible,
  title,
  description,
  confirmLabel,
  confirmColor,
  actionType = 'warning',
  onConfirm,
  onCancel,
}) => {
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!visible) return null;

  const btnColor = confirmColor || (actionType === 'delete' ? Colors.danger[600] : Colors.primary[600]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Drag Handle */}
        <View style={styles.handle} />

        {/* Icon */}
        <View style={[styles.iconBox, { backgroundColor: ICON_BG[actionType] }]}>
          {ICONS[actionType]}
        </View>

        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Description */}
        <Text style={styles.description}>{description}</Text>

        {/* NOTE: This cannot be undone — shown for delete/warning */}
        {(actionType === 'delete' || actionType === 'warning') && (
          <View style={styles.irreversibleRow}>
            <AlertTriangle size={12} color={Colors.danger[500]} />
            <Text style={styles.irreversibleText}>This action cannot be undone.</Text>
          </View>
        )}

        {/* Buttons — always visible above keyboard */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: btnColor }]}
            onPress={onConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,           // Safe area for bottom nav phones
    alignItems: 'center',
    ...Layout.shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.gray[200],
    borderRadius: 2,
    marginBottom: 24,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  irreversibleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.danger[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 24,
  },
  irreversibleText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    color: Colors.danger[600],
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[700],
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.white,
  },
});
