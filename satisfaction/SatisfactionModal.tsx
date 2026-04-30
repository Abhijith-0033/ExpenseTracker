import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, Switch } from 'react-native';
import { Colors, Layout, Typography } from '../constants/Theme';
import { X, ChevronDown, ChevronUp, Brain, Settings } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { SatisfactionMetrics, SatisfactionStatus } from './SatisfactionEngine';
import { SatisfactionInsight } from './SatisfactionInsights';
import { formatCurrency } from '../utils/currency';
import { getMergedClassifications, saveUserOverride, CategoryType } from './categoryClassification';


const { width } = Dimensions.get('window');

interface SatisfactionModalProps {
  visible: boolean;
  onClose: () => void;
  score: number | null;
  status: SatisfactionStatus | null;
  metrics: SatisfactionMetrics | null;
  insights: SatisfactionInsight[];
  recompute: () => void;
}

export default function SatisfactionModal({ visible, onClose, score, status, metrics, insights, recompute }: SatisfactionModalProps) {
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  
  // Animation Values
  const scoreAnim = useSharedValue(0);
  const savingsWidth = useSharedValue(0);
  const essentialWidth = useSharedValue(0);
  const balanceWidth = useSharedValue(0);
  const consistencyWidth = useSharedValue(0);

  useEffect(() => {
    if (visible && score !== null && metrics) {
      scoreAnim.value = withTiming(score, { duration: 1000 });
      
      const maxSavingsPts = 40;
      const savingsScore = Math.min(Math.max(metrics.savingsRate, 0), 1) * 40;
      savingsWidth.value = withDelay(300, withTiming(savingsScore / maxSavingsPts, { duration: 800 }));

      const maxEssPts = 20;
      const essScore = metrics.essentialRatio * 20;
      essentialWidth.value = withDelay(400, withTiming(essScore / maxEssPts, { duration: 800 }));

      const maxBalPts = 20;
      const balScore = metrics.balanceStability * 20;
      balanceWidth.value = withDelay(500, withTiming(balScore / maxBalPts, { duration: 800 }));

      const maxConsPts = 20;
      const consScore = metrics.consistencyScore * 20;
      consistencyWidth.value = withDelay(600, withTiming(consScore / maxConsPts, { duration: 800 }));
    } else {
      scoreAnim.value = 0;
      savingsWidth.value = 0;
      essentialWidth.value = 0;
      balanceWidth.value = 0;
      consistencyWidth.value = 0;
      setShowAdjustments(false);
      setShowCategoryEditor(false);
    }
  }, [visible, score, metrics]);

  if (!metrics || !status || score === null) return null;

  const AnimatedBar = ({ label, valueAnim, maxPts, actualPts, expl }: any) => {
    const barStyle = useAnimatedStyle(() => ({
      width: `${valueAnim.value * 100}%`,
    }));

    return (
      <View style={styles.barContainer}>
        <View style={styles.barHeader}>
          <Text style={styles.barLabel}>{label}</Text>
          <Text style={styles.barPoints}>{Math.round(actualPts)}/{maxPts} pts</Text>
        </View>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { backgroundColor: status.color }, barStyle]} />
        </View>
        <Text style={styles.barExpl}>{expl}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Brain size={24} color={Colors.gray[900]} />
              <Text style={styles.title}>Financial Health</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={Colors.gray[500]} />
            </TouchableOpacity>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {!showCategoryEditor ? (
              <>
                {/* Score Section */}
                <View style={styles.scoreSection}>
                  <View style={styles.ringContainer}>
                    <View style={[styles.ringOuter, { borderColor: `${status.color}33` }]}>
                      {/* Simplified ring visualization */}
                      <View style={[styles.ringInner, { borderColor: status.color }]}>
                        <Text style={styles.scoreNumber}>{score}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusEmoji}>{status.emoji}</Text>
                    <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
                  </View>
                  <Text style={styles.statusDesc}>{status.description}</Text>
                </View>

                {/* Score Breakdown */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Score Breakdown</Text>
                  <AnimatedBar 
                    label="Savings Rate" 
                    valueAnim={savingsWidth} 
                    maxPts={40} 
                    actualPts={Math.min(Math.max(metrics.savingsRate, 0), 1) * 40}
                    expl={`Based on your savings rate of ${(metrics.savingsRate * 100).toFixed(0)}%`}
                  />
                  <AnimatedBar 
                    label="Essential Ratio" 
                    valueAnim={essentialWidth} 
                    maxPts={20} 
                    actualPts={metrics.essentialRatio * 20}
                    expl={`${(metrics.essentialRatio * 100).toFixed(0)}% of expenses are essential`}
                  />
                  <AnimatedBar 
                    label="Balance Stability" 
                    valueAnim={balanceWidth} 
                    maxPts={20} 
                    actualPts={metrics.balanceStability * 20}
                    expl="Month-over-month balance retention"
                  />
                  <AnimatedBar 
                    label="Consistency" 
                    valueAnim={consistencyWidth} 
                    maxPts={20} 
                    actualPts={metrics.consistencyScore * 20}
                    expl="Stability of weekly spending patterns"
                  />
                </View>

                {/* Adjustments */}
                <View style={styles.section}>
                  <TouchableOpacity style={styles.adjHeader} onPress={() => setShowAdjustments(!showAdjustments)}>
                    <Text style={styles.sectionTitle}>Adjustments Applied</Text>
                    {showAdjustments ? <ChevronUp size={20} color={Colors.gray[500]} /> : <ChevronDown size={20} color={Colors.gray[500]} />}
                  </TouchableOpacity>
                  
                  {showAdjustments && (
                    <View style={styles.adjContent}>
                      {metrics.penalties.length === 0 && metrics.bonuses.length === 0 && (
                        <Text style={styles.noAdjText}>No adjustments this period</Text>
                      )}
                      {metrics.penalties.map((p, i) => (
                        <View key={`pen-${i}`} style={[styles.adjRow, { backgroundColor: Colors.danger[50] }]}>
                          <Text style={[styles.adjText, { color: Colors.danger[700] }]}>⬇ {p.reason}</Text>
                          <Text style={[styles.adjPts, { color: Colors.danger[700] }]}>-{p.points} pts</Text>
                        </View>
                      ))}
                      {metrics.bonuses.map((b, i) => (
                        <View key={`bon-${i}`} style={[styles.adjRow, { backgroundColor: Colors.success[50] }]}>
                          <Text style={[styles.adjText, { color: Colors.success[700] }]}>⬆ {b.reason}</Text>
                          <Text style={[styles.adjPts, { color: Colors.success[700] }]}>+{b.points} pts</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Spending Breakdown */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Spending Breakdown</Text>
                  <View style={styles.spendCardsRow}>
                    <View style={[styles.spendCard, { backgroundColor: Colors.success[50] }]}>
                      <Text style={[styles.spendLabel, { color: Colors.success[700] }]}>Essential</Text>
                      <Text style={[styles.spendAmount, { color: Colors.success[800] }]}>{formatCurrency(metrics.essentialExpense)}</Text>
                      <Text style={[styles.spendPct, { color: Colors.success[600] }]}>
                        {metrics.totalExpense > 0 ? ((metrics.essentialExpense / metrics.totalExpense) * 100).toFixed(0) : 0}%
                      </Text>
                    </View>
                    <View style={[styles.spendCard, { backgroundColor: Colors.danger[50] }]}>
                      <Text style={[styles.spendLabel, { color: Colors.danger[700] }]}>Non-essential</Text>
                      <Text style={[styles.spendAmount, { color: Colors.danger[800] }]}>{formatCurrency(metrics.nonEssentialExpense)}</Text>
                      <Text style={[styles.spendPct, { color: Colors.danger[600] }]}>
                        {metrics.totalExpense > 0 ? ((metrics.nonEssentialExpense / metrics.totalExpense) * 100).toFixed(0) : 0}%
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Insights */}
                {insights.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Insights & Actions</Text>
                    {insights.map((insight, idx) => (
                      <View key={`ins-${idx}`} style={styles.insightCard}>
                        <View style={[styles.insightIcon, { backgroundColor: `${insight.color}1A` }]}>
                          <Text style={styles.insightEmoji}>{insight.icon}</Text>
                        </View>
                        <View style={styles.insightContent}>
                          <Text style={styles.insightTitle}>{insight.title}</Text>
                          <Text style={styles.insightBody}>{insight.body}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Category Editor Toggle */}
                <TouchableOpacity style={styles.editBtn} onPress={() => setShowCategoryEditor(true)}>
                  <Settings size={20} color={Colors.primary[600]} />
                  <Text style={styles.editBtnText}>Edit Category Types</Text>
                </TouchableOpacity>
              </>
            ) : (
              <CategoryEditor 
                onClose={() => {
                  setShowCategoryEditor(false);
                  recompute();
                }} 
              />
            )}
            
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CategoryEditor({ onClose }: { onClose: () => void }) {
  const [categories, setCategories] = useState<{name: string, type: CategoryType}[]>([]);
  
  useEffect(() => {
    async function load() {
      const { getCategories } = require('../services/database');
      const dbCats = await getCategories();
      const merged = await getMergedClassifications();
      
      const list = dbCats.map((c: any) => ({
        name: c.name,
        type: merged[c.name] || 'non-essential'
      }));
      setCategories(list);
    }
    load();
  }, []);

  const toggleCategory = async (name: string, currentType: CategoryType) => {
    const newType = currentType === 'essential' ? 'non-essential' : 'essential';
    await saveUserOverride(name, newType);
    setCategories(prev => prev.map(c => c.name === name ? { ...c, type: newType } : c));
  };

  return (
    <View style={styles.editorContainer}>
      <TouchableOpacity style={styles.backBtn} onPress={onClose}>
        <Text style={styles.backBtnText}>← Back to Health Score</Text>
      </TouchableOpacity>
      <Text style={styles.editorTitle}>Classification Editor</Text>
      <Text style={styles.editorSub}>Toggle categories to mark them as Essential.</Text>
      
      {categories.map((cat, idx) => (
        <View key={`cat-${idx}`} style={styles.editorRow}>
          <Text style={styles.editorCatName}>{cat.name}</Text>
          <View style={styles.editorToggle}>
            <Text style={[styles.editorCatType, { color: cat.type === 'essential' ? Colors.success[600] : Colors.gray[400] }]}>
              {cat.type === 'essential' ? 'Essential' : 'Non-essential'}
            </Text>
            <Switch 
              value={cat.type === 'essential'} 
              onValueChange={() => toggleCategory(cat.name, cat.type)}
              trackColor={{ false: Colors.gray[200], true: Colors.success[400] }}
              thumbColor={Colors.white}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
  },
  closeBtn: {
    padding: 8,
    marginRight: -8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  scoreSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  ringContainer: {
    marginBottom: 16,
  },
  ringOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    position: 'absolute',
    transform: [{ rotate: '-45deg' }], // basic approximation, a true progress ring would use SVG
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 48,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    transform: [{ rotate: '45deg' }], // correct inner rotation
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusEmoji: {
    fontSize: 24,
  },
  statusLabel: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.family.bold,
  },
  statusDesc: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[500],
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 16,
  },
  barContainer: {
    marginBottom: 16,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[800],
  },
  barPoints: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[500],
  },
  barTrack: {
    height: 6,
    backgroundColor: Colors.gray[100],
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barExpl: {
    fontSize: 10,
    fontFamily: Typography.family.regular,
    color: Colors.gray[400],
  },
  adjHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adjContent: {
    marginTop: 8,
    gap: 8,
  },
  noAdjText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.gray[400],
    fontStyle: 'italic',
  },
  adjRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
  },
  adjText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
  },
  adjPts: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
  },
  spendCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  spendCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
  },
  spendLabel: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    marginBottom: 4,
  },
  spendAmount: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    marginBottom: 2,
  },
  spendPct: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
  },
  insightCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.gray[50],
    borderRadius: 16,
    marginBottom: 12,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightEmoji: {
    fontSize: 20,
  },
  insightContent: {
    flex: 1,
    justifyContent: 'center',
  },
  insightTitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 2,
  },
  insightBody: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.gray[600],
    lineHeight: 18,
  },
  editBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: Colors.primary[50],
    borderRadius: 16,
    gap: 8,
  },
  editBtnText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.bold,
    color: Colors.primary[700],
  },
  editorContainer: {
    paddingVertical: 16,
  },
  backBtn: {
    marginBottom: 24,
  },
  backBtnText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.primary[600],
  },
  editorTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.gray[900],
    marginBottom: 4,
  },
  editorSub: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.gray[500],
    marginBottom: 24,
  },
  editorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  editorCatName: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[800],
  },
  editorToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editorCatType: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    textTransform: 'uppercase',
  },
});
