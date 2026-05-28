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
  onToggle: (channel: 'telegram' | 'discord') => Promise<void>;
}

export function TaskNotifyMenu({ subscribed, onToggle }: TaskNotifyMenuProps) {
  const hasActive = subscribed.telegram || subscribed.discord;

  const handleSelect = (channel: 'telegram' | 'discord') => {
    const isSubscribed = subscribed[channel];
    void toast.promise(onToggle(channel), {
      loading: isSubscribed ? `Re-sending ${channel}…` : `Subscribing to ${channel}…`,
      success: isSubscribed ? `Re-sent ${channel}` : `Subscribed to ${channel}`,
      error: `Failed to notify ${channel}`,
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
          onCheckedChange={() => handleSelect('telegram')}
          onSelect={(e) => e.preventDefault()}
          data-testid="task-notify-telegram"
        >
          Telegram
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={subscribed.discord}
          onCheckedChange={() => handleSelect('discord')}
          onSelect={(e) => e.preventDefault()}
          data-testid="task-notify-discord"
        >
          Discord
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
