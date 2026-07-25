import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors as DefaultColors, Typography as DefaultTypography, Layout as DefaultLayout } from '../constants/Theme';

export type ColorPalette = 'coral' | 'emerald' | 'blue' | 'purple' | 'orange' | 'midnight';
export type ThemeMode = 'light' | 'dark' | 'system';
export type FontScale = 'sm' | 'md' | 'lg' | 'xl';
export type RadiusDensity = 'sharp' | 'medium' | 'round' | 'pill';
export type BackgroundStyle = 'solid' | 'warm' | 'gradient';
export type BalanceCardVariant = 'gradient_flip' | 'minimal_white' | 'compact_dark' | 'net_worth';
export type TransactionDensity = 'comfortable' | 'compact' | 'ultra';
export type TabBarStyle = 'floating' | 'standard' | 'minimal';

export interface ThemeConfig {
  palette: ColorPalette;
  mode: ThemeMode;
  fontScale: FontScale;
  radiusDensity: RadiusDensity;
  backgroundStyle: BackgroundStyle;
  balanceCardVariant: BalanceCardVariant;
  transactionDensity: TransactionDensity;
  tabBarStyle: TabBarStyle;
  showGreeting: boolean;
  showDate: boolean;
}

export interface DashboardWidget {
  id: string;
  label: string;
  description: string;
  visible: boolean;
  order: number;
  locked?: boolean;
}

export interface SidePanelItemConfig {
  id: string;
  visible: boolean;
}

export interface ThemeContextType {
  themeConfig: ThemeConfig;
  dashboardWidgets: DashboardWidget[];
  sidePanelItems: SidePanelItemConfig[];
  colors: typeof DefaultColors;
  typography: typeof DefaultTypography;
  radius: typeof DefaultLayout.radius;
  isDark: boolean;
  updateTheme: (partial: Partial<ThemeConfig>) => Promise<void>;
  updateWidgets: (widgets: DashboardWidget[]) => Promise<void>;
  updateSidePanel: (items: SidePanelItemConfig[]) => Promise<void>;
  resetAll: () => Promise<void>;
}

const DEFAULT_THEME_CONFIG: ThemeConfig = {
  palette: 'coral',
  mode: 'light',
  fontScale: 'md',
  radiusDensity: 'medium',
  backgroundStyle: 'warm',
  balanceCardVariant: 'gradient_flip',
  transactionDensity: 'comfortable',
  tabBarStyle: 'floating',
  showGreeting: true,
  showDate: true,
};

const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: 'balance_card', label: 'Main Balance Card', description: 'Total account balance & account switcher', visible: true, order: 0, locked: true },
  { id: 'metrics_grid', label: 'Income & Expense Grid', description: 'Today, Weekly, Yearly stats', visible: true, order: 1 },
  { id: 'monthly_spending', label: 'Monthly Breakdown', description: 'This Month spending & mini pie chart', visible: true, order: 2 },
  { id: 'satisfaction_card', label: 'Financial Satisfaction', description: 'Financial wellness indicator', visible: true, order: 3 },
  { id: 'cashflow_emi', label: 'Cash Flow & EMI Tracker', description: 'Monthly net cash flow & active EMIs', visible: true, order: 4 },
  { id: 'budget_progress', label: 'Budget Progress', description: 'Active budget progress scroll view', visible: true, order: 5 },
  { id: 'financial_modules', label: 'Financial Modules', description: 'Expense Books, Debts & Receivables', visible: true, order: 6 },
];

const DEFAULT_SIDE_PANEL_ITEMS: SidePanelItemConfig[] = [
  { id: 'account-detail', visible: true },
  { id: 'category-detail', visible: true },
  { id: 'budgets', visible: true },
  { id: 'income-breakdown', visible: true },
  { id: 'debt-calculator', visible: true },
  { id: 'debt-tracker', visible: true },
  { id: 'chit-funds', visible: true },
  { id: 'emi-tracker', visible: true },
  { id: 'scheduled-expenses', visible: true },
];

