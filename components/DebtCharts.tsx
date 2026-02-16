import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { Colors } from '../constants/Theme';
import { formatCurrency } from '../utils/currency';

const screenWidth = Dimensions.get('window').width;

interface DebtChartsProps {
    pieData: { value: number; color: string; text?: string }[];
    barData: { value: number; label: string; frontColor: string }[];
}

export const DebtOverviewCharts: React.FC<DebtChartsProps> = ({ pieData, barData }) => {
    if (pieData.length === 0 && barData.length === 0) return null;

    return (
        <View style={styles.container}>
            {pieData.length > 0 && (
                <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Distribution</Text>
                    <View style={styles.pieContainer}>
                        <PieChart
                            data={pieData}
                            donut
                            radius={80}
                            innerRadius={50}
                            centerLabelComponent={() => (
                                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: Colors.gray[500] }}>Total</Text>
                                </View>
                            )}
                        />
                        <View style={styles.legend}>
                            {pieData.map((item, index) => (
                                <View key={index} style={styles.legendItem}>
                                    <View style={[styles.dot, { backgroundColor: item.color }]} />
                                    <Text style={styles.legendText}>{item.text || 'Unknown'}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            )}

            {barData.length > 0 && (
                <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Top People</Text>
                    <BarChart
                        data={barData}
                        width={screenWidth - 80}
                        height={150}
                        barWidth={30}
                        noOfSections={3}
                        barBorderRadius={4}
                        yAxisThickness={0}
                        xAxisThickness={1}
                        xAxisColor={Colors.gray[300]}
                        yAxisTextStyle={{ color: Colors.gray[500], fontSize: 10 }}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 16,
    },
    chartCard: {
        backgroundColor: Colors.white,
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.gray[900],
        marginBottom: 16,
    },
    pieContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    legend: {
        marginLeft: 20,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    legendText: {
        fontSize: 12,
        color: Colors.gray[600],
    },
});
