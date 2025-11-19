# Gym Assist 待办助手 — V1.0

简洁好用的个人待办与提醒助手。本版本聚焦“自然语言创建/提醒、周视图展示与书面化转写”，确保上手快、可追溯、可迭代。

## 目录
- [版本标识](#版本标识)
- [测试版本登录](#测试版本登录)
- [已实现功能](#已实现功能)
- [使用步骤](#使用步骤)
- [创建待办策略](#创建待办策略)
- [安装与部署](#安装与部署)
- [当前版本限制与注意事项](#当前版本限制与注意事项)
- [LLM 调用失败记录与排查](#llm-调用失败记录与排查)
- [问题反馈](#问题反馈)
- [重要资源清单（已纳入版本库）](#重要资源清单已纳入版本库)
- [2025-11-18 更新](#2025-11-18-更新)
- [2025-11-19 更新（时间解析与时区）](#2025-11-19-更新时间解析与时区)

## 版本标识
- 版本号：V1.0
- 发布内容：本周待办结构化展示、提醒到点窗口、LLM事件转写、自动迁移脚本

## 测试版本登录
- 测试账号：`test@example.com`
- 测试密码：`test123456`
- 仅用于测试环境，请勿在生产使用该账号；生产环境请自行注册或由管理员创建。

## 已实现功能
- 自然语言解析与创建待办：支持绝对时间与相对时间，按用户本地时区解释并以 UTC 存储
- 提醒到点窗口：以目标时间为基准，在触发前 5 分钟内进入提醒区域
- 首页右侧提醒区域：事件展示与操作（完成/稍后10分钟/忽略），事件驱动刷新
- 本周待办结构化呈现：展示时间、关键词、LLM 书面化描述（小屏居中）
- LLM 书面化转写：创建后调用 `/api/v1/llm/rewrite`，结果持久化到 `todo_items.enrichment`
- 自动数据库迁移：启动与测试前可自动执行 `supabase/migrations/*.sql`（幂等/事务）
- 组件复用：`src/components/StatusBadge.tsx`、`src/components/TodoCard.tsx`、`src/components/ReminderList.tsx` 统一样式与交互

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

### 界面设置：时间范围显示
- 默认隐藏 todaylist / weeklist 下方的时间范围
- 在 Settings 页面启用“显示时间范围”后，展示当天窗口与本周窗口边界时间（仅用于查看与校验）

## 测试目录与主题

- 目录：`scripts/`
- 主题与命令：
  - `run-llm-tests.ts`：LLM 意图识别回归 + 集成链路验证（解释/创建/查询/删除等）。运行：`npm run test:llm`
  - `test-home-input-flow.ts`：首页输入解析与预览链路；支持单例展示与断言模式。运行：
    - 单例：`npm run test:home-flow -- "明天9点提醒我买菜"`
    - 断言：`npm run test:home-assert`
  - `test-weeklist-sync.ts`：本周列表筛选一致性（周内命中、跨周不展示）。运行：`npm run test:weeklist`
  - `test-local-db-logs.ts`：本地缓存数据库写入验证（6 条示例输入，NDJSON）。运行：`npm run test:localdb`
  - `clear-all-todos.ts`：测试辅助脚本，批量软删除当前用户的待办。运行：`npm run clear:todos`

## 本地缓存数据库写入

- 目的：在不使用 Supabase 直连的环境下，本地记录用户输入与 LLM 转写完整结果，供后续统计与可视化。
- 开关与目录（PowerShell）：
  - 设置开关：`$env:USE_LOCAL_DB='true'`
  - 可选目录：`$env:LOCAL_DB_DIR='api/data'`
- 启动服务：`$env:USE_LOCAL_DB='true'; npm run dev`
- 写入触发：调用 `POST /api/v1/llm/rewrite`（页面或脚本），将逐行写入 NDJSON 文件。
- 文件位置：`api/data/llm_rewrite_logs.ndjson`
- 行记录结构（NDJSON）：
  - `user_id`、`created_at`、`input_text`、`rewrite_result`
- 验证命令：`npm run test:localdb`（写入 6 条示例记录）
- 关闭本地写入：不设置或将 `$env:USE_LOCAL_DB='false'`；此时如已配置服务端 Supabase，将写入 `public.llm_rewrite_logs` 表。
- 相关代码位置：
  - 配置：`api/src/config.ts`
  - 本地写入：`api/src/services/localDb.ts`
  - 接口落点：`api/src/routes/llm.ts`

## 开发环境端口设置

- 场景：后端 `3000` 端口被占用或需要临时切换端口。
- 页面设置：在应用左侧“Settings”页面，找到“API Port”，将端口改为如 `3001` 并失焦保存；前端所有 API 与通知 WebSocket 将在开发环境使用该端口。
- 终端方式（可选）：PowerShell 中设置后端端口并启动：`$env:PORT='3001'; $env:USE_LOCAL_DB='true'; npm run dev`
- 端口回退：后端会自动检测并在 `PORT` 起始的 20 个端口范围内选择可用端口；如你设置了 `API Port`，前端将以该端口为主。
- 生效范围：仅开发环境；生产环境仍以部署时的域名与端口为准。

## API 基地址配置

- 场景：需要在前端显式指定后端完整地址（域名/端口），或切换到远端服务。
- 页面设置：在“Settings”页面的“API Base URL”中填写完整地址（如 `http://localhost:3000` 或 `https://api.example.com`），失焦即保存。设置后前端接口与通知 WebSocket优先使用该地址。
- 回退顺序：Base URL > API Port > `VITE_API_BASE_URL`
- 生效范围：仅开发环境；生产环境默认使用页面所在的域名。


## 创建待办策略

- 一次性事件：创建待办仅支持一次性事件，不保存“周期规则”。
- 循环表达处理：当输入包含“每周/每月/周几”等循环表达时，系统将自动计算“最近一次执行的具体日期和时刻”，并按一次性待办创建；不会生成持久的循环任务。
- 相对时间兜底：
  - “明早/今早”默认为 09:00；“今晚/明晚”默认为 20:00。
  - “今天/明天 + 上午/下午/晚上”按默认时刻（上午 09:00 / 下午 15:00 / 晚上 20:00）解析为本地时区时间。
- 歧义输入处理：出现“或/或者”等多候选时，不设置 `time`，仅返回 `timeCandidates` 并降低置信度，建议在首页搜索框补充明确时刻后再创建。
- 标题抽取：仅保留唯一核心行动（如“提醒我开会”→“开会”），忽略前缀与修饰信息。
- 状态更新：对于“把今天的 X 标记完成”等更新请求，归一为范围 `range=today/this_week`，不设置具体 `time`。
- 周窗口与时区：以用户本地时区计算；本周范围为“周一 00:00:00”至“周日 23:59:59.999”。
- 使用建议：如需循环事件，请在每次发生前几天再次在首页搜索框输入，以创建下一次的一次性待办。


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
           - 指标路径：`GET /metrics`
           - 后端入口：`api/src/index.ts`
           - 清理示例文件：删除或不使用 `api/app.ts` 与 `api/routes/auth.ts`
           - 推荐在 CI/CD 中增加步骤：备份数据库 → `npm run db:migrate` → 启动服务

## 当前版本限制与注意事项
- LLM 服务异常时，转写会使用本地规则回退（简单书面化），效果略有差异
- 自动迁移需有 `SUPABASE_DB_URL` 直连权限；否则仅在测试与开发中跳过，不会影响应用启动
- 请勿提交 `.env` 到版本库；后端仅以 `service role key` 进行安全写入，不暴露到客户端
- 周起始固定为周一（可迭代为可配置）

## LLM 调用失败记录与排查
- 现象
  - 解释或转写接口报错并回退，后端日志出现 `Aliyun LLM call failed`（`api/src/lib/aliyun.ts`）。
  - 专项脚本输出 `Aliyun LLM call failed: { status: undefined, data: undefined }`。
- 常见原因
  - 接口路径与请求体不匹配（chat 与 text-generation 混用）。
  - `ALIYUN_API_KEY` 无效或权限不足；`ALIYUN_BASE_URL` 配置错误。
  - 网络不通或被代理阻断，返回 4xx/5xx。
- 现有解决方案
  - 统一使用 DashScope 文本生成端点：`POST /services/aigc/text-generation/generation`，请求体使用 `input.prompt`。
  - 解释与转写均做 JSON 清洗（去除 ```json 包裹）与意图归一化，失败时回退到本地解析/转写。
 - 常见状态码
   - 400 Bad Request：请求体或路径不匹配、`input.prompt` 缺失、模型名错误、JSON 无法解析。
   - 401 Unauthorized：API Key 缺失或无效（检查 `.env` 的 `ALIYUN_API_KEY`）。
   - 403 Forbidden：账号/密钥权限不足（联系控制台或更换有权限的 Key）。
   - 404 Not Found：URL 路径错误或该服务未开放（确认 `ALIYUN_BASE_URL=https://dashscope.aliyuncs.com/api/v1` 与具体端点）。
   - 429 Too Many Requests：频率限制，避免短时间大量请求，增加退避重试。
   - 500/502/503 Server Error：服务端异常或网络波动，建议重试或走本地降级。
- 验证步骤
  - 环境变量（示例，不要写入代码库）：
    - `ALIYUN_API_KEY`、`ALIYUN_BASE_URL=https://dashscope.aliyuncs.com/api/v1`、`ALIYUN_MODEL=qwen-turbo`
  - 连接测试（PowerShell）：
    - `Invoke-WebRequest -Uri "$env:ALIYUN_BASE_URL/services/aigc/text-generation/generation" -Headers @{ Authorization = "Bearer $env:ALIYUN_API_KEY"; 'Content-Type' = 'application/json' } -Method POST -Body (@{ model = 'qwen-turbo'; input = @{ prompt = '你好' }; parameters = @{ temperature = 0.0 } } | ConvertTo-Json -Depth 6)`
  - 首页链路专项：
    - 单例：`npm run test:home-flow -- "明天9点提醒我买菜"`
    - 断言：`npm run test:home-assert`
- 回退行为（不影响可用性）
  - 解释：`simpleInterpret` 保留“提醒我”前缀与中文时段，生成稳定 `entities.time/title`。
  - 转写：`simplePolishFallback`，前端支持 `mode=light` 不持久化展示。
  - 首页保存统一以用户输入解析为准，today/week 落位与预览一致。

## 问题反馈
- 提交 Issue：建议在代码托管仓库开启 Issues（示例标题：`[V1.0] 本周视图关键词未展示`）
- 联系方式：维护者邮箱或团队 IM（请在私有环境补充真实地址）

## 重要资源清单（已纳入版本库）
- 数据库迁移：`supabase/migrations/2025111701_add_todo_enrichment.sql`
- 自动迁移执行：`scripts/run-db-migrations.ts`
- 测试脚本：`scripts/run-llm-tests.ts`
- 后端入口：`api/src/index.ts`
- 后端配置读取：`api/src/config.ts`（环境变量入口）
- LLM 接口：`api/src/routes/llm.ts`
- 提醒服务：`api/src/services/reminderService.ts`
- 状态徽章组件：`src/components/StatusBadge.tsx`
- 通用卡片组件：`src/components/TodoCard.tsx`
- 提醒列表组件：`src/components/ReminderList.tsx`
- 首页呈现：`src/pages/Home.tsx`

---
V1.0 关注“能用且清晰”，后续将迭代：周起始可配置、关键词用于搜索过滤、持续优化提醒与转写效果。

## 2025-11-18 更新

优化与修复：
- LLM 提示词强化：严格抽取唯一核心行动（如“明早9点洗车”→“洗车”），忽略时间/地点/工具等修饰信息（`api/src/routes/llm.ts`）。
- 核心行动清洗：新增归一函数用于后备解析，清除非行动前缀（`api/src/lib/aliyun.ts`）。
- 中文时间解析增强：支持“今天/明天/今早/明早/下午/晚上”等相对时间并提供默认时刻（上午09:00/中午12:00/下午15:00/晚上20:00），并按本地时区生成 ISO（`src/pages/Home.tsx`）。
- 今日/本周列表一致性：统一以本地时间边界进行筛选；周列表结束边界调整为“周日 23:59:59.999”，包含末端（`src/pages/Home.tsx`）。
- 创建兜底时间：当 AI 未返回时间与候选时，基于用户输入进行兜底解析，用于创建待办与提醒的 `due_time`（`src/pages/Home.tsx`）。
- UI 优化：固定侧边栏、取消列表内部滚动，首页整体滚动更顺畅（`src/App.tsx`, `src/pages/Home.tsx`）。
- 展示一致性：搜索页优先展示书面化转写 `enrichment.polished`（`src/pages/Search.tsx`）。
- 运行脚本调整：开发与 LLM 测试不再自动执行数据库迁移，避免网络超时（`package.json`）。
- 调试开关：设置页新增时间窗口调试开关（仅本地），可查看今日/本周窗口与输入解析结果（`src/pages/Settings.tsx`, `src/pages/Home.tsx`）。

未解决/待跟进：
- 个别环境下，“明早洗车”未显示在 week list：疑似为设备本地时区/系统日期与持久化 `due_time` 的组合问题。当前已：
  - 以本地日期构造 `Date(y, m, d, hh, mi)` 并转 ISO，避免 `UTC+offset` 跨日误差（`src/pages/Home.tsx`）
  - 周窗口边界改为周日 23:59:59.999 并包含末端（`src/pages/Home.tsx`）
  - 创建兜底解析覆盖“中文相对时间”
  后续计划：在不改变周窗口规则的前提下，增加针对“明早/明晚”在周日场景的专项回归测试与日志采集，定位具体设备差异。

验证：
- 类型检查 `npm run check` 与代码规范 `npm run lint` 通过。
- 周列表测试 `npm run test:weeklist` 命中正确，跨周不展示。
- LLM 与集成测试 `npx tsx scripts/run-llm-tests.ts` 全部通过。

## 2025-11-19 更新（时间解析与时区）

**为什么会出现这类问题**
- 相对时间解析不一致：中文“明晚/今晚/下午”存在 12 小时制歧义，LLM 有时只返回“晚上7点”而漏掉“明/今”的日期信息。
- 本地与 UTC 转换引发跨日：以本地 `Date(y,m,d,hh,mi)` 生成后再 `toISOString()` 存储 UTC，如默认时刻或 12 小时转换错误，会导致日期偏移。
- 展示层信息不足：周列表仅显示日期未显示具体时间，难以确认是否落在预期时段。

**解决策略是什么**
- 前端统一按“用户输入”解析优先，确保“明晚”等日期线索被尊重；LLM 的 `entities.time` 作为次选。
- 明确中文时段规则：晚间命中后对 `<12` 小时做 +12 转换；缺少小时则按可配置默认时刻赋值（上午/中午/下午/晚上）。
- 存储层始终保存 UTC ISO（由本地时间构造后转 `toISOString()`），查询筛选按本地时区今日/本周窗口进行。
- 展示层统一显示本地“日期+时间”，提升确认效率。

**怎么实现**
- 解析函数：`src/pages/Home.tsx:47-119`
  - 晚间识别包含“明晚”：`src/pages/Home.tsx:55`
  - 12 小时转换：`src/pages/Home.tsx:69-70`
  - 默认时刻读取自设置：`src/pages/Home.tsx:72-81`
- 创建时 `dueTime` 来源顺序（优先用户输入）：
  - 待办：`src/pages/Home.tsx:139-144`
  - 提醒中的待办：`src/pages/Home.tsx:160-166`
- 今日/本周窗口判断（本地时区）：
  - 今日：`src/pages/Home.tsx:207-214`
  - 本周：`src/pages/Home.tsx:233-240`
- 周列表显示具体时刻：`src/pages/Home.tsx:360`
- 服务端校验 `dueTime` 合法性：`api/src/routes/todos.ts:38-44`

**结果如何**
- 输入“明晚7点约朋友看电影”：
  - 预览：`2025/11/19 19:00:00 · today: false · week: true`
  - 今日列表：不显示该项（仅今天）
  - 本周列表：显示为 `2025/11/19 19:00:00`
- 老数据如仅存“07:00/11/24”显示旧文案，可在管理页触发转写或重新创建刷新。

### 专项问题：周日下午 3 点显示为周一 07:00
- 为什么会出现
  - 错误的时区换算或混用 UTC 边界：将“本地 15:00”错误地按 `UTC+8` 加减偏移，或以 UTC 计算周起止再与本地比较，导致跨日偏移到周一 07:00。
  - 具体易错点：把 `timezoneOffsetMinutes`（UTC 相对本地的分钟差，`UTC+8 = -480`）当作正数加到 UTC 上，或先 `Date.UTC` 后再错误调整，都会造成日期翻转。
- 解决策略
  - 周窗口与解析统一在本地时区完成，存储再转 UTC（`toISOString()`）。列表筛选使用本地周窗口（周一 00:00 至周日 23:59:59.999）。
  - 坚持“本地构造 → UTC 存储”的不变量，避免手工加减偏移引入符号错误；需要本地展示时由 UTC 通过偏移还原为本地。
- 怎么实现
  - 本地构造：前端使用 `new Date(y, m, d, hh, mi, 0, 0).toISOString()` 存储，位置：`src/pages/Home.tsx:105-118`（`toIsoFromCandidate` 返回 UTC ISO）。
  - 周窗口：`startOfWeek/endOfWeek` 在本地时区计算，位置：`src/pages/Home.tsx:218-231`；筛选使用 `new Date(due_time)` 的本地视图，位置：`src/pages/Home.tsx:233-240`。
  - 服务器展示换算：`formatLocalISO(utcMs, tz)` 用 `localMs = utcMs - tz*60000` 从 UTC 还原为本地，位置：`api/src/routes/llm.ts:20-33`。
  - LLM 解析落点统一：服务端解析时以调用方提供的 `timezoneOffsetMinutes` 计算本地 → UTC，并返回 `timeLocalISO` 与 `timeUTCISO`，位置：`api/src/routes/llm.ts:295-306`。
- 结果验证（UTC+8 示例）
  - 输入：“本周日下午 3 点”
    - 本地：`timeLocalISO = 2025-11-23T15:00:00+08:00`
    - UTC：`timeUTCISO = 2025-11-23T07:00:00.000Z`
    - 页面：周列表显示 `2025/11/23 15:00`，无跨日到周一的现象。
