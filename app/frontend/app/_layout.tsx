import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
    useFonts,
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { useAuthStore } from '@/src/store/authStore';
import { useAttendanceStore } from '@/src/store/attendanceStore';
import { initSqliteDb } from '@/src/utils/sqliteDb';

// Initialize local SQLite tables on app startup
initSqliteDb();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [loaded, error] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });
    const { isAuthenticated, isLoading, loadStoredAuth } = useAuthStore();
    const { loadAttendance, loadLogs } = useAttendanceStore();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        console.log('RootLayout [Fonts Hook] loaded:', loaded, 'error:', error);
        if (loaded || error) {
            console.log('RootLayout: Hiding splash screen');
            SplashScreen.hideAsync().catch(err => console.error('Error hiding splash screen:', err));
        }
    }, [loaded, error]);

    useEffect(() => {
        console.log('RootLayout [Auth Init] Triggering store loads');
        loadStoredAuth().then(() => console.log('RootLayout [Auth Init] loadStoredAuth finished'));
        loadAttendance().then(() => console.log('RootLayout [Auth Init] loadAttendance finished'));
        loadLogs().then(() => console.log('RootLayout [Auth Init] loadLogs finished'));
    }, [loadStoredAuth, loadAttendance, loadLogs]);

    const rootNavigationState = useRootNavigationState();

    useEffect(() => {
        console.log('RootLayout [Nav State Hook]: isLoading =', isLoading, 'isAuthenticated =', isAuthenticated, 'navigationStateKey =', rootNavigationState?.key, 'currentRouteSegment =', segments[0]);
        if (isLoading || !rootNavigationState?.key) return;

        const inAuthGroup = segments[0] === '(auth)';
        const isSplash = segments[0] === 'splash';

        if (!isAuthenticated && !inAuthGroup && !isSplash) {
            console.log('RootLayout [Nav State Hook]: Redirecting to /splash');
            router.replace('/splash');
        } else if (isAuthenticated && inAuthGroup) {
            console.log('RootLayout [Nav State Hook]: Redirecting to /(tabs)');
            router.replace('/(tabs)');
        }
    }, [isAuthenticated, segments, isLoading, rootNavigationState?.key, router]);

    if (!loaded && !error) {
        console.log('RootLayout: Returning null (waiting for fonts)...');
        return null;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="splash" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="face-check" />
            <Stack.Screen name="face-enroll" />
            <Stack.Screen name="face-auth" />
            <Stack.Screen name="auth-success" />
            <Stack.Screen name="auth-failure" />
        </Stack>
    );
}
