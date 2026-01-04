import { db } from '../db/localDB';
import { supabase, getCurrentUserId } from '../lib/supabase';
import type { Medication } from '../../shared/types';

/**
 * 获取所有药品
 */
export async function getMedications(): Promise<Medication[]> {
  // 本地测试模式：使用模拟用户 ID
  const isLocalTest = import.meta.env.VITE_LOCAL_TEST_MODE === 'true' || import.meta.env.VITE_SKIP_LOGIN === 'true';
  const userId = isLocalTest ? 'local-test-user-12345' : await getCurrentUserId();
  if (!userId) return [];

  // 先从本地数据库读取
  const localMeds = await db.medications
    .where('user_id')
    .equals(userId)
    .toArray();

  // 尝试从云端同步
  try {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true });

    if (!error && data) {
      // 更新本地数据库
      await db.medications.bulkPut(data);
      return data;
    }
  } catch (error) {
    console.error('同步药品失败:', error);
  }

  return localMeds;
}

/**
 * 添加或更新药品
 */
export async function upsertMedication(medication: Medication): Promise<void> {
  // 本地测试模式：使用模拟用户 ID
  const isLocalTest = import.meta.env.VITE_LOCAL_TEST_MODE === 'true' || import.meta.env.VITE_SKIP_LOGIN === 'true';
  const userId = isLocalTest ? 'local-test-user-12345' : await getCurrentUserId();
  if (!userId) throw new Error('未登录');

  const med: Medication = {
    ...medication,
    user_id: userId,
    updated_at: new Date().toISOString()
  };

  // 保存到本地
  await db.medications.put(med);

  // 同步到云端
  try {
    const { error } = await supabase
      .from('medications')
      .upsert(med, { onConflict: 'id' });

    if (error) throw error;
  } catch (error) {
    console.error('同步药品失败:', error);
    // 标记为未同步
    med.sync_state = 'dirty' as any;
    await db.medications.put(med);
  }
}

/**
 * 删除药品
 */
export async function deleteMedication(medicationId: string): Promise<void> {
  // 从本地删除
  await db.medications.delete(medicationId);

  // 从云端删除
  try {
    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', medicationId);

    if (error) throw error;
  } catch (error) {
    console.error('删除药品失败:', error);
  }
}

/**
 * 获取今日药品
 */
export async function getTodayMedications(): Promise<Medication[]> {
  const allMeds = await getMedications();
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // 过滤出今日需要服用的药品
  return allMeds.filter(med => {
    const scheduledTime = med.scheduled_time;
    return scheduledTime >= currentTime || scheduledTime < '06:00';
  });
}

