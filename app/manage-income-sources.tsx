import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { getIncomeSources, addIncomeSource, updateIncomeSource, deleteIncomeSource, IncomeSource } from '../services/database';
import { Plus, X, Pencil, Trash2, Briefcase, Tag, TrendingUp, Gift, DollarSign, Home, Globe, User } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { IconSymbol } from '../components/ui/icon-symbol';

const AVAILABLE_ICONS = ['Briefcase', 'Tag', 'TrendingUp', 'Gift', 'DollarSign', 'Home', 'Globe', 'User'];

export default function ManageIncomeSourcesScreen() {
    const router = useRouter();
    const [sources, setSources] = useState<IncomeSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSource, setEditingSource] = useState<IncomeSource | null>(null);
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('DollarSign');

    useEffect(() => {
        loadSources();
    }, []);

    const loadSources = async () => {
        try {
            const data = await getIncomeSources();
            setSources(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const openAdd = () => {
        setEditingSource(null);
        setName('');
        setSelectedIcon('DollarSign');
        setModalVisible(true);
    };

    const openEdit = (source: IncomeSource) => {
        setEditingSource(source);
        setName(source.name);
        setSelectedIcon(source.icon);
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Required', 'Please enter a source name');
            return;
        }

        try {
            if (editingSource) {
                await updateIncomeSource(editingSource.id, name.trim(), selectedIcon);
            } else {
                await addIncomeSource(name.trim(), selectedIcon);
            }
            setModalVisible(false);
            loadSources();
        } catch (e) {
            Alert.alert('Error', 'Failed to save. Name might be duplicate.');
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert('Delete Source', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await deleteIncomeSource(id);
                    loadSources();
                }
            }
        ]);
    };

    const renderIcon = (iconName: string, size = 20, color = Colors.gray[600]) => {
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

    const renderItem = ({ item }: { item: IncomeSource }) => (
        <View style={styles.card}>
            <View style={styles.row}>
                <View style={styles.iconBox}>
                    {renderIcon(item.icon, 20, Colors.primary[600])}
                </View>
                <Text style={styles.sourceName}>{item.name}</Text>
            </View>
            <View style={styles.row}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                    <Pencil size={18} color={Colors.primary[600]} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={[styles.actionBtn, { marginLeft: 12 }]}>
                    <Trash2 size={18} color={Colors.danger[500]} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <IconSymbol name="chevron.left" size={24} color={Colors.gray[800]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Income Sources</Text>
                <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
                    <Plus size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={sources}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={<Text style={styles.emptyText}>No income sources found.</Text>}
            />

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingSource ? 'Edit Source' : 'New Income Source'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color={Colors.gray[600]} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Source Name</Text>
                        <TextInput
                            placeholder="e.g. Salary, Consulting"
                            value={name}
                            onChangeText={setName}
                            style={styles.input}
                        />

                        <Text style={styles.label}>Select Icon</Text>
                        <View style={styles.iconGrid}>
                            {AVAILABLE_ICONS.map(icon => (
                                <TouchableOpacity
                                    key={icon}
                                    style={[styles.iconSelect, selectedIcon === icon && styles.iconSelectActive]}
                                    onPress={() => setSelectedIcon(icon)}
                                >
                                    {renderIcon(icon, 24, selectedIcon === icon ? Colors.primary[600] : Colors.gray[400])}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Text style={styles.saveText}>Save Source</Text>
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
