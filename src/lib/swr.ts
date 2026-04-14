/**
 * lib/swr.ts
 *
 * SWR 公共配置：fetcher + revalidation 策略
 * 数据只在上传报表时变化，所以用较长的 dedupingInterval 避免重复请求
 */

export const fetcher = (url: string) => fetch(url).then(r => r.json())

/** 默认 SWR 选项：适合报表数据（低频变化） */
export const swrOptions = {
  revalidateOnFocus: false,       // tab 切换不重新请求
  dedupingInterval: 60_000,       // 1 分钟内同 key 去重
  revalidateIfStale: true,        // 过期后后台刷新
  keepPreviousData: true,         // 切换参数时保留旧数据避免闪烁
}
