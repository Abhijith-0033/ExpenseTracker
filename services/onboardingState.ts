/**
 * onboardingState.ts
 * Handles all reads and writes to the onboarding_state table.
 * Also manages related AsyncStorage keys for fast reads.
 * 
 * AsyncStorage keys managed here:
 *   'user_display_name'      ← user's name for certificate
 *   'certificate_number'     ← unique cert ID e.g. CERT-2026-12345
 *   'certificate_shown'      ← 'true' once first-time cert was shown
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDatabase, getDatabase } from './database';

// ─── AsyncStorage key constants ──────────────────────────────────────────────

export const ONBOARDING_KEYS = {
  USER_DISPLAY_NAME: 'user_display_name',
  CERTIFICATE_NUMBER: 'certificate_number',
  CERTIFICATE_SHOWN: 'certificate_shown',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingState {
  id: number;
  user_name: string | null;
  certificate_generated: number;    // 0 = not generated, 1 = generated
  certificate_number: string | null;
}

// ─── Database Helpers ─────────────────────────────────────────────────────────

/**
 * Returns the single onboarding_state row, or null if table is empty.
 * Always call initDatabase() before using getDatabase().
 */
export async function getOnboardingState(): Promise<OnboardingState | null> {
  try {
    await initDatabase();
    const db = getDatabase();
    const row = await db.getFirstAsync<OnboardingState>(
      'SELECT id, user_name, certificate_generated, certificate_number FROM onboarding_state LIMIT 1'
    );
    return row ?? null;
  } catch (error) {
    console.error('getOnboardingState error:', error);
    return null;
  }
}

/**
 * Saves the user's name to:
 *   1. onboarding_state.user_name (SQLite)
 *   2. AsyncStorage 'user_display_name'
 * 
 * @param name - The user's full name (trimmed)
 */
export async function saveUserName(name: string): Promise<void> {
  try {
    await initDatabase();
    const db = getDatabase();
    const trimmedName = name.trim();

    // Upsert into SQLite
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM onboarding_state LIMIT 1'
    );
    if (existing) {
      await db.runAsync(
        `UPDATE onboarding_state
         SET user_name = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [trimmedName, existing.id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO onboarding_state (user_name) VALUES (?)`,
        [trimmedName]
      );
    }

    // Save to AsyncStorage for fast reads
    await AsyncStorage.setItem(ONBOARDING_KEYS.USER_DISPLAY_NAME, trimmedName);
  } catch (error) {
    console.error('saveUserName error:', error);
    throw new Error(`Failed to save user name: ${(error as Error).message}`);
  }
}

/**
 * Generates a unique certificate number in format CERT-YYYY-NNNNN
 * and saves it to SQLite + AsyncStorage.
 * 
 * @returns The generated certificate number string
 */
export async function generateAndSaveCertificateNumber(): Promise<string> {
  try {
    const year = new Date().getFullYear();
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const certNumber = `CERT-${year}-${randomDigits}`;

    await initDatabase();
    const db = getDatabase();

    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM onboarding_state LIMIT 1'
    );
    if (existing) {
      await db.runAsync(
        `UPDATE onboarding_state
         SET certificate_number = ?, certificate_generated = 1, updated_at = datetime('now')
         WHERE id = ?`,
        [certNumber, existing.id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO onboarding_state (certificate_number, certificate_generated)
         VALUES (?, 1)`,
        [certNumber]
      );
    }

    // Save to AsyncStorage
    await AsyncStorage.setItem(ONBOARDING_KEYS.CERTIFICATE_NUMBER, certNumber);

    return certNumber;
  } catch (error) {
    console.error('generateAndSaveCertificateNumber error:', error);
    throw new Error(`Failed to generate certificate number: ${(error as Error).message}`);
  }
}

/**
 * Marks the certificate as having been shown to the user.
 * Saves 'certificate_shown' = 'true' to AsyncStorage.
 */
export async function markCertificateShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEYS.CERTIFICATE_SHOWN, 'true');
  } catch (error) {
    console.error('markCertificateShown error:', error);
  }
}

/**
 * Quick check: has the user already entered their name?
 * Reads from AsyncStorage first (fast path), then SQLite as fallback.
 * 
 * @returns The user's name string, or null if not set
 */
export async function getUserDisplayName(): Promise<string | null> {
  try {
    // Fast path: AsyncStorage
    const cached = await AsyncStorage.getItem(ONBOARDING_KEYS.USER_DISPLAY_NAME);
    if (cached && cached.trim().length > 0) return cached;

    // Slow path: SQLite
    const state = await getOnboardingState();
    if (state?.user_name && state.user_name.trim().length > 0) {
      // Sync back to AsyncStorage
      await AsyncStorage.setItem(ONBOARDING_KEYS.USER_DISPLAY_NAME, state.user_name);
      return state.user_name;
    }
    return null;
  } catch (error) {
    console.error('getUserDisplayName error:', error);
    return null;
  }
}

/**
 * Gets the stored certificate number from AsyncStorage (fast) or SQLite.
 * 
 * @returns The certificate number string, or null if not generated yet
 */
export async function getCertificateNumber(): Promise<string | null> {
  try {
    const cached = await AsyncStorage.getItem(ONBOARDING_KEYS.CERTIFICATE_NUMBER);
    if (cached) return cached;

    const state = await getOnboardingState();
    if (state?.certificate_number) {
      await AsyncStorage.setItem(
        ONBOARDING_KEYS.CERTIFICATE_NUMBER,
        state.certificate_number
      );
      return state.certificate_number;
    }
    return null;
  } catch (error) {
    console.error('getCertificateNumber error:', error);
    return null;
  }
}

/**
 * Updates the user's display name (from Edit Name flow in CertificateScreen).
 * Same as saveUserName but semantically named for editing.
 */
export async function updateUserName(newName: string): Promise<void> {
  return saveUserName(newName);
}
