// 同步控制器 - 多设备同步核心逻辑

import { supabase, getCurrentUserId } from '../lib/supabase';
import { db, getUnsyncedLogs, markLogSynced, updateMedicationLog, getDeviceId, getMedications, upsertMedication } from '../db/localDB';
import { isApplyingRemote } from './snapshot';
import { runWithRemoteFlag } from './realtime';
import type { MedicationLog, ConflictInfo, Medication } from '../types';

/**
 * 一次性修复：更新所有药品的 device_id 为当前设备
 * 包括 null 和其他设备的 device_id
 * 使用 runWithRemoteFlag 防止触发 Realtime 回调导致无限循环
 */
export async function fixLegacyDeviceIds(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log('❌ [fixLegacyDeviceIds] 无 userId，跳过修复');
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:15',message:'No userId, skipping fix',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    return;
  }
  
  const deviceId = getDeviceId();
  // 【重要】只使用 userId 作为标志,不包含 deviceId
  // 因为清除 localStorage 后 deviceId 会变,导致标志失效
  const fixFlag = `device_id_fixed_v3_${userId}`;
  const flagValue = localStorage.getItem(fixFlag);
  
  console.log('🔍 [fixLegacyDeviceIds] 检查修复标志', { 
    userId: userId.substring(0, 8) + '...', 
    deviceId: deviceId.substring(0, 20) + '...', 
    fixFlag: fixFlag, 
    flagValue: flagValue,
    allKeys: Object.keys(localStorage).filter(k => k.includes('device_id'))
  });
  
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:25',message:'Checking fix flag',data:{fixFlag:fixFlag,flagValue:flagValue,allDeviceIdKeys:Object.keys(localStorage).filter(k=>k.includes('device_id'))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F,G'})}).catch(()=>{});
  // #endregion
  
  // 检查是否已经执行过修复
  if (flagValue) {
    console.log('⏭️ device_id 已修复,跳过', { fixFlag });
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:35',message:'Skipping fixLegacyDeviceIds',data:{userId:userId,deviceId:deviceId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    return;
  }
  
  console.log('🔧 开始修复所有药品的 device_id...', { deviceId, fixFlag });
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:36',message:'Starting fixLegacyDeviceIds',data:{userId:userId,deviceId:deviceId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // 使用 runWithRemoteFlag 包裹，防止触发 Realtime 回调
  await runWithRemoteFlag(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:40',message:'Inside runWithRemoteFlag',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    try {
      // 【重要修复】只修复 device_id 为 NULL 的记录,不修改其他设备的记录
      // 这样避免在清除localStorage后重复更新所有记录,触发大量Realtime事件
      const { data, error } = await supabase!
        .from('medications')
        .update({ device_id: deviceId })
        .eq('user_id', userId)
        .is('device_id', null)  // 只修复 device_id 为 NULL 的药品
        .select();
      
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:50',message:'Update completed',data:{count:data?.length||0,hasError:!!error,errorMsg:error?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,D'})}).catch(()=>{});
      // #endregion
      
      if (error) {
        console.error('❌ 修复药品 device_id 失败:', error);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:73',message:'Update failed',data:{error:error?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
      } else {
        console.log('✅ 已修复所有药品的 device_id，共', data?.length || 0, '条');
        console.log('🔖 [fixLegacyDeviceIds] 准备设置标志', { fixFlag, currentKeys: Object.keys(localStorage).filter(k => k.includes('device_id')) });
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:77',message:'Before setItem',data:{fixFlag:fixFlag,count:data?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        
        // 标记已完成修复
        localStorage.setItem(fixFlag, 'true');
        
        const verifyValue = localStorage.getItem(fixFlag);
        console.log('✅ [fixLegacyDeviceIds] 标志已设置', { fixFlag, savedValue: verifyValue, allKeys: Object.keys(localStorage).filter(k => k.includes('device_id')) });
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:85',message:'After setItem',data:{fixFlag:fixFlag,verifyValue:verifyValue,allDeviceIdKeys:Object.keys(localStorage).filter(k=>k.includes('device_id'))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
      }
    } catch (error) {
      console.error('❌ 修复药品 device_id 异常:', error);
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:60',message:'Exception in fixLegacyDeviceIds',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
  });
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:65',message:'fixLegacyDeviceIds completed',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
}

