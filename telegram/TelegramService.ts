import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage keys — all prefixed with 'telegram_' to avoid collision
export const TELEGRAM_KEYS = {
  APP_USER_ID: 'telegram_app_user_id',
  SERVER_URL: 'telegram_server_url',
  ENABLED: 'telegram_enabled',
  LAST_POLL: 'telegram_last_poll',
  DEFAULT_ACCOUNT_ID: 'telegram_default_account_id',
};

// THIS VALUE MUST MATCH THE APP_SECRET_KEY IN YOUR SERVER .env
// Replace with your actual secret after server deployment
const APP_SECRET_KEY = 'b6e3690000dbz';

const TIMEOUT_MS = 10000; // 10 seconds

/**
 * Fetch with a timeout.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get stored server URL from AsyncStorage.
 */
export async function getServerUrl(): Promise<string | null> {
  return AsyncStorage.getItem(TELEGRAM_KEYS.SERVER_URL);
}

/**
 * Fetch pending transactions from server.
 * Returns null if server is unreachable (graceful offline handling).
 */
export async function fetchPending(appUserId: string): Promise<{ transactions: any[]; commands: any[] } | null> {
  try {
    const serverUrl = await getServerUrl();
    if (!serverUrl) return null;

    const response = await fetchWithTimeout(
      `${serverUrl}/api/pending/${appUserId}`,
      {
        method: 'GET',
        headers: {
          'X-App-Secret': APP_SECRET_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 401) {
      // Bad credentials — clear stored data
      await AsyncStorage.multiRemove([
        TELEGRAM_KEYS.APP_USER_ID,
        TELEGRAM_KEYS.SERVER_URL,
        TELEGRAM_KEYS.ENABLED,
      ]);
      console.warn('[Telegram] 401 — credentials cleared');
      return null;
    }

    if (!response.ok) return null;

    return await response.json();
  } catch (err) {
    // Network error, timeout, server down — all handled silently
    if ((err as any)?.name !== 'AbortError') {
      console.warn('[Telegram] fetchPending failed silently:', (err as any)?.message);
    }
    return null;
  }
}

/**
 * Mark a transaction as processed on the server.
 * Retries once on failure.
 */
export async function markProcessed(
  transactionId: string,
  appUserId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const attempt = async () => {
    const serverUrl = await getServerUrl();
    if (!serverUrl) return;

    await fetchWithTimeout(
      `${serverUrl}/api/processed/${transactionId}`,
      {
        method: 'POST',
        headers: {
          'X-App-Secret': APP_SECRET_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_user_id: appUserId,
          success,
          error_message: errorMessage,
        }),
      }
    );
  };

  try {
    await attempt();
  } catch {
    // Retry once after 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await attempt();
    } catch (retryErr) {
      console.warn('[Telegram] markProcessed retry failed:', retryErr);
    }
  }
}

/**
 * Send app's response to a bot command (/today, /balance, etc.)
 */
export async function sendCommandResponse(
  appUserId: string,
  commandId: number,
  responseText: string
): Promise<void> {
  try {
    const serverUrl = await getServerUrl();
    if (!serverUrl) return;

    await fetchWithTimeout(
      `${serverUrl}/api/command-response`,
      {
        method: 'POST',
        headers: {
          'X-App-Secret': APP_SECRET_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_user_id: appUserId,
          command_id: commandId,
          response_text: responseText,
        }),
      }
    );
  } catch (err) {
    console.warn('[Telegram] sendCommandResponse failed:', err);
  }
}

/**
 * Sync the user's app categories to the server.
 */
export async function syncCategories(appUserId: string, categories: string[]): Promise<void> {
  try {
    const serverUrl = await getServerUrl();
    if (!serverUrl) return;

    await fetchWithTimeout(
      `${serverUrl}/api/sync-categories`,
      {
        method: 'POST',
        headers: {
          'X-App-Secret': APP_SECRET_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ app_user_id: appUserId, categories }),
      },
      5000
    );
  } catch (err) {
    console.warn('[Telegram] syncCategories failed:', err);
  }
}

/**
 * Check if the server is reachable.
 */
export async function checkServerHealth(serverUrl: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${serverUrl}/health`, {}, 5000);
    return response.ok;
  } catch {
    return false;
  }
}
