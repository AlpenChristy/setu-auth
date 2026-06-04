export const colors = {
    primary: '#AFCBFF',
    secondary: '#7EA7FF',
    background: '#F8FAFC',
    surface: '#EAEFF5',
    text: '#1E2A3A',
    textSecondary: '#64748B',
    success: '#A5D6A7',
    error: '#EF9A9A',
    warning: '#FFE082',
    white: '#FFFFFF',
    border: '#E2E8F0',
    overlay: 'rgba(30, 42, 58, 0.5)',
};

export const spacing = {
    xs: 4,
    sm: 6,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 36,
};

export const borderRadius = {
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12,
    full: 9999,
};

export const typography = {
    h1: {
        fontFamily: 'Poppins_700Bold',
        fontSize: 24,
        fontWeight: '700' as const,
        lineHeight: 32,
    },
    h2: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 20,
        fontWeight: '600' as const,
        lineHeight: 28,
    },
    h3: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 18,
        fontWeight: '600' as const,
        lineHeight: 24,
    },
    body: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 20,
    },
    bodyBold: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 14,
        fontWeight: '600' as const,
        lineHeight: 20,
    },
    caption: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 12,
        fontWeight: '400' as const,
        lineHeight: 16,
    },
    small: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 10,
        fontWeight: '400' as const,
        lineHeight: 14,
    },
};

export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
};
