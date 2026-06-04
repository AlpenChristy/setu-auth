import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/theme/colors';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { StatusChip } from '@/src/components/StatusChip';
import { useAuthStore } from '@/src/store/authStore';
import { format } from 'date-fns';

export default function AuthSuccessScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 10,
            friction: 3,
            useNativeDriver: true,
        }).start();
    }, [scaleAnim]);

    const handleContinue = () => {
        router.replace('/(tabs)');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.content}>
                {/* Success Animation */}
                <Animated.View
                    style={[
                        styles.successIcon,
                        { transform: [{ scale: scaleAnim }] },
                    ]}
                >
                    <View style={styles.iconCircle}>
                        <Ionicons name="checkmark" size={80} color={colors.white} />
                    </View>
                </Animated.View>

                <Text style={styles.title}>Authentication Successful</Text>
                <Text style={styles.subtitle}>Welcome back, {user?.name}!</Text>

                {/* Profile Card */}
                <Card style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarCircle}>
                            <Ionicons name="person" size={40} color={colors.secondary} />
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{user?.name}</Text>
                            <Text style={styles.profileDetail}>ID: {user?.employeeId}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.infoRow}>
                        <Ionicons name="briefcase-outline" size={20} color={colors.textSecondary} />
                        <Text style={styles.infoLabel}>Department</Text>
                        <Text style={styles.infoValue}>{user?.department}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                        <Text style={styles.infoLabel}>Login Time</Text>
                        <Text style={styles.infoValue}>{format(new Date(), 'hh:mm a')}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                        <Text style={styles.infoLabel}>Date</Text>
                        <Text style={styles.infoValue}>{format(new Date(), 'MMM dd, yyyy')}</Text>
                    </View>

                    <View style={styles.statusBadgeContainer}>
                        <StatusChip
                            label="Authenticated Successfully"
                            status="success"
                            icon="shield-checkmark"
                        />
                    </View>
                </Card>

                {/* Continue Button */}
                <Button
                    title="Continue to Dashboard"
                    onPress={handleContinue}
                    size="large"
                    style={styles.continueButton}
                />
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
        alignItems: 'center',
    },
    successIcon: {
        marginBottom: spacing.xl,
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.success,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        ...typography.h1,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    profileCard: {
        width: '100%',
        marginBottom: spacing.xl,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatarCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        ...typography.h3,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    profileDetail: {
        ...typography.body,
        color: colors.textSecondary,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.md,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    infoLabel: {
        ...typography.body,
        color: colors.textSecondary,
        marginLeft: spacing.sm,
        flex: 1,
    },
    infoValue: {
        ...typography.bodyBold,
        color: colors.text,
    },
    statusBadgeContainer: {
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    continueButton: {
        width: '100%',
    },
});