/**
 * UUID v4 正则表达式
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 判断字符串是否为合法的 UUID v4
 */
export function isValidUUID(str: string): boolean {
  return UUID_V4_REGEX.test(str);
}

/**
 * 防御性检查：只允许合法 UUID，其余一律移除
 */
export function sanitizePayload(payload: any): any {
  const sanitized = { ...payload };
  
  // 如果 id 不是 UUID，移除
  if (sanitized.id && (typeof sanitized.id !== 'string' || !isValidUUID(sanitized.id))) {
    delete sanitized.id;
  }
  
  // 如果 medication_id 不是 UUID，移除
  if (sanitized.medication_id && (typeof sanitized.medication_id !== 'string' || !isValidUUID(sanitized.medication_id))) {
    delete sanitized.medication_id;
  }
  
  return sanitized;
}

/**
 * 同步medications到云端
 */
export async function syncMedications(): Promise<void> {
  // 【B】在所有监听入口加 guard
  if (isApplyingRemote()) {
    console.log('⏭ 忽略云端回放引起的本地变化（syncMedications）');
    return;
  }
  
  const userId = await getCurrentUserId();
  if (!userId) return;
  
  try {
    const localMeds = await getMedications();
    const deviceId = getDeviceId();
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:153',message:'syncMedications开始',data:{localMedsCount:localMeds.length,deviceId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'L'})}).catch(()=>{});
    // #endregion
    
    // 【性能优化】批量推送本地medications到云端
    if (localMeds.length > 0) {
      const medsToSync = localMeds.map(med => {
        const medData: any = {
          user_id: userId,
          name: med.name,
          dosage: med.dosage,
          scheduled_time: med.scheduled_time,
          device_id: deviceId,
          updated_at: new Date().toISOString()
        };
        
        // 如果本地有合法的 UUID，使用它
        if (med.id && isValidUUID(med.id)) {
          medData.id = med.id;
        }
        
        return sanitizePayload(medData);
      }).filter(med => med); // 过滤掉无效数据
      
        if (medsToSync.length > 0) {
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:175',message:'批量upsert开始',data:{count:medsToSync.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'L'})}).catch(()=>{});
          // #endregion
          // 批量upsert（Supabase会自动处理insert/update）
          const { data: syncedMeds, error: syncError } = await supabase!
            .from('medications')
            .upsert(medsToSync, { onConflict: 'id' })
            .select();
          
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:182',message:'批量upsert结果',data:{hasError:!!syncError,errorMsg:syncError?.message,syncedCount:syncedMeds?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'L'})}).catch(()=>{});
          // #endregion
          
          if (syncError) {
            console.error('❌ 批量同步 medications 失败:', syncError);
          } else {
            console.log(`✅ 批量同步 ${syncedMeds?.length || 0} 条药品到云端`);
          
          // 【重要修复】更新本地记录中非UUID的ID
          // 匹配逻辑：通过name + dosage + scheduled_time匹配，因为local_xxx的ID无法直接匹配
          if (syncedMeds) {
            for (const syncedMed of syncedMeds) {
              // 先尝试通过ID匹配（如果是UUID）
              let localMed = localMeds.find(m => m.id === syncedMed.id);
              
              // 如果没找到，通过name + dosage + scheduled_time匹配（用于匹配local_xxx的ID）
              if (!localMed) {
                localMed = localMeds.find(m => 
                  !isValidUUID(m.id) && 
                  m.name === syncedMed.name &&
                  m.dosage === syncedMed.dosage &&
                  m.scheduled_time === syncedMed.scheduled_time
                );
              }
              
              if (localMed && localMed.id !== syncedMed.id) {
                console.log(`🔄 更新本地药品ID: ${localMed.id} → ${syncedMed.id} (${localMed.name})`);
                const updatedMed = { ...localMed, id: syncedMed.id };
                await upsertMedication(updatedMed);
                // #region agent log
                fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:217',message:'更新本地药品ID',data:{oldId:localMed.id,newId:syncedMed.id,name:localMed.name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'M'})}).catch(()=>{});
                // #endregion
              }
            }
          }
        }
      }
    }
    
    // 拉取云端medications（批量）
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:205',message:'拉取云端medications',data:{userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'L'})}).catch(()=>{});
    // #endregion
    const { data: cloudMeds } = await supabase!
      .from('medications')
      .select('*')
      .eq('user_id', userId);
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:212',message:'拉取云端medications结果',data:{cloudMedsCount:cloudMeds?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'L'})}).catch(()=>{});
    // #endregion
    
    if (cloudMeds && cloudMeds.length > 0) {
      console.log(`📥 从Supabase拉取到 ${cloudMeds.length} 条药品:`, cloudMeds.map(m => ({ id: m.id, name: m.name })));
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:245',message:'从Supabase拉取到药品',data:{cloudMedsCount:cloudMeds.length,cloudMedIds:cloudMeds.map(m=>m.id),localMedIds:localMeds.map(m=>m.id)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'N'})}).catch(()=>{});
      // #endregion
      
      // 【性能优化】批量添加云端有但本地没有的药品
      const newMeds = cloudMeds.filter(cloudMed => 
        !localMeds.find(m => m.id === cloudMed.id)
      );
      
      console.log(`🔍 匹配结果: 云端${cloudMeds.length}条, 本地${localMeds.length}条, 新药品${newMeds.length}条`);
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:252',message:'匹配结果',data:{cloudCount:cloudMeds.length,localCount:localMeds.length,newCount:newMeds.length,newMedIds:newMeds.map(m=>m.id)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'N'})}).catch(()=>{});
      // #endregion
      
      if (newMeds.length > 0) {
        const medsToAdd = newMeds.map(cloudMed => ({
          id: cloudMed.id,
          name: cloudMed.name,
          dosage: cloudMed.dosage,
          scheduled_time: cloudMed.scheduled_time,
          user_id: cloudMed.user_id,
          accent: cloudMed.accent || '#E8F5E9' // 默认浅绿色
        }));
        
        console.log(`📦 准备批量添加 ${medsToAdd.length} 条药品到本地:`, medsToAdd.map(m => ({ id: m.id, name: m.name })));
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:262',message:'批量添加到本地',data:{count:medsToAdd.length,meds:medsToAdd.map(m=>({id:m.id,name:m.name}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'N'})}).catch(()=>{});
        // #endregion
        await db.medications.bulkPut(medsToAdd);
        console.log(`✅ 批量添加 ${medsToAdd.length} 条云端药品到本地`);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:266',message:'批量添加完成',data:{count:medsToAdd.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'N'})}).catch(()=>{});
        // #endregion
      } else {
        console.log('ℹ️ 所有云端药品都已存在于本地，无需添加');
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:270',message:'无需添加新药品',data:{cloudCount:cloudMeds.length,localCount:localMeds.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'N'})}).catch(()=>{});
        // #endregion
      }
    } else {
      console.log('⚠️ 从Supabase拉取的medications为空或null');
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:274',message:'Supabase返回空数据',data:{cloudMedsIsNull:!cloudMeds,cloudMedsLength:cloudMeds?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'N'})}).catch(()=>{});
      // #endregion
    }
    
    console.log('✅ Medications同步完成');
    // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync.ts:238',message:'syncMedications完成',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'L'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    console.error('❌ Medications同步失败:', error);
  }
}

