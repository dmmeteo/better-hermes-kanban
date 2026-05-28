import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MarkdownTextProps {
  value: string;
  className?: string;
  compact?: boolean;
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'code'; code: string };

const headingPattern = /^(#{1,3})\s+(.+)$/;
const unorderedListPattern = /^[-*]\s+(.+)$/;
const orderedListPattern = /^\d+[.)]\s+(.+)$/;

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', lines: paragraph });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list) {
      blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
      list = null;
    }
  };

  const flushQuote = () => {
    if (quote.length > 0) {
      blocks.push({ type: 'quote', lines: quote });
      quote = [];
    }
  };

  const flushTextBlocks = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith('```')) {
      if (code) {
        blocks.push({ type: 'code', code: code.join('\n') });
        code = null;
      } else {
        flushTextBlocks();
        code = [];
      }
      continue;
    }

    if (code) {
      code.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushTextBlocks();
      continue;
    }

    const heading = line.match(headingPattern);
    if (heading) {
      flushTextBlocks();
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 3) as 1 | 2 | 3, text: heading[2] });
      continue;
    }

    if (line.startsWith('>')) {
      flushParagraph();
      flushList();
      quote.push(line.replace(/^>\s?/, ''));
      continue;
    }

    const ordered = line.match(orderedListPattern);
    const unordered = line.match(unorderedListPattern);
    if (ordered || unordered) {
      flushParagraph();
      flushQuote();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) flushList();
      if (!list) list = { ordered: isOrdered, items: [] };
      list.items.push((ordered?.[1] ?? unordered?.[1] ?? '').trim());
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  if (code) blocks.push({ type: 'code', code: code.join('\n') });
  flushTextBlocks();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[[^\]]+\]\([^\s)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${match.index}-${token}`;

    if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
      if (link) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noreferrer" className="break-all text-primary underline underline-offset-2 hover:text-primary/80">
            {link[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.92em] text-foreground">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key} className="italic">{token.slice(1, -1)}</em>);
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

export function MarkdownText({ value, className, compact = false }: MarkdownTextProps) {
  const blocks = parseBlocks(value);

  if (blocks.length === 0) return null;

  return (
    <div className={cn('markdown-text break-words text-sm leading-relaxed text-muted-foreground', compact ? 'space-y-1.5' : 'space-y-3', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const size = block.level === 1 ? 'text-base' : block.level === 2 ? 'text-sm' : 'text-xs';
          const Heading = `h${block.level + 2}` as 'h3' | 'h4' | 'h5';
          return (
            <Heading key={index} className={cn(size, 'font-semibold leading-snug text-foreground', index > 0 && !compact && 'pt-1')}>
              {renderInline(block.text)}
            </Heading>
          );
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag key={index} className={cn('space-y-1 pl-4', block.ordered ? 'list-decimal' : 'list-disc')}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-1 marker:text-muted-foreground/70">
                  {renderInline(item)}
                </li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote key={index} className="border-l-2 border-primary/50 pl-3 text-foreground/80">
              {block.lines.map((line, lineIndex) => (
                <p key={lineIndex}>{renderInline(line)}</p>
              ))}
            </blockquote>
          );
        }

        if (block.type === 'code') {
          return (
            <pre key={index} className="overflow-x-auto rounded-lg border border-border bg-card p-3 text-xs text-foreground">
              <code>{block.code}</code>
            </pre>
          );
        }

        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
