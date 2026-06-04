import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/src/theme/colors';
import { Card } from '@/src/components/Card';
import { StatusChip } from '@/src/components/StatusChip';
import { useAttendanceStore } from '@/src/store/attendanceStore';
import { format } from 'date-fns';

export default function LogsScreen() {
    const { logs, pendingSyncCount } = useAttendanceStore();

    const sortedLogs = [...logs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const getLogIcon = (type: string) => {
        switch (type) {
            case 'face_auth':
                return 'scan' as const;
            case 'enrollment':
                return 'person-add' as const;
            case 'login':
                return 'log-in' as const;
            default:
                return 'information-circle' as const;
        }
    };

    const getLogTitle = (type: string) => {
        switch (type) {
            case 'face_auth':
                return 'Face Authentication';
            case 'enrollment':
                return 'Face Enrollment';
            case 'login':
                return 'System Login';
            default:
                return 'Activity';
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Activity Logs</Text>
                    <Text style={styles.subtitle}>Track all authentication activities</Text>
                </View>

                {/* Sync Status Card */}
                {pendingSyncCount > 0 && (
                    <Card style={styles.syncStatusCard}>
                        <View style={styles.syncStatusRow}>
                            <Ionicons name="cloud-offline" size={24} color={colors.warning} />
                            <View style={styles.syncStatusInfo}>
                                <Text style={styles.syncStatusTitle}>Offline Queue</Text>
                                <Text style={styles.syncStatusText}>
                                    {pendingSyncCount} item{pendingSyncCount > 1 ? 's' : ''} pending sync
                                </Text>
                            </View>
                            <View style={styles.syncBadge}>
                                <Text style={styles.syncBadgeText}>{pendingSyncCount}</Text>
                            </View>
                        </View>
                    </Card>
                )}

                {/* Logs List */}
                {sortedLogs.length > 0 ? (
                    sortedLogs.map((log) => (
                        <Card key={log.id} style={styles.logCard}>
                            <View style={styles.logRow}>
                                <View
                                    style={[
                                        styles.logIcon,
                                        {
                                            backgroundColor:
                                                log.status === 'success'
                                                    ? colors.success
                                                    : colors.error,
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name={getLogIcon(log.type) as any}
                                        size={20}
                                        color={colors.white}
                                    />
                                </View>

                                <View style={styles.logContent}>
                                    <View style={styles.logHeader}>
                                        <Text style={styles.logTitle}>{getLogTitle(log.type)}</Text>
                                        <Ionicons
                                            name={log.synced ? 'cloud-done' : 'cloud-offline'}
                                            size={20}
                                            color={log.synced ? colors.success : colors.textSecondary}
                                        />
                                    </View>

                                    <View style={styles.logDetails}>
                                        <View style={styles.logDetailRow}>
                                            <Ionicons
                                                name="time-outline"
                                                size={14}
                                                color={colors.textSecondary}
                                            />
                                            <Text style={styles.logDetailText}>
                                                {format(new Date(log.timestamp), 'MMM dd, yyyy • hh:mm a')}
                                            </Text>
                                        </View>

                                        <View style={styles.statusChipContainer}>
                                            <StatusChip
                                                label={log.status === 'success' ? 'Success' : 'Failed'}
                                                status={log.status === 'success' ? 'success' : 'error'}
                                                icon={
                                                    log.status === 'success'
                                                        ? 'checkmark-circle'
                                                        : 'close-circle'
                                                }
                                            />
                                            {!log.synced && (
                                                <StatusChip
                                                    label="Pending Sync"
                                                    status="warning"
                                                    icon="cloud-upload"
                                                />
                                            )}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </Card>
                    ))
                ) : (
                    <Card style={styles.emptyCard}>
                        <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
                        <Text style={styles.emptyTitle}>No Logs Yet</Text>
                        <Text style={styles.emptyText}>
                            Your authentication activities will appear here
                        </Text>
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
    syncStatusCard: {
        marginBottom: spacing.md,
        backgroundColor: colors.warning + '20',
    },
    syncStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    syncStatusInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    syncStatusTitle: {
        ...typography.bodyBold,
        color: colors.text,
    },
    syncStatusText: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: spacing.xs - 2,
    },
    syncBadge: {
        backgroundColor: colors.warning,
        borderRadius: borderRadius.full,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xs,
    },
    syncBadgeText: {
        ...typography.small,
        color: colors.text,
        fontWeight: '700',
    },
    logCard: {
        marginBottom: spacing.sm,
    },
    logRow: {
        flexDirection: 'row',
    },
    logIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    logContent: {
        flex: 1,
    },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    logTitle: {
        ...typography.bodyBold,
        color: colors.text,
    },
    logDetails: {
        gap: spacing.xs,
    },
    logDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    logDetailText: {
        ...typography.caption,
        color: colors.textSecondary,
        marginLeft: spacing.xs,
    },
    statusChipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    emptyCard: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyTitle: {
        ...typography.h3,
        color: colors.text,
        marginTop: spacing.md,
    },
    emptyText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
});
