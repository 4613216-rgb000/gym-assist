import { config as dotenv } from 'dotenv';
dotenv();

export const config = {
  port: Number(process.env.PORT || 3000),
  supabase: {
    url: process.env.VITE_SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  aliyun: {
    apiKey: process.env.ALIYUN_API_KEY!,
    baseUrl: process.env.ALIYUN_BASE_URL!,
    model: process.env.ALIYUN_MODEL || 'qwen-turbo',
    timeoutMs: Number(process.env.ALIYUN_TIMEOUT_MS || 30000),
    maxTokens: Number(process.env.ALIYUN_MAX_TOKENS || 4096),
  },
  mcp: {
    timeServiceUrl: process.env.MCP_TIME_SERVICE_URL || 'http://localhost:8001/mcp/get_current_time',
  },
};