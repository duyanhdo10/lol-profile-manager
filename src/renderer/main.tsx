import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles/global.css';
import './features/settings/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Renderer root element is missing.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
