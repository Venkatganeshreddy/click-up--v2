import { useDroppable } from '@dnd-kit/core';
import { ReactNode } from 'react';

interface ColumnProps {
  id: string;
  children: ReactNode;
}

export default function Column({ id, children }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 bg-gray-50 rounded-lg p-3 transition-colors ${
        isOver ? 'bg-primary-50 ring-2 ring-primary-300' : ''
      }`}
    >
      {children}
    </div>
  );
}
