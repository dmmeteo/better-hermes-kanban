import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BotAvatarProps {
  name: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function BotAvatar({ name, size = 'sm', className }: BotAvatarProps) {
  const sizeClasses = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const iconSize = size === 'sm' ? 12 : 14;

  if (!name) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-muted-foreground', className)}>
        <span className={cn('rounded-full bg-muted flex items-center justify-center', sizeClasses)}>
          <Bot size={iconSize} />
        </span>
        <span className="text-xs">Unassigned</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'rounded-full flex items-center justify-center',
          sizeClasses
        )}
        style={{ backgroundColor: 'rgba(124, 92, 255, 0.15)' }}
      >
        <Bot size={iconSize} style={{ color: '#7C5CFF' }} />
      </span>
      <span className="text-xs text-muted-foreground">Bot: {name}</span>
    </span>
  );
}
