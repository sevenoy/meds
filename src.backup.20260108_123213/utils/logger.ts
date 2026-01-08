/**
 * Production-safe logger
 * In production, log and warn are no-ops
 * Only errors are always logged
 */

const isDev = false; // 永久禁用开发日志

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: any[]) => {
    console.error(...args);
  }
};
