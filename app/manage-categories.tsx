
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal, SectionList, Switch } from 'react-native';
import { useApp } from '../context/AppContext';
import { saveCategories, CategoryNode } from '../services/database';
import { Plus, X, Trash2 } from 'lucide-react-native';

export default function ManageCategoriesScreen() {
    const { categories, refreshData } = useApp();
    const [modalVisible, setModalVisible] = useState(false);

    // Form
    const [newCatName, setNewCatName] = useState('');
    const [parentCat, setParentCat] = useState<string | null>(null); // If null, adding/editing root category. If set, adding subcategory.
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [editingSubName, setEditingSubName] = useState<string | null>(null);
    const [isRepetitive, setIsRepetitive] = useState(false);
    const [defaultValidity, setDefaultValidity] = useState('28');

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
        } catch (e) {
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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Categories</Text>
                <TouchableOpacity onPress={() => { setParentCat(null); setEditingCatId(null); setEditingSubName(null); setModalVisible(true); }} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ New Category</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={categories}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <View style={styles.catCard}>
                        <View style={styles.catHeader}>
                            <Text style={styles.catTitle}>{item.name}</Text>
                            <View style={{ flexDirection: 'row' }}>
                                <TouchableOpacity onPress={() => { setParentCat(item.name); setEditingCatId(null); setEditingSubName(null); setModalVisible(true); }} style={{ marginRight: 16 }}>
                                    <Plus size={20} color="#2563eb" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                    setEditingCatId(item.id);
                                    setNewCatName(item.name);
                                    setIsRepetitive(!!item.is_recurring);
                                    setDefaultValidity(item.default_validity?.toString() || '28');
                                    setParentCat(null);
                                    setModalVisible(true);
                                }} style={{ marginRight: 16 }}>
                                    <Text style={{ color: '#2563eb', fontWeight: 'bold' }}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item.name)}>
                                    <Trash2 size={20} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        {item.subcategories.map((sub, idx) => {
                            const subSetting = item.subcategory_settings?.[sub];
                            return (
                                <View key={idx} style={styles.subCol}>
                                    <View style={styles.subRow}>
                                        <Text style={styles.subText}>{sub}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <TouchableOpacity onPress={() => {
                                                setEditingSubName(sub);
                                                setNewCatName(sub);
                                                setParentCat(item.name);
                                                setIsRepetitive(!!subSetting?.is_recurring);
                                                setDefaultValidity(subSetting?.default_validity?.toString() || '28');
                                                setModalVisible(true);
                                            }} style={{ marginRight: 12 }}>
                                                <Text style={{ color: '#2563eb', fontSize: 12 }}>Edit</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDelete(item.name, sub)}>
                                                <X size={16} color="#9ca3af" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {subSetting && (
                                        <View style={styles.subBadgeRow}>
                                            <View style={[styles.repetitiveBadge, { paddingVertical: 2 }]}>
                                                <Text style={[styles.badgeText, { fontSize: 10 }]}>
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
                                <View style={styles.repetitiveBadge}>
                                    <Text style={styles.badgeText}>Repetitive ({item.default_validity} days)</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}
            />

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingCatId ? `Edit ${newCatName}` : editingSubName ? `Edit ${editingSubName}` : parentCat ? `Add Subcategory to ${parentCat}` : 'New Category'}
                            </Text>
                            <TouchableOpacity onPress={() => {
                                setModalVisible(false);
                                setEditingCatId(null);
                                setEditingSubName(null);
                                setNewCatName('');
                            }}>
                                <X size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            placeholder="Name"
                            value={newCatName}
                            onChangeText={setNewCatName}
                            style={styles.input}
                            autoFocus
                        />

                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>
                                {parentCat ? "Override repetitive behavior?" : "Is this a repetitive expense?"}
                            </Text>
                            <Switch
                                value={isRepetitive}
                                onValueChange={setIsRepetitive}
                                trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                                thumbColor={isRepetitive ? '#2563eb' : '#f3f4f6'}
                            />
                        </View>

                        {isRepetitive && (
                            <View style={styles.validityInputRow}>
                                <Text style={styles.validityLabel}>Default Validity (Days):</Text>
                                <TextInput
                                    value={defaultValidity}
                                    onChangeText={setDefaultValidity}
                                    keyboardType="numeric"
                                    style={styles.smallInput}
                                />
                            </View>
                        )}

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Text style={styles.saveText}>Save</Text>
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
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: 60,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    addBtn: {
        backgroundColor: '#eff6ff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    addBtnText: {
        color: '#2563eb',
        fontWeight: '600',
    },
    catCard: {
        marginBottom: 20,
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 12,
    },
    catHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    catTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    subRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingLeft: 12,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    subText: {
        fontSize: 15,
        color: '#4b5563',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: '#f3f4f6',
        padding: 14,
        borderRadius: 8,
        marginBottom: 12,
        fontSize: 16,
    },
    saveBtn: {
        backgroundColor: '#2563eb',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    saveText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 8,
    },
    switchLabel: {
        fontSize: 16,
        color: '#4b5563',
    },
    validityInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    validityLabel: {
        fontSize: 14,
        color: '#6b7280',
    },
    smallInput: {
        backgroundColor: '#f3f4f6',
        padding: 10,
        borderRadius: 8,
        width: 80,
        textAlign: 'center',
        fontSize: 16,
    },
    badgeRow: {
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        marginTop: 4,
    },
    repetitiveBadge: {
        backgroundColor: '#ebf5ff',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    badgeText: {
        color: '#2563eb',
        fontSize: 12,
        fontWeight: '700',
    },
    subCol: {
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    subBadgeRow: {
        paddingLeft: 12,
        paddingBottom: 8,
    }
});
