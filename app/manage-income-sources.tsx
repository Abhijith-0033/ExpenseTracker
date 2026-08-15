import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getIncomeSourcesWithSubs,
  addIncomeSource,
  updateIncomeSource,
  deleteIncomeSource,
  addIncomeSourceSubcategory,
  updateIncomeSourceSubcategory,
  deleteIncomeSourceSubcategory,
  IncomeSource,
  IncomeSourceSubcategory,
} from '../services/database';
import { Plus, X, Pencil, Trash2, Briefcase, Tag, TrendingUp, Gift, DollarSign, Home, Globe, User } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { useTheme } from '../context/ThemeContext';
import { IconSymbol } from '../components/ui/icon-symbol';

const AVAILABLE_ICONS = ['Briefcase', 'Tag', 'TrendingUp', 'Gift', 'DollarSign', 'Home', 'Globe', 'User'];

export default function ManageIncomeSourcesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [_loading, setLoading] = useState(true);

  // --- Source modal state ---
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [editingSource, setEditingSource] = useState<IncomeSource | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('DollarSign');

  // --- Subcategory modal state ---
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [subModalParentSource, setSubModalParentSource] = useState<IncomeSource | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<IncomeSourceSubcategory | null>(null);
  const [subName, setSubName] = useState('');

  // --- Expanded state (which source rows are expanded) ---
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      const data = await getIncomeSourcesWithSubs();
      setSources(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Source (parent) actions ────────────────────────────────────

  const openAddSource = () => {
    setEditingSource(null);
    setSourceName('');
    setSelectedIcon('DollarSign');
    setSourceModalVisible(true);
  };

  const openEditSource = (source: IncomeSource) => {
    setEditingSource(source);
    setSourceName(source.name);
    setSelectedIcon(source.icon);
    setSourceModalVisible(true);
  };

  const handleSaveSource = async () => {
    if (!sourceName.trim()) {
      Alert.alert('Required', 'Please enter a source name');
      return;
    }
    try {
      if (editingSource) {
        await updateIncomeSource(editingSource.id, sourceName.trim(), selectedIcon);
      } else {
        await addIncomeSource(sourceName.trim(), selectedIcon);
      }
      setSourceModalVisible(false);
      loadSources();
    } catch (_e) {
      Alert.alert('Error', 'Failed to save. Name might be duplicate.');
    }
  };

  const handleDeleteSource = (id: number) => {
    Alert.alert(
      'Delete Source',
      'This will also delete all its subcategories. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteIncomeSource(id);
            loadSources();
          },
        },
      ]
    );
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Subcategory actions ────────────────────────────────────────

  const openAddSub = (source: IncomeSource) => {
    setSubModalParentSource(source);
    setEditingSubcategory(null);
    setSubName('');
    setSubModalVisible(true);
  };

  const openEditSub = (source: IncomeSource, sub: IncomeSourceSubcategory) => {
    setSubModalParentSource(source);
    setEditingSubcategory(sub);
    setSubName(sub.name);
    setSubModalVisible(true);
  };

  const handleSaveSub = async () => {
    if (!subName.trim()) {
      Alert.alert('Required', 'Please enter a subcategory name');
      return;
    }
    if (!subModalParentSource) return;
    try {
      if (editingSubcategory) {
        await updateIncomeSourceSubcategory(editingSubcategory.id, subName.trim());
      } else {
        await addIncomeSourceSubcategory(subModalParentSource.id, subName.trim());
      }
      setSubModalVisible(false);
      loadSources();
    } catch (_e) {
      Alert.alert('Error', 'Failed to save. Name might already exist.');
    }
  };

  const handleDeleteSub = (sub: IncomeSourceSubcategory) => {
    Alert.alert('Delete Subcategory', `Delete "${sub.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteIncomeSourceSubcategory(sub.id);
          loadSources();
        },
      },
    ]);
  };

  // ── Icon Renderer ──────────────────────────────────────────────

  const renderIcon = (iconName: string, size = 20, color = colors.gray[600]) => {
    switch (iconName) {
      case 'Briefcase': return <Briefcase size={size} color={color} />;
      case 'Tag': return <Tag size={size} color={color} />;
      case 'TrendingUp': return <TrendingUp size={size} color={color} />;
      case 'Gift': return <Gift size={size} color={color} />;
      case 'DollarSign': return <DollarSign size={size} color={color} />;
      case 'Home': return <Home size={size} color={color} />;
      case 'Globe': return <Globe size={size} color={color} />;
      case 'User': return <User size={size} color={color} />;
      default: return <DollarSign size={size} color={color} />;
    }
  };

  // ── List Item Renderer ─────────────────────────────────────────

  const renderItem = ({ item }: { item: IncomeSource }) => {
    const isExpanded = expandedIds.has(item.id);
    const hasSubs = (item.subcategories?.length ?? 0) > 0;

    return (
      <View style={[styles.card, { backgroundColor: colors.white }]}>
        {/* Source header row */}
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: colors.primary[50] }]}>
            {renderIcon(item.icon, 20, colors.primary[600])}
          </View>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => toggleExpand(item.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sourceName, { color: colors.gray[800] }]}>{item.name}</Text>
            <Text style={[styles.subCount, { color: colors.gray[400] }]}>
              {hasSubs
                ? `${item.subcategories!.length} subcategory${item.subcategories!.length === 1 ? '' : 'ies'} · tap to ${isExpanded ? 'collapse' : 'expand'}`
                : 'No subcategories · tap to add'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openEditSource(item)} style={styles.actionBtn}>
            <Pencil size={16} color={colors.primary[600]} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteSource(item.id)} style={[styles.actionBtn, { marginLeft: 4 }]}>
            <Trash2 size={16} color={colors.danger[500] || Colors.danger[500]} />
          </TouchableOpacity>
        </View>

        {/* Expanded subcategory section */}
        {isExpanded && (
          <View style={[styles.subSection, { borderTopColor: colors.gray[100] }]}>
            {/* Subcategory rows */}
            {(item.subcategories ?? []).map(sub => (
              <View key={sub.id} style={[styles.subRow, { borderBottomColor: colors.gray[50] }]}>
                <Text style={[styles.subDot, { color: colors.gray[400] }]}>›</Text>
                <Text style={[styles.subName, { color: colors.gray[700] }]}>{sub.name}</Text>
                <TouchableOpacity onPress={() => openEditSub(item, sub)} style={styles.actionBtn}>
                  <Pencil size={14} color={colors.primary[500]} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSub(sub)} style={[styles.actionBtn, { marginLeft: 4 }]}>
                  <Trash2 size={14} color={colors.danger[400] || Colors.danger[400]} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Subcategory button */}
            <TouchableOpacity
              style={[styles.addSubBtn, { borderColor: colors.primary[200], backgroundColor: colors.primary[50] }]}
              onPress={() => openAddSub(item)}
            >
              <Plus size={14} color={colors.primary[600]} />
              <Text style={[styles.addSubText, { color: colors.primary[600] }]}>Add Subcategory</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.gray[50] }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.white, borderBottomColor: colors.gray[200] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.gray[900] }]}>Income Sources</Text>
        <TouchableOpacity onPress={openAddSource} style={[styles.addBtn, { backgroundColor: colors.primary[600] }]}>
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sources}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.gray[500] }]}>No income sources found.</Text>
        }
      />

      {/* ── Source Modal ── */}
      <Modal visible={sourceModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.white }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.gray[900] }]}>
                {editingSource ? 'Edit Source' : 'New Income Source'}
              </Text>
              <TouchableOpacity onPress={() => setSourceModalVisible(false)}>
                <X size={24} color={colors.gray[600]} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.gray[600] }]}>Source Name</Text>
            <TextInput
              placeholder="e.g. Salary, Consulting"
              placeholderTextColor={colors.gray[400]}
              value={sourceName}
              onChangeText={setSourceName}
              style={[styles.input, { backgroundColor: colors.gray[50], color: colors.gray[900], borderColor: colors.gray[100] }]}
            />

            <Text style={[styles.label, { color: colors.gray[600] }]}>Select Icon</Text>
            <View style={styles.iconGrid}>
              {AVAILABLE_ICONS.map(icon => {
                const isActive = selectedIcon === icon;
                return (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconSelect,
                      { backgroundColor: colors.gray[100] },
                      isActive && { borderColor: colors.primary[600], backgroundColor: colors.primary[50] },
                    ]}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    {renderIcon(icon, 24, isActive ? colors.primary[600] : colors.gray[400])}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary[600] }]} onPress={handleSaveSource}>
              <Text style={styles.saveText}>Save Source</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Subcategory Modal ── */}
      <Modal visible={subModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.white }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.gray[900] }]}>
                  {editingSubcategory ? 'Edit Subcategory' : 'New Subcategory'}
                </Text>
                {subModalParentSource && (
                  <Text style={[styles.subModalParent, { color: colors.gray[400] }]}>
                    Under: {subModalParentSource.name}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setSubModalVisible(false)}>
                <X size={24} color={colors.gray[600]} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.gray[600] }]}>Subcategory Name</Text>
            <TextInput
              placeholder="e.g. Basic, Bonus, Commission"
              placeholderTextColor={colors.gray[400]}
              value={subName}
              onChangeText={setSubName}
              style={[styles.input, { backgroundColor: colors.gray[50], color: colors.gray[900], borderColor: colors.gray[100] }]}
              autoFocus
            />

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary[600] }]} onPress={handleSaveSub}>
              <Text style={styles.saveText}>Save Subcategory</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  addBtn: {
    backgroundColor: Colors.primary[600],
    padding: 8,
    borderRadius: 20,
  },
  listContent: {
    padding: 20,
  },
  card: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...Layout.shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sourceName: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[800],
  },
  subCount: {
    fontSize: 11,
    fontFamily: Typography.family.regular,
    color: Colors.gray[400],
    marginTop: 2,
  },
  actionBtn: {
    padding: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: Colors.gray[500],
    fontFamily: Typography.family.regular,
    fontStyle: 'italic',
  },
  subSection: {
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 4,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  subDot: {
    fontSize: 16,
    marginRight: 8,
    color: Colors.gray[400],
  },
  subName: {
    flex: 1,
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[700],
  },
  addSubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addSubText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
  },
  subModalParent: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    ...Layout.shadows.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  label: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[600],
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.gray[50],
    padding: 16,
    borderRadius: Layout.radius.lg,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.gray[100],
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  iconSelect: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconSelectActive: {
    borderColor: Colors.primary[600],
    backgroundColor: Colors.primary[50],
  },
  saveBtn: {
    backgroundColor: Colors.primary[600],
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: {
    color: Colors.white,
    fontFamily: Typography.family.bold,
    fontSize: Typography.size.md,
  },
});
