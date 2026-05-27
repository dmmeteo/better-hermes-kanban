import { LayoutGrid, ClipboardList, Plus, Search, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenQuickCapture: () => void;
  needsMeCount?: number;
}

const navItems = [
  { id: 'boards', label: 'Boards', icon: LayoutGrid },
  { id: 'mytasks', label: 'Needs me', icon: ClipboardList },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

export function MobileBottomNav({ activeTab, onTabChange, onOpenQuickCapture, needsMeCount = 0 }: MobileBottomNavProps) {
  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={onOpenQuickCapture}
        className="md:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-90 hover:scale-105"
        style={{
          backgroundColor: '#7C5CFF',
          boxShadow: '0 4px 16px rgba(124, 92, 255, 0.4)',
        }}
      >
        <Plus size={24} />
      </button>

      {/* Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-card/95 backdrop-blur-sm border-t border-border">
        <div className="flex items-center justify-around h-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                data-testid={item.id === 'mytasks' ? 'mobile-needs-me-tab' : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors',
                  isActive && 'text-primary',
                  !isActive && 'text-muted-foreground'
                )}
                style={isActive ? { color: '#7C5CFF' } : {}}
              >
                <Icon size={20} />
                {item.id === 'mytasks' && needsMeCount > 0 && (
                  <span className="absolute right-1 top-0 min-w-4 rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">
                    {needsMeCount > 9 ? '9+' : needsMeCount}
                  </span>
                )}
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
