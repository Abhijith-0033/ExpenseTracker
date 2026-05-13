import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography } from '../constants/Theme';
import { ArrowLeft, AlertTriangle, CalendarClock, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react-native';
import { router } from 'expo-router';
import { Card } from '../components/ui/Card';
import { CashFlowDay, generateCashFlowForecast } from '../services/cashFlow';
import { formatCurrency } from '../utils/currency';
import { format, parseISO } from 'date-fns';
import { LineChart } from 'react-native-gifted-charts';

export default function CashFlowScreen() {
    const [forecast, setForecast] = useState<CashFlowDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState<CashFlowDay | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await generateCashFlowForecast(30);
        setForecast(data);
        if (data.length > 0) setSelectedDay(data[0]);
        setLoading(false);
    };

    const totalIncome = forecast.reduce((sum, d) => sum + d.predictedIncome, 0);
    const totalExpense = forecast.reduce((sum, d) => sum + d.predictedExpense, 0);
    const negativeDays = forecast.filter(d => d.isNegative).length;

    const renderCalendarGrid = () => {
        return (
            <View style={styles.calendarGrid}>
                {forecast.map((day, i) => {
                    const dateObj = parseISO(day.date);
                    const isSelected = selectedDay?.date === day.date;
                    const hasEvents = day.events.length > 0;
                    
                    return (
                        <TouchableOpacity 
                            key={i} 
                            style={[
                                styles.dayCell, 
                                isSelected && styles.selectedDayCell,
                                day.isNegative && styles.negativeDayCell
                            ]}
                            onPress={() => setSelectedDay(day)}
                        >
                            <Text style={[styles.dayName, isSelected && styles.selectedText]}>{format(dateObj, 'E')}</Text>
                            <Text style={[styles.dayNum, isSelected && styles.selectedText, day.isNegative && styles.negativeText]}>{format(dateObj, 'd')}</Text>
                            
                            {hasEvents && (
                                <View style={styles.dotContainer}>
                                    {day.predictedIncome > 0 && <View style={[styles.dot, {backgroundColor: Colors.success[500]}]} />}
                                    {day.predictedExpense > 0 && <View style={[styles.dot, {backgroundColor: Colors.danger[500]}]} />}
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.gray[800]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>30-Day Cash Flow</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {negativeDays > 0 && (
                    <View style={styles.warningBanner}>
                        <AlertTriangle size={20} color={Colors.danger[600]} style={{marginRight: 8}} />
                        <View style={{flex: 1}}>
                            <Text style={styles.warningTitle}>Low Balance Warning</Text>
                            <Text style={styles.warningText}>Your balance may go negative on {negativeDays} upcoming days.</Text>
                        </View>
                    </View>
                )}

                <View style={styles.summaryRow}>
                    <Card style={styles.summaryCard}>
                        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                            <TrendingUp size={16} color={Colors.success[600]} style={{marginRight: 4}} />
                            <Text style={styles.summaryLabel}>Expected In</Text>
                        </View>
                        <Text style={[styles.summaryVal, {color: Colors.success[700]}]}>{formatCurrency(totalIncome)}</Text>
                    </Card>
                    <View style={{width: 12}} />
                    <Card style={styles.summaryCard}>
                        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                            <TrendingDown size={16} color={Colors.danger[600]} style={{marginRight: 4}} />
                            <Text style={styles.summaryLabel}>Expected Out</Text>
                        </View>
                        <Text style={[styles.summaryVal, {color: Colors.danger[700]}]}>{formatCurrency(totalExpense)}</Text>
                    </Card>
                </View>

                <Text style={styles.sectionTitle}>Balance Trend</Text>
                {forecast.length > 0 && (
                    <Card style={{ padding: 16, marginBottom: 24, paddingRight: 0 }}>
                        <LineChart
                            data={forecast.map(d => ({
                                value: d.runningBalance,
                                label: format(parseISO(d.date), 'dd')
                            }))}
                            color={negativeDays > 0 ? Colors.danger[500] : Colors.success[500]}
                            thickness={3}
                            hideDataPoints
                            spacing={20}
                            height={120}
                            adjustToWidth
                            yAxisTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
                            xAxisLabelTextStyle={{ color: Colors.gray[400], fontSize: 10 }}
                            noOfSections={3}
                            yAxisColor={Colors.gray[200]}
                            xAxisColor={Colors.gray[200]}
                            isAnimated
                        />
                    </Card>
                )}

                <Text style={styles.sectionTitle}>Forecast Calendar</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 16}}>
                    {renderCalendarGrid()}
                </ScrollView>

                {selectedDay && (
                    <View style={styles.detailsSection}>
                        <View style={styles.detailsHeader}>
                            <Text style={styles.detailsTitle}>{format(parseISO(selectedDay.date), 'EEEE, MMMM d')}</Text>
                            <View style={[styles.balanceBadge, selectedDay.isNegative && {backgroundColor: Colors.danger[50]}]}>
                                <Text style={[styles.balanceLabel, selectedDay.isNegative && {color: Colors.danger[700]}]}>End Balance</Text>
                                <Text style={[styles.balanceVal, selectedDay.isNegative && {color: Colors.danger[700]}]}>{formatCurrency(selectedDay.runningBalance)}</Text>
                            </View>
                        </View>

                        {selectedDay.events.length === 0 ? (
                            <Text style={styles.emptyEvents}>No expected transactions for this day.</Text>
                        ) : (
                            selectedDay.events.map((event, i) => (
                                <Card key={i} style={styles.eventCard}>
                                    <View style={[styles.eventIcon, {backgroundColor: event.type === 'income' ? Colors.success[50] : Colors.danger[50]}]}>
                                        {event.source === 'subscription' ? <RefreshCw size={20} color={Colors.danger[600]} /> :
                                         event.source === 'scheduled' ? <CalendarClock size={20} color={Colors.danger[600]} /> :
                                         event.type === 'income' ? <TrendingUp size={20} color={Colors.success[600]} /> :
                                         <TrendingDown size={20} color={Colors.danger[600]} />}
                                    </View>
                                    <View style={styles.eventInfo}>
                                        <Text style={styles.eventName}>{event.description}</Text>
                                        <Text style={styles.eventSource}>{event.source === 'predicted' ? 'Predicted from history' : event.source === 'scheduled' ? 'Scheduled bill' : 'Subscription'}</Text>
                                    </View>
                                    <Text style={[styles.eventAmount, {color: event.type === 'income' ? Colors.success[600] : Colors.gray[900]}]}>
                                        {event.type === 'income' ? '+' : '-'}{formatCurrency(event.amount)}
                                    </Text>
                                </Card>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.gray[50] },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    backButton: { padding: 8, marginRight: 8, marginLeft: -8 },
    headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    content: { padding: 16, paddingTop: 0 },
    warningBanner: { flexDirection: 'row', backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: Colors.danger[200] },
    warningTitle: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, color: Colors.danger[800], marginBottom: 2 },
    warningText: { fontSize: Typography.size.sm, color: Colors.danger[700] },
    summaryRow: { flexDirection: 'row', marginBottom: 24 },
    summaryCard: { flex: 1, padding: 16 },
    summaryLabel: { fontSize: Typography.size.xs, color: Colors.gray[500], textTransform: 'uppercase', fontFamily: Typography.family.bold },
    summaryVal: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold },
    sectionTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 16 },
    calendarGrid: { flexDirection: 'row', gap: 8, paddingBottom: 8 },
    dayCell: { width: 56, height: 72, backgroundColor: Colors.white, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.gray[200] },
    selectedDayCell: { backgroundColor: Colors.primary[600], borderColor: Colors.primary[600] },
    negativeDayCell: { backgroundColor: '#FEF2F2', borderColor: Colors.danger[300] },
    dayName: { fontSize: Typography.size.xs, color: Colors.gray[500], marginBottom: 4 },
    dayNum: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    selectedText: { color: Colors.white },
    negativeText: { color: Colors.danger[700] },
    dotContainer: { flexDirection: 'row', gap: 2, marginTop: 6, height: 4 },
    dot: { width: 4, height: 4, borderRadius: 2 },
    detailsSection: { marginTop: 32 },
    detailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
    detailsTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    balanceBadge: { alignItems: 'flex-end', backgroundColor: Colors.gray[100], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    balanceLabel: { fontSize: Typography.size.xs, color: Colors.gray[500] },
    balanceVal: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    emptyEvents: { color: Colors.gray[500], fontStyle: 'italic', textAlign: 'center', padding: 32 },
    eventCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 8 },
    eventIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    eventInfo: { flex: 1 },
    eventName: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    eventSource: { fontSize: Typography.size.xs, color: Colors.gray[500], marginTop: 2 },
    eventAmount: { fontSize: Typography.size.md, fontFamily: Typography.family.bold }
});
