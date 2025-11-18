import { useEffect, useState } from 'react'

export default function Settings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [language, setLanguage] = useState<'en'|'zh'>(() => (localStorage.getItem('settings.language') || 'en') as 'en'|'zh')
  const [apiKey, setApiKey] = useState('')
  const [debugTime, setDebugTime] = useState(false)
  const [morning, setMorning] = useState('09:00')
  const [noon, setNoon] = useState('12:00')
  const [afternoon, setAfternoon] = useState('15:00')
  const [evening, setEvening] = useState('20:00')
  const [apiPort, setApiPort] = useState('3000')
  const [apiBaseUrl, setApiBaseUrl] = useState('')

  useEffect(() => {
    const n = localStorage.getItem('settings.notificationsEnabled')
    const l = localStorage.getItem('settings.language')
    const k = localStorage.getItem('settings.apiKey')
    const d = localStorage.getItem('settings.debugTimeWindows')
    const m = localStorage.getItem('settings.timeDefaults.morning')
    const nn = localStorage.getItem('settings.timeDefaults.noon')
    const a = localStorage.getItem('settings.timeDefaults.afternoon')
    const e = localStorage.getItem('settings.timeDefaults.evening')
    const p = localStorage.getItem('settings.apiPort')
    const u = localStorage.getItem('settings.apiBaseUrl')
    setNotificationsEnabled(n === null ? true : n !== 'false')
    setLanguage(((l || 'en') as 'en'|'zh'))
    setApiKey(k || '')
    setDebugTime(d === 'true')
    setMorning(m || '09:00')
    setNoon(nn || '12:00')
    setAfternoon(a || '15:00')
    setEvening(e || '20:00')
    setApiPort(p || '3000')
    setApiBaseUrl(u || '')
  }, [])

  const saveNotifications = (val: boolean) => {
    setNotificationsEnabled(val)
    localStorage.setItem('settings.notificationsEnabled', String(val))
    window.dispatchEvent(new CustomEvent('settings-updated'))
  }

  const saveLanguage = (val: string) => {
    setLanguage(val as 'en'|'zh')
    localStorage.setItem('settings.language', val)
    window.dispatchEvent(new CustomEvent('settings-updated'))
  }

  const saveApiKey = (val: string) => {
    setApiKey(val)
    localStorage.setItem('settings.apiKey', val)
    window.dispatchEvent(new CustomEvent('settings-updated'))
  }

  const saveApiPort = (val: string) => {
    const v = val.replace(/[^0-9]/g, '')
    if (!v) return
    setApiPort(v)
    localStorage.setItem('settings.apiPort', v)
    window.dispatchEvent(new CustomEvent('settings-updated'))
  }

  const saveApiBaseUrl = (val: string) => {
    const v = val.trim()
    if (!v) { setApiBaseUrl(''); localStorage.removeItem('settings.apiBaseUrl'); window.dispatchEvent(new CustomEvent('settings-updated')); return }
    setApiBaseUrl(v)
    localStorage.setItem('settings.apiBaseUrl', v)
    window.dispatchEvent(new CustomEvent('settings-updated'))
  }

  const saveDebugTime = (val: boolean) => {
    setDebugTime(val)
    localStorage.setItem('settings.debugTimeWindows', String(val))
    window.dispatchEvent(new CustomEvent('settings-updated'))
  }

  const saveTimeDefault = (key: 'morning'|'noon'|'afternoon'|'evening', val: string) => {
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(val)) return
    if (key === 'morning') setMorning(val)
    if (key === 'noon') setNoon(val)
    if (key === 'afternoon') setAfternoon(val)
    if (key === 'evening') setEvening(val)
    localStorage.setItem(`settings.timeDefaults.${key}`, val)
    window.dispatchEvent(new CustomEvent('settings-updated'))
  }

  const textTimeRange = language === 'zh'
    ? '控制 todaylist / weeklist 的时间范围显示（D1：YYYY-MM-DD HH:mm:ss.SSS）'
    : 'Control time ranges visibility for todaylist/weeklist (D1: YYYY-MM-DD HH:mm:ss.SSS)'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">{language === 'zh' ? '设置' : 'Settings'}</h1>
      <div className="space-y-6">
        <div className="flex items-center justify-between border rounded p-4">
          <div>
            <div className="font-medium">{language === 'zh' ? '提醒' : 'Reminders'}</div>
            <div className="text-sm text-gray-600">{language === 'zh' ? '启用桌面通知' : 'Enable desktop notifications'}</div>
          </div>
          </div>
          <label className="inline-flex items-center">
            <input type="checkbox" checked={notificationsEnabled} onChange={(e) => saveNotifications(e.target.checked)} />
            <span className="ml-2 text-sm">{language === 'zh' ? '启用' : 'Enabled'}</span>
          </label>
        </div>

        <div className="flex items-center justify之间 border rounded p-4">
          <div>
            <div className="font-medium">{language === 'zh' ? '语言' : 'Language'}</div>
            <div className="text-sm text-gray-600">{language === 'zh' ? '界面语言' : 'Interface language'}</div>
          </div>
          <select className="border px-3 py-2 rounded" value={language} onChange={(e) => saveLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="zh">简体中文</option>
          </select>
        </div>

        <div className="border rounded p-4">
          <div className="font-medium mb-2">{language === 'zh' ? 'API 密钥' : 'API Key'}</div>
          <input
            className="w-full border px-3 py-2 rounded"
            type="password"
            placeholder={language === 'zh' ? '输入你的 API 密钥' : 'Input your API key'}
            value={apiKey}
            onChange={(e) => saveApiKey(e.target.value)}
          />
          <div className="text-xs text-gray-500 mt-2">{language === 'zh' ? '仅在本地存储，用于客户端请求。' : 'Stored locally for client-side requests.'}</div>
        </div>

        <div className="border rounded p-4">
          <div className="font-medium mb-2">{language === 'zh' ? 'API 端口' : 'API Port'}</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">http://localhost:</span>
            <input
              className="border px-2 py-1 rounded w-24"
              value={apiPort}
              onChange={(e) => setApiPort(e.target.value)}
              onBlur={(e) => saveApiPort(e.target.value)}
            />
          </div>
          <div className="text-xs text-gray-500 mt-2">{language === 'zh' ? '仅开发环境使用；留空使用默认或环境变量配置。' : 'Dev-only; leave empty to use default or environment variables.'}</div>
        </div>

        <div className="border rounded p-4">
          <div className="font-medium mb-2">{language === 'zh' ? 'API 基地址' : 'API Base URL'}</div>
          <input
            className="w-full border px-3 py-2 rounded"
            placeholder={language === 'zh' ? '例如：http://localhost:3000 或 https://api.example.com' : 'e.g.: http://localhost:3000 or https://api.example.com'}
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            onBlur={(e) => saveApiBaseUrl(e.target.value)}
          />
          <div className="text-xs text-gray-500 mt-2">{language === 'zh' ? '设置后优先使用完整地址；留空则按端口或环境变量回退。' : 'If set, uses full base URL; leave empty to fall back to port or env.'}</div>
        </div>

        <div className="flex items-center justify之间 border rounded p-4">
          <div>
            <div className="font-medium">{language === 'zh' ? '显示时间范围' : 'Show time ranges'}</div>
            <div className="text-sm text-gray-600">{textTimeRange}</div>
          <label className="inline-flex items-center">
            <input type="checkbox" checked={debugTime} onChange={(e) => saveDebugTime(e.target.checked)} />
            <span className="ml-2 text-sm">{language === 'zh' ? '显示' : 'Show'}</span>
          </label>
        </div>

        <div className="border rounded p-4">
          <div className="font-medium mb-2">{language === 'zh' ? '默认时段' : 'Default Times'}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <span className="w-20 text-sm text-gray-600">{language === 'zh' ? '上午' : 'Morning'}</span>
              <input className="border px-2 py-1 rounded w-32" value={morning} onChange={(e) => saveTimeDefault('morning', e.target.value)} />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-20 text-sm text-gray-600">{language === 'zh' ? '中午' : 'Noon'}</span>
              <input className="border px-2 py-1 rounded w-32" value={noon} onChange={(e) => saveTimeDefault('noon', e.target.value)} />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-20 text-sm text-gray-600">{language === 'zh' ? '下午' : 'Afternoon'}</span>
              <input className="border px-2 py-1 rounded w-32" value={afternoon} onChange={(e) => saveTimeDefault('afternoon', e.target.value)} />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-20 text-sm text-gray-600">{language === 'zh' ? '晚上' : 'Evening'}</span>
              <input className="border px-2 py-1 rounded w-32" value={evening} onChange={(e) => saveTimeDefault('evening', e.target.value)} />
            </label>
          </div>
          <div className="text-xs text-gray-500 mt-2">{language === 'zh' ? '格式示例：09:00:00、14:30:15（支持不写秒）' : 'Format examples: 09:00:00, 14:30:15 (seconds optional)'}</div>
        </div>
      </div>
    </div>
  )
}
