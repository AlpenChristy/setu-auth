import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/src/theme/colors';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { useAuthStore } from '@/src/store/authStore';
import { useAttendanceStore } from '@/src/store/attendanceStore';
import { format } from 'date-fns';

export default function SyncScreen() {
    const router = useRouter();
    const { setLastSync } = useAuthStore();
    const { pendingSyncCount, markAsSynced, clearSyncedData } = useAttendanceStore();
    const [syncProgress, setSyncProgress] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isPurging, setIsPurging] = useState(false);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isComplete) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 10,
                friction: 3,
                useNativeDriver: true,
            }).start();
        }
    }, [isComplete, scaleAnim]);

    const handleStartSync = async () => {
        if (pendingSyncCount === 0) {
            return;
        }

        setIsSyncing(true);
        setSyncProgress(0);

        // Simulate sync progress
        const totalSteps = 100;
        for (let i = 0; i <= totalSteps; i++) {
            await new Promise((resolve) => setTimeout(resolve, 30));
            setSyncProgress(i);

            Animated.timing(progressAnim, {
                toValue: i,
                duration: 30,
                useNativeDriver: false,
            }).start();
        }

        // Mark as synced
        await markAsSynced();
        const now = new Date().toISOString();
        setLastSync(now);

        setIsSyncing(false);
        setIsComplete(true);

        // Auto-purge after sync
        setTimeout(async () => {
            setIsPurging(true);
            await clearSyncedData();
            setTimeout(() => {
                setIsPurging(false);
            }, 1500);
        }, 2000);
    };

    const handleGoBack = () => {
        router.back();
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>
                        {isPurging ? 'Cleaning Up' : isComplete ? 'Sync Complete' : 'Data Sync'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {isPurging
                            ? 'Removing synced data...'
                            : isComplete
                                ? 'All data synced successfully'
                                : 'Sync offline data with cloud'}
                    </Text>
                </View>

                {/* Sync Icon */}
                {!isComplete && !isPurging && (
                    <View style={styles.iconContainer}>
                        <View style={styles.iconCircle}>
                            <Ionicons
                                name={isSyncing ? 'cloud-upload' : 'cloud-offline'}
                                size={80}
                                color={isSyncing ? colors.secondary : colors.textSecondary}
                            />
                        </View>
                    </View>
                )}

                {/* Success Icon */}
                {isComplete && !isPurging && (
                    <Animated.View
                        style={[
                            styles.iconContainer,
                            { transform: [{ scale: scaleAnim }] },
                        ]}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: colors.success }]}>
                            <Ionicons name="checkmark" size={80} color={colors.white} />
                        </View>
                    </Animated.View>
                )}

                {/* Purging Icon */}
                {isPurging && (
                    <View style={styles.iconContainer}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
                            <Ionicons name="trash" size={80} color={colors.white} />
                        </View>
                    </View>
                )}

                {/* Sync Info Card */}
                {!isComplete && !isPurging && (
                    <Card style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <Ionicons name="documents" size={24} color={colors.textSecondary} />
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Pending Items</Text>
                                <Text style={styles.infoValue}>{pendingSyncCount} records</Text>
                            </View>
                        </View>

                        {isSyncing && (
                            <>
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressBar}>
                                        <Animated.View
                                            style={[
                                                styles.progressFill,
                                                { width: progressWidth },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.progressText}>{syncProgress}%</Text>
                                </View>

                                <View style={styles.statusContainer}>
                                    <Ionicons name="sync" size={20} color={colors.secondary} />
                                    <Text style={styles.statusText}>Uploading to AWS...</Text>
                                </View>
                            </>
                        )}
                    </Card>
                )}

                {/* Success Message */}
                {isComplete && !isPurging && (
                    <Card style={styles.successCard}>
                        <Text style={styles.successTitle}>Sync Successful!</Text>
                        <View style={styles.successDetail}>
                            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                            <Text style={styles.successText}>
                                {pendingSyncCount} records synced to AWS
                            </Text>
                        </View>
                        <View style={styles.successDetail}>
                            <Ionicons name="time" size={20} color={colors.textSecondary} />
                            <Text style={styles.successText}>
                                {format(new Date(), 'MMM dd, yyyy • hh:mm a')}
                            </Text>
                        </View>
                    </Card>
                )}

                {/* Purge Message */}
                {isPurging && (
                    <Card style={styles.purgeCard}>
                        <Text style={styles.purgeTitle}>Local Temporary Data Purged Successfully</Text>
                        <Text style={styles.purgeText}>
                            Synced records have been removed from local storage
                        </Text>
                    </Card>
                )}

                {/* Action Button */}
                <View style={styles.buttonContainer}>
                    {!isSyncing && !isComplete && !isPurging && (
                        <Button
                            title="Start Sync"
                            onPress={handleStartSync}
                            size="large"
                            disabled={pendingSyncCount === 0}
                        />
                    )}

                    {(isComplete || isPurging) && (
                        <Button
                            title="Done"
                            onPress={handleGoBack}
                            size="large"
                        />
                    )}
                </View>

                {/* Info Text */}
                {!isSyncing && !isComplete && !isPurging && pendingSyncCount === 0 && (
                    <Text style={styles.infoText}>No data to sync</Text>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
    },
    header: {
        marginBottom: spacing.xl,
    },
    title: {
        ...typography.h2,
        color: colors.text,
        textAlign: 'center',
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    iconCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoCard: {
        marginBottom: spacing.xl,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    infoContent: {
        marginLeft: spacing.md,
        flex: 1,
    },
    infoLabel: {
        ...typography.body,
        color: colors.textSecondary,
    },
    infoValue: {
        ...typography.h3,
        color: colors.text,
        marginTop: spacing.xs - 2,
    },
    progressContainer: {
        marginTop: spacing.md,
    },
    progressBar: {
        height: 8,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.secondary,
    },
    progressText: {
        ...typography.caption,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.md,
    },
    statusText: {
        ...typography.body,
        color: colors.text,
        marginLeft: spacing.sm,
    },
    successCard: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
        marginBottom: spacing.xl,
    },
    successTitle: {
        ...typography.h3,
        color: colors.text,
        marginBottom: spacing.md,
    },
    successDetail: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    successText: {
        ...typography.body,
        color: colors.textSecondary,
        marginLeft: spacing.sm,
    },
    purgeCard: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
        marginBottom: spacing.xl,
    },
    purgeTitle: {
        ...typography.h3,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    purgeText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    buttonContainer: {
        marginTop: 'auto',
        paddingBottom: spacing.lg,
    },
    infoText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.md,
    },
});
