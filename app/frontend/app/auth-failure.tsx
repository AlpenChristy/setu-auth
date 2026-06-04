import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/theme/colors';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';

export default function AuthFailureScreen() {
    const router = useRouter();
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.timing(shakeAnim, {
                toValue: 10,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(shakeAnim, {
                toValue: -10,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(shakeAnim, {
                toValue: 10,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(shakeAnim, {
                toValue: 0,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, [shakeAnim]);

    const handleRetry = () => {
        router.replace('/face-auth');
    };

    const handleContactAdmin = () => {
        // Mock action - could open email or support screen
        console.log('Contact admin');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.content}>
                {/* Error Icon */}
                <Animated.View
                    style={[
                        styles.errorIcon,
                        { transform: [{ translateX: shakeAnim }] },
                    ]}
                >
                    <View style={styles.iconCircle}>
                        <Ionicons name="close" size={80} color={colors.white} />
                    </View>
                </Animated.View>

                <Text style={styles.title}>Authentication Failed</Text>
                <Text style={styles.subtitle}>Face verification was unsuccessful</Text>

                {/* Error Card */}
                <Card style={styles.errorCard}>
                    <View style={styles.errorRow}>
                        <Ionicons name="information-circle" size={24} color={colors.error} />
                        <Text style={styles.errorText}>
                            We could not verify your identity. This could be due to:
                        </Text>
                    </View>

                    <View style={styles.reasonsList}>
                        <View style={styles.reasonItem}>
                            <View style={styles.bulletPoint} />
                            <Text style={styles.reasonText}>Poor lighting conditions</Text>
                        </View>
                        <View style={styles.reasonItem}>
                            <View style={styles.bulletPoint} />
                            <Text style={styles.reasonText}>Face not properly aligned</Text>
                        </View>
                        <View style={styles.reasonItem}>
                            <View style={styles.bulletPoint} />
                            <Text style={styles.reasonText}>Camera obstruction</Text>
                        </View>
                        <View style={styles.reasonItem}>
                            <View style={styles.bulletPoint} />
                            <Text style={styles.reasonText}>Facial features changed significantly</Text>
                        </View>
                    </View>
                </Card>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    <Button
                        title="Retry Authentication"
                        onPress={handleRetry}
                        size="large"
                        style={styles.retryButton}
                    />

                    <Button
                        title="Contact Administrator"
                        onPress={handleContactAdmin}
                        variant="outline"
                        size="large"
                        style={styles.contactButton}
                    />
                </View>
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
    errorIcon: {
        marginBottom: spacing.xl,
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.error,
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
    errorCard: {
        width: '100%',
        marginBottom: spacing.xl,
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    errorText: {
        ...typography.body,
        color: colors.text,
        marginLeft: spacing.sm,
        flex: 1,
    },
    reasonsList: {
        marginLeft: spacing.lg,
    },
    reasonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    bulletPoint: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.textSecondary,
        marginRight: spacing.sm,
    },
    reasonText: {
        ...typography.body,
        color: colors.textSecondary,
    },
    buttonContainer: {
        width: '100%',
    },
    retryButton: {
        marginBottom: spacing.md,
    },
    contactButton: {
        marginBottom: spacing.md,
    },
});
