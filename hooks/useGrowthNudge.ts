import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useGrowthNudge(nudgeKey: string) {
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);

  const storageKey = `nudge_shown_${nudgeKey}`;

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const val = await AsyncStorage.getItem(storageKey);
        if (active) {
          setShouldShow(val !== 'true');
        }
      } catch (e) {
        console.warn('Failed to check growth nudge status:', e);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    checkStatus();
    return () => {
      active = false;
    };
  }, [storageKey]);

  const dismiss = useCallback(async () => {
    try {
      await AsyncStorage.setItem(storageKey, 'true');
      setShouldShow(false);
    } catch (e) {
      console.warn('Failed to dismiss growth nudge:', e);
    }
  }, [storageKey]);

  return { shouldShow: !loading && shouldShow, dismiss };
}
