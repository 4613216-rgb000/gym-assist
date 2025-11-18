# Gym Assist 待办助手

一个专注“自然语言创建、提醒、周视图展示、书面化转写”的轻量待办应用。

## 快速开始
- 安装并启动：`npm install && npm run dev`
- 前端：`http://localhost:5173/`（端口占用时 Vite 会自动换端口）
- 后端：默认 `http://localhost:3000/`（Settings 可调整为 `3001` 等）
- 登录测试账号：`test@example.com` / `test123456`（仅测试环境）

## 功能概览
- 自然语言创建待办；支持绝对/相对时间，按本地时区解析后存储为 ISO（UTC）
- 到点提醒：目标时间前 5 分钟进入提醒区域，可一键操作
- 周视图：展示时间、关键词与书面化描述
- 转写服务：`POST /api/v1/llm/rewrite`，结果写入 `todo_items.enrichment`

## 设置项（开发环境）
- `API Port`：在 Settings 设置端口（如 `3001`），前端将优先使用该端口
- `API Base URL`：设置完整地址（`http://localhost:3000` 或远端），优先级高于端口
- 优先级：`API Base URL` > `API Port` > `VITE_API_BASE_URL`

## 测试
- LLM 与集成：`npm run test:llm`
- 首页输入链路：
  - 单例：`npm run test:home-flow -- "明天9点提醒我买菜"`
  - 断言：`npm run test:home-assert`
- 周列表一致性：`npm run test:weeklist`
- 本地写入验证：`npm run test:localdb`
- 批量清理：`npm run clear:todos`

## 本地缓存写入（可选）
- 开关：`$env:USE_LOCAL_DB='true'`
- 目录（可选）：`$env:LOCAL_DB_DIR='api/data'`
- 启动：`$env:USE_LOCAL_DB='true'; npm run dev`
- 文件：`api/data/llm_rewrite_logs.ndjson`（字段：`user_id`、`created_at`、`input_text`、`rewrite_result`）

## 环境变量示例
- 前端/测试：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`
- 后端写入：`SUPABASE_SERVICE_ROLE_KEY`（勿暴露到前端）
- LLM：`ALIYUN_API_KEY`、`ALIYUN_BASE_URL`、`ALIYUN_MODEL`
- 直连迁移：`SUPABASE_DB_URL`（可在 CI/CD 中使用）

## 部署
- 迁移：`npm run db:migrate`（未配置 `SUPABASE_DB_URL` 将跳过）
- 构建/启动：`npm run build` / `npm run start`
- 指标：`GET /metrics`

## 重要路径
- 后端入口：`api/src/index.ts`
- 后端配置：`api/src/config.ts`
- LLM 路由：`api/src/routes/llm.ts`
- 提醒服务：`api/src/services/reminderService.ts`
- 首页：`src/pages/Home.tsx`
- 搜索：`src/pages/Search.tsx`

## 2025-11-18 更新（摘要）
- 提示词与行动抽取优化；中文相对时间解析增强（09:00 / 15:00 / 20:00 默认）
- 周窗口边界统一：周一 00:00:00.000 至 周日 23:59:59.999
- 搜索优先展示书面化转写；侧边栏与滚动体验优化
- 开发/测试脚本不再自动迁移，降低超时风险

## 注意事项
- 不要提交 `.env` 到仓库
- LLM 不可用时会使用本地回退策略，表现可能略有差异
