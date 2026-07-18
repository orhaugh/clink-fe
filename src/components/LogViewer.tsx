import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { fmtTime } from '@/lib/format'
import type { LogRecord } from '@/lib/types'
import { EmptyState } from './States'

const levelClass: Record<string, string> = {
  error: 'text-danger',
  warn: 'text-warn',
  info: 'text-info',
  debug: 'text-muted-foreground',
}

const rowAccent: Record<string, string> = {
  error: 'border-l-danger/70 bg-danger/[0.04]',
  warn: 'border-l-warn/70 bg-warn/[0.03]',
  info: 'border-l-transparent',
  debug: 'border-l-transparent',
}

interface LogViewerProps {
  records: LogRecord[]
  follow?: boolean
  showSource?: boolean
  className?: string
  heightClass?: string
  emptyLabel?: string
}

export function LogViewer({
  records,
  follow = true,
  showSource = true,
  className,
  heightClass = 'h-[60vh]',
  emptyLabel = 'No log records',
}: LogViewerProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  useEffect(() => {
    if (follow) endRef.current?.scrollIntoView({ block: 'end' })
  }, [records, follow])

  if (records.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-card', heightClass, className)}>
        <EmptyState label={emptyLabel} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'overflow-auto rounded-lg border bg-card font-mono text-xs leading-relaxed',
        heightClass,
        className,
      )}
    >
      {records.map((r, i) => {
        const multiline = r.message.includes('\n') || r.message.length > 160
        const isOpen = expanded.has(i)
        return (
          <div
            key={`${r.ts_ms}-${i}`}
            className={cn(
              'flex gap-3 border-l-2 px-3 py-1 hover:bg-muted/40',
              rowAccent[r.level] ?? 'border-l-transparent',
            )}
          >
            <span className="shrink-0 tabular-nums text-muted-foreground/80">
              {fmtTime(r.ts_ms)}
            </span>
            <span
              className={cn('w-12 shrink-0 uppercase', levelClass[r.level] ?? 'text-foreground')}
            >
              {r.level}
            </span>
            {showSource && (
              <span className="w-40 shrink-0 truncate text-primary/90">{r.source}</span>
            )}
            <span
              className={cn(
                'min-w-0 flex-1 whitespace-pre-wrap break-words',
                multiline && !isOpen && 'line-clamp-1 cursor-pointer',
              )}
              role={multiline ? 'button' : undefined}
              tabIndex={multiline ? 0 : undefined}
              onClick={multiline ? () => toggle(i) : undefined}
              onKeyDown={
                multiline
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggle(i)
                      }
                    }
                  : undefined
              }
              title={multiline ? (isOpen ? 'Click to collapse' : 'Click to expand') : undefined}
            >
              {r.message}
            </span>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
