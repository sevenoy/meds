/**
 * 冲突检测与解决服务
 * 实现 LWW (Last Write Wins) 策略
 */

/**
 * 检测两个数据是否存在冲突
 * @param local 本地数据
 * @param remote 远程数据
 * @returns 是否存在冲突
 */
export function detectConflict(local: any, remote: any): boolean {
  if (!local || !remote) return false;
  
  const localTime = new Date(local.updated_at || local.created_at).getTime();
  const remoteTime = new Date(remote.updated_at || remote.created_at).getTime();
  
  // 5秒内的变更视为冲突
  const timeDiff = Math.abs(localTime - remoteTime);
  return timeDiff < 5000;
}

/**
 * 解决冲突 - 使用 LWW 策略
 * @param local 本地数据
 * @param remote 远程数据
 * @returns 胜出的数据
 */
export function resolveConflict(local: any, remote: any): any {
  const localTime = new Date(local.updated_at || local.created_at).getTime();
  const remoteTime = new Date(remote.updated_at || remote.created_at).getTime();
  
  // Last Write Wins - 时间戳更新的获胜
  return remoteTime > localTime ? remote : local;
}

/**
 * 合并冲突数据
 * 对于某些字段可以智能合并而不是简单覆盖
 */
export function mergeConflict(local: any, remote: any): any {
  const winner = resolveConflict(local, remote);
  
  // 基础策略：使用获胜方的数据
  // 未来可以扩展为字段级别的智能合并
  return {
    ...winner,
    // 保留冲突标记用于调试
    _conflict_resolved: true,
    _conflict_time: new Date().toISOString()
  };
}

/**
 * 批量检测冲突
 * @param localData 本地数据数组
 * @param remoteData 远程数据数组
 * @returns 冲突列表
 */
export function detectBatchConflicts(
  localData: any[],
  remoteData: any[]
): Array<{ local: any; remote: any }> {
  const conflicts: Array<{ local: any; remote: any }> = [];
  
  for (const remoteItem of remoteData) {
    const localItem = localData.find(l => l.id === remoteItem.id);
    
    if (localItem && detectConflict(localItem, remoteItem)) {
      conflicts.push({ local: localItem, remote: remoteItem });
    }
  }
  
  return conflicts;
}

/**
 * 批量解决冲突
 * @param conflicts 冲突列表
 * @returns 解决后的数据
 */
export function resolveBatchConflicts(
  conflicts: Array<{ local: any; remote: any }>
): any[] {
  return conflicts.map(({ local, remote }) => resolveConflict(local, remote));
}