const PALETTES: Record<ColorPalette, { primary: typeof DefaultColors.primary; accent: typeof DefaultColors.accent }> = {
  coral: {
    primary: {
      50: '#FDECE7',
      100: '#FCD8CE',
      200: '#F8B19C',
      300: '#F38A6B',
      400: '#F0704C',
      500: '#E8917A',
      600: '#D66A4E',
      700: '#B04E35',
      800: '#8C3D29',
      900: '#692C1D',
    },
    accent: {
      peach: '#FDDCCC',
      mint: '#D6F0E0',
      lavender: '#EDE7F6',
      rose: '#FCE4EC',
    },
  },
  emerald: {
    primary: {
      50: '#ECFDF5',
      100: '#D1FAE5',
      200: '#A7F3D0',
      300: '#6EE7B7',
      400: '#34D399',
      500: '#10B981',
      600: '#059669',
      700: '#047857',
      800: '#065F46',
      900: '#064E3B',
    },
    accent: {
      peach: '#D1FAE5',
      mint: '#A7F3D0',
      lavender: '#E0E7FF',
      rose: '#FCE4EC',
    },
  },
  blue: {
    primary: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
    },
    accent: {
      peach: '#DBEAFE',
      mint: '#D1FAE5',
      lavender: '#EDE7F6',
      rose: '#FCE4EC',
    },
  },
  purple: {
    primary: {
      50: '#F5F3FF',
      100: '#EDE9FE',
      200: '#DDD6FE',
      300: '#C4B5FD',
      400: '#A78BFA',
      500: '#8B5CF6',
      600: '#7C3AED',
      700: '#6D28D9',
      800: '#5B21B6',
      900: '#4C1D95',
    },
    accent: {
      peach: '#EDE9FE',
      mint: '#D1FAE5',
      lavender: '#DDD6FE',
      rose: '#FCE4EC',
    },
  },
  orange: {
    primary: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      200: '#FDE68A',
      300: '#FCD34D',
      400: '#FBBF24',
      500: '#F59E0B',
      600: '#D97706',
      700: '#B45309',
      800: '#92400E',
      900: '#78350F',
    },
    accent: {
      peach: '#FEF3C7',
      mint: '#D1FAE5',
      lavender: '#EDE7F6',
      rose: '#FCE4EC',
    },
  },
  midnight: {
    primary: {
      50: '#EEF2FF',
      100: '#E0E7FF',
      200: '#C7D2FE',
      300: '#A5B4FC',
      400: '#818CF8',
      500: '#6366F1',
      600: '#4F46E5',
      700: '#4338CA',
      800: '#3730A3',
      900: '#312E81',
    },
    accent: {
      peach: '#E0E7FF',
      mint: '#D1FAE5',
      lavender: '#C7D2FE',
      rose: '#FCE4EC',
    },
  },
};

const STORAGE_KEY = '@gastos_theme_v1';

