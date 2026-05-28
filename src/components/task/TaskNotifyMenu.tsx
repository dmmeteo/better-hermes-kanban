import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TaskNotifyMenuProps {
  subscribed: { telegram: boolean; discord: boolean };
  onToggle: (channel: 'telegram' | 'discord', subscribed: boolean) => Promise<void>;
}

export function TaskNotifyMenu({ subscribed, onToggle }: TaskNotifyMenuProps) {
  const hasActive = subscribed.telegram || subscribed.discord;

  const handleSelect = (channel: 'telegram' | 'discord', next: boolean) => {
    void toast.promise(onToggle(channel, next), {
      loading: next ? `Subscribing to ${channel}…` : `Unsubscribing from ${channel}…`,
      success: next ? `Subscribed to ${channel}` : `Unsubscribed from ${channel}`,
      error: `Failed to ${next ? 'subscribe to' : 'unsubscribe from'} ${channel}`,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-8 w-8"
          aria-label="Notify channels"
          data-testid="task-notify-menu-trigger"
        >
          <Bell size={14} />
          {hasActive && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Notify channels
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={subscribed.telegram}
          onCheckedChange={(next) => handleSelect('telegram', Boolean(next))}
          onSelect={(e) => e.preventDefault()}
          data-testid="task-notify-telegram"
        >
          Telegram
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={subscribed.discord}
          onCheckedChange={(next) => handleSelect('discord', Boolean(next))}
          onSelect={(e) => e.preventDefault()}
          data-testid="task-notify-discord"
        >
          Discord
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
