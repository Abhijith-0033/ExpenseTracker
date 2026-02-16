
// Design System Constants

export const Colors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // Brand color
    600: '#2563eb', // Default interactive
    700: '#1d4ed8', // Pressed / Darker
    800: '#1e40af',
    900: '#1e3a8a',
  },
  gray: {
    50: '#f9fafb', // Background
    100: '#f3f4f6', // Surface / Input bg
    200: '#e5e7eb', // Borders
    300: '#d1d5db', // Disabled text
    400: '#9ca3af', // Secondary text
    500: '#6b7280', // Icon default
    600: '#4b5563', // Body text
    700: '#374151',
    800: '#1f2937', // Titles
    900: '#111827', // Headings
  },
  success: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    bg: '#ecfdf5',
    text: '#047857',
  },
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    bg: '#fef2f2',
    text: '#b91c1c',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    bg: '#fffbeb',
    text: '#b45309',
  },
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  // Legacy support for template components
  light: {
    text: '#111827',
    background: '#fff',
    tint: '#3b82f6',
    icon: '#6b7280',
    tabIconDefault: '#9ca3af',
    tabIconSelected: '#3b82f6',
  },
  dark: {
    text: '#fff',
    background: '#111827',
    tint: '#fff',
    icon: '#9ca3af',
    tabIconDefault: '#9ca3af',
    tabIconSelected: '#fff',
  }
};

export const Layout = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4, // Android
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
  },
};
