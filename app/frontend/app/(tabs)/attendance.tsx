import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/src/theme/colors';
import { Card } from '@/src/components/Card';
import { useAttendanceStore, AttendanceRecord } from '@/src/store/attendanceStore';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    addMonths,
    subMonths,
    parse,
} from 'date-fns';

export default function AttendanceScreen() {
    const { attendance } = useAttendanceStore();
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    // Get all days in the current month bounds
    const { monthStart, monthEnd } = useMemo(() => ({
        monthStart: startOfMonth(selectedMonth),
        monthEnd: endOfMonth(selectedMonth)
    }), [selectedMonth]);

    const daysInMonth = useMemo(() => {
        return eachDayOfInterval({ start: monthStart, end: monthEnd });
    }, [monthStart, monthEnd]);

    // Group days into weeks
    const weeks = useMemo(() => {
        const weeksArray = [] as Date[][];
        let currentWeek: Date[] = [];

        daysInMonth.forEach((day, index) => {
            currentWeek.push(day);
            if (currentWeek.length === 7 || index === daysInMonth.length - 1) {
                weeksArray.push(currentWeek);
                currentWeek = [];
            }
        });

        return weeksArray;
    }, [daysInMonth]);

    // Calculate monthly stats
    const monthlyStats = useMemo(() => {
        const monthAttendance = attendance.filter((record) => {
            const recordDate = parse(record.date, 'yyyy-MM-dd', new Date());
            return (
                recordDate >= monthStart && recordDate <= monthEnd
            );
        });

        const presentDays = monthAttendance.filter((r) => r.status === 'present').length;
        const totalWorkingHours = monthAttendance.reduce(
            (sum, r) => sum + (r.workingHours || 0),
            0
        );

        return {
            presentDays,
            absentDays: daysInMonth.length - presentDays,
            totalHours: Math.round(totalWorkingHours * 10) / 10,
        };
    }, [attendance, monthStart, monthEnd, daysInMonth]);

    const getAttendanceForDate = (date: Date): AttendanceRecord | undefined => {
        return attendance.find((record) =>
            isSameDay(parse(record.date, 'yyyy-MM-dd', new Date()), date)
        );
    };

    const handlePreviousMonth = () => {
        setSelectedMonth(subMonths(selectedMonth, 1));
    };

    const handleNextMonth = () => {
        setSelectedMonth(addMonths(selectedMonth, 1));
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Attendance</Text>
                    <Text style={styles.subtitle}>Track your monthly attendance</Text>
                </View>

                {/* Month Navigator */}
                <View style={styles.monthNavigator}>
                    <TouchableOpacity
                        onPress={handlePreviousMonth}
                        style={styles.navButton}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>{format(selectedMonth, 'MMMM yyyy')}</Text>
                    <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                        <Ionicons name="chevron-forward" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Monthly Summary */}
                <Card style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Monthly Summary</Text>
                    <View style={styles.summaryGrid}>
                        <View style={styles.summaryItem}>
                            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
                            <Text style={styles.summaryValue}>{monthlyStats.presentDays}</Text>
                            <Text style={styles.summaryLabel}>Present</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Ionicons name="close-circle" size={32} color={colors.error} />
                            <Text style={styles.summaryValue}>{monthlyStats.absentDays}</Text>
                            <Text style={styles.summaryLabel}>Absent</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Ionicons name="time" size={32} color={colors.secondary} />
                            <Text style={styles.summaryValue}>{monthlyStats.totalHours}h</Text>
                            <Text style={styles.summaryLabel}>Total Hours</Text>
                        </View>
                    </View>
                </Card>

                {/* Weekly Calendar */}
                <Text style={styles.sectionTitle}>Weekly View</Text>
                {weeks.map((week, weekIndex) => (
                    <Card key={weekIndex} style={styles.weekCard}>
                        <View style={styles.weekHeader}>
                            <Text style={styles.weekTitle}>Week {weekIndex + 1}</Text>
                            <Text style={styles.weekDates}>
                                {format(week[0], 'MMM dd')} - {format(week[week.length - 1], 'MMM dd')}
                            </Text>
                        </View>

                        {week.map((day) => {
                            const record = getAttendanceForDate(day);
                            const isPresent = record?.status === 'present';
                            const isToday = isSameDay(day, new Date());

                            return (
                                <View key={day.toString()} style={styles.dayRow}>
                                    <View style={styles.dayInfo}>
                                        <View
                                            style={[
                                                styles.dayDot,
                                                {
                                                    backgroundColor: isPresent
                                                        ? colors.success
                                                        : colors.textSecondary,
                                                },
                                            ]}
                                        />
                                        <View>
                                            <Text style={[styles.dayName, isToday && styles.todayText]}>
                                                {format(day, 'EEEE')}
                                            </Text>
                                            <Text style={styles.dayDate}>{format(day, 'MMM dd')}</Text>
                                        </View>
                                    </View>

                                    {record ? (
                                        <View style={styles.dayDetails}>
                                            <View style={styles.timeRow}>
                                                <Ionicons
                                                    name="enter-outline"
                                                    size={14}
                                                    color={colors.textSecondary}
                                                />
                                                <Text style={styles.timeText}>{record.checkIn}</Text>
                                            </View>
                                            {record.checkOut && (
                                                <View style={styles.timeRow}>
                                                    <Ionicons
                                                        name="exit-outline"
                                                        size={14}
                                                        color={colors.textSecondary}
                                                    />
                                                    <Text style={styles.timeText}>{record.checkOut}</Text>
                                                </View>
                                            )}
                                            {record.workingHours > 0 && (
                                                <Text style={styles.hoursText}>
                                                    {record.workingHours}h worked
                                                </Text>
                                            )}
                                        </View>
                                    ) : (
                                        <Text style={styles.noDataText}>No record</Text>
                                    )}
                                </View>
                            );
                        })}
                    </Card>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
    },
    header: {
        marginTop: spacing.md,
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.h2,
        color: colors.text,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    monthNavigator: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        backgroundColor: colors.white,
        borderRadius: borderRadius.md,
        padding: spacing.md,
    },
    navButton: {
        padding: spacing.xs,
    },
    monthText: {
        ...typography.h3,
        color: colors.text,
    },
    summaryCard: {
        marginBottom: spacing.lg,
    },
    summaryTitle: {
        ...typography.bodyBold,
        color: colors.text,
        marginBottom: spacing.md,
    },
    summaryGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryValue: {
        ...typography.h2,
        color: colors.text,
        marginTop: spacing.xs,
    },
    summaryLabel: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: spacing.xs - 2,
    },
    sectionTitle: {
        ...typography.h3,
        color: colors.text,
        marginBottom: spacing.md,
    },
    weekCard: {
        marginBottom: spacing.md,
    },
    weekHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    weekTitle: {
        ...typography.bodyBold,
        color: colors.text,
    },
    weekDates: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    dayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.surface,
    },
    dayInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    dayDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: spacing.sm,
    },
    dayName: {
        ...typography.body,
        color: colors.text,
        fontWeight: '600',
    },
    todayText: {
        color: colors.secondary,
    },
    dayDate: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    dayDetails: {
        alignItems: 'flex-end',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs - 2,
    },
    timeText: {
        ...typography.caption,
        color: colors.text,
        marginLeft: spacing.xs,
        fontWeight: '600',
    },
    hoursText: {
        ...typography.small,
        color: colors.textSecondary,
    },
    noDataText: {
        ...typography.caption,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
});
