import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography } from '../constants/Theme';
import { ArrowLeft, Target, Plus, CheckCircle2, Edit2, Trash2, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import Svg, { Circle } from 'react-native-svg';
import { SavingsGoal, SavingsContribution, getGoals, addGoal, addContribution, calculateWeeklyTarget, getGoalProgress, getCompletedGoals, updateGoal, deleteGoal, getContributions, updateContribution, deleteContribution, getGoalById } from '../services/savingsGoals';
import { formatCurrency } from '../utils/currency';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BarChart } from 'react-native-gifted-charts';

const ProgressRing = ({ progress, size = 60, strokeWidth = 6, color = Colors.primary[500] }: { progress: number, size?: number, strokeWidth?: number, color?: string }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - progress * circumference;
    return (
        <Svg width={size} height={size}>
            <Circle stroke={Colors.gray[200]} fill="none" cx={size/2} cy={size/2} r={radius} strokeWidth={strokeWidth} />
            <Circle stroke={color} fill="none" cx={size/2} cy={size/2} r={radius} strokeWidth={strokeWidth}
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
        </Svg>
    );
};

export default function SavingsGoalsScreen() {
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [completedGoals, setCompletedGoals] = useState<SavingsGoal[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showContributeModal, setShowContributeModal] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
    const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
    const [showGoalDetailsModal, setShowGoalDetailsModal] = useState(false);
    const [contributions, setContributions] = useState<SavingsContribution[]>([]);
    const [editingContribution, setEditingContribution] = useState<SavingsContribution | null>(null);

    // Add Goal Form
    const [newName, setNewName] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newDeadline, setNewDeadline] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Contribution Form
    const [contribAmount, setContribAmount] = useState('');
    const [contribNotes, setContribNotes] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [active, completed] = await Promise.all([
            getGoals(),
            getCompletedGoals()
        ]);
        setGoals(active);
        setCompletedGoals(completed);
    };

    const handleAddGoal = async () => {
        const newErrors: Record<string, string> = {};
        if (!newName.trim()) newErrors.name = 'Goal name is required';
        if (!newTarget.trim() || isNaN(parseFloat(newTarget))) newErrors.target = 'Valid target amount is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});
        
        if (editingGoal) {
            await updateGoal(editingGoal.id, {
                name: newName,
                target_amount: parseFloat(newTarget),
                deadline: newDeadline.toISOString().split('T')[0]
            });
        } else {
            await addGoal(newName, parseFloat(newTarget), newDeadline.toISOString().split('T')[0], null);
        }
        
        setShowAddModal(false);
        setEditingGoal(null);
        setErrors({});
        setNewName('');
        setNewTarget('');
        loadData();
    };

    const openEditModal = (goal: SavingsGoal) => {
        setEditingGoal(goal);
        setNewName(goal.name);
        setNewTarget(goal.target_amount.toString());
        setNewDeadline(new Date(goal.deadline));
        setShowAddModal(true);
    };

    const closeGoalModal = () => {
        setShowAddModal(false);
        setEditingGoal(null);
        setErrors({});
        setNewName('');
        setNewTarget('');
    };

    const openGoalDetails = async (goal: SavingsGoal) => {
        setSelectedGoal(goal);
        setContributions(await getContributions(goal.id));
        setShowGoalDetailsModal(true);
    };

    const refreshSelectedGoal = async (goalId: number) => {
        await loadData();
        const freshContributions = await getContributions(goalId);
        const freshGoal = await getGoalById(goalId);
        if (freshGoal) setSelectedGoal(freshGoal);
        setContributions(freshContributions);
    };

    const handleDeleteGoal = async (goal: SavingsGoal) => {
        Alert.alert('Delete Goal', `Delete "${goal.name}" and all its contributions?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await deleteGoal(goal.id);
                    if (selectedGoal?.id === goal.id) {
                        setShowGoalDetailsModal(false);
                        setSelectedGoal(null);
                    }
                    closeGoalModal();
                    loadData();
                }
            }
        ]);
    };

    const handleAddContribution = async () => {
        if (!selectedGoal || !contribAmount.trim()) return;
        const amount = parseFloat(contribAmount);
        if (!amount || amount <= 0) return;

        if (editingContribution) {
            await updateContribution(editingContribution.id, amount, contribNotes);
        } else {
            await addContribution(selectedGoal.id, amount, contribNotes || 'Manual contribution');
        }
        setShowContributeModal(false);
        setContribAmount('');
        setContribNotes('');
        setEditingContribution(null);
        await refreshSelectedGoal(selectedGoal.id);
    };

    const openContributionModal = (goal: SavingsGoal, contribution?: SavingsContribution) => {
        setSelectedGoal(goal);
        setEditingContribution(contribution || null);
        setContribAmount(contribution ? contribution.amount.toString() : '');
        setContribNotes(contribution?.notes || '');
        setShowContributeModal(true);
    };

    const closeContributionModal = () => {
        setShowContributeModal(false);
        setContribAmount('');
        setContribNotes('');
        setEditingContribution(null);
    };

    const handleDeleteContribution = async (contribution: SavingsContribution) => {
        Alert.alert('Delete Contribution', 'Remove this contribution from the goal?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await deleteContribution(contribution.id);
                    if (selectedGoal) await refreshSelectedGoal(selectedGoal.id);
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.gray[800]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Savings Goals</Text>
                <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
                    <Plus size={24} color={Colors.primary[600]} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {goals.length === 0 && completedGoals.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Target size={48} color={Colors.gray[300]} />
                        <Text style={styles.emptyText}>No savings goals yet</Text>
                        <Button title="Create Goal" onPress={() => setShowAddModal(true)} style={{marginTop: 16}} />
                    </View>
                ) : (
                    <>
                        {goals.length > 0 && (
                            <Card style={{ marginBottom: 24, paddingVertical: 24, alignItems: 'center' }}>
                                <Text style={[styles.sectionTitle, { alignSelf: 'flex-start', marginLeft: 20, marginTop: -4 }]}>Progress Overview</Text>
                                <BarChart
                                    data={goals.map(g => ({
                                        value: g.current_amount,
                                        label: g.name.length > 6 ? g.name.substring(0, 5) + '..' : g.name,
                                        frontColor: g.color || Colors.primary[500],
                                        topLabelComponent: () => (
                                            <Text style={{color: Colors.gray[500], fontSize: 10, marginBottom: 4}}>
                                                {Math.round(getGoalProgress(g) * 100)}%
                                            </Text>
                                        )
                                    }))}
                                    barWidth={32}
                                    spacing={24}
                                    roundedTop
                                    hideRules
                                    xAxisThickness={0}
                                    yAxisThickness={0}
                                    yAxisTextStyle={{color: Colors.gray[500], fontSize: 10}}
                                    noOfSections={3}
                                    maxValue={Math.max(...goals.map(g => g.current_amount)) * 1.3 || 100}
                                    isAnimated
                                />
                            </Card>
                        )}
                        {goals.map(goal => {
                            const progress = getGoalProgress(goal);
                            const weekly = calculateWeeklyTarget(goal);
                            return (
                                <TouchableOpacity key={goal.id} activeOpacity={0.9} onPress={() => openGoalDetails(goal)}>
                                <Card style={styles.goalCard}>
                                    <View style={styles.goalHeader}>
                                        <View style={styles.goalIconBox}>
                                            <Text style={{fontSize: 24}}>{goal.icon}</Text>
                                        </View>
                                        <View style={styles.goalInfo}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={styles.goalName}>{goal.name}</Text>
                                                <TouchableOpacity onPress={() => openEditModal(goal)} style={{ padding: 4 }}>
                                                    <Edit2 size={16} color={Colors.primary[500]} />
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={styles.goalTarget}>Target: {formatCurrency(goal.target_amount)}</Text>
                                        </View>
                                        <View style={styles.progressContainer}>
                                            <ProgressRing progress={progress} color={goal.color} />
                                            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
                                        </View>
                                    </View>
                                    
                                    <View style={styles.goalStats}>
                                        <View>
                                            <Text style={styles.statLabel}>Saved so far</Text>
                                            <Text style={styles.statValue}>{formatCurrency(goal.current_amount)}</Text>
                                        </View>
                                        <View style={{alignItems: 'flex-end'}}>
                                            <Text style={styles.statLabel}>Needed Weekly</Text>
                                            <Text style={[styles.statValue, {color: Colors.primary[500]}]}>{formatCurrency(weekly)}</Text>
                                        </View>
                                    </View>
                                    
                                    <Button 
                                        title="Add Contribution" 
                                        variant="secondary"
                                        onPress={() => {
                                            openContributionModal(goal);
                                        }}
                                        style={{marginTop: 16}}
                                    />
                                </Card>
                                </TouchableOpacity>
                            );
                        })}

                        {completedGoals.length > 0 && (
                            <View style={styles.completedSection}>
                                <Text style={styles.sectionTitle}>Completed</Text>
                                {completedGoals.map(goal => (
                                    <Card key={goal.id} style={[styles.goalCard, {opacity: 0.8}]}>
                                        <View style={styles.goalHeader}>
                                            <View style={[styles.goalIconBox, {backgroundColor: Colors.success[100]}]}>
                                                <CheckCircle2 size={24} color={Colors.success[600]} />
                                            </View>
                                            <View style={styles.goalInfo}>
                                                <Text style={[styles.goalName, {textDecorationLine: 'line-through'}]}>{goal.name}</Text>
                                                <Text style={styles.goalTarget}>Reached {formatCurrency(goal.target_amount)}</Text>
                                            </View>
                                        </View>
                                    </Card>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            <Modal visible={showAddModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingGoal ? 'Edit Savings Goal' : 'New Savings Goal'}</Text>
                        
                        <Text style={styles.inputLabel}>Goal Name</Text>
                        <TextInput
                            style={[styles.input, errors.name && { borderColor: Colors.danger[300], borderWidth: 1 }]}
                            placeholder="e.g. New Macbook"
                            value={newName}
                            onChangeText={(val) => {
                                setNewName(val);
                                if (errors.name) setErrors(prev => ({...prev, name: ''}));
                            }}
                        />
                        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                        
                        <Text style={styles.inputLabel}>Target Amount</Text>
                        <TextInput
                            style={[styles.input, errors.target && { borderColor: Colors.danger[300], borderWidth: 1 }]}
                            placeholder="₹0"
                            keyboardType="numeric"
                            value={newTarget}
                            onChangeText={(val) => {
                                setNewTarget(val);
                                if (errors.target) setErrors(prev => ({...prev, target: ''}));
                            }}
                        />
                        {errors.target && <Text style={styles.errorText}>{errors.target}</Text>}

                        <Text style={styles.inputLabel}>Deadline</Text>
                        <TouchableOpacity 
                            style={styles.input} 
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text>{format(newDeadline, 'MMM dd, yyyy')}</Text>
                        </TouchableOpacity>

                        {showDatePicker && (
                            <DateTimePicker
                                value={newDeadline}
                                mode="date"
                                display="default"
                                onChange={(event, date) => {
                                    setShowDatePicker(false);
                                    if (date) setNewDeadline(date);
                                }}
                            />
                        )}

                        <View style={styles.modalButtons}>
                            {editingGoal && (
                                <TouchableOpacity onPress={() => handleDeleteGoal(editingGoal)} style={styles.deleteGoalButton}>
                                    <Trash2 size={18} color={Colors.danger[600]} />
                                </TouchableOpacity>
                            )}
                            <Button title="Cancel" variant="ghost" onPress={closeGoalModal} style={{flex: 1}} />
                            <Button title={editingGoal ? "Update Goal" : "Save Goal"} onPress={handleAddGoal} style={{flex: 1, marginLeft: 8}} />
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showGoalDetailsModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedGoal?.name}</Text>
                            <TouchableOpacity onPress={() => setShowGoalDetailsModal(false)} style={styles.iconButton}>
                                <X size={22} color={Colors.gray[600]} />
                            </TouchableOpacity>
                        </View>

                        {selectedGoal && (
                            <View style={styles.detailSummary}>
                                <Text style={styles.statLabel}>Current contribution</Text>
                                <Text style={styles.detailAmount}>{formatCurrency(selectedGoal.current_amount)}</Text>
                                <Text style={styles.goalTarget}>Target: {formatCurrency(selectedGoal.target_amount)}</Text>
                            </View>
                        )}

                        <View style={styles.detailActions}>
                            {selectedGoal && <Button title="Edit Goal" variant="secondary" onPress={() => openEditModal(selectedGoal)} containerStyle={{ flex: 1 }} />}
                            {selectedGoal && <Button title="Add Contribution" onPress={() => openContributionModal(selectedGoal)} containerStyle={{ flex: 1, marginLeft: 8 }} />}
                        </View>


                        <Text style={styles.sectionTitle}>Contributions</Text>
                        <ScrollView style={{ maxHeight: 260 }}>
                            {contributions.length === 0 ? (
                                <Text style={styles.emptyEvents}>No contributions yet.</Text>
                            ) : contributions.map(item => (
                                <View key={item.id} style={styles.contributionRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.contributionAmount}>{formatCurrency(item.amount)}</Text>
                                        <Text style={styles.contributionMeta}>{format(new Date(item.date), 'MMM dd, yyyy')} {item.notes ? `- ${item.notes}` : ''}</Text>
                                    </View>
                                    {!item.auto_detected && (
                                        <View style={styles.rowActions}>
                                            <TouchableOpacity onPress={() => selectedGoal && openContributionModal(selectedGoal, item)} style={styles.iconButton}>
                                                <Edit2 size={16} color={Colors.primary[600]} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDeleteContribution(item)} style={styles.iconButton}>
                                                <Trash2 size={16} color={Colors.danger[600]} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={showContributeModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingContribution ? 'Edit Contribution' : 'Add Contribution'}</Text>
                            <TouchableOpacity onPress={closeContributionModal} style={styles.iconButton}>
                                <X size={22} color={Colors.gray[600]} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{marginBottom: 16, color: Colors.gray[600]}}>To: {selectedGoal?.name}</Text>
                        
                        <Text style={styles.inputLabel}>Amount</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="₹0"
                            keyboardType="numeric"
                            value={contribAmount}
                            onChangeText={setContribAmount}
                            autoFocus
                        />
                        <Text style={styles.inputLabel}>Notes</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Optional note"
                            value={contribNotes}
                            onChangeText={setContribNotes}
                        />

                        <View style={styles.modalButtons}>
                            <Button title="Close" variant="ghost" onPress={closeContributionModal} style={{flex: 1}} />
                            <Button title={editingContribution ? 'Save' : 'Add'} onPress={handleAddContribution} style={{flex: 1, marginLeft: 8}} />
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.gray[50] },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, justifyContent: 'space-between' },
    backButton: { padding: 8, marginLeft: -8 },
    headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    addButton: { padding: 8, marginRight: -8 },
    content: { padding: 16 },
    emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
    emptyText: { marginTop: 16, fontSize: Typography.size.lg, color: Colors.gray[500] },
    goalCard: { marginBottom: 16 },
    goalHeader: { flexDirection: 'row', alignItems: 'center' },
    goalIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.gray[100], alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    goalInfo: { flex: 1 },
    goalName: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    goalTarget: { fontSize: Typography.size.sm, color: Colors.gray[500], marginTop: 4 },
    progressContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
    progressText: { position: 'absolute', fontSize: Typography.size.xs, fontFamily: Typography.family.bold, color: Colors.gray[700] },
    goalStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.gray[100] },
    statLabel: { fontSize: Typography.size.xs, color: Colors.gray[500], textTransform: 'uppercase' },
    statValue: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900], marginTop: 4 },
    completedSection: { marginTop: 32 },
    sectionTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 },
    modalTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 24 },
    inputLabel: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.gray[700], marginBottom: 8 },
    input: { backgroundColor: Colors.gray[100], borderRadius: 12, padding: 16, fontSize: Typography.size.md, marginBottom: 20 },
    modalButtons: { flexDirection: 'row', marginTop: 'auto', paddingTop: 24 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    iconButton: { padding: 8 },
    deleteGoalButton: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.danger[50], alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    detailSummary: { backgroundColor: Colors.primary[50], borderRadius: 16, padding: 16, marginBottom: 16 },
    detailAmount: { fontSize: Typography.size.xxxl, fontFamily: Typography.family.bold, color: Colors.primary[700], marginTop: 4 },
    detailActions: { flexDirection: 'row', marginBottom: 20 },
    contributionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
    contributionAmount: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    contributionMeta: { fontSize: Typography.size.xs, color: Colors.gray[500], marginTop: 2 },
    rowActions: { flexDirection: 'row', alignItems: 'center' },
    emptyEvents: { textAlign: 'center', color: Colors.gray[500], padding: 24 },
    errorText: {
        fontSize: 12,
        color: Colors.danger[600],
        fontFamily: Typography.family.medium,
        marginTop: -16,
        marginBottom: 12,
        marginLeft: 4,
    },
});
