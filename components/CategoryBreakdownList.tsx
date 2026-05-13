import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CategoryTotal, SubcategoryTotal } from '../services/analysis';
import { formatCurrency } from '../utils/currency';
import { Colors, Layout } from '../constants/Theme';
import { IconSymbol } from './ui/icon-symbol';

interface Props {
    categoryData: CategoryTotal[];
    selectedCategory: string | null;
    onSelectCategory: (category: string) => void;
    subcategoryData: SubcategoryTotal[];
    loadingSubcategories: boolean;
    totalAmount?: number;
}

export const CategoryBreakdownList: React.FC<Props> = ({
    categoryData,
    selectedCategory,
    onSelectCategory,
    subcategoryData,
    loadingSubcategories,
    totalAmount
}) => {

    return (
        <View style={styles.container}>
            {categoryData.map((cat) => {
                const isExpanded = selectedCategory === cat.category;

                return (
                    <View key={cat.category} style={styles.card}>
                        <TouchableOpacity
                            style={[styles.header, isExpanded && styles.headerExpanded]}
                            onPress={() => onSelectCategory(cat.category)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.headerLeft}>
                                <View style={[styles.dot, { backgroundColor: Colors.primary[500] }]} />
                                <Text style={styles.categoryName}>{cat.category}</Text>
                            </View>
                            <View style={styles.headerRight}>
                                <Text style={styles.categoryTotal}>{formatCurrency(cat.total)}</Text>
                                <IconSymbol
                                    name="chevron.right"
                                    size={20}
                                    color={Colors.gray[400]}
                                    style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                                />
                            </View>
                        </TouchableOpacity>

                        {isExpanded && (
                            <View style={styles.content}>
                                {loadingSubcategories ? (
                                    <ActivityIndicator size="small" color={Colors.primary[500]} />
                                ) : subcategoryData.length > 0 ? (
                                    subcategoryData.map((sub, index) => (
                                        <View key={index} style={styles.subRow}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <Text style={styles.subName}>{sub.subcategory}</Text>
                                                <Text style={styles.subTotal}>{formatCurrency(sub.total)}</Text>
                                            </View>
                                            {sub.grandTotal !== undefined && (
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <Text style={styles.subDetailLabel}>Grand Total: {formatCurrency(sub.grandTotal)}</Text>
                                                    <Text style={styles.subDetailLabel}>Avg/Mo: {formatCurrency(sub.monthlyAvg || 0)}</Text>
                                                    <Text style={styles.subDetailLabel}>Avg/Tx: {formatCurrency(sub.avgPerTx || 0)}</Text>
                                                </View>
                                            )}
                                        </View>
                                    ))
                                ) : (
                                    <Text style={styles.noData}>No subcategory data</Text>
                                )}
                            </View>
                        )}
                    </View>
                );
            })}

            {totalAmount !== undefined && categoryData.length > 0 && (
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Insights Amount</Text>
                    <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 10,
    },
    card: {
        backgroundColor: Colors.white,
        borderRadius: Layout.radius.md,
        marginBottom: 8,
        ...Layout.shadows.sm,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    headerExpanded: {
        backgroundColor: Colors.gray[50],
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 12,
    },
    categoryName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.gray[900],
    },
    categoryTotal: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.gray[900],
    },
    content: {
        padding: 16,
        backgroundColor: Colors.gray[50],
    },
    subRow: {
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[200],
    },
    subName: {
        fontSize: 14,
        color: Colors.gray[600],
    },
    subTotal: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.gray[800],
    },
    subDetailLabel: {
        fontSize: 11,
        color: Colors.gray[500],
    },
    noData: {
        textAlign: 'center',
        color: Colors.gray[400],
        fontStyle: 'italic',
        padding: 10,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: Colors.primary[50],
        borderRadius: Layout.radius.md,
        marginTop: 8,
        borderWidth: 1,
        borderColor: Colors.primary[100],
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary[700],
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.primary[800],
    },
});
