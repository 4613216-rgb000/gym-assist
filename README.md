# Gym Assist 待办助手 — V1.0

简洁好用的个人待办与提醒助手。本版本聚焦“自然语言创建/提醒、周视图展示与书面化转写”，确保上手快、可追溯、可迭代。

## 版本标识
- 版本号：V1.0
- 发布内容：本周待办结构化展示、提醒到点窗口、LLM事件转写、自动迁移脚本

## 已实现功能
- 自然语言解析与创建待办：支持绝对时间与相对时间，按用户本地时区解释并以 UTC 存储
- 提醒到点窗口：以目标时间为基准，在触发前 5 分钟内进入提醒区域；支持循环规则推算
- 首页右侧提醒区域：事件展示与操作（完成/稍后10分钟/忽略），事件驱动刷新
- 本周待办结构化呈现：展示时间、关键词、LLM 书面化描述（小屏居中）
- LLM 书面化转写：创建后调用 `/api/v1/llm/rewrite`，结果持久化到 `todo_items.enrichment`
- 自动数据库迁移：启动与测试前可自动执行 `supabase/migrations/*.sql`（幂等/事务）

## 使用步骤
1. 启动开发环境
   - `npm install`
   - `npm run dev`
   - 前端开发服：`http://localhost:5173/`；后端 API：`http://localhost:3000/`
2. 登录与基础操作
   - 在页面登录（Supabase 认证）后，在首页输入自然语言：例如“今天晚上洗车”、“提醒我在2025-11-20 15:00 开会”
   - 创建后自动触发转写，周视图展示时间/关键词/书面化描述
   - 到点前 5 分钟的待办会进入右侧提醒区域，可直接操作
3. 测试
   - `npm run test:llm`（含 AI 意图识别 11 条与集成测试 8 条；自动迁移在测试前执行）

## 安装与部署
1. 环境变量（示例）
   - `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（前端/测试用）
   - `SUPABASE_SERVICE_ROLE_KEY`（后端服务写入用，勿暴露到前端）
   - `ALIYUN_API_KEY`、`ALIYUN_BASE_URL`、`ALIYUN_MODEL`
   - `API_BASE_URL`（测试脚本用，如 `http://localhost:3000`）
   - `SUPABASE_DB_URL`（自动迁移直连 Postgres 用，生产/CI 推荐配置）
2. 数据库迁移
   - 运行 `npm run db:migrate` 执行 `supabase/migrations`；未配置 `SUPABASE_DB_URL` 时将跳过
3. 生产部署
   - 构建：`npm run build`
   - 启动：`npm run start`
   - 推荐在 CI/CD 中增加步骤：备份数据库 → `npm run db:migrate` → 启动服务

## 当前版本限制与注意事项
- LLM 服务异常时，转写会使用本地规则回退（简单书面化），效果略有差异
- 自动迁移需有 `SUPABASE_DB_URL` 直连权限；否则仅在测试与开发中跳过，不会影响应用启动
- 请勿提交 `.env` 到版本库；后端仅以 `service role key` 进行安全写入，不暴露到客户端
- 周起始固定为周一（可迭代为可配置）

## 问题反馈
- 提交 Issue：建议在代码托管仓库开启 Issues（示例标题：`[V1.0] 本周视图关键词未展示`）
- 联系方式：维护者邮箱或团队 IM（请在私有环境补充真实地址）

## 重要资源清单（已纳入版本库）
- 数据库迁移：`supabase/migrations/2025111701_add_todo_enrichment.sql`
- 自动迁移执行：`scripts/run-db-migrations.ts`
- 测试脚本：`scripts/run-llm-tests.ts`
- 后端配置读取：`api/src/config.ts`（环境变量入口）
- LLM 接口：`api/src/routes/llm.ts`
- 提醒服务：`api/src/services/reminderService.ts`
- 首页呈现：`src/pages/Home.tsx`

---
V1.0 关注“能用且清晰”，后续将迭代：周起始可配置、关键词用于搜索过滤、持续优化提醒与转写效果。
