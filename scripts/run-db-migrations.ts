import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { Pool } from 'pg'

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    console.log('ℹ️  未配置 SUPABASE_DB_URL，跳过自动迁移执行（将视为成功）')
    return
  }

  const pool = new Pool({ connectionString: dbUrl })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await client.query('COMMIT')
  } catch {
    await client.query('ROLLBACK')
    throw new Error('初始化迁移表失败')
  }

  const dir = path.resolve('supabase/migrations')
  let files: string[] = []
  try {
    const entries = await fs.readdir(dir)
    files = entries.filter((f) => f.endsWith('.sql')).sort()
  } catch {
    console.log('ℹ️  未找到迁移目录，跳过自动迁移执行')
    await client.release()
    await pool.end()
    return
  }

  const { rows } = await client.query('SELECT filename FROM public.schema_migrations')
  const applied = new Set<string>(rows.map((r) => r.filename as string))

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`↪️  已应用迁移：${file}`)
      continue
    }
    const full = path.join(dir, file)
    const sql = await fs.readFile(full, 'utf-8')
    console.log(`🚀 开始应用迁移：${file}`)
    const start = Date.now()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO public.schema_migrations(filename) VALUES($1)', [file])
      await client.query('COMMIT')
      console.log(`✅  迁移成功：${file}（耗时 ${Date.now() - start}ms）`)
    } catch (e) {
      await client.query('ROLLBACK')
      console.error(`❌  迁移失败：${file}`, e)
      throw e
    }
  }

  await client.release()
  await pool.end()
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e)
  console.error('自动迁移执行失败：', msg)
  process.exit(1)
})
