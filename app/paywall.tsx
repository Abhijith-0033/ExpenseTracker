import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function PaywallRoute() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
