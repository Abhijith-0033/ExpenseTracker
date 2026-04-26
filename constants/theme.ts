// Premium Design System Constants v2.0.0

export const Colors = {
  primary: {
    50: '#FDECE7',
    100: '#FCD8CE',
    200: '#F8B19C',
    300: '#F38A6B',
    400: '#F0704C',
    500: '#E8917A', // Warm coral - Brand color
    600: '#D66A4E', // Default interactive
    700: '#B04E35', // Pressed / Darker
    800: '#8C3D29',
    900: '#692C1D',
  },
  accent: {
    peach: '#FDDCCC',    // Tinted card background
    mint: '#D6F0E0',     // Success tinted card
    lavender: '#EDE7F6', // Analytics tinted card
    rose: '#FCE4EC',     // Additional tint
  },
  gray: {
    50: '#FAFAF8', // Warm white - Main Background
    100: '#F4F4F2', // Surface / Input bg
    200: '#EAEAE7', // Borders
    300: '#D5D5D1', // Disabled text
    400: '#A3A3A0', // Secondary text
    500: '#737370', // Icon default
    600: '#52524F', // Body text
    700: '#383836',
    800: '#262624', // Titles
    900: '#1A1A2E', // Headings - Deep navy
  },
  success: {
    50: '#EBF7F0',
    100: '#D6F0E0',
    200: '#ADDDC0',
    300: '#83CAA1',
    400: '#6BAF8D', // Sage - Success color
    500: '#4D966F',
    600: '#377A55',
    700: '#265E3F',
    800: '#18422A',
    900: '#0C2618',
    bg: '#EBF7F0',
    text: '#265E3F',
  },
  danger: {
    50: '#FDF1F1',
    100: '#FAE1E1',
    200: '#F2BEBE',
    300: '#EA9999',
    400: '#E07070', // Soft red - Danger color
    500: '#D44D4D',
    600: '#B53737',
    700: '#8F2626',
    800: '#691818',
    900: '#420C0C',
    bg: '#FDF1F1',
    text: '#8F2626',
  },
  warning: {
    50: '#FDF8EC',
    100: '#FCEFCC',
    200: '#F8DB99',
    300: '#F4C666',
    400: '#E4A853', // Warm amber - Warning color
    500: '#CF8D32',
    600: '#A66E24',
    700: '#7D5117',
    800: '#54340A',
    900: '#2E1B04',
    bg: '#FDF8EC',
    text: '#7D5117',
  },
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  // Legacy support
  light: {
    text: '#1A1A2E',
    background: '#FAFAF8',
    tint: '#E8917A',
    icon: '#737370',
    tabIconDefault: '#A3A3A0',
    tabIconSelected: '#E8917A',
  },
  dark: {
    text: '#ffffff',
    background: '#1A1A2E',
    tint: '#E8917A',
    icon: '#A3A3A0',
    tabIconDefault: '#737370',
    tabIconSelected: '#ffffff',
  }
};

export const Typography = {
  family: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    bold: 'DMSans_700Bold',
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 40,
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
      shadowColor: '#1A1A2E',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: '#1A1A2E',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 4,
    },
    lg: {
      shadowColor: '#1A1A2E',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 8,
    },
    xl: {
      shadowColor: '#E8917A', // Tinted shadow for primary elements
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.15,
      shadowRadius: 32,
      elevation: 12,
    },
  },
};
