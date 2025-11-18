import { useEffect, useMemo, useState } from 'react'
import { useTodo } from '../stores/todo'

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function startWeekOffset(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function Overview() {
  const { list, fetchTodos } = useTodo()
  const [mode, setMode] = useState<'year'|'month'>('year')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(10) // 0-based, default November
  const [lang, setLang] = useState<'en'|'zh'>(() => (localStorage.getItem('settings.language') || 'en') as 'en'|'zh')

  useEffect(() => { fetchTodos() }, [fetchTodos])
  useEffect(() => {
    const onUpdated = () => setLang((localStorage.getItem('settings.language') || 'en') as 'en'|'zh')
    window.addEventListener('settings-updated', onUpdated as EventListener)
    return () => window.removeEventListener('settings-updated', onUpdated as EventListener)
  }, [])

  const grouped = useMemo(() => {
    const map: Record<string, { title: string; time?: string }[]> = {}
    for (const t of list) {
      if (!t.due_time) continue
      const d = new Date(t.due_time)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const item = { title: t.title, time: new Date(t.due_time).toLocaleTimeString() }
      map[key] = map[key] ? [...map[key], item] : [item]
    }
    return map
  }, [list])

  const total = daysInMonth(year, month)
  const offset = startWeekOffset(year, month)
  const cells = Array(offset).fill(null).concat(Array.from({ length: total }, (_, i) => new Date(year, month, i + 1)))

  const enterMonth = (m: number) => { setMonth(m); setMode('month') }
  const backToYear = () => setMode('year')

  return (
    <div className="p-6">
      {mode === 'year' ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">{year}</div>
            <div className="flex gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setYear((y) => y - 1)}>{lang === 'zh' ? '上一年' : 'Prev'}</button>
              <button className="px-3 py-1 border rounded" onClick={() => setYear((y) => y + 1)}>{lang === 'zh' ? '下一年' : 'Next'}</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 12 }, (_, i) => (
              <button key={i} className="border rounded p-4 text-center hover:bg-gray-50" onClick={() => enterMonth(i)}>
                <div className="text-lg font-semibold">{lang === 'zh' ? `${i+1}月` : monthNames[i]}</div>
                <div className="text-xs text-gray-600">{year}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button className="px-3 py-1 border rounded" onClick={backToYear}>{lang === 'zh' ? '返回' : 'Back'}</button>
            <div className="font-semibold">{year}-{String(month + 1).padStart(2, '0')}</div>
            <div />
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((d, idx) => {
              if (!d) return <div key={`e-${idx}`} className="h-28 border rounded bg-gray-50" />
              const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
              const items = grouped[key] || []
              return (
                <div key={key} className="h-28 border rounded p-2 flex flex-col">
                  <div className="text-xs text-gray-600">{lang === 'zh' ? `${d.getDate()}日` : d.getDate()}</div>
                  <div className="mt-1 space-y-1 overflow-auto">
                    {items.slice(0, 3).map((it, i) => (
                      <div key={`${key}-${i}`} className="text-xs">
                        <span className="font-medium mr-1">{it.title}</span>
                        <span className="text-gray-600">{it.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
