import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function TrialEndScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
