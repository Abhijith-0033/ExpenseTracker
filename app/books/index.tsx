
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, X, Search, Filter } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../../constants/Theme';
import { getBooks, addBook, updateBook, deleteBook, ExpenseBook } from '../../services/books';
import { BookCard } from '../../components/BookCard';
import { formatCurrency } from '../../utils/currency';
import { PressableScale } from '../../components/ui/PressableScale';
import { Snackbar } from '../../components/Snackbar';

export default function BooksScreen() {
    const router = useRouter();
    const [books, setBooks] = useState<(ExpenseBook & { total_spent: number; total_income: number; item_count: number })[]>([]);
    const [filteredBooks, setFilteredBooks] = useState<(ExpenseBook & { total_spent: number; total_income: number; item_count: number })[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [editingBook, setEditingBook] = useState<ExpenseBook | null>(null);

    // Snackbar State
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const fetchData = async () => {
        try {
            const data = await getBooks();
            setBooks(data);
            setFilteredBooks(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [])
    );

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredBooks(books);
        } else {
            const lower = searchQuery.toLowerCase();
            setFilteredBooks(books.filter(b =>
                b.name.toLowerCase().includes(lower) ||
                (b.description && b.description.toLowerCase().includes(lower))
            ));
        }
    }, [searchQuery, books]);

    const handleCreate = async () => {
        if (!name.trim()) {
            Alert.alert('Required', 'Please enter a book name');
            return;
        }
        try {
            await addBook(name, description, parseFloat(budget) || 0);
            setModalVisible(false);
            setName('');
            setDescription('');
            setBudget('');
            fetchData();
            setSnackbarMessage('Expense book created');
            setSnackbarVisible(true);
        } catch (e) {
            Alert.alert('Error', 'Failed to create book');
        }
    };

    const handleEditBook = (book: ExpenseBook & { total_spent: number; total_income: number; item_count: number }) => {
        setEditingBook(book);
        setName(book.name);
        setDescription(book.description || '');
        setBudget(book.budget.toString());
        setEditModalVisible(true);
    };

    const handleUpdateBook = async () => {
        if (!editingBook || !name.trim()) {
            Alert.alert('Required', 'Please enter a book name');
            return;
        }

        // Check for duplicate names
        const existingBook = books.find(b => b.name.toLowerCase() === name.toLowerCase() && b.id !== editingBook.id);
        if (existingBook) {
            Alert.alert('Error', 'An expense book with this name already exists');
            return;
        }

        try {
            await updateBook(editingBook.id, name, description, parseFloat(budget) || 0);
            setEditModalVisible(false);
            setEditingBook(null);
            setName('');
            setDescription('');
            setBudget('');
            fetchData();
            setSnackbarMessage('Expense book updated');
            setSnackbarVisible(true);
        } catch (e) {
            Alert.alert('Error', 'Failed to update book');
        }
    };

    const handleDeleteBook = (book: ExpenseBook & { total_spent: number; total_income: number; item_count: number }) => {
        Alert.alert(
            'Delete Expense Book',
            `This will permanently delete '${book.name}' and all its entries. This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteBook(book.id);
                            fetchData();
                            setSnackbarMessage('Expense book deleted');
                            setSnackbarVisible(true);
                        } catch (e) {
                            Alert.alert('Error', 'Failed to delete book');
                        }
                    }
                }
            ]
        );
    };

    const totalTracked = books.reduce((sum, b) => sum + b.total_spent, 0);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <PressableScale onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={Colors.gray[900]} />
                </PressableScale>
                <Text style={styles.headerTitle}>Expense Books</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Search size={20} color={Colors.gray[400]} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={Colors.gray[400]}
                    />
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            >
                {/* Summary */}
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Total Projects</Text>
                        <Text style={styles.summaryValue}>{books.length}</Text>
                    </View>
                    <View style={[styles.summaryItem, { borderLeftWidth: 1, borderLeftColor: Colors.gray[200], paddingLeft: 20 }]}>
                        <Text style={styles.summaryLabel}>Total Tracked</Text>
                        <Text style={[styles.summaryValue, { color: Colors.primary[600] }]}>
                            {formatCurrency(totalTracked)}
                        </Text>
                    </View>
                </View>

                {/* List */}
                {loading ? (
                    <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 40 }} />
                ) : (
                    filteredBooks.length > 0 ? (
                        filteredBooks.map(book => (
                            <BookCard
                                key={book.id}
                                book={book}
                                onPress={() => router.push(`/books/${book.id}` as any)}
                                onEdit={() => handleEditBook(book)}
                                onDelete={() => handleDeleteBook(book)}
                            />
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'No matching books found' : 'No expense books yet.\nCreate one to start tracking a project!'}
                            </Text>
                        </View>
                    )
                )}

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                <Plus size={32} color="white" />
            </TouchableOpacity>

            {/* Create Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Expense Book</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color={Colors.gray[500]} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Book Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. House Renovation"
                            value={name}
                            onChangeText={setName}
                            autoFocus
                        />

                        <Text style={styles.label}>Description (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Painting and repairs"
                            value={description}
                            onChangeText={setDescription}
                        />

                        <Text style={styles.label}>Budget Target (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0"
                            keyboardType="numeric"
                            value={budget}
                            onChangeText={setBudget}
                        />

                        <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}>
                            <Text style={styles.saveBtnText}>Create Book</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Edit Modal */}
            <Modal visible={editModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Expense Book</Text>
                            <TouchableOpacity onPress={() => {
                                setEditModalVisible(false);
                                setEditingBook(null);
                                setName('');
                                setDescription('');
                                setBudget('');
                            }}>
                                <X size={24} color={Colors.gray[500]} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Book Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. House Renovation"
                            value={name}
                            onChangeText={setName}
                            autoFocus
                        />

                        <Text style={styles.label}>Description (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Painting and repairs"
                            value={description}
                            onChangeText={setDescription}
                        />

                        <Text style={styles.label}>Budget Target (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0"
                            keyboardType="numeric"
                            value={budget}
                            onChangeText={setBudget}
                        />

                        <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateBook}>
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Snackbar */}
            <Snackbar
                visible={snackbarVisible}
                message={snackbarMessage}
                onDismiss={() => setSnackbarVisible(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.gray[50] },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: Colors.white,
    },
    backBtn: { padding: 4, marginLeft: -4 },
    headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    searchContainer: {
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.gray[100],
        paddingHorizontal: 16,
        height: 44,
        borderRadius: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.medium,
        color: Colors.gray[900],
    },
    scrollContent: { padding: 20 },
    summaryContainer: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    summaryItem: {
        flex: 1,
    },
    summaryLabel: {
        fontSize: Typography.size.xs,
        color: Colors.gray[500],
        marginBottom: 4,
        fontFamily: Typography.family.bold,
    },
    summaryValue: {
        fontSize: Typography.size.xxl,
        fontFamily: Typography.family.bold,
        color: Colors.gray[900],
    },
    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyText: { textAlign: 'center', color: Colors.gray[500], lineHeight: 24, fontFamily: Typography.family.medium },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary[600],
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: Colors.primary[600],
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: 450,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold },
    label: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, marginBottom: 8, color: Colors.gray[700] },
    input: {
        backgroundColor: Colors.gray[50],
        padding: 16,
        borderRadius: Layout.radius.lg,
        marginBottom: 20,
        fontSize: Typography.size.md,
        fontFamily: Typography.family.medium,
        borderWidth: 1,
        borderColor: Colors.gray[100],
    },
    saveBtn: {
        backgroundColor: Colors.primary[600],
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    saveBtnText: { color: 'white', fontSize: Typography.size.md, fontFamily: Typography.family.bold },
});
