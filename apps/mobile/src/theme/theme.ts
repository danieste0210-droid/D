import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { colors } from './colors';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.brand,
    secondary: colors.brandDark,
    background: colors.background,
    surface: colors.surface,
    error: colors.danger,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.brandLight,
    secondary: colors.brand,
  },
};