/**
 * 推送本地未同步的记录到服务器
 */
export async function pushLocalChanges(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  
  const unsynced = await getUnsyncedLogs();
  
  for (const log of unsynced) {
    try {
      // 检查是否已存在（通过 image_hash）
      if (log.image_hash) {
        try {
          const { data: existing, error: queryError } = await supabase!
          .from('medication_logs')
          .select('id')
          .eq('image_hash', log.image_hash)
            .maybeSingle();
        
          // 406 错误通常表示查询格式问题，跳过检查继续插入
          if (queryError && queryError.code !== 'PGRST116') {
            console.warn('⚠️ 查询 image_hash 失败，继续插入:', queryError);
          } else if (existing) {
          // 已存在，更新本地记录
          await markLogSynced(log.id, { ...log, id: existing.id });
            continue;
          }
        } catch (err) {
          console.warn('⚠️ 检查重复记录失败，继续插入:', err);
        }
      }
      
      // 处理 medication_id：如果不是 UUID，需要找到对应的云端 ID
      let cloudMedicationId: string | undefined = undefined;
      
      if (!log.medication_id || !isValidUUID(log.medication_id)) {
        // medication_id 不是 UUID（可能是 local_xxx 或 med_xxx）
        // 查找本地 medication，看是否有云端 ID
        const localMed = await getMedications().then(meds => 
          meds.find(m => m.id === log.medication_id)
        );
        
        if (!localMed) {
          // 找不到对应的 medication，跳过本次同步
          console.warn('⚠️ medication_id 不是 UUID 且未找到本地记录，跳过同步:', log.medication_id);
          continue;
        }
        
        if (!isValidUUID(localMed.id)) {
          // 本地 medication 还没有云端 ID（仍然是 local_xxx 或 med_xxx），跳过本次同步
          console.warn('⚠️ medication_id 不是 UUID，且本地 medication 也没有云端 ID，跳过同步:', log.medication_id);
          continue;
        }
        
        cloudMedicationId = localMed.id; // 使用云端 ID
      } else {
        // medication_id 已经是合法的 UUID
        cloudMedicationId = log.medication_id;
      }
      
      // 构建插入数据（只发送数据库存在的字段，根据 supabase-schema.sql）
      const insertData: any = {
        user_id: userId,
        medication_id: cloudMedicationId,
        taken_at: log.taken_at,
        uploaded_at: log.uploaded_at,
        time_source: log.time_source,
        status: log.status,
        image_path: log.image_path,
        image_hash: log.image_hash,
        source_device: log.source_device,
        created_at: new Date().toISOString(),
        updated_at: log.updated_at || new Date().toISOString()
      };
      
      // 防御性检查：移除非 UUID 格式的 id 和 medication_id
      const sanitized = sanitizePayload(insertData);
      
      // 最终检查：确保 medication_id 是合法的 UUID
      if (!sanitized.medication_id || !isValidUUID(sanitized.medication_id)) {
        console.warn('⚠️ medication_id 不是合法 UUID，跳过同步:', sanitized.medication_id);
        continue;
      }
      
      // 插入新记录（不传 id，让数据库自动生成 UUID）
      const { data, error } = await supabase!
        .from('medication_logs')
        .insert(sanitized)
        .select()
        .single();
      
      if (error) {
        console.error('❌ 插入 medication_log 失败:', error);
        throw error;
      }
      
      // 标记为已同步（使用云端返回的 UUID）
      if (data && data.id) {
        await markLogSynced(log.id, { ...log, id: data.id });
      }
    } catch (error) {
      console.error('同步失败:', error);
      // 保持 dirty 状态，稍后重试
    }
  }
}

