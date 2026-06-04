import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@/src/theme/colors';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    variant?: 'default' | 'flat';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'default' }) => {
    return (
        <View style={[
            styles.card,
            variant === 'default' && shadows.md,
            style
        ]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.md,
        padding: spacing.md,
    },
});
