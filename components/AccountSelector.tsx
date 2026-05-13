import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, Wallet } from 'lucide-react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { Account } from '../services/database';
import { formatCurrency } from '../utils/currency';

interface AccountSelectorProps {
    accounts: Account[];
    selectedAccountId: number | null;
    onSelect: (accountId: number | null) => void;
    includeNoAccount?: boolean;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
    accounts,
    selectedAccountId,
    onSelect,
    includeNoAccount = true,
}) => {
    const options = includeNoAccount
        ? [{ id: null, name: 'No Account', type: 'Optional', balance: null }, ...accounts]
        : accounts;

    if (options.length === 0) {
        return (
            <View style={styles.emptyState}>
                <Wallet size={18} color={Colors.gray[400]} />
                <Text style={styles.emptyText}>No accounts available</Text>
            </View>
        );
    }

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.content}
        >
            {options.map((account) => {
                const isSelected = selectedAccountId === account.id;

                return (
                    <TouchableOpacity
                        key={account.id ?? 'no-account'}
                        style={[styles.option, isSelected && styles.selectedOption]}
                        activeOpacity={0.85}
                        onPress={() => onSelect(account.id)}
                    >
                        <View style={[styles.iconWrap, isSelected && styles.selectedIconWrap]}>
                            {isSelected ? (
                                <Check size={16} color={Colors.white} />
                            ) : (
                                <Wallet size={16} color={Colors.primary[600]} />
                            )}
                        </View>
                        <View style={styles.textWrap}>
                            <Text
                                style={[styles.name, isSelected && styles.selectedText]}
                                numberOfLines={1}
                            >
                                {account.name}
                            </Text>
                            <Text
                                style={[styles.detail, isSelected && styles.selectedDetail]}
                                numberOfLines={1}
                            >
                                {account.balance === null ? account.type : formatCurrency(account.balance)}
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    content: {
        gap: 8,
        paddingVertical: 2,
    },
    option: {
        minWidth: 136,
        maxWidth: 180,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: Colors.gray[200],
        backgroundColor: Colors.white,
    },
    selectedOption: {
        borderColor: Colors.primary[600],
        backgroundColor: Colors.primary[50],
    },
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: Layout.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary[50],
    },
    selectedIconWrap: {
        backgroundColor: Colors.primary[600],
    },
    textWrap: {
        flex: 1,
        minWidth: 0,
    },
    name: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.bold,
        color: Colors.gray[800],
    },
    selectedText: {
        color: Colors.primary[700],
    },
    detail: {
        marginTop: 2,
        fontSize: Typography.size.xs,
        fontFamily: Typography.family.medium,
        color: Colors.gray[500],
    },
    selectedDetail: {
        color: Colors.primary[700],
    },
    emptyState: {
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        borderRadius: Layout.radius.lg,
        borderWidth: 1,
        borderColor: Colors.gray[200],
        backgroundColor: Colors.gray[50],
    },
    emptyText: {
        fontSize: Typography.size.sm,
        fontFamily: Typography.family.medium,
        color: Colors.gray[500],
    },
});
