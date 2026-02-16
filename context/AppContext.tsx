import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    initDatabase,
    getTransactions,
    getAccounts,
    getCategories,
    Transaction,
    Account,
    CategoryNode
} from '../services/database';

interface AppContextType {
    transactions: Transaction[];
    accounts: Account[];
    categories: CategoryNode[];
    loading: boolean;
    soundEnabled: boolean;
    refreshData: () => Promise<void>;
    setSoundEnabled: (enabled: boolean) => Promise<void>;
}

const AppContext = createContext<AppContextType>({
    transactions: [],
    accounts: [],
    categories: [],
    loading: true,
    soundEnabled: true,
    refreshData: async () => { },
    setSoundEnabled: async () => { },
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [soundEnabled, setSoundEnabledState] = useState(true);

    const refreshData = async () => {
        try {
            const [txs, accs, cats] = await Promise.all([
                getTransactions(),
                getAccounts(),
                getCategories()
            ]);
            setTransactions(txs);
            setAccounts(accs);
            setCategories(cats);
        } catch (error) {
            console.error("Failed to fetch data", error);
        }
    };

    const setSoundEnabled = async (enabled: boolean) => {
        try {
            setSoundEnabledState(enabled);
            await AsyncStorage.setItem('sound_enabled', enabled ? 'true' : 'false');
        } catch (error) {
            console.error("Failed to save sound setting", error);
        }
    };

    useEffect(() => {
        const init = async () => {
            await initDatabase();

            // Load sound setting
            try {
                const savedSound = await AsyncStorage.getItem('sound_enabled');
                if (savedSound !== null) {
                    setSoundEnabledState(savedSound === 'true');
                }
            } catch (e) {
                console.error("Error loading sound preference", e);
            }

            await refreshData();
            setLoading(false);
        };
        init();
    }, []);

    return (
        <AppContext.Provider value={{
            transactions,
            accounts,
            categories,
            loading,
            soundEnabled,
            refreshData,
            setSoundEnabled
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);
