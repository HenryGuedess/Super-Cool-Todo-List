import React from 'react';
import TaskManager from './components/TaskManager';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <TaskManager />
    </ErrorBoundary>
  );
}

export default App;