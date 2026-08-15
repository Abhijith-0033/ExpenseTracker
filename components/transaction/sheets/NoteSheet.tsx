import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Colors, Typography } from '../../../constants/Theme';

export interface NoteSheetProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  onSave: (note: string) => void;
  typeColor: string;
}

export const NoteSheet: React.FC<NoteSheetProps> = ({
  visible,
  onClose,
  value,
  onSave,
  typeColor,
}) => {
  const [text, setText] = useState(value);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    setText(value);
  }, [value, visible]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleConfirm = () => {
    onSave(text.trim());
    onClose();
  };

  const sheetHeight = keyboardHeight > 0 ? 60 : 42;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Note" heightPercent={sheetHeight}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.container}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="What was this for? (optional)"
            placeholderTextColor={Colors.gray[400]}
            multiline
            maxLength={200}
            autoFocus
            returnKeyType="done"
            blurOnSubmit={false}
          />

          <View style={styles.footer}>
            <Text style={styles.charCount}>{text.length}/200</Text>
            <Pressable
              onPress={handleConfirm}
              style={[styles.saveBtn, { backgroundColor: typeColor }]}
            >
              <Text style={styles.saveBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  input: {
    backgroundColor: Colors.gray[50],
    borderRadius: 14,
    padding: 14,
    minHeight: 100,
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.gray[200],
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingBottom: 8,
  },
  charCount: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveBtnText: {
    color: Colors.white,
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.sm,
  },
});
