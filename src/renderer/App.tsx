import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { HashRouter } from 'react-router';
import { AppRouter } from './app/AppRouter';
import { appTheme } from './app/theme';

export function App() {
  return (
    <MantineProvider theme={appTheme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      <HashRouter>
        <AppRouter />
      </HashRouter>
    </MantineProvider>
  );
}
