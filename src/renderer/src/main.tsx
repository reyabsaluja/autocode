import React from 'react';
import ReactDOM from 'react-dom/client';

import '@fontsource-variable/outfit';
import '@fontsource-variable/jetbrains-mono';

import { App } from './app/App';
import { AppProviders } from './app/providers';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);
