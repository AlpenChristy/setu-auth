import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@/src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/src/store/authStore';

export default function SplashScreen() {
    const router = useRouter();
    const { isAuthenticated, isLoading } = useAuthStore();
    const scaleAnim = useRef(new Animated.Value(0.3)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        console.log('SplashScreen: mounted/updated. isLoading =', isLoading, 'isAuthenticated =', isAuthenticated);
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 10,
                friction: 2,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
        ]).start();

        console.log('SplashScreen: setting 1200ms redirection timer...');
        const timer = setTimeout(() => {
            console.log('SplashScreen: timer fired. isLoading =', isLoading, 'isAuthenticated =', isAuthenticated);
            if (!isLoading) {
                if (isAuthenticated) {
                    console.log('SplashScreen: redirecting to /(tabs)');
                    router.replace('/(tabs)');
                } else {
                    console.log('SplashScreen: redirecting to /(auth)/login');
                    router.replace('/(auth)/login');
                }
            } else {
                console.log('SplashScreen: timer fired but skipped redirect because isLoading is still true.');
            }
        }, 1200);

        return () => {
            console.log('SplashScreen: clearing timer (cleanup)');
            clearTimeout(timer);
        };
    }, [isLoading, isAuthenticated, router, scaleAnim, fadeAnim]);

    return (
        <LinearGradient
            colors={[colors.primary, colors.secondary]}
            style={styles.container}
        >
            <Animated.View
                style={[
                    styles.content,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
                <View style={styles.iconContainer}>
                    <Image
                        source={require('../assets/images/logo.png')}
                        style={styles.logoImage}
                    />
                </View>
                <Text style={styles.title}>SetuAuth</Text>
                <Text style={styles.subtitle}>Offline Identity Verification System</Text>
            </Animated.View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        overflow: 'hidden',
    },
    logoImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    title: {
        ...typography.h1,
        color: colors.white,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.caption,
        color: colors.white,
        opacity: 0.9,
        textAlign: 'center',
    },
});
