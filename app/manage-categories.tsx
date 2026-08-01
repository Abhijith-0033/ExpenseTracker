
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal, Switch } from 'react-native';
import { useApp } from '../context/AppContext';
import { saveCategories } from '../services/database';
import { Plus, X, Trash2 } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { useTheme } from '../context/ThemeContext';
import { ConfirmActionSheet, ConfirmActionType } from '../components/ConfirmActionSheet';

export default function ManageCategoriesScreen() {
    const { categories, refreshData } = useApp();
    const { colors } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);

    // Form
    const [newCatName, setNewCatName] = useState('');
    const [parentCat, setParentCat] = useState<string | null>(null); // If null, adding/editing root category. If set, adding subcategory.
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [editingSubName, setEditingSubName] = useState<string | null>(null);
    const [isRepetitive, setIsRepetitive] = useState(false);
    const [defaultValidity, setDefaultValidity] = useState('28');

    const [confirmSheet, setConfirmSheet] = useState<{
        title: string;
        description: string;
        confirmLabel: string;
        actionType: ConfirmActionType;
        onConfirm: () => void;
    } | null>(null);

    const requestSave = () => {
        if (!newCatName.trim()) return;
        if (editingCatId || editingSubName) {
            setConfirmSheet({
                title: 'Save Changes?',
                description: 'Are you sure you want to save these changes?',
                confirmLabel: 'Edit',
                actionType: 'edit',
                onConfirm: () => {
                    setConfirmSheet(null);
                    handleSave();
                }
            });
        } else {
            handleSave();
        }
    };

    const handleSave = async () => {
        if (!newCatName.trim()) return;

        const updatedCats = [...categories];

        if (editingCatId) {
            // Edit existing category
            const cat = updatedCats.find(c => c.id === editingCatId);
            if (cat) {
                cat.name = newCatName;
                cat.is_recurring = isRepetitive;
                cat.default_validity = isRepetitive ? parseInt(defaultValidity) : undefined;
            }
        } else if (parentCat) {
            // Add or Edit subcategory
            const parent = updatedCats.find(c => c.name === parentCat);
            if (parent) {
                if (editingSubName) {
                    // Edit existing sub
                    const idx = parent.subcategories.indexOf(editingSubName);
                    if (idx !== -1) {
                        parent.subcategories[idx] = newCatName;

                        // Update settings map if name changed or settings set
                        if (!parent.subcategory_settings) parent.subcategory_settings = {};

                        // If name changed, move settings
                        if (editingSubName !== newCatName && parent.subcategory_settings[editingSubName]) {
                            parent.subcategory_settings[newCatName] = parent.subcategory_settings[editingSubName];
                            delete parent.subcategory_settings[editingSubName];
                        }

                        parent.subcategory_settings[newCatName] = {
                            is_recurring: isRepetitive,
                            default_validity: isRepetitive ? parseInt(defaultValidity) : undefined
                        };
                    }
                } else {
                    // Add new sub
                    if (!parent.subcategories.includes(newCatName)) {
                        parent.subcategories.push(newCatName);
                        if (isRepetitive) {
                            if (!parent.subcategory_settings) parent.subcategory_settings = {};
                            parent.subcategory_settings[newCatName] = {
                                is_recurring: true,
                                default_validity: parseInt(defaultValidity)
                            };
                        }
                    } else {
                        Alert.alert('Duplicate', 'Subcategory already exists');
                        return;
                    }
                }
            }
        } else {
            // Add root category
            if (!updatedCats.some(c => c.name === newCatName)) {
                updatedCats.push({
                    id: Date.now().toString(),
                    name: newCatName,
                    subcategories: [],
                    is_recurring: isRepetitive,
                    default_validity: isRepetitive ? parseInt(defaultValidity) : undefined
                });
            } else {
                Alert.alert('Duplicate', 'Category already exists');
                return;
            }
        }

        try {
            await saveCategories(updatedCats);
            await refreshData();
            setModalVisible(false);
            setNewCatName('');
            setEditingCatId(null);
            setEditingSubName(null);
            setIsRepetitive(false);
            setDefaultValidity('28');
        } catch (_e) {
            Alert.alert('Error', 'Failed to save');
        }
    };

    const handleDelete = async (catName: string, subName?: string) => {
        const updatedCats = [...categories];
        if (subName) {
            const parent = updatedCats.find(c => c.name === catName);
            if (parent) {
                parent.subcategories = parent.subcategories.filter(s => s !== subName);
                if (parent.subcategory_settings) delete parent.subcategory_settings[subName];
            }
        } else {
            const idx = updatedCats.findIndex(c => c.name === catName);
            if (idx !== -1) updatedCats.splice(idx, 1);
        }
        await saveCategories(updatedCats);
        await refreshData();
    };

    const requestDelete = (catName: string, subName?: string) => {
        setConfirmSheet({
            title: `Delete ${subName || catName}?`,
            description: 'This action cannot be undone.',
            confirmLabel: 'Delete',
            actionType: 'delete',
            onConfirm: () => {
                setConfirmSheet(null);
                handleDelete(catName, subName);
            }
        });
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.gray[50] }]}>
            <View style={[styles.header, { backgroundColor: colors.white, borderBottomColor: colors.gray[100] }]}>
                <Text style={[styles.title, { color: colors.gray[900] }]}>Categories</Text>
                <TouchableOpacity onPress={() => { setParentCat(null); setEditingCatId(null); setEditingSubName(null); setModalVisible(true); }} style={[styles.addBtn, { backgroundColor: colors.primary[50] }]}>
                    <Text style={[styles.addBtnText, { color: colors.primary[600] }]}>+ New Category</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={categories}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <View style={[styles.catCard, { backgroundColor: colors.white }]}>
                        <View style={styles.catHeader}>
                            <Text style={[styles.catTitle, { color: colors.gray[900] }]}>{item.name}</Text>
                            <View style={{ flexDirection: 'row' }}>
                                <TouchableOpacity onPress={() => { setParentCat(item.name); setEditingCatId(null); setEditingSubName(null); setModalVisible(true); }} style={{ marginRight: 16 }}>
                                    <Plus size={20} color={colors.primary[600]} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                    setEditingCatId(item.id);
                                    setNewCatName(item.name);
                                    setIsRepetitive(!!item.is_recurring);
                                    setDefaultValidity(item.default_validity?.toString() || '28');
                                    setParentCat(null);
                                    setModalVisible(true);
                                }} style={{ marginRight: 16 }}>
                                    <Text style={{ color: colors.primary[600], fontFamily: Typography.family.bold, fontSize: Typography.size.sm }}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => requestDelete(item.name)}>
                                    <Trash2 size={20} color={colors.danger[500] || '#ef4444'} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        {item.subcategories.map((sub, idx) => {
                            const subSetting = item.subcategory_settings?.[sub];
                            return (
                                <View key={idx} style={styles.subCol}>
                                    <View style={styles.subRow}>
                                        <Text style={[styles.subText, { color: colors.gray[600] }]}>{sub}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <TouchableOpacity onPress={() => {
                                                setEditingSubName(sub);
                                                setNewCatName(sub);
                                                setParentCat(item.name);
                                                setIsRepetitive(!!subSetting?.is_recurring);
                                                setDefaultValidity(subSetting?.default_validity?.toString() || '28');
                                                setModalVisible(true);
                                            }} style={{ marginRight: 12 }}>
                                                <Text style={{ color: colors.primary[600], fontFamily: Typography.family.medium, fontSize: Typography.size.xs }}>Edit</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => requestDelete(item.name, sub)}>
                                                <X size={16} color={colors.gray[400] || '#9ca3af'} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {subSetting && (
                                        <View style={styles.subBadgeRow}>
                                            <View style={[styles.repetitiveBadge, { backgroundColor: colors.primary[50], paddingVertical: 2 }]}>
                                                <Text style={[styles.badgeText, { color: colors.primary[600], fontSize: 10 }]}>
                                                    {subSetting.is_recurring ? `Repetitive (${subSetting.default_validity}d)` : 'Not Repetitive'}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                        {item.is_recurring && (
                            <View style={styles.badgeRow}>
                                <View style={[styles.repetitiveBadge, { backgroundColor: colors.primary[50] }]}>
                                    <Text style={[styles.badgeText, { color: colors.primary[600] }]}>Repetitive ({item.default_validity} days)</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}
            />

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.white }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.gray[900] }]}>
                                {editingCatId ? `Edit ${newCatName}` : editingSubName ? `Edit ${editingSubName}` : parentCat ? `Add Subcategory to ${parentCat}` : 'New Category'}
                            </Text>
                            <TouchableOpacity onPress={() => {
                                setModalVisible(false);
                                setEditingCatId(null);
                                setEditingSubName(null);
                                setNewCatName('');
                            }}>
                                <X size={24} color={colors.gray[600] || '#333'} />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            placeholder="Name"
                            placeholderTextColor={colors.gray[400]}
                            value={newCatName}
                            onChangeText={setNewCatName}
                            style={[styles.input, { backgroundColor: colors.gray[50], color: colors.gray[900], borderColor: colors.gray[200] }]}
                            autoFocus
                        />

                        <View style={styles.switchRow}>
                            <Text style={[styles.switchLabel, { color: colors.gray[600] }]}>
                                {parentCat ? "Override repetitive behavior?" : "Is this a repetitive expense?"}
                            </Text>
                            <Switch
                                value={isRepetitive}
                                onValueChange={setIsRepetitive}
                                trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
                                thumbColor={isRepetitive ? colors.primary[600] : colors.gray[100]}
                            />
                        </View>

                        {isRepetitive && (
                            <View style={styles.validityInputRow}>
                                <Text style={[styles.validityLabel, { color: colors.gray[500] }]}>Default Validity (Days):</Text>
                                <TextInput
                                    value={defaultValidity}
                                    onChangeText={setDefaultValidity}
                                    keyboardType="numeric"
                                    style={[styles.smallInput, { backgroundColor: colors.gray[50], color: colors.gray[900], borderColor: colors.gray[200] }]}
                                />
                            </View>
                        )}

                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary[600] }]} onPress={requestSave}>
                            <Text style={styles.saveText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {confirmSheet && (
                <ConfirmActionSheet
                    visible={!!confirmSheet}
                    title={confirmSheet.title}
                    description={confirmSheet.description}
                    confirmLabel={confirmSheet.confirmLabel}
                    actionType={confirmSheet.actionType}
                    onConfirm={confirmSheet.onConfirm}
                    onCancel={() => setConfirmSheet(null)}
                />
            )}
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
        padding: 16,
        paddingTop: 60,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    title: {
        fontSize: Typography.size.xxl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    addBtn: {
        backgroundColor: Colors.primary[50],
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: Layout.radius.md,
    },
    addBtnText: {
        color: Colors.primary[600],
        fontFamily: Typography.family.bold,
    },
    catCard: {
        marginBottom: 20,
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.lg,
        padding: 12,
        ...Layout.shadows.sm,
    },
    catHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    catTitle: {
        fontSize: Typography.size.lg,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    subRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingLeft: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.gray[100],
    },
    subText: {
        fontSize: Typography.size.sm,
        color: Colors.gray[600],
        fontFamily: Typography.family.medium,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.xl,
        padding: 24,
        ...Layout.shadows.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: Typography.size.xl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    input: {
        backgroundColor: Colors.gray[50],
        padding: 16,
        borderRadius: Layout.radius.lg,
        marginBottom: 16,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.medium,
        color: Colors.gray[900],
        borderWidth: 1,
        borderColor: Colors.gray[100],
    },
    saveBtn: {
        backgroundColor: Colors.primary[600],
        padding: 16,
        borderRadius: Layout.radius.lg,
        alignItems: 'center',
        marginTop: 8,
        ...Layout.shadows.sm,
    },
    saveText: {
        color: Colors.white,
        fontFamily: Typography.family.bold,
        fontSize: Typography.size.md,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 8,
    },
    switchLabel: {
        fontSize: Typography.size.md,
        color: Colors.gray[600],
        fontFamily: Typography.family.medium,
    },
    validityInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    validityLabel: {
        fontSize: Typography.size.sm,
        color: Colors.gray[500],
        fontFamily: Typography.family.medium,
    },
    smallInput: {
        backgroundColor: Colors.gray[50],
        padding: 12,
        borderRadius: Layout.radius.lg,
        width: 80,
        textAlign: 'center',
        fontSize: Typography.size.md,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
        borderWidth: 1,
        borderColor: Colors.gray[100],
    },
    badgeRow: {
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: Colors.gray[100],
        marginTop: 4,
    },
    repetitiveBadge: {
        backgroundColor: Colors.primary[50],
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Layout.radius.sm,
        alignSelf: 'flex-start',
    },
    badgeText: {
        color: Colors.primary[600],
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.bold,
    },
    subCol: {
        borderTopWidth: 1,
        borderTopColor: Colors.gray[100],
    },
    subBadgeRow: {
        paddingLeft: 12,
        paddingBottom: 8,
    }
});
