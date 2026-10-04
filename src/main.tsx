import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './index.css';
import { BrowserWorkflowEngine } from './engine/browser-engine';
import { getTestScenario } from './presets/self-healing-scenarios';

// Register default presets resolver for browser simulation scenarios
BrowserWorkflowEngine.setDefaultScenarioResolver(getTestScenario);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary fullscreen>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
