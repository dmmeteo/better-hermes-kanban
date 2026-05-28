import { Plus } from 'lucide-react';

interface MobileCreateTaskFabProps {
  onOpenQuickCapture: () => void;
}

export function MobileCreateTaskFab({ onOpenQuickCapture }: MobileCreateTaskFabProps) {
  return (
    <button
      type="button"
      aria-label="Create task"
      data-testid="mobile-create-task-fab"
      onClick={onOpenQuickCapture}
      className="md:hidden fixed bottom-5 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-90 hover:scale-105"
      style={{
        backgroundColor: '#7C5CFF',
        boxShadow: '0 4px 16px rgba(124, 92, 255, 0.4)',
      }}
    >
      <Plus size={24} />
    </button>
  );
}
