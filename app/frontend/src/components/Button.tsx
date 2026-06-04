import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/src/theme/colors';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'small' | 'medium' | 'large';
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    loading = false,
    disabled = false,
    style,
    textStyle,
}) => {
    const buttonStyle = [
        styles.button,
        styles[variant],
        styles[size],
        disabled && styles.disabled,
        style,
    ];

    const textStyles = [
        styles.text,
        styles[`${variant}Text`],
        styles[`${size}Text`],
        textStyle,
    ];

    return (
        <TouchableOpacity
            style={buttonStyle}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
            ) : (
                <Text style={textStyles}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    primary: {
        backgroundColor: colors.secondary,
    },
    secondary: {
        backgroundColor: colors.surface,
    },
    outline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.secondary,
    },
    ghost: {
        backgroundColor: 'transparent',
    },
    small: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    medium: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    large: {
        paddingVertical: spacing.md + 2,
        paddingHorizontal: spacing.xl,
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        ...typography.bodyBold,
    },
    primaryText: {
        color: colors.white,
    },
    secondaryText: {
        color: colors.text,
    },
    outlineText: {
        color: colors.secondary,
    },
    ghostText: {
        color: colors.secondary,
    },
    smallText: {
        fontSize: 14,
    },
    mediumText: {
        fontSize: 16,
    },
    largeText: {
        fontSize: 18,
    },
});
