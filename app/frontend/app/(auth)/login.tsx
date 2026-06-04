import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/theme/colors';
import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';
import { Card } from '@/src/components/Card';
import { useAuthStore } from '@/src/store/authStore';

export default function LoginScreen() {
    const router = useRouter();
    const { login } = useAuthStore();
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [rememberDevice, setRememberDevice] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const netInfo = useNetInfo();
    const isOffline = netInfo.isConnected === false;

    const handleLogin = async () => {
        setError('');

        if (!employeeId) {
            setError('Please enter your Employee ID');
            return;
        }
        if (!password) {
            setError('Please enter your password');
            return;
        }

        setLoading(true);

        const success = await login(employeeId.trim(), password.trim());
        setLoading(false);
        
        if (success) {
            router.replace('/face-check');
        } else {
            setError('Invalid Employee ID or Password. Check Admin Web or your connection.');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Status Indicator */}
                    <View style={styles.statusBar}>
                        <View style={[
                            styles.statusDot, 
                            isOffline ? { backgroundColor: colors.warning } : { backgroundColor: colors.success }
                        ]} />
                        <Text style={styles.statusText}>
                            {isOffline ? 'Offline Mode' : 'Online Ready'}
                        </Text>
                    </View>

                    {/* Logo */}
                    <View style={styles.logoContainer}>
                        <View style={styles.iconCircle}>
                            <Image
                                source={require('../../assets/images/applogo.png')}
                                style={styles.appLogoImage}
                            />
                        </View>
                        <Text style={styles.title}>SetuAuth</Text>
                        <Text style={styles.subtitle}>Field Worker Authentication</Text>
                    </View>

                    {/* Login Card */}
                    <Card style={styles.loginCard}>
                        <Input
                            label="Employee ID"
                            placeholder="Enter your employee ID"
                            value={employeeId}
                            onChangeText={setEmployeeId}
                            icon="person-outline"
                            autoCapitalize="none"
                        />

                        <Input
                            label="Password"
                            placeholder="Enter your password"
                            value={password}
                            onChangeText={setPassword}
                            icon="lock-closed-outline"
                            type="password"
                            autoCapitalize="none"
                        />

                        <TouchableOpacity
                            style={styles.checkboxContainer}
                            onPress={() => setRememberDevice(!rememberDevice)}
                        >
                            <Ionicons
                                name={rememberDevice ? 'checkbox' : 'square-outline'}
                                size={24}
                                color={colors.secondary}
                            />
                            <Text style={styles.checkboxLabel}>Remember Device</Text>
                        </TouchableOpacity>

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        <Button
                            title="Login"
                            onPress={handleLogin}
                            loading={loading}
                            style={styles.loginButton}
                        />
                    </Card>

                    {/* Footer */}
                    <Text style={styles.footerText}>Secure Offline Access Enabled</Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        marginBottom: spacing.lg,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.success,
        marginRight: spacing.sm,
    },
    statusText: {
        ...typography.caption,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        overflow: 'hidden',
    },
    appLogoImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    title: {
        ...typography.h1,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
    },
    loginCard: {
        marginBottom: spacing.lg,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    checkboxLabel: {
        ...typography.body,
        color: colors.text,
        marginLeft: spacing.sm,
    },
    errorText: {
        ...typography.caption,
        color: colors.error,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    loginButton: {
        marginTop: spacing.sm,
    },
    footerText: {
        ...typography.caption,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.md,
    },
});
