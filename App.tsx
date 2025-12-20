import React, { useState, useEffect } from 'react';
import { Camera, Check, Clock, AlertCircle, Plus, User, X, Save, Bell, RefreshCw, Info, Edit2, Pill, Trash2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { CameraModal } from './src/components/CameraModal';
import { SyncPrompt } from './src/components/SyncPrompt';
import { LoginPage } from './src/components/LoginPage';
import { UpdateNotification } from './src/components/UpdateNotification';
import { AvatarUpload } from './src/components/AvatarUpload';
import { getTodayMedications, isMedicationTakenToday } from './src/services/medication';
import { getMedicationLogs, upsertMedication, deleteMedication, getMedications } from './src/db/localDB';
import { initRealtimeSync, mergeRemoteLog, pullRemoteChanges, pushLocalChanges, syncMedications } from './src/services/sync';
import { initSettingsRealtimeSync, getUserSettings, saveUserSettings } from './src/services/userSettings';
import { saveSnapshotLegacy, loadSnapshotLegacy, initAutoSyncLegacy, markLocalDataDirty, cloudSaveV2, cloudLoadV2, applySnapshot, isApplyingSnapshot, runWithUserAction, isUserTriggered } from './src/services/snapshot';
// 注意：旧函数名（saveSnapshot, loadSnapshot, initAutoSync）已改为 Legacy 版本
// 新版本占位函数：cloudSaveV2, cloudLoadV2（待实现）
import { checkStorageBucket } from './src/services/storage';
import type { Medication, MedicationLog } from './src/types';

// --- Types ---
interface MedicationUI extends Medication {
  status: 'pending' | 'completed' | 'overdue';
  lastTakenAt?: string;
  uploadedAt?: string;
  lastLog?: MedicationLog;
}

// --- Sub-Components ---

const Watermark: React.FC<{ text: string }> = ({ text }) => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0">
    <div className="absolute top-20 -left-20 text-[20rem] font-black text-black opacity-[0.03] uppercase italic tracking-tighter">
      {text}
    </div>
  </div>
);

const SectionTitle: React.FC<{ title: string; subtitle?: string; outline?: boolean }> = ({ title, subtitle, outline }) => (
  <div className="mb-12 relative z-10">
    <h2 className={`text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none ${outline ? 'text-outline' : 'text-black'}`}>
      {title}
    </h2>
    {subtitle && <p className="text-gray-500 font-medium tracking-widest uppercase mt-4 text-sm">{subtitle}</p>}
  </div>
);

