
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { useApp } from '../context/AppContext';
import { CategoryNode } from '../services/database';
import { X, ChevronRight } from 'lucide-react-native';

interface CategoryPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (category: string, subcategory: string) => void;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({ visible, onClose, onSelect }) => {
    const { categories } = useApp();
    const [selectedParent, setSelectedParent] = useState<CategoryNode | null>(null);

    const handleSelectSub = (sub: string) => {
        if (selectedParent) {
            onSelect(selectedParent.name, sub);
            setSelectedParent(null);
            onClose();
        }
    };

    const renderItem = ({ item }: { item: CategoryNode }) => (
        <TouchableOpacity
            style={styles.item}
            onPress={() => setSelectedParent(item)}
        >
            <View style={styles.iconPlaceholder} />
            <Text style={styles.itemText}>{item.name}</Text>
            <ChevronRight size={20} color="#9ca3af" />
        </TouchableOpacity>
    );

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
                        {selectedParent ? selectedParent.name : 'Select Category'}
                    </Text>
                    <TouchableOpacity onPress={() => {
                        if (selectedParent) setSelectedParent(null);
                        else onClose();
                    }}>
                        <X size={24} color="#1f2937" />
                    </TouchableOpacity>
                </View>

                {selectedParent ? (
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
                        data={categories}
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
