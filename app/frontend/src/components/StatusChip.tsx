import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@/src/theme/colors';

interface StatusChipProps {
    label: string;
    status: 'success' | 'error' | 'warning' | 'info';
    icon?: keyof typeof Ionicons.glyphMap;
}

export const StatusChip: React.FC<StatusChipProps> = ({ label, status, icon }) => {
    const statusColors = {
        success: colors.success,
        error: colors.error,
        warning: colors.warning,
        info: colors.primary,
    };

    const bgColor = statusColors[status];

    return (
        <View style={[styles.chip, { backgroundColor: bgColor }]}>
            {icon && (
                <Ionicons
                    name={icon}
                    size={14}
                    color={colors.text}
                    style={styles.icon}
                />
            )}
            <Text style={styles.label}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.full,
        alignSelf: 'flex-start',
    },
    icon: {
        marginRight: spacing.xs - 2,
    },
    label: {
        ...typography.small,
        fontWeight: '600',
        color: colors.text,
    },
});
