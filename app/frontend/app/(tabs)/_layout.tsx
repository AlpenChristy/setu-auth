import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HomeIcon = ({ color, size }: { color: string; size: number }) => (
    <Ionicons name="home" size={size} color={color} />
);

const AttendanceIcon = ({ color, size }: { color: string; size: number }) => (
    <Ionicons name="calendar" size={size} color={color} />
);

const LogsIcon = ({ color, size }: { color: string; size: number }) => (
    <Ionicons name="list" size={size} color={color} />
);

const SettingsIcon = ({ color, size }: { color: string; size: number }) => (
    <Ionicons name="settings" size={size} color={color} />
);

export default function TabsLayout() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.secondary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarStyle: {
                    backgroundColor: colors.white,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    paddingBottom: Math.max(insets.bottom, 8),
                    paddingTop: 8,
                    height: 60 + insets.bottom,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600',
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: HomeIcon,
                }}
            />
            <Tabs.Screen
                name="attendance"
                options={{
                    title: 'Attendance',
                    tabBarIcon: AttendanceIcon,
                }}
            />
            <Tabs.Screen
                name="logs"
                options={{
                    title: 'Logs',
                    tabBarIcon: LogsIcon,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: SettingsIcon,
                }}
            />
        </Tabs>
    );
}
