import { useState, useCallback, useEffect } from 'react';
import { InteractionManager, DeviceEventEmitter } from 'react-native';
import { SatisfactionEngine, SatisfactionMetrics, SatisfactionStatus } from './SatisfactionEngine';
import { generateInsights, SatisfactionInsight } from './SatisfactionInsights';

export function useSatisfaction(period: string = 'month') {
  const [score, setScore] = useState<number | null>(null);
  const [status, setStatus] = useState<SatisfactionStatus | null>(null);
  const [metrics, setMetrics] = useState<SatisfactionMetrics | null>(null);
  const [insights, setInsights] = useState<SatisfactionInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const compute = useCallback(() => {
    setLoading(true);
    // Run off main thread to avoid blocking UI
    InteractionManager.runAfterInteractions(async () => {
      try {
        const result = await SatisfactionEngine.compute(period);
        setScore(result.finalScore);
        setStatus(result.status);
        setMetrics(result.metrics);
        setInsights(generateInsights(result.metrics, result.finalScore));
      } catch (error) {
        console.error('Failed to compute satisfaction score:', error);
      } finally {
        setLoading(false);
      }
    });
  }, [period]);

  useEffect(() => {
    compute();
  }, [compute]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('RECOMPUTE_SATISFACTION', compute);
    return () => sub.remove();
  }, [compute]);

  return { score, status, metrics, insights, loading, recompute: compute };
}
