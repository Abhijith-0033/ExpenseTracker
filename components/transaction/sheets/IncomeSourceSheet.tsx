import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TouchableOpacity } from 'react-native';
import { Check, ChevronRight, ChevronLeft, Briefcase, Tag, TrendingUp, Gift, DollarSign, Home, Globe, User } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Colors, Typography, Layout } from '../../../constants/Theme';
import { IncomeSource, IncomeSourceSubcategory } from '../../../services/database';

const renderSourceIcon = (iconName?: string, size = 18, color = Colors.gray[600]) => {
  switch (iconName) {
    case 'Briefcase': return <Briefcase size={size} color={color} />;
    case 'Tag': return <Tag size={size} color={color} />;
    case 'TrendingUp': return <TrendingUp size={size} color={color} />;
    case 'Gift': return <Gift size={size} color={color} />;
    case 'DollarSign': return <DollarSign size={size} color={color} />;
    case 'Home': return <Home size={size} color={color} />;
    case 'Globe': return <Globe size={size} color={color} />;
    case 'User': return <User size={size} color={color} />;
    default:
      if (iconName && iconName.length <= 4) {
        return <Text style={{ fontSize: size }}>{iconName}</Text>;
      }
      return <DollarSign size={size} color={color} />;
  }
};

export interface IncomeSourceSheetProps {
  visible: boolean;
  onClose: () => void;
  sources: IncomeSource[];
  selectedSource?: string;
  selectedSubcategory?: string;
  onSelect: (sourceName: string, subcategoryName?: string) => void;
  typeColor: string;
}

export const IncomeSourceSheet: React.FC<IncomeSourceSheetProps> = ({
  visible,
  onClose,
  sources,
  selectedSource,
  selectedSubcategory,
  onSelect,
  typeColor,
}) => {
  const [activeSource, setActiveSource] = useState<IncomeSource | null>(null);

  const handleClose = () => {
    setActiveSource(null);
    onClose();
  };

  const handleSelectSource = (source: IncomeSource) => {
    if ((source.subcategories?.length ?? 0) > 0) {
      setActiveSource(source);
    } else {
      onSelect(source.name, undefined);
      setActiveSource(null);
      onClose();
    }
  };

  const handleSelectSubcategory = (sub: IncomeSourceSubcategory) => {
    if (!activeSource) return;
    onSelect(activeSource.name, sub.name);
    setActiveSource(null);
    onClose();
  };

  const title = activeSource ? `${activeSource.name} — Pick Sub` : 'Select Income Source';

  return (
    <BottomSheet visible={visible} onClose={handleClose} title={title} heightPercent={55}>
      {activeSource ? (
        <View style={{ flex: 1 }}>
          <View style={styles.level2Header}>
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => setActiveSource(null)}
              activeOpacity={0.7}
            >
              <ChevronLeft size={18} color={typeColor} />
              <Text style={[styles.backText, { color: typeColor }]}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.selectMainBtn, { backgroundColor: typeColor + '1A' }]}
              onPress={() => {
                onSelect(activeSource.name, undefined);
                setActiveSource(null);
                onClose();
              }}
            >
              <Text style={[styles.selectMainText, { color: typeColor }]}>
                Select "{activeSource.name}" Only
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={activeSource.subcategories ?? []}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected =
                selectedSource === activeSource.name && selectedSubcategory === item.name;
              return (
                <Pressable
                  onPress={() => handleSelectSubcategory(item)}
                  style={({ pressed }) => [
                    styles.row,
                    isSelected && [styles.selectedRow, { borderColor: typeColor, backgroundColor: typeColor + '0A' }],
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.name}>{item.name}</Text>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: typeColor }]}>
                      <Check size={12} color={Colors.white} />
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      ) : (
        <FlatList
          data={sources}
          keyExtractor={(item) => item.id?.toString() || item.name}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSelected = item.name === selectedSource;
            const hasSubs = (item.subcategories?.length ?? 0) > 0;
            return (
              <Pressable
                onPress={() => handleSelectSource(item)}
                style={({ pressed }) => [
                  styles.row,
                  isSelected && [styles.selectedRow, { borderColor: typeColor, backgroundColor: typeColor + '0A' }],
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.iconCircle}>
                  {renderSourceIcon(item.icon, 18, typeColor)}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  {hasSubs && (
                    <Text style={styles.subHint}>
                      {item.subcategories!.length} subcategor{item.subcategories!.length === 1 ? 'y' : 'ies'}
                    </Text>
                  )}
                </View>

                {hasSubs ? (
                  <ChevronRight size={18} color={Colors.gray[400]} />
                ) : isSelected ? (
                  <View style={[styles.checkCircle, { backgroundColor: typeColor }]}>
                    <Check size={12} color={Colors.white} />
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  list: {
    paddingVertical: 8,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.gray[100],
    ...Layout.shadows.sm,
  },
  selectedRow: {
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 18,
  },
  name: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  subHint: {
    fontSize: 11,
    fontFamily: Typography.family.regular,
    color: Colors.gray[400],
    marginTop: 2,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
  },
  level2Header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  selectMainBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  selectMainText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
  },
});
