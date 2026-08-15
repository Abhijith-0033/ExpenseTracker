import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { CategoryNode, getIncomeSourcesWithSubs, IncomeSource } from '../services/database';
import { X, ChevronRight } from 'lucide-react-native';

interface CategoryPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (category: string, subcategory: string) => void;
    type?: 'expense' | 'income';
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({ visible, onClose, onSelect, type = 'expense' }) => {
    const { categories } = useApp();
    const [selectedParent, setSelectedParent] = useState<CategoryNode | null>(null);
    const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
    const [incomeSubPicker, setIncomeSubPicker] = useState<IncomeSource | null>(null);

    useEffect(() => {
        if (visible && type === 'income') {
            getIncomeSourcesWithSubs()
                .then(sources => {
                    setIncomeSources(sources);
                })
                .catch(err => {
                    console.error("Failed to load income sources in CategoryPicker", err);
                });
        }
        if (!visible) {
            setIncomeSubPicker(null);
        }
    }, [visible, type]);

    const handleSelectSub = (sub: string) => {
        if (selectedParent) {
            onSelect(selectedParent.name, sub);
            setSelectedParent(null);
            onClose();
        }
    };

    const renderItem = ({ item }: { item: CategoryNode }) => {
        const hasSubcategories = item.subcategories && item.subcategories.length > 0;

        return (
            <TouchableOpacity
                style={styles.item}
                onPress={() => {
                    if (hasSubcategories) {
                        setSelectedParent(item);
                    } else {
                        onSelect(item.name, '');
                        onClose();
                    }
                }}
            >
                <View style={styles.iconPlaceholder} />
                <Text style={styles.itemText}>{item.name}</Text>
                {hasSubcategories && <ChevronRight size={20} color="#9ca3af" />}
            </TouchableOpacity>
        );
    };

    const renderSubItem = ({ item }: { item: string }) => (
        <TouchableOpacity
            style={styles.item}
            onPress={() => handleSelectSub(item)}
        >
            <Text style={styles.itemText}>{item}</Text>
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>
                        {type === 'income'
                            ? (incomeSubPicker ? incomeSubPicker.name : 'Select Income Category')
                            : (selectedParent ? selectedParent.name : 'Select Category')}
                    </Text>
                    <TouchableOpacity onPress={() => {
                        if (selectedParent) setSelectedParent(null);
                        else if (incomeSubPicker) setIncomeSubPicker(null);
                        else onClose();
                    }}>
                        <X size={24} color="#1f2937" />
                    </TouchableOpacity>
                </View>

                {type === 'income' ? (
                    incomeSubPicker ? (
                        <View style={{ flex: 1 }}>
                            <TouchableOpacity style={styles.backButton} onPress={() => setIncomeSubPicker(null)}>
                                <Text style={{ color: '#2563eb' }}>← Back to Sources</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.item, { backgroundColor: '#eff6ff' }]}
                                onPress={() => {
                                    onSelect('Income', incomeSubPicker.name);
                                    setIncomeSubPicker(null);
                                    onClose();
                                }}
                            >
                                <Text style={[styles.itemText, { color: '#1d4ed8' }]}>
                                    Use "{incomeSubPicker.name}" only (no subcategory)
                                </Text>
                            </TouchableOpacity>
                            <FlatList
                                data={incomeSubPicker.subcategories ?? []}
                                keyExtractor={(i) => i.id.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.item}
                                        onPress={() => {
                                            onSelect('Income', `${incomeSubPicker.name} › ${item.name}`);
                                            setIncomeSubPicker(null);
                                            onClose();
                                        }}
                                    >
                                        <Text style={styles.itemText}>{incomeSubPicker.name} › {item.name}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    ) : (
                        <FlatList
                            data={incomeSources}
                            keyExtractor={(i) => i.id.toString()}
                            renderItem={({ item }) => {
                                const hasSubs = (item.subcategories?.length ?? 0) > 0;
                                return (
                                    <TouchableOpacity
                                        style={styles.item}
                                        onPress={() => {
                                            if (hasSubs) {
                                                setIncomeSubPicker(item);
                                            } else {
                                                onSelect('Income', item.name);
                                                onClose();
                                            }
                                        }}
                                    >
                                        <View style={styles.iconPlaceholder} />
                                        <Text style={styles.itemText}>{item.name}</Text>
                                        {hasSubs && <ChevronRight size={20} color="#9ca3af" />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    )
                ) : selectedParent ? (
                    <View style={{ flex: 1 }}>
                        <TouchableOpacity style={styles.backButton} onPress={() => setSelectedParent(null)}>
                            <Text style={{ color: '#2563eb' }}>Back to Categories</Text>
                        </TouchableOpacity>
                        <FlatList
                            data={selectedParent.subcategories}
                            keyExtractor={(i) => i}
                            renderItem={renderSubItem}
                        />
                    </View>
                ) : (
                    <FlatList
                        data={categories.filter(c => c.name !== 'Income')}
                        keyExtractor={(i) => i.id}
                        renderItem={renderItem}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    item: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f9fafb',
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e5e7eb',
        marginRight: 12,
    },
    itemText: {
        fontSize: 16,
        flex: 1,
    },
    backButton: {
        padding: 12,
        paddingHorizontal: 16,
        backgroundColor: '#eff6ff',
    }
});
