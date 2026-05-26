import { FileText, Download, MoreHorizontal, Lock } from 'lucide-react';
import type { PlannedAttachment } from '@/lib/types';

interface TaskAttachmentsPlannedProps {
  attachments: PlannedAttachment[];
}

export function TaskAttachmentsPlanned({ attachments }: TaskAttachmentsPlannedProps) {
  return (
    <div className="space-y-3">
      {/* Backend TODO notice */}
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-500/5 border border-amber-500/20">
        <Lock size={12} className="text-amber-500/60 shrink-0" />
        <span className="text-[11px] text-amber-500/80">
          Attachments planned — Backend TODO
        </span>
      </div>

      {attachments.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-xs">
          No attachments planned
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card opacity-60"
            >
              <FileText size={16} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{att.filename}</p>
                <p className="text-[10px] text-muted-foreground">{att.size}</p>
              </div>
              <button className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground" disabled>
                <Download size={14} />
              </button>
              <button className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground" disabled>
                <MoreHorizontal size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
