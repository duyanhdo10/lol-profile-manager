import { createTheme } from '@mantine/core';

export const appTheme = createTheme({
  primaryColor: 'teal',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'md',
  fontFamily: 'Inter, "Segoe UI Variable", "Segoe UI", sans-serif',
  headings: {
    fontFamily: 'Inter, "Segoe UI Variable", "Segoe UI", sans-serif',
    fontWeight: '700',
  },
  colors: {
    abyss: [
      '#f1f8fa',
      '#dcecef',
      '#b7d8dd',
      '#8cc0c8',
      '#64a8b2',
      '#478e99',
      '#36727c',
      '#285862',
      '#183f48',
      '#071b24',
    ],
    hexgold: [
      '#fff8e4',
      '#f8e9bd',
      '#ebd187',
      '#dcb751',
      '#c69d2f',
      '#a98221',
      '#856619',
      '#634c12',
      '#44330b',
      '#271d05',
    ],
  },
});
