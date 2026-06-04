import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/src/theme/colors';
import { Card } from '@/src/components/Card';
import { useAuthStore } from '@/src/store/authStore';
import { useAttendanceStore } from '@/src/store/attendanceStore';
import { storage } from '@/src/utils/storage';

export default function SettingsScreen() {
    const router = useRouter();
    const { user, logout } = useAuthStore();
    const { pendingSyncCount } = useAttendanceStore();

    const handleReEnroll = () => {
        Alert.alert(
            'Re-enroll Face',
            'This will reset your current face enrollment. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    onPress: () => router.push('/face-enroll'),
                    style: 'destructive',
                },
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    onPress: async () => {
                        await logout();
                        router.replace('/(auth)/login');
                    },
                    style: 'destructive',
                },
            ]
        );
    };

    const handleClearCache = async () => {
        Alert.alert(
            'Clear Cache',
            'This will remove all locally stored data. Unsynceddata will be lost.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    onPress: async () => {
                        await storage.removeItem('attendance');
                        await storage.removeItem('logs');
                        Alert.alert('Success', 'Cache cleared successfully');
                    },
                    style: 'destructive',
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Settings</Text>
                    <Text style={styles.subtitle}>Manage your account and preferences</Text>
                </View>

                {/* Profile Section */}
                <Card style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarLarge}>
                            {user?.facePhoto ? (
                                <Image 
                                    source={{ uri: user.facePhoto }} 
                                    style={styles.avatarImage} 
                                />
                            ) : (
                                <Ionicons name="person" size={48} color={colors.secondary} />
                            )}
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{user?.name}</Text>
                            <Text style={styles.profileDetail}>ID: {user?.employeeId}</Text>
                            <Text style={styles.profileDetail}>{user?.department}</Text>
                        </View>
                    </View>
                </Card>

                {/* Device Info Section */}
                <Text style={styles.sectionTitle}>Device Information</Text>
                <Card style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <Ionicons name="phone-portrait" size={24} color={colors.textSecondary} />
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Device Status</Text>
                            <Text style={styles.settingValue}>Offline Ready</Text>
                        </View>
                    </View>
                </Card>

                {/* Offline Storage Section */}
                <Card style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <Ionicons name="save" size={24} color={colors.textSecondary} />
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Offline Storage</Text>
                            <Text style={styles.settingValue}>
                                {pendingSyncCount} items pending sync
                            </Text>
                        </View>
                    </View>
                </Card>

                {/* Face Authentication Section */}
                <Text style={styles.sectionTitle}>Face Authentication</Text>
                <TouchableOpacity onPress={handleReEnroll}>
                    <Card style={styles.settingCard}>
                        <View style={styles.settingRow}>
                            <Ionicons name="scan" size={24} color={colors.secondary} />
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Re-enroll Face</Text>
                                <Text style={styles.settingDescription}>
                                    Update your facial recognition data
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
                        </View>
                    </Card>
                </TouchableOpacity>

                {/* Security Settings Section */}
                <Text style={styles.sectionTitle}>Security</Text>
                <Card style={styles.settingCard}>
                    <View style={styles.settingRow}>
                        <Ionicons name="shield-checkmark" size={24} color={colors.success} />
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Face ID Enabled</Text>
                            <Text style={styles.settingDescription}>
                                Your device is secured with biometric authentication
                            </Text>
                        </View>
                    </View>
                </Card>

                {/* Data Management Section */}
                <Text style={styles.sectionTitle}>Data Management</Text>
                <TouchableOpacity onPress={handleClearCache}>
                    <Card style={styles.settingCard}>
                        <View style={styles.settingRow}>
                            <Ionicons name="trash" size={24} color={colors.error} />
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Clear Cache</Text>
                                <Text style={styles.settingDescription}>
                                    Remove all locally stored data
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
                        </View>
                    </Card>
                </TouchableOpacity>

                {/* Logout Button */}
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out" size={24} color={colors.error} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                {/* App Version */}
                <Text style={styles.versionText}>Version 1.0.0</Text>
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
    profileCard: {
        marginBottom: spacing.lg,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    avatarImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
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
        marginBottom: spacing.xs - 2,
    },
    sectionTitle: {
        ...typography.bodyBold,
        color: colors.text,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    settingCard: {
        marginBottom: spacing.sm,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    settingLabel: {
        ...typography.bodyBold,
        color: colors.text,
    },
    settingValue: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: spacing.xs - 2,
    },
    settingDescription: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: spacing.xs - 2,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginTop: spacing.lg,
        borderWidth: 1.5,
        borderColor: colors.error,
    },
    logoutText: {
        ...typography.bodyBold,
        color: colors.error,
        marginLeft: spacing.sm,
    },
    versionText: {
        ...typography.caption,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.lg,
    },
});
