import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WarningBannerProps {
  message: string;
  className?: string;
}

export function WarningBanner({ message, className }: WarningBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium',
        className
      )}
      style={{
        backgroundColor: 'rgba(245, 158, 11, 0.10)',
        border: '1px solid rgba(245, 158, 11, 0.30)',
        color: '#F59E0B',
      }}
    >
      <AlertTriangle size={14} />
      <span>{message}</span>
    </div>
  );
}