const ProgressRing: React.FC<{ percentage: number }> = ({ percentage }) => {
  return (
    <div className="relative flex items-center justify-center w-36 h-36 md:w-40 md:h-40 group">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="50%" cy="50%" r="45%"
          className="stroke-[#BFEFFF] fill-none"
          strokeWidth="10"
        />
        <circle
          cx="50%" cy="50%" r="45%"
          className="stroke-black fill-none transition-all duration-1000 ease-out"
          strokeWidth="10"
          strokeDasharray={`${percentage * 2.83}, 283`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl md:text-3xl font-black italic tracking-tighter">{percentage}%</span>
        <span className="text-[10px] md:text-xs font-bold text-gray-400 tracking-widest">完成</span>
      </div>
    </div>
  );
};

const MedCard: React.FC<{ 
  med: MedicationUI; 
  onCameraClick: () => void;
}> = ({ med, onCameraClick }) => {
  const getAccentStyle = () => {
    if (typeof med.accent === 'string' && med.accent.startsWith('#')) {
      return { backgroundColor: med.accent };
    }
    switch(med.accent) {
      case 'berry': return { backgroundColor: '#FFE0F0' };
      case 'lime': return { backgroundColor: '#E8F5E9' };
      case 'mint': return { backgroundColor: '#BFEFFF' };
      default: return { backgroundColor: '#FFFFFF' };
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className={`group relative p-8 rounded-[40px] flex items-center justify-between transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${med.status === 'completed' ? 'bg-white' : ''}`}
      style={med.status === 'completed' ? {} : getAccentStyle()}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-black bg-black text-white px-3 py-1 rounded-full italic">{med.scheduled_time}</span>
          {med.status === 'completed' && <Check className="w-5 h-5 text-green-600" strokeWidth={3} />}
        </div>
        <h3 className="text-2xl font-black tracking-tighter uppercase italic text-[#DF4949]">
          {med.name} <span className="text-gray-600 font-bold text-base normal-case">{med.dosage}</span>
        </h3>
      </div>

      <div className="flex items-center">
        {med.status === 'pending' ? (
          <button 
            onClick={onCameraClick}
            className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center hover:scale-110 transition-transform active:scale-95 shadow-xl"
          >
            <Camera className="w-8 h-8" />
          </button>
        ) : (
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 tracking-widest">已验证</p>
            <p className="text-sm font-black italic">{formatTime(med.lastTakenAt)}</p>
            {med.lastLog?.status === 'suspect' && (
              <AlertCircle className="w-4 h-4 text-red-600 mt-1 mx-auto" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const TimelineItem: React.FC<{ 
  log: MedicationLog; 
  medication: Medication;
  onMedicationClick?: (medicationId: string) => void;
}> = ({ log, medication, onMedicationClick }) => {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const isDelayed = log.status === 'late' || log.status === 'suspect';
  const getStatusColor = () => {
    switch(log.status) {
      case 'ontime': return 'bg-green-100 text-green-600';
      case 'late': return 'bg-yellow-100 text-yellow-600';
      case 'suspect': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const getStatusText = () => {
    // 根据时间来源判断是拍摄还是读取
    if (log.time_source === 'exif') {
      return '拍摄'; // EXIF 时间 = 直接拍摄
    } else {
      return '读取'; // 系统时间 = 读取照片
    }
  };

  const getTimeSourceText = () => {
    switch(log.time_source) {
      case 'exif': return '相机时间';
      case 'system': return '系统时间';
      default: return '手动';
    }
  };

  return (
    <div className="relative pl-12 pb-16 border-l-2 border-black/10 last:pb-0">
      <div className="absolute left-[-11px] top-0 w-5 h-5 rounded-full bg-black border-4 border-white" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => onMedicationClick?.(medication.id)}
              className="text-sm font-black italic uppercase hover:text-blue-600 transition-colors cursor-pointer"
            >
              {medication.name}
            </button>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md tracking-widest ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            <span className="text-[10px] font-bold text-gray-400 tracking-widest">
              {formatDate(log.taken_at)}
            </span>
          </div>
          
          <div className="mt-4">
            <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-1">拍摄时间 ({getTimeSourceText()})</p>
              <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-black" />
                <span className="font-black italic">{formatTime(log.taken_at)}</span>
                </div>
                {log.image_path ? (
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-200 rounded-xl overflow-hidden group relative cursor-pointer ml-auto flex-shrink-0">
                    <img 
                      src={log.image_path} 
                      alt="验证凭证" 
                      className="w-full h-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                      onError={(e) => {
                        console.error('❌ 图片加载失败:', log.image_path);
                        // 图片加载失败时显示占位符
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent && !parent.querySelector('.image-error')) {
                          const placeholder = document.createElement('div');
                          placeholder.className = 'image-error w-full h-full flex items-center justify-center bg-gray-300';
                          placeholder.innerHTML = '<span class="text-xs text-gray-500">图片</span>';
                          parent.appendChild(placeholder);
                        }
                      }}
                    />
                    <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 w-64 h-64 md:w-80 md:h-80">
                      <img 
                        src={log.image_path} 
                        alt="预览" 
                        className="w-full h-full object-cover rounded-2xl shadow-2xl border-4 border-white"
                        onError={(e) => {
                          console.error('❌ 预览图片加载失败:', log.image_path);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-200 rounded-xl flex items-center justify-center ml-auto flex-shrink-0">
                    <span className="text-xs text-gray-400 font-bold">无图</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  // 登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'medications' | 'profile'>('dashboard');
  const [medications, setMedications] = useState<MedicationUI[]>([]);
  const [timelineLogs, setTimelineLogs] = useState<MedicationLog[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [syncPrompt, setSyncPrompt] = useState<MedicationLog | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 日期筛选
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // YYYY-MM-DD
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedMedicationId, setSelectedMedicationId] = useState<string | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // 个人中心状态
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showMedicationManage, setShowMedicationManage] = useState(false);
  
  // 用户信息
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '用户');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(localStorage.getItem('reminderEnabled') === 'true');
  const [syncEnabled, setSyncEnabled] = useState(localStorage.getItem('syncEnabled') === 'true');
  
  // 药品管理
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedTime, setNewMedTime] = useState('');
  const [newMedAccent, setNewMedAccent] = useState<string>('#E8F5E9'); // 默认浅绿色
  
  // 编辑药品
  const [showMedicationEdit, setShowMedicationEdit] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [editMedName, setEditMedName] = useState('');
  const [editMedDosage, setEditMedDosage] = useState('');
  const [editMedTime, setEditMedTime] = useState('');
  const [editMedAccent, setEditMedAccent] = useState<string>('#E8F5E9'); // 默认浅绿色

  // 创建默认药品（一次性）
  const createDefaultMedications = (): Medication[] => {
    return [
      { 
        id: `med_${Date.now()}_1`, 
        name: '降压药', 
        dosage: '1片', 
        scheduled_time: '08:00', 
        accent: '#E8F5E9' 
      },
      { 
        id: `med_${Date.now()}_2`, 
        name: '降糖药', 
        dosage: '1片', 
        scheduled_time: '12:00', 
        accent: '#E0F2F1' 
      },
      { 
        id: `med_${Date.now()}_3`, 
        name: '钙片', 
        dosage: '2片', 
        scheduled_time: '20:00', 
        accent: '#FCE4EC' 
      },
    ];
  };

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true);
      
      // 【4】修复默认药品初始化（幂等）
      // 从云端检查初始化状态
      const loadResult = await cloudLoadV2();
      if (loadResult.success && loadResult.payload) {
        const payload = loadResult.payload as any;
        
        // 如果未初始化，执行一次性初始化
        if (!payload.__initialized) {
          console.log('🆕 执行一次性默认药品初始化');
          
          const defaultMeds = createDefaultMedications();
          
          // 构建新的 payload
          const newPayload = {
            ver: 1,
            medications: defaultMeds,
            medication_logs: payload.medication_logs ?? [],
            user_settings: payload.user_settings ?? {},
            snapshot_label: `初始化 ${new Date().toLocaleString('zh-CN')}`,
            __initialized: true
          };
          
          // 保存到云端
          const saveResult = await cloudSaveV2(newPayload);
          if (saveResult.success) {
            console.log('✅ 默认药品已保存到云端');
          } else {
            console.error('❌ 保存默认药品到云端失败:', saveResult.message);
          }
          
          // 应用到本地数据库
          await applySnapshot(newPayload);
        } else {
          // 已初始化，应用云端快照（整体替换）
          await applySnapshot(payload);
        }
      } else {
        // 如果 cloudLoadV2 失败，使用本地数据
        console.warn('⚠️ cloudLoadV2 失败，使用本地数据');
      }
      
      // 加载药物列表
      const meds = await getTodayMedications();
      
      // 转换药物列表并检查状态
      const medsWithStatus: MedicationUI[] = await Promise.all(
        meds.map(async (med) => {
          const taken = await isMedicationTakenToday(med.id);
          const logs = await getMedicationLogs(med.id);
          const todayLogs = logs.filter(log => {
            const logDate = new Date(log.taken_at);
            const today = new Date();
            return logDate.toDateString() === today.toDateString();
          });
          const lastLog = todayLogs[0];
          
          return {
            ...med,
            status: taken ? 'completed' : 'pending',
            lastTakenAt: lastLog?.taken_at,
            uploadedAt: lastLog?.uploaded_at,
            lastLog
          };
        })
      );
      
      setMedications(medsWithStatus);
      
      // 加载时间线数据（最近7天）
      const allLogs = await getMedicationLogs();
      console.log('📊 加载所有记录:', allLogs.length);
      
      // 调试：打印每条记录的 image_path
      allLogs.forEach((log, idx) => {
        console.log(`记录 ${idx + 1}:`, {
          id: log.id,
          medication_id: log.medication_id,
          taken_at: log.taken_at,
          has_image_path: !!log.image_path,
          image_path_type: log.image_path ? (log.image_path.startsWith('data:') ? 'DataURL' : 'URL') : 'null',
          image_path_length: log.image_path?.length || 0
        });
      });
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentLogs = allLogs
        .filter(log => new Date(log.taken_at) >= sevenDaysAgo)
        .sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime());
      
      console.log('📅 最近7天的记录:', recentLogs.length);
      setTimelineLogs(recentLogs);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 检查登录状态
  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
    setCheckingAuth(false);
  }, []);

  // 初始化同步监听
  useEffect(() => {
    if (!isLoggedIn) return;
    
    loadData();
    
    // 检查 Storage bucket
    checkStorageBucket().then(exists => {
      if (!exists) {
        console.warn('⚠️ Storage bucket 不存在，图片将保存在本地');
        // 显示提示（可选，避免打扰用户）
        // const notification = document.createElement('div');
        // notification.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-orange-500 text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg';
        // notification.textContent = '💡 提示：请在 Supabase 中创建 medication-images bucket';
        // document.body.appendChild(notification);
        // setTimeout(() => notification.remove(), 5000);
      }
    }).catch(console.error);
    
    // 加载用户设置
    getUserSettings().then(settings => {
      console.log('📋 用户设置已加载:', settings);
      // 应用用户设置到应用状态
      if (settings.avatar_url) {
        setAvatarUrl(settings.avatar_url);
        console.log('👤 用户头像已加载');
      }
    }).catch(console.error);
    
    // 初始化 Realtime 同步
    const cleanup = initRealtimeSync(
      // 处理服药记录更新
      (log) => {
        console.log('🔔 收到其他设备的服药记录更新');
        // 自动合并远程记录
        mergeRemoteLog(log).then(() => {
          console.log('✅ 服药记录已自动同步');
          loadData();
        }).catch(console.error);
      },
      // 处理药品列表更新（自动同步，无需确认）
      async () => {
        // 【1】删除所有"药品列表变化监听"中的自动行为
        // 状态变化 ≠ 用户操作，禁止自动触发刷新
        console.log('🔔 收到药品列表更新（Realtime），但不自动刷新（等待用户操作）');
      }
    );
    
    // 初始化快照自动同步（Legacy）
    let cleanupSnapshot: (() => void) | null = null;
    initAutoSyncLegacy(() => {
      // 【1】删除所有"快照更新监听"中的自动行为
      // 状态变化 ≠ 用户操作，禁止自动触发刷新
      console.log('🔔 收到快照更新（Realtime），但不自动刷新（等待用户操作）');
    }).then(cleanup => {
      cleanupSnapshot = cleanup;
    }).catch(console.error);
    
    // 初始化用户设置实时同步（参考技术白皮书的多设备同步机制）
    const cleanupSettings = initSettingsRealtimeSync((settings) => {
      console.log('⚙️ 用户设置已更新:', settings);
      
      // 自动应用头像更新（无需用户确认）
      if (settings.avatar_url !== avatarUrl) {
        console.log('👤 检测到头像更新，自动同步...');
        setAvatarUrl(settings.avatar_url || null);
        
        // 显示友好提示
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 z-50 bg-black text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg animate-fade-in';
        notification.textContent = '✅ 头像已从其他设备同步';
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('animate-fade-out');
          setTimeout(() => notification.remove(), 300);
        }, 3000);
      }
      
      // 对于其他设置变更，询问用户是否应用
      if (Object.keys(settings).some(key => key !== 'avatar_url' && settings[key] !== undefined)) {
        const shouldApply = confirm('其他设备更新了设置，是否立即应用？');
        if (shouldApply) {
          window.location.reload();
        }
      }
    });
    
    // 定期同步（缩短到3秒，更快速的多设备同步）
    const syncInterval = setInterval(async () => {
      console.log('⏰ 定时同步...');
      
      let hasChanges = false;
      
      // 1. 同步medications（双向同步）
      await syncMedications().catch(console.error);
      
      // 2. 同步medication_logs
      await pushLocalChanges().catch(console.error);
      const logs = await pullRemoteChanges().catch(() => []);
      if (logs && logs.length > 0) {
        console.log(`📥 拉取到 ${logs.length} 条新记录`);
        for (const log of logs) {
          await mergeRemoteLog(log).catch(console.error);
        }
      }
      
      // 3. 同步用户设置（包括头像）
      const settings = await getUserSettings().catch(() => ({} as any));
      if (settings && (settings as any).avatar_url && (settings as any).avatar_url !== avatarUrl) {
        console.log('👤 检测到头像更新（定时同步）');
        setAvatarUrl((settings as any).avatar_url);
      }
      
      // 【1】删除所有"定时同步监听"中的自动刷新行为
      // 状态变化 ≠ 用户操作，禁止自动触发刷新
      // 定时同步只负责数据同步，不触发界面刷新
    }, 3000); // 每3秒同步一次
    
    return () => {
      cleanup();
      cleanupSettings();
      if (cleanupSnapshot) cleanupSnapshot();
      clearInterval(syncInterval);
    };
  }, [isLoggedIn]);

  // 处理拍照成功
  const handleRecordSuccess = async () => {
    // 【3】所有用户操作必须包裹 runWithUserAction
    runWithUserAction(async () => {
      console.log('📸 拍照成功，刷新数据...');
      markLocalDataDirty(); // 标记为已修改
      
      // 延迟一下确保数据已保存
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await loadData();
      
      // 验证数据是否加载
      const allLogs = await getMedicationLogs();
      console.log('📊 当前所有记录数:', allLogs.length);
      allLogs.forEach((log, idx) => {
        console.log(`记录 ${idx + 1}:`, {
          id: log.id,
          medication_id: log.medication_id,
          taken_at: log.taken_at,
          has_image: !!log.image_path,
          image_path_preview: log.image_path ? log.image_path.substring(0, 50) + '...' : 'null'
        });
      });
    });
  };

  // 处理同步提示接受
  const handleSyncAccept = async () => {
    // 【3】所有用户操作必须包裹 runWithUserAction
    runWithUserAction(async () => {
      if (syncPrompt) {
        await mergeRemoteLog(syncPrompt);
        setSyncPrompt(null);
        await loadData();
      }
    });
  };

  // 计算进度
  const completedCount = medications.filter(m => m.status === 'completed').length;
  const progress = medications.length > 0 
    ? Math.round((completedCount / medications.length) * 100) 
    : 0;

  // 检查认证状态
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-black italic tracking-tighter">加载中...</p>
        </div>
      </div>
    );
  }

  // 显示登录页面
  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-black italic tracking-tighter">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <Watermark text="健康" />

      {/* Nav */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[rgba(52,130,213,1)] text-white px-8 py-4 rounded-full flex items-center gap-8 shadow-2xl backdrop-blur-lg bg-opacity-90">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'dashboard' ? 'scale-110' : ''}`}
        >
          <Camera className="w-6 h-6 text-white" />
          <span className="text-[8px] font-black text-white">首页</span>
        </button>
        <button 
          onClick={() => setActiveTab('timeline')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'timeline' ? 'scale-110' : ''}`}
        >
          <Clock className="w-6 h-6 text-white" />
          <span className="text-[8px] font-black text-white">记录</span>
        </button>
        <button
          onClick={() => setActiveTab('medications')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'medications' ? 'scale-110' : ''}`}
        >
          <Pill className="w-6 h-6 text-white" />
          <span className="text-[8px] font-black text-white">药品</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'scale-110' : ''}`}
        >
          <User className="w-6 h-6 text-white" />
          <span className="text-[8px] font-black text-white">我的</span>
        </button>
      </nav>

      {/* Header */}
      <header className="px-6 md:px-24 pt-4 pb-8 md:pt-8 md:pb-16 flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10">
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h1 className="text-2xl font-black italic tracking-tighter">
              药盒助手 <span className="text-gray-500 text-xs font-medium tracking-widest">{(window as any).APP_VERSION || 'V251219.1'}</span>
            </h1>
            {/* 云端快照管理按钮 */}
            {isLoggedIn && (
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    // 暂时使用 Legacy 版本，待 V2 实现后切换
                    const result = await saveSnapshotLegacy();
                    alert(result.message);
                    if (result.success) {
                      await loadData(); // 刷新数据
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-full text-xs font-bold hover:bg-blue-600 transition-all shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  云端保存
                </button>
                
                <button
                  onClick={async () => {
                    // 暂时使用 Legacy 版本，待 V2 实现后切换
                    const result = await loadSnapshotLegacy(false);
                    alert(result.message);
                    if (result.success) {
                      await loadData(); // 刷新数据
                    }
                  }}
                  className="px-3 py-1.5 bg-green-500 text-white rounded-full text-xs font-bold hover:bg-green-600 transition-all shadow-md flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  云端读取
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 md:px-24 relative z-10">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 gap-8 max-w-4xl">
            <div className="mb-8">
              <h4 className="text-sm font-black italic tracking-tighter mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-lime"></span>
                待服用药物
              </h4>
              <div className="space-y-6">
                {medications.map(med => (
                  <MedCard 
                    key={med.id} 
                    med={med}
                    onCameraClick={() => setShowCameraModal(true)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="max-w-4xl">
            {/* 月历选择器 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
              {/* 日历标题栏 - 可点击展开/收起 */}
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="w-full flex items-center justify-between mb-3 hover:bg-gray-50 -mx-4 px-4 py-2 rounded-xl transition-all"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown 
                    className={`w-5 h-5 transition-transform ${showCalendar ? 'rotate-180' : ''}`}
                  />
                  <span className="text-base font-black italic tracking-tighter">
                    {selectedMonth.getFullYear()}年 {selectedMonth.getMonth() + 1}月
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {showCalendar ? '收起日历' : '展开日历'}
                </span>
              </button>

              {/* 日历内容 - 可折叠 */}
              {showCalendar && (
                <>
                  {/* 月份导航 */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => {
                        const newMonth = new Date(selectedMonth);
                        newMonth.setMonth(newMonth.getMonth() - 1);
                        setSelectedMonth(newMonth);
                      }}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowMonthPicker(!showMonthPicker)}
                      className="text-base font-black italic tracking-tighter hover:text-blue-600 transition-colors"
                    >
                      {selectedMonth.getFullYear()}年 {selectedMonth.getMonth() + 1}月
                    </button>
                    <button
                      onClick={() => {
                        const newMonth = new Date(selectedMonth);
                        newMonth.setMonth(newMonth.getMonth() + 1);
                        setSelectedMonth(newMonth);
                      }}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

              {/* 月份选择器 */}
              {showMonthPicker && (
                <div className="mb-3 p-3 bg-gray-50 rounded-xl">
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 12 }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const newMonth = new Date(selectedMonth);
                          newMonth.setMonth(i);
                          setSelectedMonth(newMonth);
                          setShowMonthPicker(false);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                          selectedMonth.getMonth() === i
                            ? 'bg-blue-600 text-white'
                            : 'bg-white hover:bg-gray-100'
                        }`}
                      >
                        {i + 1}月
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 星期标题 */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                  <div key={day} className="text-center text-[10px] font-bold text-gray-400 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* 日期网格 */}
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const year = selectedMonth.getFullYear();
                  const month = selectedMonth.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const days = [];

                  // 填充空白
                  for (let i = 0; i < firstDay; i++) {
                    days.push(<div key={`empty-${i}`} className="aspect-square" />);
                  }

                  // 填充日期
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const logsOnDate = timelineLogs.filter(log => {
                      const logDate = new Date(log.taken_at).toISOString().split('T')[0];
                      return logDate === dateStr;
                    });
                    const isSelected = selectedDate === dateStr;
                    const isToday = dateStr === new Date().toISOString().split('T')[0];

                    days.push(
                      <button
                        key={day}
                        onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all text-xs ${
                          isSelected 
                            ? 'bg-blue-600 text-white scale-105 shadow-md' 
                            : isToday
                            ? 'bg-blue-50 text-blue-600 font-bold'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <span className="font-bold">{day}</span>
                        {logsOnDate.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {Array.from(new Set(logsOnDate.map(log => {
                              const med = medications.find(m => m.id === log.medication_id);
                              return med?.accent;
                            }))).map((accent, idx) => (
                              <div
                                key={idx}
                                className={`w-2 h-2 rounded-full shadow-md ring-1 ring-white ${
                                  accent === 'lime' ? 'bg-lime' :
                                  accent === 'mint' ? 'bg-mint' :
                                  accent === 'berry' ? 'bg-berry' :
                                  'bg-gray-400'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  }

                  return days;
                })()}
              </div>

              {/* 药品筛选 */}
              {selectedDate && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-[10px] font-bold text-gray-500 mb-2">筛选药品</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedMedicationId(null)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                        !selectedMedicationId
                          ? 'bg-black text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      全部
                    </button>
                    {medications.map(med => (
                      <button
                        key={med.id}
                        onClick={() => setSelectedMedicationId(
                          selectedMedicationId === med.id ? null : med.id
                        )}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          selectedMedicationId === med.id
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {med.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}
            </div>

             <div className="space-y-4">
                {(() => {
                  let filteredLogs = timelineLogs;

                  // 按日期筛选
                  if (selectedDate) {
                    filteredLogs = filteredLogs.filter(log => {
                      const logDate = new Date(log.taken_at).toISOString().split('T')[0];
                      return logDate === selectedDate;
                    });
                  } else {
                    // 默认显示当月记录
                    filteredLogs = filteredLogs.filter(log => {
                      const logDate = new Date(log.taken_at);
                      return logDate.getMonth() === selectedMonth.getMonth() &&
                             logDate.getFullYear() === selectedMonth.getFullYear();
                    });
                  }

                  // 按药品筛选
                  if (selectedMedicationId) {
                    filteredLogs = filteredLogs.filter(log => log.medication_id === selectedMedicationId);
                  }

                  return filteredLogs.length > 0 ? (
                    filteredLogs.map(log => {
                      const medication = medications.find(m => m.id === log.medication_id);
                      if (!medication) return null;
                      return (
                        <TimelineItem 
                          key={log.id} 
                          log={log} 
                          medication={medication}
                          onMedicationClick={(medId) => {
                            setSelectedMedicationId(medId);
                            setSelectedDate(null); // 清除日期筛选以显示全部历史
                          }}
                        />
                      );
                    })
                  ) : (
                    <div className="py-24 text-center">
                      <p className="text-6xl font-black italic text-gray-200 tracking-tighter">暂无记录</p>
                      <p className="text-gray-400 font-bold tracking-widest mt-4">
                        {selectedDate ? '当天' : '本月'}暂无服药记录
                      </p>
                    </div>
                  );
                })()}
             </div>
          </div>
        )}

        {activeTab === 'medications' && (
          <div className="max-w-4xl">
            {/* 添加新药品 */}
            <div className="mb-6 p-6 bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl border-2 border-pink-100">
              <h4 className="text-lg font-black italic tracking-tighter mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                添加新药品
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">药品名称</label>
                  <input
                    type="text"
                    value={newMedName}
                    onChange={(e) => setNewMedName(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
                    placeholder="例如：降压药"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">剂量</label>
                  <input
                    type="text"
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
                    placeholder="例如：1片"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">服用时间</label>
                  <input
                    type="time"
                    value={newMedTime}
                    onChange={(e) => setNewMedTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">卡片颜色</label>
                  <div className="flex items-center gap-4">
                    {/* 颜色预览 */}
                    <div 
                      className="w-24 h-24 rounded-2xl border-4 border-gray-300 shadow-lg transition-all hover:scale-105 cursor-pointer flex-shrink-0"
                      style={{ backgroundColor: newMedAccent }}
                      onClick={() => document.getElementById('colorPicker')?.click()}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-700 bg-white/80 px-2 py-1 rounded-lg">
                          点击选择
                        </span>
                      </div>
                    </div>
                    
                    {/* 颜色选择器（隐藏原生控件）*/}
                    <div className="flex-1">
                      <input
                        id="colorPicker"
                        type="color"
                        value={newMedAccent}
                        onChange={(e) => setNewMedAccent(e.target.value)}
                        className="opacity-0 w-0 h-0 absolute"
                      />
                      
                      {/* 显示颜色值 */}
                      <div className="space-y-2">
                        <div className="text-lg font-black italic tracking-tighter">
                          {newMedAccent.toUpperCase()}
                        </div>
                        <div className="text-xs text-gray-500 font-bold">
                          点击左侧色块选择颜色
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    // 【3】所有用户操作必须包裹 runWithUserAction
                    runWithUserAction(async () => {
                      if (!newMedName || !newMedDosage || !newMedTime) {
                        alert('请填写完整信息');
                        return;
                      }

                      const newMed: Medication = {
                        id: `med_${Date.now()}`,
                        name: newMedName,
                        dosage: newMedDosage,
                        scheduled_time: newMedTime,
                        accent: newMedAccent
                      };

                      await upsertMedication(newMed);
                      markLocalDataDirty(); // 标记为已修改
                      await loadData();
                      
                      setNewMedName('');
                      setNewMedDosage('');
                      setNewMedTime('');
                      setNewMedAccent('#E8F5E9');
                    });
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black italic rounded-full tracking-tighter hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  添加药品
                </button>
              </div>
            </div>

            {/* 现有药品列表 */}
            <div>
              <h4 className="text-lg font-black italic tracking-tighter mb-4">当前药品列表</h4>
              
              {medications.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Pill className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="font-bold">暂无药品</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {medications.map((med) => (
                    <div
                      key={med.id}
                      className="p-5 rounded-2xl border-2 flex items-center justify-between"
                      style={{ 
                        backgroundColor: typeof med.accent === 'string' && med.accent.startsWith('#') ? `${med.accent}33` : 
                          med.accent === 'lime' ? 'rgba(232, 245, 233, 0.2)' :
                          med.accent === 'mint' ? 'rgba(191, 239, 255, 0.2)' :
                          'rgba(255, 224, 240, 0.2)',
                        borderColor: typeof med.accent === 'string' && med.accent.startsWith('#') ? med.accent :
                          med.accent === 'lime' ? '#E8F5E9' :
                          med.accent === 'mint' ? '#BFEFFF' :
                          '#FFE0F0'
                      }}
                    >
                      <div className="flex-1">
                        <h5 className="font-black italic tracking-tighter text-lg">{med.name}</h5>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm font-bold text-gray-600">{med.dosage}</span>
                          <span className="text-xs font-black bg-black text-white px-3 py-1 rounded-full italic">
                            {med.scheduled_time}
                          </span>
                        </div>
                      </div>
                      
                      {/* 编辑和删除按钮 */}
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => {
                            setEditingMedication(med);
                            setEditMedName(med.name);
                            setEditMedDosage(med.dosage);
                            setEditMedTime(med.scheduled_time);
                            setEditMedAccent(typeof med.accent === 'string' && med.accent.startsWith('#') ? med.accent : 
                              med.accent === 'lime' ? '#E8F5E9' :
                              med.accent === 'mint' ? '#BFEFFF' :
                              '#FFE0F0');
                            setShowMedicationEdit(true);
                          }}
                          className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-all"
                          title="编辑药品"
                        >
                          <Edit2 className="w-5 h-5 text-blue-600" />
                        </button>
                        
                        <button
                          onClick={async () => {
                            // 【3】所有用户操作必须包裹 runWithUserAction
                            runWithUserAction(async () => {
                              if (confirm(`确定要删除"${med.name}"吗？\n相关的服药记录也会被删除。`)) {
                                await deleteMedication(med.id);
                                markLocalDataDirty(); // 标记为已修改
                                await loadData();
                              }
                            });
                          }}
                          className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200 transition-all"
                          title="删除药品"
                        >
                          <Trash2 className="w-5 h-5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-4xl">
            {/* 用户信息卡片 */}
            <div className="bg-white rounded-[40px] p-4 shadow-sm border border-gray-100 mb-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt="用户头像" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-white" strokeWidth={2.5} />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-black italic tracking-tighter mb-1">{userName}</h2>
                  <p className="text-sm text-gray-500 font-bold tracking-widest">药盒助手用户</p>
                </div>
                <button 
                  onClick={() => setShowProfileEdit(true)}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-lime rounded-3xl p-6 text-center">
                <p className="text-3xl font-black italic tracking-tighter mb-1">{medications.length}</p>
                <p className="text-xs font-bold text-gray-600 tracking-widest">药物总数</p>
              </div>
              <div className="bg-mint rounded-3xl p-6 text-center">
                <p className="text-3xl font-black italic tracking-tighter mb-1">{timelineLogs.length}</p>
                <p className="text-xs font-bold text-gray-600 tracking-widest">服药记录</p>
              </div>
              <div className="bg-berry rounded-3xl p-6 text-center">
                <p className="text-3xl font-black italic tracking-tighter mb-1">{progress}%</p>
                <p className="text-xs font-bold text-gray-600 tracking-widest">今日完成</p>
              </div>
            </div>

            {/* 功能列表 */}
            <div className="space-y-3">
              <div 
                onClick={() => setShowProfileEdit(true)}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-black italic tracking-tighter">个人信息</p>
                    <p className="text-xs text-gray-400 font-bold">管理你的个人资料</p>
                  </div>
                </div>
                <span className="text-gray-400">›</span>
              </div>

              <div
                onClick={() => setActiveTab('medications')}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                    <Pill className="w-5 h-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="font-black italic tracking-tighter">药品管理</p>
                    <p className="text-xs text-gray-400 font-bold">添加或删除药品</p>
                  </div>
                </div>
                <span className="text-gray-400">›</span>
              </div>

              <div 
                onClick={() => setShowReminderSettings(true)}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-black italic tracking-tighter">提醒设置</p>
                    <p className="text-xs text-gray-400 font-bold">
                      {reminderEnabled ? '提醒已开启' : '设置服药提醒时间'}
                    </p>
                  </div>
                </div>
                <span className="text-gray-400">›</span>
              </div>

              <div 
                onClick={() => setShowSyncSettings(true)}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-black italic tracking-tighter">数据同步</p>
                    <p className="text-xs text-gray-400 font-bold">
                      {syncEnabled ? '同步已开启' : '多设备数据同步管理'}
                    </p>
                  </div>
                </div>
                <span className="text-gray-400">›</span>
              </div>

              <div 
                onClick={() => setShowAbout(true)}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Info className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-black italic tracking-tighter">关于应用</p>
                    <p className="text-xs text-gray-400 font-bold">版本 {(window as any).APP_VERSION || 'V251219.1'}</p>
                  </div>
                </div>
                <span className="text-gray-400">›</span>
              </div>

              <div 
                onClick={() => {
                  if (confirm('确定要退出登录吗？')) {
                    localStorage.removeItem('isLoggedIn');
                    localStorage.removeItem('username');
                    setIsLoggedIn(false);
                  }
                }}
                className="bg-red-50 rounded-2xl p-5 shadow-sm border border-red-100 flex items-center justify-between hover:bg-red-100 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <X className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-black italic tracking-tighter text-red-600">退出登录</p>
                    <p className="text-xs text-red-400 font-bold">当前用户：{userName}</p>
                  </div>
                </div>
                <span className="text-red-400">›</span>
              </div>
            </div>
          </div>
        )}
      </main>


      {/* Camera Modal */}
      {showCameraModal && medications.length > 0 && (
        <CameraModal
          medications={medications}
          onClose={() => setShowCameraModal(false)}
          onSuccess={handleRecordSuccess}
        />
      )}

      {/* Sync Prompt */}
      {syncPrompt && (
        <SyncPrompt
          log={syncPrompt}
          onAccept={handleSyncAccept}
          onDismiss={() => setSyncPrompt(null)}
        />
      )}

      {/* 个人信息编辑 */}
      {showProfileEdit && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black italic tracking-tighter">个人信息</h3>
              <button
                onClick={() => setShowProfileEdit(false)}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* 头像上传 */}
              <div className="py-4">
                <AvatarUpload 
                  currentAvatarUrl={avatarUrl || undefined}
                  onAvatarUpdated={(url) => {
                    console.log('📸 App: 收到头像更新回调', url);
                    setAvatarUrl(url);
                    console.log('✅ App: 头像状态已更新');
                    
                    // 强制重新渲染（通过更新一个临时状态）
                    // React会自动优化，这只是确保状态传播
                  }}
                  size={120}
                />
              </div>

              {/* 用户名 */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">用户名</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:outline-none font-medium"
                  placeholder="请输入用户名"
                />
              </div>

              <button
                onClick={() => {
                  localStorage.setItem('userName', userName);
                  setShowProfileEdit(false);
                }}
                className="w-full px-6 py-4 bg-black text-white font-black italic rounded-full tracking-tighter hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提醒设置 */}
      {showReminderSettings && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black italic tracking-tighter">提醒设置</h3>
              <button
                onClick={() => setShowReminderSettings(false)}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-green-600" />
                    <span className="font-black italic tracking-tighter">启用提醒</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminderEnabled}
                      onChange={(e) => {
                        setReminderEnabled(e.target.checked);
                        localStorage.setItem('reminderEnabled', e.target.checked.toString());
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 font-bold">
                  开启后，系统会在服药时间前15分钟提醒你
                </p>
              </div>

              {reminderEnabled && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-gray-600">提醒时间</p>
                  {medications.map((med) => (
                    <div key={med.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200">
                      <span className="font-bold">{med.name}</span>
                      <span className="text-sm font-black italic px-3 py-1 bg-black text-white rounded-full">
                        {med.scheduled_time}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowReminderSettings(false)}
                className="w-full px-6 py-4 bg-black text-white font-black italic rounded-full tracking-tighter hover:bg-gray-800 transition-all"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 数据同步设置 */}
      {showSyncSettings && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black italic tracking-tighter">数据同步</h3>
              <button
                onClick={() => setShowSyncSettings(false)}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-purple-600" />
                    <span className="font-black italic tracking-tighter">自动同步</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncEnabled}
                      onChange={(e) => {
                        setSyncEnabled(e.target.checked);
                        localStorage.setItem('syncEnabled', e.target.checked.toString());
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 font-bold">
                  开启后，数据会自动在多个设备间同步
                </p>
              </div>

              {syncEnabled && (
                <div className="space-y-3">
                  <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                    <div className="flex items-center gap-3 mb-2">
                      <Check className="w-5 h-5 text-blue-600" />
                      <span className="font-black italic tracking-tighter text-blue-900">同步状态正常</span>
                    </div>
                    <p className="text-xs text-blue-700 font-bold">
                      最后同步时间: {new Date().toLocaleString('zh-CN')}
                    </p>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        await pushLocalChanges();
                        const logs = await pullRemoteChanges();
                        for (const log of logs) {
                          await mergeRemoteLog(log);
                        }
                        await loadData();
                        alert('同步成功！');
                      } catch (error) {
                        console.error('同步失败:', error);
                        alert('同步失败，请检查网络连接');
                      }
                    }}
                    className="w-full px-6 py-3 bg-purple-100 text-purple-700 font-black italic rounded-full tracking-tighter hover:bg-purple-200 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    立即同步
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowSyncSettings(false)}
                className="w-full px-6 py-4 bg-black text-white font-black italic rounded-full tracking-tighter hover:bg-gray-800 transition-all"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 关于应用 */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black italic tracking-tighter">关于应用</h3>
              <button
                onClick={() => setShowAbout(false)}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <span className="text-4xl font-black italic text-white">药</span>
                </div>
                <h2 className="text-3xl font-black italic tracking-tighter mb-2">药盒助手</h2>
                <p className="text-sm text-gray-500 font-bold">版本 {(window as any).APP_VERSION || 'V251219.1'}</p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-xs font-bold text-gray-500 mb-1">应用简介</p>
                  <p className="text-sm font-medium text-gray-700">
                    智能服药追踪系统，通过照片EXIF时间戳验证服药记录，确保100%依从性。
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-xs font-bold text-gray-500 mb-1">核心功能</p>
                  <ul className="text-sm font-medium text-gray-700 space-y-1">
                    <li>• 照片时间戳验证</li>
                    <li>• 多设备数据同步</li>
                    <li>• 服药提醒功能</li>
                    <li>• 历史记录追踪</li>
                  </ul>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-xs font-bold text-gray-500 mb-1">技术支持</p>
                  <p className="text-sm font-medium text-gray-700">
                    使用EXIF元数据提取、Supabase云端同步、LocalStorage本地存储等技术。
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAbout(false)}
                className="w-full px-6 py-4 bg-black text-white font-black italic rounded-full tracking-tighter hover:bg-gray-800 transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 编辑药品 */}
      {showMedicationEdit && editingMedication && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black italic tracking-tighter">编辑药品</h3>
              <button
                onClick={() => {
                  setShowMedicationEdit(false);
                  setEditingMedication(null);
                }}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">药品名称</label>
                <input
                  type="text"
                  value={editMedName}
                  onChange={(e) => setEditMedName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:outline-none font-medium"
                  placeholder="例如：降压药"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">剂量</label>
                <input
                  type="text"
                  value={editMedDosage}
                  onChange={(e) => setEditMedDosage(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:outline-none font-medium"
                  placeholder="例如：1片"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">服用时间</label>
                <input
                  type="time"
                  value={editMedTime}
                  onChange={(e) => setEditMedTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">卡片颜色</label>
                <div className="flex items-center gap-4">
                  {/* 颜色预览 */}
                  <div 
                    className="w-20 h-20 rounded-2xl border-4 border-gray-300 shadow-lg transition-all hover:scale-105 cursor-pointer flex-shrink-0"
                    style={{ backgroundColor: editMedAccent }}
                    onClick={() => document.getElementById('editColorPicker')?.click()}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-700 bg-white/80 px-2 py-1 rounded-lg">
                        点击
                      </span>
                    </div>
                  </div>
                  
                  {/* 颜色选择器 */}
                  <div className="flex-1">
                    <input
                      id="editColorPicker"
                      type="color"
                      value={editMedAccent}
                      onChange={(e) => setEditMedAccent(e.target.value)}
                      className="opacity-0 w-0 h-0 absolute"
                    />
                    
                    <div className="space-y-2">
                      <div className="text-base font-black italic tracking-tighter">
                        {editMedAccent.toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={async () => {
                  // 【3】所有用户操作必须包裹 runWithUserAction
                  runWithUserAction(async () => {
                    if (!editMedName || !editMedDosage || !editMedTime) {
                      alert('请填写完整信息');
                      return;
                    }

                    const updatedMed: Medication = {
                      ...editingMedication,
                      name: editMedName,
                      dosage: editMedDosage,
                      scheduled_time: editMedTime,
                      accent: editMedAccent
                    };

                    await upsertMedication(updatedMed);
                    markLocalDataDirty(); // 标记为已修改
                    await loadData();
                    setShowMedicationEdit(false);
                    setEditingMedication(null);

                    // 显示成功提示
                    const notification = document.createElement('div');
                    notification.className = 'fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg animate-fade-in';
                    notification.textContent = '✅ 药品信息已更新';
                    document.body.appendChild(notification);
                    setTimeout(() => {
                      notification.classList.add('animate-fade-out');
                      setTimeout(() => notification.remove(), 300);
                    }, 2000);
                  });
                }}
                className="w-full px-6 py-4 bg-blue-600 text-white font-black italic rounded-full tracking-tighter hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 版本更新提示 */}
      <UpdateNotification />
    </div>
  );
}
