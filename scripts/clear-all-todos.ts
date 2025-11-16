import 'dotenv/config'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!
  const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com'
  const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test123456'

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await supabase.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD })
  if (error || !data.session?.access_token) throw new Error(`登录失败：${error?.message}`)
  const token = data.session.access_token

  const delRes = await axios.delete(`${BASE_URL}/api/v1/todos`, { headers: { Authorization: `Bearer ${token}` } })
  const deleted = delRes.data?.deleted ?? 0
  console.log(`已删除待办：${deleted}`)

  const q = await axios.get(`${BASE_URL}/api/v1/todos?page=1&size=10`, { headers: { Authorization: `Bearer ${token}` } })
  const left = (q.data.list || []).length
  console.log(`剩余待办：${left}`)
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e)
  console.error('清空失败：', msg)
  process.exit(1)
})
