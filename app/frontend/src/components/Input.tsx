import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TextInputProps,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@/src/theme/colors';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    type?: 'text' | 'password';
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    icon,
    type = 'text',
    ...props
}) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const isPassword = type === 'password';

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={[styles.inputContainer, error && styles.inputError]}>
                {icon && (
                    <Ionicons
                        name={icon}
                        size={20}
                        color={colors.textSecondary}
                        style={styles.icon}
                    />
                )}
                <TextInput
                    style={styles.input}
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={isPassword && !isPasswordVisible}
                    {...props}
                />
                {isPassword && (
                    <TouchableOpacity
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                        style={styles.eyeIcon}
                    >
                        <Ionicons
                            name={isPasswordVisible ? 'eye-off' : 'eye'}
                            size={20}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>
                )}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    label: {
        ...typography.bodyBold,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderRadius: borderRadius.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
    },
    inputError: {
        borderColor: colors.error,
    },
    input: {
        flex: 1,
        ...typography.body,
        color: colors.text,
        paddingVertical: spacing.md,
    },
    icon: {
        marginRight: spacing.sm,
    },
    eyeIcon: {
        padding: spacing.xs,
    },
    errorText: {
        ...typography.caption,
        color: colors.error,
        marginTop: spacing.xs,
    },
});
