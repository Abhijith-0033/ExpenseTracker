import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Layout } from '../constants/Theme';
import { ArrowLeft, FileText, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MonthlyReport, generateMonthlyReportData, exportReportAsPDF } from '../services/financialReport';
import { formatCurrency } from '../utils/currency';
import { format, subMonths, addMonths } from 'date-fns';
import { BarChart, PieChart } from 'react-native-gifted-charts';

export default function FinancialReportScreen() {
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [report, setReport] = useState<MonthlyReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await generateMonthlyReportData(selectedMonth);
            setReport(data);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Could not generate report for this month");
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleExport = async () => {
        setExporting(true);
        try {
            await exportReportAsPDF(selectedMonth);
        } catch (_e) {
            Alert.alert("Export Failed", "There was an error generating the PDF.");
        } finally {
            setExporting(false);
        }
    };

    const handlePrevMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
    const handleNextMonth = () => {
        const next = addMonths(selectedMonth, 1);
        if (next <= new Date()) setSelectedMonth(next);
    };

    const renderMetricRow = (label: string, value: string, isBold: boolean = false) => (
        <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, isBold && {fontFamily: Typography.family.bold, color: Colors.gray[900]}]}>{label}</Text>
            <Text style={[styles.metricValue, isBold && {fontFamily: Typography.family.bold}]}>{value}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.gray[800]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Financial Report</Text>
            </View>

            <View style={styles.monthSelector}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.monthArrow}>
                    <ChevronLeft size={24} color={Colors.gray[700]} />
                </TouchableOpacity>
                <Text style={styles.monthText}>{format(selectedMonth, 'MMMM yyyy')}</Text>
                <TouchableOpacity onPress={handleNextMonth} style={[styles.monthArrow, selectedMonth.getMonth() === new Date().getMonth() && selectedMonth.getFullYear() === new Date().getFullYear() && {opacity: 0.3}]} disabled={selectedMonth.getMonth() === new Date().getMonth() && selectedMonth.getFullYear() === new Date().getFullYear()}>
                    <ChevronRight size={24} color={Colors.gray[700]} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={[styles.content, {justifyContent: 'center', alignItems: 'center'}]}>
                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                </View>
            ) : report ? (
                <ScrollView contentContainerStyle={styles.content}>
                    
                    <Card style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FileText size={24} color={Colors.primary[600]} />
                        </View>
                        <View>
                            <Text style={styles.summaryTitle}>Monthly Summary</Text>
                            <Text style={styles.summarySub}>Your snapshot for {report.monthStr}</Text>
                        </View>
                    </Card>

                    <View style={styles.gridRow}>
                        <Card style={[styles.gridCard, {backgroundColor: Colors.accent.mint}]}>
                            <Text style={[styles.gridLabel, {color: Colors.success[800]}]}>Income</Text>
                            <Text style={[styles.gridVal, {color: Colors.success[900]}]}>{formatCurrency(report.incomeTotal)}</Text>
                        </Card>
                        <Card style={[styles.gridCard, {backgroundColor: '#FCE4EC'}]}>
                            <Text style={[styles.gridLabel, {color: Colors.danger[800]}]}>Expense</Text>
                            <Text style={[styles.gridVal, {color: Colors.danger[900]}]}>{formatCurrency(report.expenseTotal)}</Text>
                        </Card>
                    </View>

                    <Card style={[styles.detailsCard, { alignItems: 'center', paddingVertical: 32 }]}>
                        <BarChart
                            data={[
                                { value: report.incomeTotal, label: 'In', frontColor: Colors.success[500] },
                                { value: report.expenseTotal, label: 'Out', frontColor: Colors.danger[500] }
                            ]}
                            barWidth={40}
                            spacing={40}
                            roundedTop
                            hideRules
                            xAxisThickness={0}
                            yAxisThickness={0}
                            yAxisTextStyle={{color: Colors.gray[500], fontSize: 10}}
                            noOfSections={3}
                            maxValue={Math.max(report.incomeTotal, report.expenseTotal) * 1.2 || 100}
                            isAnimated
                        />
                    </Card>

                    <Card style={styles.detailsCard}>
                        <Text style={styles.sectionTitle}>Key Metrics</Text>
                        {renderMetricRow('Savings Rate', `${report.savingsRate.toFixed(1)}%`)}
                        {renderMetricRow('Health Score', `${report.satisfactionScore}/100`)}
                        {renderMetricRow('Net Flow', formatCurrency(report.incomeTotal - report.expenseTotal), true)}
                    </Card>

                    <Card style={styles.detailsCard}>
                        <Text style={styles.sectionTitle}>Top Categories</Text>
                        {report.categoryBreakdown.length === 0 ? (
                            <Text style={styles.emptyText}>No expenses this month</Text>
                        ) : (
                            <View>
                                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                                    <PieChart
                                        data={report.categoryBreakdown.slice(0, 5).map((c, i) => ({
                                            value: c.total,
                                            color: [Colors.primary[600], Colors.primary[500], Colors.primary[400], Colors.primary[300], Colors.primary[200]][i % 5]
                                        }))}
                                        donut
                                        radius={70}
                                        innerRadius={35}
                                    />
                                </View>
                                {report.categoryBreakdown.slice(0, 5).map((cat, i) => (
                                    <View key={i} style={styles.catRow}>
                                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                            <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: [Colors.primary[600], Colors.primary[500], Colors.primary[400], Colors.primary[300], Colors.primary[200]][i % 5], marginRight: 8}} />
                                            <Text style={styles.catName}>{cat.category}</Text>
                                        </View>
                                        <Text style={styles.catVal}>{formatCurrency(cat.total)}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </Card>

                    <View style={{height: 100}} /> 
                </ScrollView>
            ) : null}

            <View style={styles.footer}>
                <Button 
                    title={exporting ? "Generating PDF..." : "Export PDF Report"} 
                    onPress={handleExport}
                    disabled={loading || exporting || !report}
                    style={styles.exportBtn}
                />
                <Text style={styles.autoNote}>Reports auto-generate on the 1st of each month.</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.gray[50] },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    backButton: { padding: 8, marginRight: 8, marginLeft: -8 },
    headerTitle: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[200] },
    monthArrow: { padding: 8 },
    monthText: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    content: { padding: 16 },
    summaryCard: { flexDirection: 'row', alignItems: 'center', padding: 20, marginBottom: 16 },
    summaryIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary[50], alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    summaryTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    summarySub: { fontSize: Typography.size.sm, color: Colors.gray[500], marginTop: 4 },
    gridRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    gridCard: { flex: 1, padding: 20 },
    gridLabel: { fontSize: Typography.size.sm, fontFamily: Typography.family.bold, textTransform: 'uppercase', marginBottom: 8 },
    gridVal: { fontSize: Typography.size.xl, fontFamily: Typography.family.bold },
    detailsCard: { padding: 20, marginBottom: 16 },
    sectionTitle: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900], marginBottom: 16 },
    metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
    metricLabel: { fontSize: Typography.size.md, color: Colors.gray[600] },
    metricValue: { fontSize: Typography.size.md, color: Colors.gray[900] },
    catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
    catName: { fontSize: Typography.size.md, color: Colors.gray[700] },
    catVal: { fontSize: Typography.size.md, fontFamily: Typography.family.bold, color: Colors.gray[900] },
    emptyText: { color: Colors.gray[500], fontStyle: 'italic' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white, padding: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.gray[200], ...Layout.shadows.md },
    exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    autoNote: { textAlign: 'center', fontSize: Typography.size.xs, color: Colors.gray[500], marginTop: 12 }
});
