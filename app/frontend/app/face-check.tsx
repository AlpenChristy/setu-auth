import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/theme/colors';
import { useAuthStore } from '@/src/store/authStore';

export default function FaceCheckScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Rotation animation
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: true,
            })
        ).start();

        // Check face enrollment status
        const timer = setTimeout(() => {
            if (user?.faceEnrolled) {
                router.replace('/(tabs)');
            } else {
                router.replace('/face-enroll');
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [user, rotateAnim, router]);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.content}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="scan-circle" size={120} color={colors.secondary} />
                </Animated.View>
                <Text style={styles.title}>Checking Face Authentication Status</Text>
                <Text style={styles.subtitle}>Please wait...</Text>
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
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    title: {
        ...typography.h2,
        color: colors.text,
        textAlign: 'center',
        marginTop: spacing.xl,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
});
