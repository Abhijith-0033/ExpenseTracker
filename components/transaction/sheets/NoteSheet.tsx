import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
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

  useEffect(() => {
    setText(value);
  }, [value, visible]);

  const handleConfirm = () => {
    onSave(text.trim());
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Note" heightPercent={40}>
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
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  input: {
    backgroundColor: Colors.gray[50],
    borderRadius: 14,
    padding: 14,
    height: 100,
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
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