/**
 * 从服务器拉取最新记录
 */
export async function pullRemoteChanges(lastSyncTime?: string): Promise<MedicationLog[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  
  let query = supabase!
    .from('medication_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (lastSyncTime) {
    query = query.gt('updated_at', lastSyncTime);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('拉取失败:', error);
    // 如果是字段不存在的错误，返回空数组（表结构可能未更新）
    if (error.message?.includes('column') || error.code === 'PGRST204') {
      console.warn('⚠️ 数据库表结构可能未更新，请执行 supabase-schema-fix.sql');
      return [];
    }
    return [];
  }
  
  // 转换数据，添加本地字段
  return (data || []).map(log => ({
    ...log,
    sync_state: 'clean' as SyncState,
    local_id: undefined // 云端数据没有 local_id
  }));
}

/**
 * 检测冲突
 */
export function detectConflict(
  local: MedicationLog,
  remote: MedicationLog
): ConflictInfo | null {
  // 同一记录被不同设备修改
  if (local.id === remote.id && local.updated_at !== remote.updated_at) {
    return {
      local,
      remote,
      reason: '同一记录在不同设备被修改'
    };
  }
  
  // EXIF 时间不同（可疑）
  if (local.image_hash === remote.image_hash && 
      local.taken_at !== remote.taken_at) {
    return {
      local,
      remote,
      reason: '相同照片但时间戳不同'
    };
  }
  
  return null;
}

