import { useState } from 'react';
import { X, Plus, Star, Bot, ChevronRight, Radio, Plug, Sliders, Stethoscope } from 'lucide-react';
import type { Board } from '@/lib/types';
import { BOT_PROFILES } from '@/lib/types';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BoardsSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  boards: Board[];
  activeBoard: Board;
  onBoardChange: (board: Board) => void;
  isMobile?: boolean;
}

export function BoardsSettingsPanel({
  open,
  onClose,
  boards,
  activeBoard,
  onBoardChange,
  isMobile = false,
}: BoardsSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'boards' | 'settings'>('boards');

  const settingsSections = [
    { id: 'profiles', label: 'Profiles / Bots', icon: Bot },
    { id: 'routing', label: 'Routing rules', icon: Radio },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'preferences', label: 'Preferences', icon: Sliders },
    { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
  ];

  const content = (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border/50">
        {(['boards', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 py-2 text-xs font-medium capitalize transition-colors relative',
              activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'boards' && (
        <div className="space-y-1">
          {boards.map((board) => (
            <button
              key={board.id}
              onClick={() => {
                onBoardChange(board);
                toast.success(`Switched to ${board.name}`);
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors',
                board.id === activeBoard.id ? 'bg-accent' : 'hover:bg-accent/50'
              )}
            >
              <div className="flex items-center gap-2">
                <Star
                  size={14}
                  className={board.isDefault ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}
                />
                <span className="text-sm">{board.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{board.taskCount}</span>
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            </button>
          ))}
          <button
            onClick={() => toast.info('Create board coming soon')}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-accent/50 transition-colors mt-2"
          >
            <Plus size={14} />
            <span className="text-sm">New board</span>
          </button>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          {/* Profiles/Bots */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
              Profiles / Bots
            </h4>
            <div className="space-y-1">
              {BOT_PROFILES.map((bot) => (
                <div
                  key={bot.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(124, 92, 255, 0.15)' }}
                  >
                    <Bot size={12} style={{ color: '#7C5CFF' }} />
                  </div>
                  <span className="text-sm">{bot.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Settings links */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
              Settings
            </h4>
            <div className="space-y-1">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => toast.info(`${section.label} coming soon`)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <section.icon size={14} className="text-muted-foreground" />
                    <span className="text-sm">{section.label}</span>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent side="bottom" className="h-[85vh] p-0 bg-background border-t border-border rounded-t-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <span className="text-sm font-semibold">Hermes</span>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="px-4 py-4 overflow-y-auto h-[calc(85vh-60px)]">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[360px] p-0 bg-background border border-border">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">Board settings</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-6">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
