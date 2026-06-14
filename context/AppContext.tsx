import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    initDatabase,
    getAccounts,
    getCategories,
    Account,
    CategoryNode
} from '../services/database';
import { useQueryClient } from '@tanstack/react-query';

interface AppContextType {
    accounts: Account[];
    categories: CategoryNode[];
    loading: boolean;
    soundEnabled: boolean;
    dataVersion: number;
    refreshData: () => Promise<void>;
    setSoundEnabled: (enabled: boolean) => Promise<void>;
}

const AppContext = createContext<AppContextType>({
    accounts: [],
    categories: [],
    loading: true,
    soundEnabled: true,
    dataVersion: 0,
    refreshData: async () => { },
    setSoundEnabled: async () => { },
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [soundEnabled, setSoundEnabledState] = useState(true);
    const [dataVersion, setDataVersion] = useState(0);

    const queryClient = useQueryClient();

    const refreshData = async () => {
        try {
            const [accs, cats] = await Promise.all([
                getAccounts(),
                getCategories()
            ]);
            setAccounts(accs);
            setCategories(cats);
            queryClient.invalidateQueries();
            setDataVersion(v => v + 1);
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
            accounts,
            categories,
            loading,
            soundEnabled,
            dataVersion,
            refreshData,
            setSoundEnabled
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);
