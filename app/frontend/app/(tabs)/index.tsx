import React, { useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/src/theme/colors';
import { Card } from '@/src/components/Card';
import { useAuthStore } from '@/src/store/authStore';
import { useAttendanceStore } from '@/src/store/attendanceStore';
import { format } from 'date-fns';

export default function HomeScreen() {
    const router = useRouter();
    const { user, lastSync } = useAuthStore();
    const { logs, pendingSyncCount, attendance, fetchAttendance, fetchLogs, syncOfflineData } = useAttendanceStore();
    const netInfo = useNetInfo();
    const isOffline = netInfo.isConnected === false;

    useEffect(() => {
        if (netInfo.isConnected) {
            console.log('HomeScreen detected online connection: trigger auto-sync');
            syncOfflineData();
        }
    }, [netInfo.isConnected, syncOfflineData]);

    useFocusEffect(
        useCallback(() => {
            if (user?.id) {
                fetchAttendance(user.id);
                fetchLogs(user.id);
            }
        }, [user?.id, fetchAttendance, fetchLogs])
    );

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayRecord = attendance.find(r => r.userId === user?.id && r.date === todayStr);

    const recentLogs = logs.slice(-5).reverse();

    const handleVerifyIdentity = () => {
        router.push('/face-auth');
    };

    const handleSync = () => {
        router.push('/sync');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Welcome back,</Text>
                        <Text style={styles.userName}>{user?.name}</Text>
                    </View>
                    <View style={styles.offlineIndicator}>
                        <View style={[
                            styles.offlineDot,
                            isOffline ? { backgroundColor: colors.warning } : { backgroundColor: colors.success }
                        ]} />
                        <Text style={styles.offlineText}>
                            {isOffline ? 'Offline Ready' : 'Online Ready'}
                        </Text>
                    </View>
                </View>

                {/* Profile Mini Card */}
                <Card style={styles.profileCard}>
                    <View style={styles.profileContent}>
                        <View style={styles.avatarCircle}>
                            {user?.facePhoto ? (
                                <Image
                                    source={{ uri: user.facePhoto }}
                                    style={styles.avatarImage}
                                />
                            ) : (
                                <Ionicons name="person" size={32} color={colors.secondary} />
                            )}
                        </View>
                        <View style={styles.profileDetails}>
                            <Text style={styles.profileName}>{user?.name}</Text>
                            <Text style={styles.profileInfo}>ID: {user?.employeeId}</Text>
                            <Text style={styles.profileInfo}>{user?.department}</Text>
                        </View>
                        <View style={styles.profileBadge}>
                            <Ionicons name="shield-checkmark" size={24} color={colors.success} />
                        </View>
                    </View>
                </Card>

                {/* Authentication Status Card */}
                {/* Daily Attendance Card */}
                <Card style={styles.attendanceCard}>
                    <Text style={styles.cardHeaderTitle}>{"Today's Attendance"}</Text>
                    <View style={styles.dateTimeContainer}>
                        <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.dateTimeText}>{format(new Date(), 'EEEE, MMMM dd, yyyy')}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.attendanceColumns}>
                        {/* Check-In Column */}
                        <View style={styles.attendanceColumn}>
                            <View style={styles.timeHeader}>
                                <Ionicons name="enter-outline" size={18} color={colors.success} />
                                <Text style={styles.columnLabel}>CHECK IN</Text>
                            </View>
                            <Text style={styles.timeValue}>{todayRecord ? todayRecord.checkIn : '--:--'}</Text>
                            <Text style={styles.locationValue} numberOfLines={2}>
                                {todayRecord?.checkInLocation ? todayRecord.checkInLocation : 'Not checked in yet'}
                            </Text>
                        </View>

                        <View style={styles.verticalDivider} />

                        {/* Check-Out Column */}
                        <View style={styles.attendanceColumn}>
                            <View style={styles.timeHeader}>
                                <Ionicons name="exit-outline" size={18} color={colors.error} />
                                <Text style={styles.columnLabel}>CHECK OUT</Text>
                            </View>
                            <Text style={styles.timeValue}>{todayRecord?.checkOut ? todayRecord.checkOut : '--:--'}</Text>
                            <Text style={styles.locationValue} numberOfLines={2}>
                                {todayRecord?.checkOut ? todayRecord.checkOutLocation || 'Unknown' : 'Not checked out yet'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Attendance CTA Button */}
                    {!user?.faceEnrolled ? (
                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: colors.warning }]}
                            onPress={() => router.push('/face-enroll')}
                        >
                            <Ionicons name="scan" size={20} color={colors.white} style={styles.btnIcon} />
                            <Text style={styles.buttonText}>Enroll Face First</Text>
                        </TouchableOpacity>
                    ) : !todayRecord ? (
                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: colors.success }]}
                            onPress={handleVerifyIdentity}
                        >
                            <Ionicons name="enter" size={20} color={colors.white} style={styles.btnIcon} />
                            <Text style={styles.buttonText}>Verify Face & Check In</Text>
                        </TouchableOpacity>
                    ) : !todayRecord.checkOut ? (
                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: colors.error }]}
                            onPress={handleVerifyIdentity}
                        >
                            <Ionicons name="exit" size={20} color={colors.white} style={styles.btnIcon} />
                            <Text style={styles.buttonText}>Verify Face & Check Out</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.primaryButton, { backgroundColor: colors.textSecondary, opacity: 0.8 }]}>
                            <Ionicons name="checkmark-circle" size={20} color={colors.white} style={styles.btnIcon} />
                            <Text style={styles.buttonText}>Attendance Completed</Text>
                        </View>
                    )}
                </Card>

                {/* Last Sync Status */}
                <Card style={styles.syncCard}>
                    <View style={styles.syncRow}>
                        <Ionicons name="cloud-upload" size={24} color={colors.textSecondary} />
                        <View style={styles.syncInfo}>
                            <Text style={styles.syncLabel}>Last Sync</Text>
                            <Text style={styles.syncValue}>
                                {lastSync ? format(new Date(lastSync), 'MMM dd, hh:mm a') : 'Never'}
                            </Text>
                        </View>
                        {pendingSyncCount > 0 && (
                            <View style={styles.syncBadge}>
                                <Text style={styles.syncBadgeText}>{pendingSyncCount}</Text>
                            </View>
                        )}
                    </View>
                </Card>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity style={[styles.actionCard, { width: '100%' }]} onPress={handleSync}>
                        <View style={styles.actionIcon}>
                            <Ionicons name="cloud-upload" size={28} color={colors.secondary} />
                        </View>
                        <Text style={styles.actionLabel}>Sync Data</Text>
                    </TouchableOpacity>
                </View>

                {/* Recent Activity */}
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                {recentLogs.length > 0 ? (
                    recentLogs.map((log) => (
                        <Card key={log.id} style={styles.activityCard}>
                            <View style={styles.activityRow}>
                                <View
                                    style={[
                                        styles.activityDot,
                                        {
                                            backgroundColor:
                                                log.status === 'success' ? colors.success : colors.error,
                                        },
                                    ]}
                                />
                                <View style={styles.activityInfo}>
                                    <Text style={styles.activityTitle}>
                                        {log.type === 'face_auth'
                                            ? 'Face Authentication'
                                            : log.type === 'enrollment'
                                                ? 'Face Enrollment'
                                                : 'Login'}
                                    </Text>
                                    <Text style={styles.activityTime}>
                                        {format(new Date(log.timestamp), 'MMM dd, hh:mm a')}
                                    </Text>
                                </View>
                                <Ionicons
                                    name={log.synced ? 'cloud-done' : 'cloud-offline'}
                                    size={20}
                                    color={log.synced ? colors.success : colors.textSecondary}
                                />
                            </View>
                        </Card>
                    ))
                ) : (
                    <Card style={styles.emptyCard}>
                        <Ionicons name="time-outline" size={48} color={colors.textSecondary} />
                        <Text style={styles.emptyText}>No recent activity</Text>
                    </Card>
                )}
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginTop: spacing.md,
        marginBottom: spacing.lg,
    },
    greeting: {
        ...typography.body,
        color: colors.textSecondary,
    },
    userName: {
        ...typography.h2,
        color: colors.text,
        marginTop: spacing.xs,
    },
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.full,
    },
    offlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.success,
        marginRight: spacing.xs,
    },
    offlineText: {
        ...typography.caption,
        color: colors.text,
        fontWeight: '600',
    },
    profileCard: {
        marginBottom: spacing.md,
    },
    profileContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    profileDetails: {
        flex: 1,
    },
    profileName: {
        ...typography.h3,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    profileInfo: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    profileBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    attendanceCard: {
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    cardHeaderTitle: {
        ...typography.h3,
        color: colors.text,
        fontWeight: '700',
    },
    dateTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    dateTimeText: {
        ...typography.caption,
        color: colors.textSecondary,
        marginLeft: spacing.xs,
    },
    divider: {
        height: 1,
        backgroundColor: colors.surface,
        marginVertical: spacing.md,
    },
    verticalDivider: {
        width: 1,
        backgroundColor: colors.surface,
        marginHorizontal: spacing.md,
    },
    attendanceColumns: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    attendanceColumn: {
        flex: 1,
    },
    timeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    columnLabel: {
        ...typography.caption,
        color: colors.textSecondary,
        fontWeight: '700',
        marginLeft: spacing.xs,
    },
    timeValue: {
        ...typography.h1,
        fontSize: 28,
        color: colors.text,
        marginVertical: spacing.xs,
    },
    locationValue: {
        ...typography.caption,
        color: colors.textSecondary,
        lineHeight: 16,
    },
    primaryButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        marginTop: spacing.xs,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    btnIcon: {
        marginRight: spacing.sm,
    },
    buttonText: {
        ...typography.bodyBold,
        color: colors.white,
    },
    syncCard: {
        marginBottom: spacing.lg,
    },
    syncRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    syncInfo: {
        marginLeft: spacing.md,
        flex: 1,
    },
    syncLabel: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    syncValue: {
        ...typography.bodyBold,
        color: colors.text,
        marginTop: spacing.xs - 2,
    },
    syncBadge: {
        backgroundColor: colors.error,
        borderRadius: borderRadius.full,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xs,
    },
    syncBadgeText: {
        ...typography.small,
        color: colors.white,
        fontWeight: '700',
    },
    sectionTitle: {
        ...typography.h3,
        color: colors.text,
        marginBottom: spacing.md,
    },
    actionsGrid: {
        flexDirection: 'row',
        marginBottom: spacing.lg,
    },
    actionCard: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    actionIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    actionLabel: {
        ...typography.body,
        color: colors.text,
        fontWeight: '600',
        textAlign: 'center',
    },
    activityCard: {
        marginBottom: spacing.sm,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: spacing.md,
    },
    activityInfo: {
        flex: 1,
    },
    activityTitle: {
        ...typography.bodyBold,
        color: colors.text,
        marginBottom: spacing.xs - 2,
    },
    activityTime: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    emptyCard: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    emptyText: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
});
