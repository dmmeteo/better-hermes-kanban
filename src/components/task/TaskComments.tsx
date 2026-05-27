import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import type { TaskComment } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import { MarkdownText } from '@/components/shared/MarkdownText';

interface TaskCommentsProps {
  comments: TaskComment[];
  onAddComment: (text: string) => void;
}

export function TaskComments({ comments, onAddComment }: TaskCommentsProps) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAddComment(text.trim());
    setText('');
  };

  return (
    <div className="space-y-4">
      {/* Comment input */}
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-primary">U</span>
        </div>
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Add a comment..."
            className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
            data-testid="task-comments-composer-input"
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
            data-testid="task-comments-composer-submit"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">
          <MessageSquare size={20} className="mx-auto mb-2 opacity-40" />
          No comments yet
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  {comment.author[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold">{comment.author}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                </div>
                <MarkdownText value={comment.text} compact className="text-xs text-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
