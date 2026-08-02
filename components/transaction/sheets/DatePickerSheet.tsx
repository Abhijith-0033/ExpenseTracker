import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { subDays, isSameDay } from 'date-fns';
import { BottomSheet } from './BottomSheet';
import { Colors, Typography } from '../../../constants/Theme';

export interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  typeColor: string;
}

export const DatePickerSheet: React.FC<DatePickerSheetProps> = ({
  visible,
  onClose,
  selectedDate,
  onSelectDate,
  typeColor,
}) => {
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const today = new Date();
  const yesterday = subDays(today, 1);

  const isTodaySelected = isSameDay(selectedDate, today);
  const isYesterdaySelected = isSameDay(selectedDate, yesterday);
  const isCustomSelected = !isTodaySelected && !isYesterdaySelected;

  const handleSelectQuick = (d: Date) => {
    onSelectDate(d);
    setShowCustomPicker(false);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Date" heightPercent={showCustomPicker ? 50 : 35}>
      <View style={styles.container}>
        {/* Quick Selection Pills */}
        <View style={styles.pillsRow}>
          <Pressable
            onPress={() => handleSelectQuick(today)}
            style={({ pressed }) => [
              styles.pill,
              isTodaySelected && { backgroundColor: typeColor },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.pillText, isTodaySelected && styles.activePillText]}>
              Today
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSelectQuick(yesterday)}
            style={({ pressed }) => [
              styles.pill,
              isYesterdaySelected && { backgroundColor: typeColor },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.pillText, isYesterdaySelected && styles.activePillText]}>
              Yesterday
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowCustomPicker(true)}
            style={({ pressed }) => [
              styles.pill,
              (isCustomSelected || showCustomPicker) && { backgroundColor: typeColor },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.pillText, (isCustomSelected || showCustomPicker) && styles.activePillText]}>
              Custom Date
            </Text>
          </Pressable>
        </View>

        {/* Native DateTimePicker when Custom is selected */}
        {showCustomPicker && (
          <View style={styles.pickerWrapper}>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(_event, date) => {
                if (date) {
                  onSelectDate(date);
                  if (Platform.OS === 'android') {
                    onClose();
                  }
                }
              }}
            />
            {Platform.OS === 'ios' && (
              <Pressable
                onPress={onClose}
                style={[styles.doneBtn, { backgroundColor: typeColor }]}
              >
                <Text style={styles.doneBtnText}>Confirm Date</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  pill: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  pillText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    color: Colors.gray[700],
  },
  activePillText: {
    color: Colors.white,
  },
  pickerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  doneBtnText: {
    color: Colors.white,
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.sm,
  },
});
