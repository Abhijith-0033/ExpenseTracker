import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryNode, getCategories } from '../services/database';

export type CategoryType = 'essential' | 'non-essential';

const DEFAULT_CLASSIFICATION: Record<string, CategoryType> = {
  // Essential
  'Food':          'essential',
  'Rent':          'essential',
  'Bills':         'essential',
  'Transport':     'essential',
  'Healthcare':    'essential',
  'Groceries':     'essential',
  'Education':     'essential',
  'Utilities':     'essential',
  'Housing':       'essential',

  // Non-essential
  'Shopping':      'non-essential',
  'Entertainment': 'non-essential',
  'Luxury':        'non-essential',
  'Dining Out':    'non-essential',
  'Travel':        'non-essential',
  'Subscriptions': 'non-essential',
  'Gifts':         'non-essential',
  'Personal Care': 'non-essential',
};

const OVERRIDES_KEY = 'satisfaction_category_overrides';

export async function getUserOverrides(): Promise<Record<string, CategoryType>> {
  try {
    const data = await AsyncStorage.getItem(OVERRIDES_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('Failed to load category overrides:', e);
    return {};
  }
}

export async function saveUserOverride(category: string, type: CategoryType): Promise<void> {
  try {
    const overrides = await getUserOverrides();
    overrides[category] = type;
    await AsyncStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.error('Failed to save category override:', e);
  }
}

export async function getMergedClassifications(): Promise<Record<string, CategoryType>> {
  try {
    const dbCategories = await getCategories();
    const overrides = await getUserOverrides();
    
    const classifications: Record<string, CategoryType> = { ...DEFAULT_CLASSIFICATION };
    
    // Add DB categories defaulting to non-essential if not in default map
    dbCategories.forEach(cat => {
      if (!classifications[cat.name]) {
        classifications[cat.name] = 'non-essential';
      }
    });

    // Apply user overrides
    return { ...classifications, ...overrides };
  } catch (e) {
    console.error('Failed to get merged classifications:', e);
    return DEFAULT_CLASSIFICATION;
  }
}
