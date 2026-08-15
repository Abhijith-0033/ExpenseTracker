import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Image, Download, Share2, X } from 'lucide-react-native';
import { Colors, Typography, Layout } from '../../constants/Theme';

interface ReportShareSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaveImage: () => void;
  onExportPDF: () => void;
  onShareText: () => void;
  periodLabel: string;
}

export function ReportShareSheet({ visible, onClose, onSaveImage, onExportPDF, onShareText, periodLabel }: ReportShareSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Share {periodLabel} Report</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.gray[500]} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.option} onPress={onSaveImage}>
            <View style={[styles.optionIcon, { backgroundColor: Colors.primary[50] }]}>
              <Image size={22} color={Colors.primary[600]} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Save as Image</Text>
              <Text style={styles.optionSub}>High-quality PNG snapshot of this report</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={onExportPDF}>
            <View style={[styles.optionIcon, { backgroundColor: Colors.danger[50] }]}>
              <Download size={22} color={Colors.danger[600]} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Export as PDF</Text>
              <Text style={styles.optionSub}>Professional formatted report document</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={onShareText}>
            <View style={[styles.optionIcon, { backgroundColor: Colors.success[50] }]}>
              <Share2 size={22} color={Colors.success[600]} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Share Summary Text</Text>
              <Text style={styles.optionSub}>Copy-paste friendly text summary</Text>
            </View>
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.gray[300],
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  title: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  closeBtn: { padding: 4 },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  optionIcon: {
    width: 48, height: 48, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
  },
  optionText: { flex: 1 },
  optionTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  optionSub: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    marginTop: 2,
  },
});
