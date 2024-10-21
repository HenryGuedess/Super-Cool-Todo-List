import React from 'react';
import { DragDropContext, DragDropContextProps } from 'react-beautiful-dnd';

const DndWrapper: React.FC<DragDropContextProps> = (props) => {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('defaultProps will be removed')) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  return <DragDropContext {...props} />;
};

export default DndWrapper;