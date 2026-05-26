import { useEffect, useMemo, useState } from 'react'
import { getBoard, getBoards, getTaskDetail } from './lib/nativeKanbanClient'
import type { BoardSummary } from './lib/nativeKanbanMappers'
import { STATUS_DEFINITIONS, TASK_STATUS_ORDER } from './lib/status'
import type { Task, TaskDetail, TaskStatus } from './lib/types'
import './styles.css'

const priorityLabel = (priority: number) => {
  if (priority >= 100) return 'P100'
  if (priority >= 75) return 'P75'
  if (priority >= 50) return 'P50'
  if (priority >= 25) return 'P25'
  return 'P0'
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [activeBoard, setActiveBoard] = useState<string | undefined>()
  const [activeStatus, setActiveStatus] = useState<TaskStatus>('ready')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'native' | 'static'>('static')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const boardList = await getBoards()
      const selected = boardList.find((board) => board.isCurrent)?.slug ?? boardList.find((board) => board.slug !== 'static')?.slug ?? boardList[0]?.slug
      const snapshot = await getBoard(selected === 'static' ? undefined : selected)
      if (cancelled) return
      setBoards(boardList)
      setActiveBoard(selected)
      setTasks(snapshot.tasks)
      setSource(snapshot.source)
      setLoading(false)
    }
    void load().catch(() => setLoading(false))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    getTaskDetail(selectedId)
      .then((next) => { if (!cancelled) setDetail(next) })
      .catch(() => { if (!cancelled) setDetail(null) })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [selectedId])

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const result = Object.fromEntries(TASK_STATUS_ORDER.map((status) => [status, [] as Task[]])) as Record<TaskStatus, Task[]>
    for (const task of tasks) {
      if (q && !`${task.title} ${task.body} ${task.assignee}`.toLowerCase().includes(q)) continue
      result[task.status]?.push(task)
    }
    return result
  }, [query, tasks])

  const activeTasks = grouped[activeStatus]
  const selectedTask = detail?.task ?? tasks.find((task) => task.id === selectedId) ?? null

  async function changeBoard(slug: string) {
    setActiveBoard(slug)
    setLoading(true)
    const snapshot = await getBoard(slug === 'static' ? undefined : slug)
    setTasks(snapshot.tasks)
    setSource(snapshot.source)
    setLoading(false)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">H</div>
        <div className="brand-copy">
          <span>Hermes</span>
          <strong>Kanban Control Room</strong>
        </div>
        <div className="topbar-actions">
          <select value={activeBoard ?? ''} onChange={(event) => void changeBoard(event.target.value)}>
            {boards.map((board) => <option key={board.slug} value={board.slug}>{board.name}</option>)}
          </select>
          <button className="ghost-button">Board settings</button>
          <button className="primary-button" onClick={() => setQuickOpen(true)}>Create task</button>
        </div>
      </header>

      <section className="summary-strip">
        <div>
          <span className="eyebrow">Live board</span>
          <h1>{boards.find((board) => board.slug === activeBoard)?.name ?? 'Better Hermes Kanban'}</h1>
        </div>
        <div className="metric-card"><strong>{tasks.length}</strong><span>Total tasks</span></div>
        <div className="metric-card warn"><strong>{grouped.blocked.length}</strong><span>Blocked</span></div>
        <div className="metric-card ok"><strong>{grouped.ready.length}</strong><span>Ready</span></div>
        <div className="metric-card muted"><strong>{source}</strong><span>Data source</span></div>
      </section>

      <section className="mobile-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, profiles, summaries…" />
        <div className="status-tabs">
          {TASK_STATUS_ORDER.map((status) => (
            <button key={status} className={status === activeStatus ? 'active' : ''} onClick={() => setActiveStatus(status)}>
              {STATUS_DEFINITIONS[status].label}<span>{grouped[status].length}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mobile-list">
        <Column status={activeStatus} tasks={activeTasks} onOpen={setSelectedId} mobile />
      </section>

      <section className="desktop-board" aria-busy={loading}>
        {TASK_STATUS_ORDER.map((status) => (
          <Column key={status} status={status} tasks={grouped[status]} onOpen={setSelectedId} />
        ))}
      </section>

      <button className="fab" onClick={() => setQuickOpen(true)}>+</button>

      {selectedId && (
        <div className="drawer-backdrop" onClick={() => setSelectedId(null)}>
          <aside className="task-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="task-id">{selectedTask?.id}</span>
                <h2>{selectedTask?.title ?? 'Loading task…'}</h2>
              </div>
              <div className="drawer-actions">
                <button className="ghost-button">Edit</button>
                <button className="icon-button" onClick={() => setSelectedId(null)}>×</button>
              </div>
            </div>
            {detailLoading && <div className="skeleton">Loading full Hermes task detail…</div>}
            <div className="drawer-grid">
              <Meta label="Status" value={selectedTask?.status ?? '—'} />
              <Meta label="Priority" value={selectedTask ? priorityLabel(selectedTask.priority) : '—'} />
              <Meta label="Profile" value={selectedTask?.assignee || 'Auto'} />
            </div>
            <section className="panel"><h3>Body</h3><p>{selectedTask?.body || 'No description yet.'}</p></section>
            <section className="panel"><h3>Comments</h3><p>{detail?.comments.length ? `${detail.comments.length} comments` : 'No comments yet.'}</p></section>
            <section className="panel"><h3>Events / Activity</h3><ul>{(detail?.events ?? []).slice(0, 8).map((event) => <li key={event.id}>{event.kind}</li>)}</ul></section>
            <section className="panel"><h3>Runs / History</h3><ul>{(detail?.runs ?? []).slice(0, 6).map((run) => <li key={run.id}>{run.profile} · {run.status}{run.outcome ? ` · ${run.outcome}` : ''}</li>)}</ul></section>
            <section className="panel planned"><h3>Attachments</h3><p>Planned/TODO — current Hermes API does not confirm native file attachments.</p></section>
          </aside>
        </div>
      )}

      {quickOpen && (
        <div className="drawer-backdrop" onClick={() => setQuickOpen(false)}>
          <aside className="task-drawer compact" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div><span className="eyebrow">Quick capture</span><h2>Create task</h2></div>
              <button className="icon-button" onClick={() => setQuickOpen(false)}>×</button>
            </div>
            <QuickCapture />
          </aside>
        </div>
      )}
    </main>
  )
}

function Column({ status, tasks, onOpen, mobile = false }: { status: TaskStatus; tasks: Task[]; onOpen: (id: string) => void; mobile?: boolean }) {
  const def = STATUS_DEFINITIONS[status]
  return (
    <div className={`column ${def.readOnly ? 'read-only' : ''} ${mobile ? 'mobile-column' : ''}`}>
      <div className="column-header">
        <span className="status-dot" style={{ color: def.color, background: def.color }} />
        <div><h2>{def.label}</h2><p>{def.readOnly ? 'Dispatcher owned · drop disabled' : def.description}</p></div>
        <strong>{tasks.length}</strong>
      </div>
      <div className="cards">
        {tasks.map((task) => <TaskCard key={task.id} task={task} onOpen={onOpen} />)}
        {!tasks.length && <div className="empty-card">No {def.label.toLowerCase()} tasks</div>}
      </div>
    </div>
  )
}

function TaskCard({ task, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  const def = STATUS_DEFINITIONS[task.status]
  return (
    <article className="task-card" onClick={() => onOpen(task.id)}>
      <div className="card-head"><span className="task-id">{task.id}</span><span className="priority">{priorityLabel(task.priority)}</span></div>
      <h3>{task.title}</h3>
      {task.body && <p>{task.body.slice(0, 150)}</p>}
      <footer><span>{task.assignee || 'Auto'}</span><span style={{ color: def.color }}>{def.label}</span></footer>
    </article>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="meta"><span>{label}</span><strong>{value}</strong></div>
}

function QuickCapture() {
  return (
    <form className="quick-form">
      <label>Title<input placeholder="What should Hermes do?" autoFocus /></label>
      <label>Body<textarea placeholder="Context, acceptance criteria, links…" rows={7} /></label>
      <div className="form-grid"><label>Profile<select><option>developer</option><option>auto</option></select></label><label>Initial status<select><option>triage</option><option>todo</option></select></label></div>
      <div className="planned-box">Attachment/image picker is planned only; use URLs in body/comments for MVP.</div>
      <button type="button" className="primary-button">Create after write API wiring</button>
    </form>
  )
}

export default App