const ThemeContext = createContext<ThemeContextType>({
  themeConfig: DEFAULT_THEME_CONFIG,
  dashboardWidgets: DEFAULT_DASHBOARD_WIDGETS,
  sidePanelItems: DEFAULT_SIDE_PANEL_ITEMS,
  colors: DefaultColors,
  typography: DefaultTypography,
  radius: DefaultLayout.radius,
  isDark: false,
  updateTheme: async () => {},
  updateWidgets: async () => {},
  updateSidePanel: async () => {},
  resetAll: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(DEFAULT_THEME_CONFIG);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>(DEFAULT_DASHBOARD_WIDGETS);
  const [sidePanelItems, setSidePanelItems] = useState<SidePanelItemConfig[]>(DEFAULT_SIDE_PANEL_ITEMS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadStoredTheme = async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          const parsed = JSON.parse(json);
          if (parsed.themeConfig) {
            setThemeConfig({ ...DEFAULT_THEME_CONFIG, ...parsed.themeConfig });
          }
          if (Array.isArray(parsed.dashboardWidgets)) {
            // Merge with defaults in case new widgets were added
            const mergedWidgets = DEFAULT_DASHBOARD_WIDGETS.map(def => {
              const found = parsed.dashboardWidgets.find((w: DashboardWidget) => w.id === def.id);
              return found ? { ...def, visible: found.visible, order: found.order } : def;
            }).sort((a, b) => a.order - b.order);
            setDashboardWidgets(mergedWidgets);
          }
          if (Array.isArray(parsed.sidePanelItems)) {
            const mergedPanel = DEFAULT_SIDE_PANEL_ITEMS.map(def => {
              const found = parsed.sidePanelItems.find((i: SidePanelItemConfig) => i.id === def.id);
              return found ? { ...def, visible: found.visible } : def;
            });
            setSidePanelItems(mergedPanel);
          }
        }
      } catch (e) {
        console.error('Failed to load saved theme preferences:', e);
      } finally {
        setLoaded(true);
      }
    };
    loadStoredTheme();
  }, []);

  const saveToStorage = async (
    config: ThemeConfig,
    widgets: DashboardWidget[],
    panel: SidePanelItemConfig[]
  ) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ themeConfig: config, dashboardWidgets: widgets, sidePanelItems: panel })
      );
    } catch (e) {
      console.error('Failed to save theme to AsyncStorage:', e);
    }
  };

  const updateTheme = useCallback(async (partial: Partial<ThemeConfig>) => {
    setThemeConfig(prev => {
      const next = { ...prev, ...partial };
      saveToStorage(next, dashboardWidgets, sidePanelItems);
      return next;
    });
  }, [dashboardWidgets, sidePanelItems]);

  const updateWidgets = useCallback(async (newWidgets: DashboardWidget[]) => {
    const sorted = [...newWidgets].sort((a, b) => a.order - b.order);
    setDashboardWidgets(sorted);
    await saveToStorage(themeConfig, sorted, sidePanelItems);
  }, [themeConfig, sidePanelItems]);

  const updateSidePanel = useCallback(async (newItems: SidePanelItemConfig[]) => {
    setSidePanelItems(newItems);
    await saveToStorage(themeConfig, dashboardWidgets, newItems);
  }, [themeConfig, dashboardWidgets]);

  const resetAll = useCallback(async () => {
    setThemeConfig(DEFAULT_THEME_CONFIG);
    setDashboardWidgets(DEFAULT_DASHBOARD_WIDGETS);
    setSidePanelItems(DEFAULT_SIDE_PANEL_ITEMS);
    await saveToStorage(DEFAULT_THEME_CONFIG, DEFAULT_DASHBOARD_WIDGETS, DEFAULT_SIDE_PANEL_ITEMS);
  }, []);

  const isDark = useMemo(() => {
    if (themeConfig.mode === 'dark') return true;
    if (themeConfig.mode === 'system') return systemColorScheme === 'dark';
    return false;
  }, [themeConfig.mode, systemColorScheme]);

  const colors = useMemo(() => {
    const p = PALETTES[themeConfig.palette] || PALETTES.coral;

    if (!isDark) {
      return {
        ...DefaultColors,
        primary: p.primary,
        accent: p.accent,
      };
    }

    // Dark Mode Theme Scale Overrides
    return {
      ...DefaultColors,
      primary: p.primary,
      accent: {
        peach: 'rgba(253, 220, 204, 0.15)',
        mint: 'rgba(214, 240, 224, 0.15)',
        lavender: 'rgba(237, 231, 246, 0.15)',
        rose: 'rgba(252, 228, 236, 0.15)',
      },
      gray: {
        50: '#0F0F14',   // Deep dark background
        100: '#1C1C26',  // Card background
        200: '#2E2E40',  // Border
        300: '#484860',  // Disabled
        400: '#7B7B9A',  // Subtitle
        500: '#9E9EB8',  // Icons
        600: '#C2C2D6',  // Body text
        700: '#E0E0EC',  // Subheadings
        800: '#F0F0F8',  // Card Titles
        900: '#FFFFFF',  // Display headings
      },
      white: '#1C1C26', // White cards become dark surfaces
      black: '#FFFFFF',
    };
  }, [themeConfig.palette, isDark]);

  const typography = useMemo(() => {
    const scaleMap: Record<FontScale, number> = {
      sm: 0.88,
      md: 1.0,
      lg: 1.12,
      xl: 1.25,
    };
    const mult = scaleMap[themeConfig.fontScale] || 1.0;

    return {
      ...DefaultTypography,
      size: {
        xs: Math.round(12 * mult),
        sm: Math.round(14 * mult),
        md: Math.round(16 * mult),
        lg: Math.round(18 * mult),
        xl: Math.round(20 * mult),
        xxl: Math.round(24 * mult),
        xxxl: Math.round(32 * mult),
        display: Math.round(40 * mult),
      },
    };
  }, [themeConfig.fontScale]);

  const radius = useMemo(() => {
    const radiusMap: Record<RadiusDensity, typeof DefaultLayout.radius> = {
      sharp: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
      medium: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
      round: { sm: 12, md: 18, lg: 24, xl: 32, full: 9999 },
      pill: { sm: 16, md: 24, lg: 32, xl: 40, full: 9999 },
    };
    return radiusMap[themeConfig.radiusDensity] || DefaultLayout.radius;
  }, [themeConfig.radiusDensity]);

  return (
    <ThemeContext.Provider
      value={{
        themeConfig,
        dashboardWidgets,
        sidePanelItems,
        colors,
        typography,
        radius,
        isDark,
        updateTheme,
        updateWidgets,
        updateSidePanel,
        resetAll,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
