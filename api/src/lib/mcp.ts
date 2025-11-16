/**
 * 获取当前时间（暂时使用服务器UTC时间，后续可接入MCP服务）
 */
export interface CurrentTimeResponse {
  unix: number;
  iso: string;
  timezone: string;
}

export async function getCurrentTime(): Promise<CurrentTimeResponse> {
  const now = new Date();
  return {
    unix: now.getTime(),
    iso: now.toISOString(),
    timezone: 'UTC',
  };
}
