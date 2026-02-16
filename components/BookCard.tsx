
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Layout } from '../constants/Theme';
import { BookOpen, FolderPen, Trash2 } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency } from '../utils/currency';
import { ExpenseBook } from '../services/books';

interface BookCardProps {
    book: ExpenseBook & { total_spent: number; item_count: number };
    onPress: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onPress, onEdit, onDelete }) => {
    // Calculate progress if budget exists
    const progress = book.budget > 0 ? Math.min(book.total_spent / book.budget, 1) : 0;
    const isOverBudget = book.budget > 0 && book.total_spent > book.budget;

    // Choose gradient based on status
    const getGradientColors = () => {
        if (isOverBudget) return [Colors.danger[500], Colors.danger[700]];
        if (progress > 0.9) return [Colors.warning[500], Colors.warning[700]];
        return [Colors.primary[500], Colors.primary[700]];
    };

    const renderRightActions = () => {
        return (
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary[500] }]} onPress={onEdit}>
                    <FolderPen size={20} color="white" />
                    <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.danger[500] }]} onPress={onDelete}>
                    <Trash2 size={20} color="white" />
                    <Text style={styles.actionText}>Delete</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <Swipeable renderRightActions={renderRightActions}>
            <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
                <LinearGradient
                    colors={getGradientColors() as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.card}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.iconContainer}>
                            <BookOpen size={20} color="white" />
                        </View>
                        <Text style={styles.lastUpdated}>
                            {new Date(book.last_updated).toLocaleDateString()}
                        </Text>
                    </View>

                    <Text style={styles.bookName} numberOfLines={1}>{book.name}</Text>
                    {book.description ? (
                        <Text style={styles.description} numberOfLines={1}>{book.description}</Text>
                    ) : null}

                    <View style={styles.footer}>
                        <View>
                            <Text style={styles.label}>Total Spent</Text>
                            <Text style={styles.amount}>{formatCurrency(book.total_spent)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.label}>{book.item_count} items</Text>
                            {book.budget > 0 && (
                                <Text style={styles.budgetLabel}>
                                    of {formatCurrency(book.budget)}
                                </Text>
                            )}
                        </View>
                    </View>

                    {book.budget > 0 && (
                        <View style={styles.progressContainer}>
                            <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: isOverBudget ? 'white' : 'rgba(255,255,255,0.8)' }]} />
                        </View>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </Swipeable>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: Layout.radius.xl,
        padding: Layout.spacing.lg,
        marginBottom: Layout.spacing.md,
        ...Layout.shadows.md,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Layout.spacing.md,
        paddingLeft: 10,
    },
    actionBtn: {
        width: 70,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: Layout.radius.lg,
        marginLeft: 8,
    },
    actionText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lastUpdated: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
    },
    bookName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 8,
    },
    label: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginBottom: 2,
    },
    budgetLabel: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        fontWeight: '600',
    },
    amount: {
        color: 'white',
        fontSize: 22,
        fontWeight: '800',
    },
    progressContainer: {
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 2,
        marginTop: 16,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 2,
    }
});
