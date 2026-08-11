import { useEffect, useRef, useState } from 'react'
import type { SearchResult, SearchStatus } from '../../types'

function fmtSize(n: number) {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function fmtTime(ms: number) {
  if (!ms) return ''
  const d = new Date(ms)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const ICONS: Record<string, string> = {
  EXE: '⚙️',
  DLL: '🧩',
  JPG: '🖼️',
  JPEG: '🖼️',
  PNG: '🖼️',
  GIF: '🖼️',
  WEBP: '🖼️',
  SVG: '🖼️',
  MP3: '🎵',
  FLAC: '🎵',
  WAV: '🎵',
  MP4: '🎬',
  MKV: '🎬',
  AVI: '🎬',
  DOC: '📄',
  DOCX: '📄',
  XLS: '📊',
  XLSX: '📊',
  PPT: '📽️',
  PDF: '📕',
  TXT: '📃',
  MD: '📝',
  ZIP: '📦',
  RAR: '📦',
  '7Z': '📦',
  JSON: '🧾',
  HTML: '🌐',
  CSS: '🎨',
  JS: '🟨',
  TS: '🟦',
  PY: '🐍'
}

export default function SearchScreen() {
  const [status, setStatus] = useState<SearchStatus | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(-1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.eisland?.searchStatus().then(setStatus).catch(() => {})
    inputRef.current?.focus()
  }, [])

  // 选中项滚动到可见
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${selected}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const search = async (q = query) => {
    const text = q.trim()
    if (!text || !window.eisland) return
    setBusy(true)
    setError(null)
    try {
      const res = await window.eisland.searchFiles(text)
      setResults(res.results ?? [])
      setSelected(res.results?.length ? 0 : -1)
      if (res.error) setError(res.error)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const open = (r: SearchResult, mode: 'file' | 'folder' | 'everything') => {
    window.eisland?.searchOpen(r.path, mode)
  }

  // 键盘导航：↑↓ 选择，Enter 打开，Ctrl+Enter 定位，Shift+Enter 在 Everything 中打开，Ctrl+Shift+C 复制路径
  const onKey = (e: React.KeyboardEvent) => {
    const n = results.length
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault()
      setSelected((s) => Math.min(n - 1, s + 1))
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault()
      setSelected((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      const r = selected >= 0 ? results[selected] : null
      if (r && e.ctrlKey) {
        e.preventDefault()
        open(r, 'folder')
      } else if (r && e.shiftKey) {
        e.preventDefault()
        open(r, 'everything')
      } else if (r) {
        e.preventDefault()
        open(r, 'file')
      } else if (!e.ctrlKey && !e.shiftKey) {
        e.preventDefault()
        search()
      }
    } else if (e.key === 'c' && e.ctrlKey && e.shiftKey) {
      const r = selected >= 0 ? results[selected] : null
      if (r) {
        e.preventDefault()
        window.eisland?.searchCopyPath(r.path)
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 搜索框 */}
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="搜索文件名（支持通配符）"
          className="min-w-0 flex-1 rounded-xl border border-island-line bg-island-card px-3 py-2 text-[13px] text-white outline-none placeholder:text-zinc-600 focus:border-island-accent/50"
        />
        <button
          onClick={() => search()}
          disabled={busy || !query.trim()}
          className="neon-accent grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[15px] transition-opacity disabled:opacity-40"
          aria-label="搜索"
        >
          🔍
        </button>
      </div>

      {status?.available && (
        <div className="px-4 pb-1 text-[11px] text-zinc-600">
          {status.method === 'es'
            ? 'Everything (es.exe)'
            : status.method === 'http'
              ? 'Everything HTTP 服务'
              : '内置搜索（Windows 索引 / 全盘扫描）'}
        </div>
      )}

      <div ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {!status ? (
          <div className="py-6 text-center text-[12px] text-zinc-500">检测搜索后端中…</div>
        ) : (
          <>
            {busy && <div className="py-6 text-center text-[12px] text-zinc-500">搜索中…</div>}
            {!busy && error && <div className="py-4 text-center text-[12px] text-red-400">{error}</div>}
            {!busy && !error && results.length === 0 && (
              <div className="py-6 text-center text-[12px] text-zinc-600">
                {query.trim() ? '没有匹配结果' : '输入关键词，回车全盘搜索'}
              </div>
            )}
            <div className="space-y-1.5">
              {results.map((r, i) => (
                <div
                  key={i}
                  data-idx={i}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => open(r, 'file')}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
                    i === selected ? 'bg-white/15' : 'bg-island-card hover:bg-white/10'
                  }`}
                >
                  <span className="text-lg">{ICONS[r.ext] ?? '📄'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-white">{r.name}</span>
                    <span className="block truncate text-[11px] text-zinc-600">{r.path}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-zinc-500">
                    <span className="block tabular-nums">{fmtSize(r.size)}</span>
                    <span className="block tabular-nums text-zinc-600">{fmtTime(r.mtime)}</span>
                  </span>
                  <span
                    role="button"
                    title="打开所在文件夹"
                    onClick={(e) => {
                      e.stopPropagation()
                      open(r, 'folder')
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px] text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    📁
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 快捷键提示 */}
      {status?.available && results.length > 0 && (
        <div className="shrink-0 border-t border-island-line px-4 py-1.5 text-[10px] text-zinc-600">
          ↑↓ 选择 · Enter 打开 · Ctrl+Enter 定位 · Shift+Enter 在 Everything 中打开 · Ctrl+Shift+C 复制路径
        </div>
      )}
    </div>
  )
}