/**
 * 合并远程记录到本地
 */
export async function mergeRemoteLog(log: MedicationLog): Promise<void> {
  const existing = await db.medicationLogs.get(log.id);
  
  if (!existing) {
    // 新记录，直接添加
    await db.medicationLogs.add({
      ...log,
      sync_state: 'clean'
    });
    return;
  }
  
  // 检测冲突
  const conflict = detectConflict(existing, log);
  if (conflict) {
    // 标记为冲突，等待用户决策
    await db.medicationLogs.update(existing.id, {
      ...existing,
      sync_state: 'conflict'
    });
    return;
  }
  
  // 无冲突，更新本地记录
  await markLogSynced(existing.id, log);
}

/**
 * 初始化 Realtime 监听（增强版 - 基于云端同步技术文档）
 */
export function initRealtimeSync(
  onMedicationLogSync: (log: MedicationLog) => void,
  onMedicationSync: () => void
): () => void {
  const currentDeviceId = getDeviceId();
  console.log('🔄 启动增强版 Realtime 同步... (device_id:', currentDeviceId, ')');
  
  // 创建一个channel监听所有变化
  const channel = supabase!
    .channel('medication-realtime-sync-' + currentDeviceId) // 使用唯一的channel名称
    // 监听medication_logs表的变化
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'medication_logs'
      },
      async (payload) => {
        console.log('📥 Realtime: medication_logs变化', payload.eventType, payload);
        
        if (payload.new) {
          const log = payload.new as MedicationLog;
          
          // 只处理其他设备的记录
          if (log.source_device !== currentDeviceId) {
            console.log('📱 检测到其他设备的服药记录:', {
              device: log.source_device,
              medication: log.medication_name,
              time: log.taken_at
            });
            
            // 直接同步，不需要用户确认
            onMedicationLogSync(log);
          } else {
            console.log('ℹ️ 本设备的记录，跳过');
          }
        }
      }
    )
    // 监听medications表的变化
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'medications'
      },
      async (payload) => {
        console.log('📥 Realtime: medications变化', payload.eventType, payload);
        
        if (payload.new) {
          const med = payload.new as any;
          const userId = await getCurrentUserId();
          
          // 只处理同一用户的数据
          if (med.user_id === userId) {
            console.log('💊 检测到药品列表更新');
            
            // 直接同步，不需要用户确认
        onMedicationSync();
          }
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ 药品数据 Realtime 订阅成功');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('❌ 药品数据 Realtime 订阅失败:', status);
      } else {
      console.log('🔄 Realtime订阅状态:', status);
      }
    });
  
  // 返回清理函数
  return () => {
    console.log('🔌 断开Realtime连接');
    supabase!.removeChannel(channel);
  };
}

