import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Camera, Check, Clock, AlertCircle, Plus, User, X, Save, Bell, RefreshCw, Info, Edit2, Pill, Trash2, ChevronLeft, ChevronRight, ChevronDown, Database } from 'lucide-react';
import { CameraModal } from './src/components/CameraModal';
import { SyncPrompt } from './src/components/SyncPrompt';
import { LoginPage } from './src/components/LoginPage';
import { UpdateNotification } from './src/components/UpdateNotification';
import { AvatarUpload } from './src/components/AvatarUpload';
import { SyncStatusIndicator } from './src/components/SyncStatusIndicator';
import { DebugPanel } from './src/components/DebugPanel';
import { getTodayMedications, isMedicationTakenToday } from './src/services/medication';
import { getMedicationLogs, upsertMedication, deleteMedication, getMedications, getDeviceId, db } from './src/db/localDB';
import { initRealtimeSync, mergeRemoteLog, pullRemoteChanges, pushLocalChanges, syncMedications, fixLegacyDeviceIds, detectConflict, pullMedicationsFromCloud } from './src/services/sync';
import { initSettingsRealtimeSync, getUserSettings, saveUserSettings, updateUserSettings } from './src/services/userSettings';
import { saveSnapshotLegacy, loadSnapshotLegacy, initAutoSyncLegacy, markLocalDataDirty, cloudSaveV2, cloudLoadV2, applySnapshot, isApplyingSnapshot, runWithUserAction, isUserTriggered, getCurrentSnapshotPayload, isApplyingRemote, initRealtimeV2 } from './src/services/snapshot';
import { initRealtimeSync as initNewRealtimeSync, reconnect as reconnectRealtime, isApplyingRemoteChange } from './src/services/realtime';
import { forcePwaUpdateOncePerVersion } from './src/sw-register';
import { APP_VERSION } from './src/config/version';
// 【新增】纯云端服务
import { enforceVersionSync, getMedicationsFromCloud, getLogsFromCloud, getTodayLogsFromCloud, upsertMedicationToCloud, deleteMedicationFromCloud, addLogToCloud, initCloudOnlyRealtime } from './src/services/cloudOnly';
import type { Medication, MedicationLog } from './src/types';

// --- Helper Functions ---
function getCurrentUser() {
  try {
    const raw = localStorage.getItem('current_user_v1');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

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
  const getAccentColor = () => {
    // 支持hex颜色或旧的预设颜色
    if (med.accent?.startsWith('#')) {
      return med.accent;
    }
    switch(med.accent) {
      case 'berry': return '#FFD1DC';
      case 'lime': return '#E0F3A2';
      case 'mint': return '#BFEFFF';
      default: return '#FFFFFF';
    }
  };

  const accentColor = getAccentColor();

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className={`group relative p-4 rounded-[40px] flex items-center justify-between transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${med.status === 'completed' ? 'bg-white' : ''}`}
      style={{ backgroundColor: med.status !== 'completed' ? accentColor : undefined }}
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
  isLast?: boolean;
}> = ({ log, medication, onMedicationClick, isLast }) => {
  // 【修复 D】懒加载图片：点击时间才显示
  const [showImage, setShowImage] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  
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

  // 【修复 D】处理图片 URL：支持 storage 路径和 DataURL
  React.useEffect(() => {
    if (showImage && log.image_path && !imageUrl) {
      // 如果是 storage 路径（不包含 data:），生成 publicUrl
      if (!log.image_path.startsWith('data:')) {
        // 检查是否是完整的 URL
        if (log.image_path.startsWith('http://') || log.image_path.startsWith('https://')) {
          setImageUrl(log.image_path);
        } else {
          // 从路径中提取文件名，生成 publicUrl
          // 假设路径格式为 userId/medicationId/timestamp_filename
          // 需要从 supabase 获取 publicUrl
          if (supabase) {
            try {
              const { data: { publicUrl } } = supabase.storage
                .from('medication-images')
                .getPublicUrl(log.image_path);
              setImageUrl(publicUrl);
            } catch (e) {
              console.warn('⚠️ 生成 publicUrl 失败，使用原始路径:', e);
              setImageUrl(log.image_path);
            }
          } else {
            setImageUrl(log.image_path);
          }
        }
      } else {
        // DataURL 直接使用
        setImageUrl(log.image_path);
      }
    }
  }, [showImage, log.image_path, imageUrl]);

  const hasImage = !!log.image_path;

  return (
    <div className={`relative pl-12 pb-8 border-l-2 border-black/10 ${isLast ? 'border-l-transparent pb-0' : ''}`}>
      <div className="absolute left-[-11px] top-0 w-5 h-5 rounded-full bg-black border-4 border-white" />
      
      <div className="flex flex-col gap-3">
        {/* 药品名称和状态标签 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onMedicationClick?.(medication.id)}
            className="text-lg font-black italic uppercase hover:text-blue-600 transition-colors cursor-pointer"
          >
            {medication.name}
          </button>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-md tracking-widest ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        {/* 时间和图片信息 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-1">
                拍摄时间 ({getTimeSourceText()})
              </p>
              {/* 【修复 D】点击时间展开/收起图片 */}
              <button
                onClick={() => {
                  if (hasImage) {
                    setShowImage(!showImage);
                  }
                }}
                className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer"
              >
                <Clock className="w-4 h-4 text-black" />
                <span className="font-black italic text-base">{formatTime(log.taken_at)}</span>
                {hasImage && (
                  <span className="text-xs text-gray-400 ml-2">
                    {showImage ? '▼' : '▶'} {showImage ? '收起' : '查看图片'}
                  </span>
                )}
              </button>
              </div>
            
            {/* 【修复 D】默认不加载图片，仅显示小图标/标记 */}
            {hasImage && !showImage && (
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <Camera className="w-6 h-6 text-gray-400" />
              </div>
            )}
            </div>
            
          {/* 【修复 D】点击时间后才渲染图片 */}
          {showImage && imageUrl && (
            <div className="px-4 pb-4">
                <img 
                src={imageUrl} 
                  alt="验证凭证" 
                className="max-w-[120px] h-auto rounded-xl object-cover"
                onError={(e) => {
                  console.error('❌ 图片加载失败:', imageUrl);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              </div>
            )}
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

  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'profile' | 'medications'>('dashboard');
  const [medications, setMedications] = useState<MedicationUI[]>([]);
  const [timelineLogs, setTimelineLogs] = useState<MedicationLog[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string | null>(null); // 新增：选中的药物ID
  const [syncPrompt, setSyncPrompt] = useState<MedicationLog | null>(null);
  const [initialLoading, setInitialLoading] = useState(true); // 只在应用初始化时使用
  const [appInitialized, setAppInitialized] = useState(false); // 新增：应用是否已初始化
  
  // Realtime 同步状态
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  
  // 日期筛选
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // YYYY-MM-DD
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // 个人中心状态
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showMedicationManage, setShowMedicationManage] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // 用户信息
  const [userName, setUserName] = useState('');
  
  // 【时间戳权威模型】从user_settings加载用户名
  React.useEffect(() => {
    (async () => {
      try {
        const settings = await getUserSettings();
        if (settings.userName) {
          setUserName(settings.userName);
        } else {
          // 降级：从localStorage读取（兼容旧数据）
          const savedName = localStorage.getItem('userName');
          if (savedName) {
            setUserName(savedName);
            // 迁移到user_settings
            await updateUserSettings({ userName: savedName });
          }
        }
      } catch (error) {
        console.error('❌ 加载用户名失败:', error);
        // 降级：从localStorage读取
        const savedName = localStorage.getItem('userName');
        if (savedName) {
          setUserName(savedName);
        }
      }
    })();
  }, []);
  
  // 旧的初始化逻辑（已废弃，保留兼容）
  const _oldUserNameInit = () => {
    // 优先从 localStorage 获取
    const savedName = localStorage.getItem('userName');
    if (savedName) return savedName;
    
    // 尝试从登录信息获取
    const currentUser = localStorage.getItem('current_user_v1');
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        return user.username || '用户';
      } catch {
        return '用户';
      }
    }
    
    return '用户';
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(localStorage.getItem('reminderEnabled') === 'true');
  const [syncEnabled, setSyncEnabled] = useState(localStorage.getItem('syncEnabled') === 'true');
  
  // 药品管理
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedTime, setNewMedTime] = useState('');
  const [newMedAccent, setNewMedAccent] = useState<string>('#E0F3A2'); // 默认颜色
  
  // 编辑药品状态
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [editMedName, setEditMedName] = useState('');
  const [editMedDosage, setEditMedDosage] = useState('');
  const [editMedTime, setEditMedTime] = useState('');
  const [editMedAccent, setEditMedAccent] = useState<string>('#E0F3A2');

  // 【防重入锁】防止 loadData 并发执行
  const syncInProgressRef = React.useRef(false);
  const loadDataTriggerSourceRef = React.useRef<string>('');
  
  // 【初始化阶段标记】防止 Realtime 在初始化阶段误触发
  const isInitializingRef = React.useRef(true);
  
  // 【性能优化】lastLogByMedicationId Map：一次建索引，避免每次扫描全量 logs
  const lastLogByMedicationIdRef = React.useRef<Map<string, MedicationLog>>(new Map());
  
  // 【修复 C】useRef 作为单一真相缓存：永远跟随 state
  const medicationsRef = React.useRef<MedicationUI[]>([]);
  const logsRef = React.useRef<MedicationLog[]>([]);
  
  // 【修复 C】同步 ref 和 state
  React.useEffect(() => {
    medicationsRef.current = medications;
  }, [medications]);
  
  React.useEffect(() => {
    logsRef.current = timelineLogs;
  }, [timelineLogs]);

  // 【修复 D】安全的 setMedications：带硬核日志和防护
  const safeSetMedications = useCallback((newMeds: MedicationUI[], source: string) => {
    const prevCount = medicationsRef.current.length;
    const newCount = newMeds.length;
    const startTime = performance.now();
    
    // 【修复 D】硬核日志：如果从 >0 变成 0，打印警告和调用栈
    if (prevCount > 0 && newCount === 0 && source !== 'logout' && source !== 'clear-data') {
      const stack = new Error().stack;
      console.warn('⚠️ [状态丢失警告] medications 从', prevCount, '变成 0，来源:', source);
      console.warn('调用栈:', stack);
    }
    
    setMedications(newMeds);
    const duration = performance.now() - startTime;
    console.log(`📊 [setMedications] 来源: ${source}, 数量: ${prevCount} → ${newCount}, 耗时: ${duration.toFixed(2)}ms`);
  }, []);
  
  // 【修复 D】安全的 setTimelineLogs：带硬核日志和防护
  const safeSetTimelineLogs = useCallback((newLogs: MedicationLog[], source: string) => {
    const prevCount = logsRef.current.length;
    const newCount = newLogs.length;
    const startTime = performance.now();
    
    // 【修复 D】硬核日志：如果从 >0 变成 0，打印警告和调用栈
    if (prevCount > 0 && newCount === 0 && source !== 'logout' && source !== 'clear-data') {
      const stack = new Error().stack;
      console.warn('⚠️ [状态丢失警告] timelineLogs 从', prevCount, '变成 0，来源:', source);
      console.warn('调用栈:', stack);
    }
    
    setTimelineLogs(newLogs);
    const duration = performance.now() - startTime;
    console.log(`📊 [setTimelineLogs] 来源: ${source}, 数量: ${prevCount} → ${newCount}, 耗时: ${duration.toFixed(2)}ms`);
  }, []);

  // 加载数据（用 useCallback 缓存，避免每次渲染都创建新函数）
  const loadData = useCallback(async (syncFromCloud: boolean = false, triggerSource: string = 'unknown') => {
    // 【防重入锁】如果正在同步，拒绝再次进入
    if (syncInProgressRef.current) {
      console.log('⏭️ loadData 正在执行中，跳过重复调用', {
        currentTrigger: loadDataTriggerSourceRef.current,
        newTrigger: triggerSource,
        syncFromCloud
      });
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:loadData:rejected',message:'loadData rejected - already in progress',data:{currentTrigger:loadDataTriggerSourceRef.current,newTrigger:triggerSource},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return;
    }

    // 设置锁和触发来源
    syncInProgressRef.current = true;
    loadDataTriggerSourceRef.current = triggerSource;

    // 【修复 A】在 loadData 开头复制当前 state（安全模式）
    const prevMeds = medicationsRef.current;
    const prevLogs = logsRef.current;
    
    // 【修复 A】临时变量：最后一次性 setState
    let newMeds: MedicationUI[] = prevMeds;
    let newLogs: MedicationLog[] = prevLogs;
    let newLastLogMap = lastLogByMedicationIdRef.current;

    try {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:loadData:entry',message:'loadData called',data:{syncFromCloud:syncFromCloud,triggerSource:triggerSource},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B4'})}).catch(()=>{});
      // #endregion
      
      // 【Realtime 统一模型】不再设置 loading，数据由 Realtime 驱动
      
      console.log('🔄 开始加载数据...', { triggerSource, syncFromCloud, prevMedCount: prevMeds.length, prevLogCount: prevLogs.length });
      
      // 【修复 A】如果 triggerSource 不是 app-init/app-init-background 或 syncFromCloud=false，必须直接使用 prevMeds/prevLogs
      if ((triggerSource !== 'app-init' && triggerSource !== 'app-init-background') || !syncFromCloud) {
        console.log('⏭️ [非初始化/跳过云端] 使用 prevMeds/prevLogs，仅更新 derived 结果', { triggerSource, syncFromCloud });
        // 使用 prevMeds/prevLogs，仅更新 derived（status/map/sorted）结果
        newMeds = prevMeds;
        newLogs = prevLogs;
      } else {
        // 【唯一拉取点】只在应用初始化时拉取 medications
        console.log('☁️ [初始化] 从云端拉取 medications（唯一拉取点）');
        const medsStartTime = performance.now();
        const rawMeds = await getMedicationsFromCloud();
        const medsDuration = performance.now() - medsStartTime;
        console.log(`⏱️ medications 请求耗时: ${medsDuration.toFixed(2)}ms`);
        console.log(`📋 [初始化] 从云端加载 ${rawMeds.length} 个药物:`, rawMeds.map(m => m.name));
        
        // 转换为 MedicationUI（稍后添加 status）
        const meds: Medication[] = rawMeds;
        
        // 【唯一拉取点】只在应用初始化时拉取 logs（瘦身版本）
        console.log('☁️ [初始化] 从云端拉取 logs（唯一拉取点，瘦身版本）');
        const logsStartTime = performance.now();
        const allLogs = await getLogsFromCloud(undefined, 300, 60); // 最近60天，最多300条
        const logsDuration = performance.now() - logsStartTime;
        console.log(`⏱️ logs 请求耗时: ${logsDuration.toFixed(2)}ms`);
        console.log(`📝 [初始化] 从云端加载 ${allLogs.length} 条服药记录（渲染前 logs 条数: ${allLogs.length}）`);
        
        // 【性能优化】一次建索引：构建 lastLogByMedicationId Map
        const lastLogMap = new Map<string, MedicationLog>();
        for (const log of allLogs) {
          const medId = log.medication_id;
          const existing = lastLogMap.get(medId);
          if (!existing || new Date(log.taken_at) > new Date(existing.taken_at)) {
            lastLogMap.set(medId, log);
          }
        }
        newLastLogMap = lastLogMap;
        lastLogByMedicationIdRef.current = lastLogMap;
        console.log(`✅ [性能优化] 已构建 lastLogByMedicationId Map，共 ${lastLogMap.size} 个药品的最新记录`);
        
        // 按日期降序排序
        const sortedLogs = [...allLogs].sort((a, b) => 
          new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
        );
        console.log('✅ 记录已排序，最新记录:', sortedLogs[0]?.taken_at);
        newLogs = sortedLogs;
        
        // 【修复 B】Merge 策略：合并现有 state 和云端数据
        // 1. 以现有 state 为主（可能包含 Realtime 更新的数据）
        const existingMedMap = new Map(prevMeds.map(m => [m.id, m]));
        
        // 2. 合并云端数据：只添加缺失的，更新已存在的（但保留本地计算的 status/lastLog）
        const mergedMeds: MedicationUI[] = meds.map((med) => {
          const existing = existingMedMap.get(med.id);
          if (existing) {
            // 已存在：保留本地计算的 status 和 lastLog，但更新其他字段（包括 accent）
            const lastLog = lastLogMap.get(med.id);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const taken = lastLog && new Date(lastLog.taken_at) >= today;
            
            return {
              ...existing,
              ...med, // 更新云端字段（包括 accent）
              status: existing.status || (taken ? 'completed' : 'pending'), // 保留现有 status
              lastTakenAt: existing.lastTakenAt || lastLog?.taken_at,
              uploadedAt: existing.uploadedAt || lastLog?.created_at,
              lastLog: existing.lastLog || lastLog
            };
          } else {
            // 新药品：计算 status
            const lastLog = lastLogMap.get(med.id);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const taken = lastLog && new Date(lastLog.taken_at) >= today;
            
            return {
              ...med,
              status: taken ? 'completed' : 'pending',
              lastTakenAt: lastLog?.taken_at,
              uploadedAt: lastLog?.created_at,
              lastLog
            };
          }
        });
        
        // 3. 添加云端没有但本地有的药品（可能是 Realtime 新增的）
        prevMeds.forEach(med => {
          if (!meds.find(m => m.id === med.id)) {
            mergedMeds.push(med);
          }
        });
        
        newMeds = mergedMeds;
        
        // 【时间戳权威模型】Merge logs：基于时间戳合并，新数据覆盖旧数据
        const existingLogMap = new Map<string, MedicationLog>();
        prevLogs.forEach(log => {
          existingLogMap.set(log.id, log);
        });
        
        // 合并云端数据：基于时间戳决定是否更新
        const mergedLogs: MedicationLog[] = [];
        const processedIds = new Set<string>();
        
        // 1. 先处理云端数据
        sortedLogs.forEach(cloudLog => {
          const existing = existingLogMap.get(cloudLog.id);
          if (existing) {
            // 存在相同ID：比较时间戳，新的覆盖旧的
            const cloudTime = new Date(cloudLog.updated_at || cloudLog.created_at || cloudLog.taken_at).getTime();
            const localTime = new Date(existing.updated_at || existing.created_at || existing.taken_at).getTime();
            if (cloudTime >= localTime) {
              // 云端数据更新或相等，使用云端数据
              mergedLogs.push(cloudLog);
            } else {
              // 本地数据更新，保留本地数据
              mergedLogs.push(existing);
            }
          } else {
            // 新记录，直接添加
            mergedLogs.push(cloudLog);
          }
          processedIds.add(cloudLog.id);
        });
        
        // 2. 添加本地有但云端没有的 logs（可能是 Realtime 新增的）
        prevLogs.forEach(log => {
          if (!processedIds.has(log.id)) {
            mergedLogs.push(log);
          }
        });
        
        // 重新排序
        newLogs = mergedLogs.sort((a, b) => 
          new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
        );
        
        console.log('✅ [Merge] 数据合并完成', { 
          medCount: newMeds.length, 
          logCount: newLogs.length,
          addedMeds: newMeds.length - meds.length,
          addedLogs: newLogs.length - sortedLogs.length
        });
      }
      
      // 【修复 A】最后一次性 setState（安全模式）
      // 仅当成功拿到 newMeds/newLogs 时才 setState
      safeSetMedications(newMeds, triggerSource);
      safeSetTimelineLogs(newLogs, triggerSource);
      
      const medCount = newMeds.length;
      const logCount = newLogs.length;
      
      // 【性能监控 E】打印耗时和统计
      if (triggerSource === 'app-init') {
        console.timeEnd('loadData_app_init');
        console.log(`✅ loadData 完成（medCount: ${medCount}, logCount: ${logCount}）`);
      } else {
        console.log('✅ 数据加载完成', { triggerSource, medCount, logCount });
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:loadData:success',message:'loadData completed',data:{medicationsCount:medCount,logsCount:logCount,triggerSource:triggerSource},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B4'})}).catch(()=>{});
      // #endregion
    } catch (error: any) {
      console.error('❌ 加载数据失败:', error, { triggerSource });
      // 【修复 A】loadData 失败时必须保持原 state 不被清空
      // 不调用 setMedications([]) 或 setTimelineLogs([])，保持现有数据
      // newMeds 和 newLogs 仍然是 prevMeds 和 prevLogs，不会清空
      console.log('🛡️ [状态保护] loadData 失败，保持原 state 不变', { 
        prevMedCount: prevMeds.length, 
        prevLogCount: prevLogs.length 
      });
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:loadData:error',message:'loadData failed',data:{error:error.message,triggerSource:triggerSource},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B4'})}).catch(()=>{});
      // #endregion
    } finally {
      // 【释放锁】
      syncInProgressRef.current = false;
      loadDataTriggerSourceRef.current = '';
      // 【Realtime 统一模型】不再设置 loading，数据由 Realtime 驱动
    }
  }, []); // 空依赖数组，因为内部使用的都是稳定的 API 函数

  // 【首屏优化】快速加载：只加载今日记录和药品列表，立即进入主页
  const loadDataFast = useCallback(async () => {
    try {
      console.log('⚡ [首屏优化] 开始快速加载...');
      
      // 1. 快速加载药品列表（必须）
      const rawMeds = await getMedicationsFromCloud();
      const meds: Medication[] = rawMeds;
      
      // 转换为 MedicationUI
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const medsUI: MedicationUI[] = meds.map(med => ({
        ...med,
        status: 'pending',
        lastTakenAt: undefined,
        uploadedAt: undefined,
        lastLog: undefined
      }));
      
      safeSetMedications(medsUI, 'fast-load');
      
      // 2. 快速加载今日记录（必须）
      const todayLogs = await getTodayLogsFromCloud();
      const sortedTodayLogs = [...todayLogs].sort((a, b) => 
        new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
      );
      
      // 更新 lastLogByMedicationId Map（仅今日记录）
      const todayLastLogMap = new Map<string, MedicationLog>();
      for (const log of todayLogs) {
        const medId = log.medication_id;
        const existing = todayLastLogMap.get(medId);
        if (!existing || new Date(log.taken_at) > new Date(existing.taken_at)) {
          todayLastLogMap.set(medId, log);
        }
      }
      lastLogByMedicationIdRef.current = todayLastLogMap;
      
      // 更新药品状态（基于今日记录）
      const updatedMeds = medsUI.map(med => {
        const lastLog = todayLastLogMap.get(med.id);
        const taken = lastLog && new Date(lastLog.taken_at) >= today;
        return {
          ...med,
          status: taken ? 'completed' : 'pending',
          lastTakenAt: lastLog?.taken_at,
          lastLog
        };
      });
      safeSetMedications(updatedMeds, 'fast-load-updated');
      
      safeSetTimelineLogs(sortedTodayLogs, 'fast-load');
      
      console.log(`⚡ [首屏优化] 快速加载完成（${medsUI.length} 个药品，${todayLogs.length} 条今日记录）`);
    } catch (error) {
      console.error('❌ 快速加载失败:', error);
      // 失败时至少设置空数组，避免白屏
      safeSetMedications([], 'fast-load-error');
      safeSetTimelineLogs([], 'fast-load-error');
    }
  }, []);

  // 检查登录状态
  useEffect(() => {
    // 检查是否已登录
    const storedLogin = localStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(storedLogin);
    setCheckingAuth(false);
  }, []);

  // 初始化同步监听
  useEffect(() => {
    if (!isLoggedIn) return;
    
    // 【修复清缓存策略】禁止在启动流程自动触发清缓存，只在用户主动操作时触发
    // 移除自动调用 forcePwaUpdateOncePerVersion，避免每次启动都清缓存导致启动慢
    // forcePwaUpdateOncePerVersion('login').catch((e) => {
    //   console.warn('⚠️ PWA 强制更新失败（忽略继续运行）:', e);
    // }); // ❌ 已移除：禁止在启动流程自动清缓存
    
    // 【首屏优化】立即进入主页，延迟加载非关键数据
    const initializeApp = async () => {
      try {
        console.log('🚀 开始初始化应用（首屏优化模式）...');
        
        // 【Realtime 统一模型】初始化：只加载一次数据，之后全部由 Realtime 驱动
        // 1. 快速加载：立即加载今日记录和药品列表，不阻塞 UI
        setInitialLoading(false); // 立即取消 loading，允许进入主页
        loadDataFast(); // 非阻塞加载
        
        // 【延迟加载】2. 后台加载完整数据（不阻塞 UI）
        (async () => {
          try {
            // 版本检查（后台执行）
            try {
              await enforceVersionSync();
              console.log('✅ 版本检查通过');
            } catch (error: any) {
              if (error.message === 'VERSION_MISMATCH') {
                return;
              }
              console.warn('⚠️ 版本检查失败，继续初始化:', error);
            }
            
            // 加载云端快照（后台执行）
            const loadResult = await cloudLoadV2();
            if (loadResult.success && loadResult.payload) {
              console.log('✅ 云端数据已加载并初始化 payload');
            } else {
              console.log('📝 首次使用，创建初始 payload');
              const payload = getCurrentSnapshotPayload();
              if (!payload) {
                console.warn('⚠️ payload 仍为 null，手动初始化...');
              }
            }
            
            // 修复旧药品的 device_id（后台执行）
            await fixLegacyDeviceIds();
            console.log('🔧 device_id 修复完成');
            
            // 【Realtime 统一模型】初始化时只加载一次完整数据，之后全部由 Realtime 驱动
            await loadData(true, 'app-init-background');
            console.log('✅ 完整数据加载完成');
            
            // 标记应用已初始化（Realtime 现在可以处理所有事件）
            isInitializingRef.current = false;
            setAppInitialized(true);
            console.log('✅ 应用已初始化，Realtime 现在可以处理所有事件');
          } catch (error) {
            console.error('❌ 后台初始化失败:', error);
            isInitializingRef.current = false;
            setAppInitialized(true);
          }
        })();
      } catch (error) {
        console.error('❌ 应用初始化失败:', error);
        setInitialLoading(false);
        isInitializingRef.current = false;
        setAppInitialized(true);
      }
    };
    
    initializeApp();
    
    // 【延迟加载】启用 Realtime V2 多设备即时同步（后台执行，不阻塞 UI）
    let realtimeCleanup: (() => void) | null = null;
    setTimeout(() => {
      initRealtimeV2().then(cleanup => {
        realtimeCleanup = cleanup;
        console.log('✅ Realtime V2 多设备即时同步已启用');
        setRealtimeStatus('connected');
      }).catch(error => {
        console.error('❌ Realtime V2 启动失败:', error);
        setRealtimeStatus('disconnected');
      });
    }, 1000); // 延迟 1 秒启动
    
    // 【延迟加载】加载用户设置（后台执行，不阻塞 UI）
    setTimeout(() => {
      getUserSettings().then(settings => {
        console.log('📋 用户设置已加载:', settings);
        if (settings.avatar_url) {
          setAvatarUrl(settings.avatar_url);
          console.log('👤 用户头像已加载');
        }
      }).catch(console.error);
    }, 500); // 延迟 0.5 秒加载
    
    // 【Realtime 统一模型】立即启动 Realtime，确保数据实时同步
    let cloudRealtimeCleanup: (() => void) | null = null;
    initCloudOnlyRealtime({
      onMedicationChange: (payload) => {
        // 【Realtime 统一模型】Realtime 是唯一数据源，立即处理所有事件
        // 不再忽略初始化阶段的事件，确保数据一致性
        
        // 【局部更新】根据 payload 直接更新 state，不触发全量拉取
        const { eventType, new: newData, old: oldData } = payload;
        
        if (eventType === 'DELETE') {
          // 删除：从 state 中移除
          const deletedId = oldData?.id;
          if (deletedId) {
            safeSetMedications(prev => prev.filter(m => m.id !== deletedId), 'realtime-med-delete');
            // 【强制性能修复】从 Map 中删除，不触发 logs 重算
            lastLogByMedicationIdRef.current.delete(deletedId);
            console.log('✅ [Realtime] 已从 state 移除药品:', deletedId);
          }
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          // 插入/更新：更新或添加药品
          const medData = newData;
          if (medData) {
            safeSetMedications(prev => {
              const existingIndex = prev.findIndex(m => m.id === medData.id);
              if (existingIndex >= 0) {
                // 更新现有药品
                const updated = [...prev];
                const existingMed = updated[existingIndex];
                // 【修复 A】确保所有字段（包括 accent/color）都被更新，但保留本地计算的 status 和 lastLog
                updated[existingIndex] = {
                  ...existingMed,
                  ...medData, // 包含 accent、name、dosage、scheduled_time 等所有字段
                  status: existingMed.status || 'pending', // 保留本地计算的 status
                  lastTakenAt: existingMed.lastTakenAt,
                  uploadedAt: existingMed.uploadedAt,
                  lastLog: existingMed.lastLog
                };
                console.log('✅ [Realtime] 已更新药品（包括颜色）:', medData.id, { accent: medData.accent });
                return updated;
              } else {
                // 添加新药品
                return [...prev, {
                  ...medData,
                  status: 'pending',
                  lastTakenAt: undefined,
                  uploadedAt: undefined,
                  lastLog: undefined
                }];
              }
            }, 'realtime-med-insert-update');
            console.log('✅ [Realtime] 已更新 state 中的药品:', medData.id);
          }
        }
      },
      onLogChange: (payload) => {
        // 【Realtime 统一模型】Realtime 是唯一数据源，立即处理所有事件
        // 不再忽略初始化阶段的事件，确保数据一致性
        
        // 【局部更新】根据 payload 直接更新 state，不触发全量拉取
        const { eventType, new: newData, old: oldData } = payload;
        
        if (eventType === 'DELETE') {
          // 删除：从 state 中移除
          const deletedId = oldData?.id;
          const deletedMedId = oldData?.medication_id;
          if (deletedId) {
            safeSetTimelineLogs(prev => {
              const filtered = prev.filter(l => l.id !== deletedId);
              // 【强制性能修复】更新 Map：如果删除的是某个药品的最新记录，需要重新查找
              if (deletedMedId) {
                const currentLastLog = lastLogByMedicationIdRef.current.get(deletedMedId);
                if (currentLastLog?.id === deletedId) {
                  // 删除的是最新记录，需要从 filtered 中找下一个最新的
                  const nextLatest = filtered
                    .filter(l => l.medication_id === deletedMedId)
                    .sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime())[0];
                  if (nextLatest) {
                    lastLogByMedicationIdRef.current.set(deletedMedId, nextLatest);
                  } else {
                    lastLogByMedicationIdRef.current.delete(deletedMedId);
                  }
                }
              }
              return filtered;
            }, 'realtime-log-delete');
            console.log('✅ [Realtime] 已从 state 移除记录:', deletedId);
          }
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
          // 插入/更新：更新或添加记录
          const logData = newData;
          if (logData && logData.medication_id) {
            // 【强制性能修复】更新 Map：如果这是该药品的最新记录，更新 Map
            const medId = logData.medication_id;
            const currentLastLog = lastLogByMedicationIdRef.current.get(medId);
            if (!currentLastLog || new Date(logData.taken_at) > new Date(currentLastLog.taken_at)) {
              lastLogByMedicationIdRef.current.set(medId, logData);
              // 【强制性能修复】更新对应药品的 status
              safeSetMedications(prev => prev.map(m => {
                if (m.id === medId) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const taken = new Date(logData.taken_at) >= today;
                  return {
                    ...m,
                    status: taken ? 'completed' : 'pending',
                    lastTakenAt: logData.taken_at,
                    uploadedAt: logData.created_at,
                    lastLog: logData
                  };
                }
                return m;
              }), 'realtime-log-update-med-status');
            }
            
            // 【时间戳权威模型】更新 timelineLogs：基于时间戳合并
            safeSetTimelineLogs(prev => {
              const existingIndex = prev.findIndex(l => l.id === logData.id);
              if (existingIndex >= 0) {
                // 更新现有记录：比较时间戳，新的覆盖旧的
                const existing = prev[existingIndex];
                const newTime = new Date(logData.updated_at || logData.created_at || logData.taken_at).getTime();
                const existingTime = new Date(existing.updated_at || existing.created_at || existing.taken_at).getTime();
                
                if (newTime >= existingTime) {
                  // 新数据时间戳更新或相等，使用新数据
                  const updated = [...prev];
                  updated[existingIndex] = { ...existing, ...logData };
                  return updated.sort((a, b) => 
                    new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
                  );
                } else {
                  // 旧数据时间戳更新，保留旧数据（拒绝覆盖）
                  console.log('⏭️ [时间戳保护] 拒绝旧数据覆盖新数据:', logData.id, {
                    newTime: new Date(newTime),
                    existingTime: new Date(existingTime)
                  });
                  return prev;
                }
              } else {
                // 添加新记录
                return [...prev, logData].sort((a, b) => 
                  new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
                );
              }
            }, 'realtime-log-insert-update');
            console.log('✅ [Realtime] 已更新 state 中的记录:', logData.id);
          }
        }
      }
    }).then(cleanup => {
      cloudRealtimeCleanup = cleanup;
      console.log('✅ 纯云端 Realtime 已启动');
    }).catch(error => {
      console.error('❌ Realtime 初始化失败:', error);
    });
    
    // 【本地认证模式】禁用旧的 Realtime 同步
    /*
    // 初始化旧的 Realtime 同步（保留兼容性）
    const cleanup = initRealtimeSync(
      // 处理服药记录更新
      (log) => {
        // 【B】在所有监听入口加 guard
        if (isApplyingRemote()) {
          console.log('⏭ 忽略云端回放引起的本地变化（服药记录）');
          return;
        }
        
        console.log('🔔 收到其他设备的服药记录更新');
        // 自动合并远程记录
        mergeRemoteLog(log).then(() => {
          console.log('✅ 服药记录已自动同步');
          // 【Realtime 统一模型】不再调用 loadData，Realtime 会自动更新 UI
        }).catch(console.error);
      },
      // 处理药品列表更新（自动同步，无需确认）
      async () => {
        // 【B】在所有监听入口加 guard
        if (isApplyingRemote()) {
          console.log('⏭ 忽略云端回放引起的本地变化（药品列表）');
          return;
        }
        
        console.log('🔔 收到药品列表更新，自动同步...');
        
        try {
          // 先同步medications
          await syncMedications();
          // 【Realtime 统一模型】不再调用 loadData，Realtime 会自动更新 UI
          console.log('✅ 药品列表已自动同步');
          
          // 显示友好提示
          const notification = document.createElement('div');
          notification.className = 'fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-full font-bold text-sm shadow-lg animate-fade-in';
          notification.textContent = '✅ 药品列表已从其他设备同步';
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.classList.add('animate-fade-out');
            setTimeout(() => notification.remove(), 300);
          }, 3000);
        } catch (error) {
          console.error('❌ 药品列表同步失败:', error);
        }
      }
    );
    */
    
    // 【本地认证模式】禁用快照自动同步
    /*
    // 初始化快照自动同步
    let cleanupSnapshot: (() => void) | null = null;
    initAutoSyncLegacy(() => {
      // 【B】在所有监听入口加 guard
      if (isApplyingRemote()) {
        console.log('⏭ 忽略云端回放引起的本地变化（快照更新）');
        return;
      }
      
      // 【Realtime 统一模型】不再调用 loadData，Realtime 会自动更新 UI
    }).then(cleanup => {
      cleanupSnapshot = cleanup;
    }).catch(console.error);
    */
    
    // 【时间戳权威模型】启用用户设置实时同步
    const cleanupSettings = initSettingsRealtimeSync((settings) => {
      console.log('⚙️ 用户设置已更新:', settings);
      
      // 【时间戳权威模型】自动应用用户名更新（无需用户确认）
      if (settings.userName && settings.userName !== userName) {
        console.log('👤 检测到用户名更新，自动同步...');
        setUserName(settings.userName);
      }
      
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
      
      // 对于其他设置变更，自动应用（时间戳新的覆盖旧的）
      // 不再询问用户，直接应用（基于时间戳权威模型）
      console.log('✅ 用户设置已自动同步');
    });
    
    // 【本地认证模式】定时同步已禁用（见上方注释）
    // 定期同步（缩短到3秒，更快速的多设备同步）
    // 【本地认证模式】禁用定时同步，避免无效的 Supabase 调用
    // const syncInterval = setInterval(async () => {
    //   // #region agent log
    //   fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:syncInterval',message:'Sync interval triggered',data:{isApplyingRemote:isApplyingRemote()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    //   // #endregion
    //   // 【B】在所有监听入口加 guard
    //   if (isApplyingRemote()) {
    //     console.log('⏭ 忽略云端回放引起的本地变化（定时同步）');
    //     return;
    //   }
    //   
    //   console.log('⏰ 定时同步...');
    //   // #region agent log
    //   fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:syncInterval:executing',message:'Starting sync operations',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    //   // #endregion
    //   
    //   // 【B】定时同步只负责数据同步，不触发刷新/保存
    //   // 删除所有变化检测和刷新逻辑，避免触发 cloudSaveV2
    //   await syncMedications().catch(console.error);
    //   await pushLocalChanges().catch(console.error);
    //   const logs = await pullRemoteChanges().catch(() => []);
    //   if (logs && logs.length > 0) {
    //     console.log(`📥 拉取到 ${logs.length} 条新记录`);
    //     for (const log of logs) {
    //       await mergeRemoteLog(log).catch(console.error);
    //     }
    //   }
    //   
    //   // 同步用户设置（包括头像）
    //   const settings = await getUserSettings().catch(() => ({} as any));
    //   if (settings && (settings as any).avatar_url && (settings as any).avatar_url !== avatarUrl) {
    //     console.log('👤 检测到头像更新（定时同步）');
    //     setAvatarUrl((settings as any).avatar_url);
    //   }
    //   
    //   // 【B】禁止定时同步触发刷新/保存
    //   // 删除所有 loadData() / cloudSaveV2() 调用
    // }, 3000); // 每3秒同步一次
    
    // 【云端化】返回清理函数
    return () => {
      if (realtimeCleanup) {
        realtimeCleanup();
        console.log('🔌 Realtime V2 已断开');
      }
      if (cloudRealtimeCleanup) {
        cloudRealtimeCleanup();
        console.log('🔌 纯云端 Realtime 已断开');
      }
      if (cleanupSettings) {
        cleanupSettings();
        console.log('🔌 用户设置 Realtime 已断开');
      }
    };
  }, [isLoggedIn]);

  // 【修复 B】处理拍照成功：立即更新前端 state（Optimistic/Confirmed UI）
  const handleRecordSuccess = async (newLog: MedicationLog) => {
    console.log('✅ [新增记录] 云端 upsert 成功，立即更新前端 state:', newLog.id);
    
    // 1) 立刻 setLogs(prev => [newLog, ...prev])，并确保去重（按 id）
    safeSetTimelineLogs(prev => {
      // 去重：如果已存在相同 id，替换；否则添加到开头
      const existingIndex = prev.findIndex(l => l.id === newLog.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newLog;
        // 重新排序
        return updated.sort((a, b) => 
          new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
        );
      } else {
        // 添加到开头并排序
        return [newLog, ...prev].sort((a, b) => 
          new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
        );
      }
    }, 'add-log-success');
    
    // 2) 同步更新 lastLogByMedicationId Map
    const medId = newLog.medication_id;
    const currentLastLog = lastLogByMedicationIdRef.current.get(medId);
    if (!currentLastLog || new Date(newLog.taken_at) > new Date(currentLastLog.taken_at)) {
      lastLogByMedicationIdRef.current.set(medId, newLog);
      console.log('✅ [Map更新] 已更新 lastLogByMedicationId Map:', medId);
      
      // 3) 更新对应药品的 status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const taken = new Date(newLog.taken_at) >= today;
      
      safeSetMedications(prev => prev.map(m => {
        if (m.id === medId) {
          return {
            ...m,
            status: taken ? 'completed' : 'pending',
            lastTakenAt: newLog.taken_at,
            uploadedAt: newLog.created_at,
            lastLog: newLog
          };
        }
        return m;
      }), 'add-log-update-med-status');
    }
    
    // 不要调用 loadData('manual-refresh')，已直接更新 state
    console.log('✅ [新增记录] 前端 state 已立即更新，无需全量 reload');
  };

  // 处理同步提示接受
  const handleSyncAccept = async () => {
    if (syncPrompt) {
      await mergeRemoteLog(syncPrompt);
      setSyncPrompt(null);
      // 【Realtime 统一模型】不再调用 loadData，Realtime 会自动更新 UI
    }
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

  // 【Realtime 统一模型】只在应用初始化时显示 loading，页面切换不再显示
  if (initialLoading && !appInitialized) {
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
      <header className="px-6 md:px-24 pt-4 pb-2 md:pt-8 md:pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10">
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h1 className="text-2xl font-black italic tracking-tighter">
              药盒助手 <span className="text-gray-500 text-xs font-medium tracking-widest">{APP_VERSION}</span>
            </h1>
            {/* Realtime 同步状态指示器 */}
            <div className="flex items-center gap-2">
              {realtimeStatus === 'connected' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-green-700">实时同步</span>
                </div>
              )}
              {realtimeStatus === 'connecting' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-yellow-700">连接中...</span>
                </div>
              )}
              {realtimeStatus === 'disconnected' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-50 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] font-bold text-red-700">未连接</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 md:px-24 relative z-10">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 gap-8 max-w-4xl">
            <div className="mb-4">
              <h4 className="text-sm font-black italic tracking-tighter mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-lime"></span>
                待服用药物
              </h4>
              <div className="space-y-3">
                {medications.map(med => (
                  <MedCard 
                    key={med.id} 
                    med={med}
                    onCameraClick={() => {
                      setSelectedMedicationId(med.id);
                      setShowCameraModal(true);
                    }}
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
                          <div className="flex gap-1 mt-1 flex-wrap justify-center">
                            {Array.from(new Set(logsOnDate.map(log => {
                              const med = medications.find(m => m.id === log.medication_id);
                              if (!med) return null;
                              // 获取实际颜色值
                              const color = med.accent?.startsWith('#') ? med.accent :
                                med.accent === 'lime' ? '#E0F3A2' :
                                med.accent === 'mint' ? '#BFEFFF' :
                                med.accent === 'berry' ? '#FFD1DC' : '#999999';
                              return JSON.stringify({ color, name: med.name });
                            }).filter(Boolean))).map((item, idx) => {
                              const { color, name } = JSON.parse(item as string);
                              return (
                                <div
                                  key={idx}
                                  className="w-2 h-2 rounded-full shadow-md ring-1 ring-white"
                                  style={{ backgroundColor: color }}
                                  title={name}
                                />
                              );
                            })}
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

             <div className="space-y-6">
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

                  // 按天分组
                  const groupedByDate = filteredLogs.reduce((groups, log) => {
                    const dateKey = new Date(log.taken_at).toISOString().split('T')[0];
                    if (!groups[dateKey]) {
                      groups[dateKey] = [];
                    }
                    groups[dateKey].push(log);
                    return groups;
                  }, {} as Record<string, typeof filteredLogs>);

                  // 按日期降序排序
                  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

                  return sortedDates.length > 0 ? (
                    sortedDates.map(dateKey => {
                      const logsOnDate = groupedByDate[dateKey];
                      const date = new Date(dateKey);
                      const isToday = dateKey === new Date().toISOString().split('T')[0];
                      const dateDisplay = isToday ? '今天' : date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });

                      return (
                        <div key={dateKey} className="mb-2">
                          {/* 日期标题 - 更醒目的设计 */}
                          <div className="flex items-center gap-4 mb-2">
                            <div className={`px-6 py-3 rounded-full ${isToday ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg' : 'bg-gray-100 text-gray-700'} font-black italic text-base`}>
                              {dateDisplay}
                            </div>
                            <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-200 to-transparent" />
                            <span className="text-sm font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                              {logsOnDate.length} 条
                            </span>
                          </div>

                          {/* 当天的记录列表 - 使用时间线样式 */}
                          <div className="relative">
                            {logsOnDate.map((log, index) => {
                              const medication = medications.find(m => m.id === log.medication_id);
                              if (!medication) return null;
                              
                              return (
                                <TimelineItem 
                                  key={log.id} 
                                  log={log} 
                                  medication={medication}
                                  onMedicationClick={(medId) => {
                                    setSelectedMedicationId(medId);
                                  }}
                                  isLast={index === logsOnDate.length - 1}
                                />
                              );
                            })}
                          </div>
                        </div>
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

        {activeTab === 'profile' && (
          <div className="max-w-4xl">
            {/* 用户信息卡片 - 降低高度至50% */}
            <div className="bg-white rounded-[40px] p-2 shadow-sm border border-gray-100 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt="用户头像" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-white" strokeWidth={2.5} />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-black italic tracking-tighter mb-0.5">{userName || localStorage.getItem('userName') || '用户'}</h2>
                  <p className="text-xs text-gray-500 font-bold tracking-widest">药盒助手用户</p>
                </div>
                <button 
                  onClick={() => setShowProfileEdit(true)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-lime rounded-3xl p-3 text-center">
                <p className="text-3xl font-black italic tracking-tighter mb-1">{medications.length}</p>
                <p className="text-xs font-bold text-gray-600 tracking-widest">药物总数</p>
              </div>
              <div className="bg-mint rounded-3xl p-3 text-center">
                <p className="text-3xl font-black italic tracking-tighter mb-1">{timelineLogs.length}</p>
                <p className="text-xs font-bold text-gray-600 tracking-widest">服药记录</p>
              </div>
              <div className="bg-berry rounded-3xl p-3 text-center">
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
                onClick={async () => {
                  if (confirm('⚠️ 警告：确定要清除所有药品数据吗？\n\n这将删除：\n- 所有药品记录\n- 所有服药记录\n- 本地数据库数据\n- 云端数据\n\n此操作不可恢复！')) {
                    if (confirm('⚠️ 最后确认：真的要删除所有数据吗？')) {
                      try {
                        console.log('🗑️ 开始清除所有药品数据...');
                        // #region agent log
                        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1301',message:'开始清除所有药品数据',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K'})}).catch(()=>{});
                        // #endregion
                        
                        // 方法1: 清除本地 IndexedDB
                        console.log('📦 清除本地 IndexedDB...');
                        // #region agent log
                        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1305',message:'清除本地IndexedDB',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K'})}).catch(()=>{});
                        // #endregion
                        await db.medications.clear();
                        await db.medicationLogs.clear();
                        console.log('✅ 本地数据库已清空');
                        // #region agent log
                        fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1307',message:'本地数据库已清空',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K'})}).catch(()=>{});
                        // #endregion
                        
                        // 方法2: 清除 payload
                        const payload = getCurrentSnapshotPayload();
                        if (payload) {
                          console.log('📦 清除 payload...');
                          payload.medications = [];
                          payload.medication_logs = [];
                          
                          // 保存到云端
                          const result = await cloudSaveV2(payload);
                          if (result.success) {
                            console.log('✅ 云端数据已清空');
                          } else {
                            console.warn('⚠️ 云端清空失败:', result.message);
                          }
                        }
                        
                        // 方法3: 直接清除 Supabase 数据库
                        try {
                          // #region agent log
                          fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1327',message:'开始清除Supabase',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K'})}).catch(()=>{});
                          // #endregion
                          const { getCurrentUserId } = await import('./src/lib/supabase');
                          const { supabase } = await import('./src/lib/supabase');
                          const userId = await getCurrentUserId();
                          
                          // #region agent log
                          fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1332',message:'获取userId和supabase',data:{hasUserId:!!userId,hasSupabase:!!supabase},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K'})}).catch(()=>{});
                          // #endregion
                          
                          if (userId && supabase) {
                            console.log('📦 清除 Supabase 数据...', { userId });
                            
                            // 删除所有药品
                            // #region agent log
                            fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1338',message:'删除Supabase药品',data:{userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K'})}).catch(()=>{});
                            // #endregion
                            const { error: medError, count: medCount } = await supabase
                              .from('medications')
                              .delete()
                              .eq('user_id', userId)
                              .select('*', { count: 'exact', head: false });
                            
                            // #region agent log
                            fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1345',message:'删除药品结果',data:{hasError:!!medError,errorMsg:medError?.message,count:medCount},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K'})}).catch(()=>{});
                            // #endregion
                            
                            if (medError) {
                              console.error('❌ 清除 Supabase 药品失败:', medError);
                            } else {
                              console.log(`✅ Supabase 药品数据已清空 (${medCount || 0} 条)`);
                            }
                            
                            // 删除所有记录
                            // #region agent log
                            fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1353',message:'删除Supabase记录',data:{userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K'})}).catch(()=>{});
                            // #endregion
                            const { error: logError, count: logCount } = await supabase
                              .from('medication_logs')
                              .delete()
                              .eq('user_id', userId)
                              .select('*', { count: 'exact', head: false });
                            
                            // #region agent log
                            fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1360',message:'删除记录结果',data:{hasError:!!logError,errorMsg:logError?.message,count:logCount},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K'})}).catch(()=>{});
                            // #endregion
                            
                            if (logError) {
                              console.error('❌ 清除 Supabase 记录失败:', logError);
                            } else {
                              console.log(`✅ Supabase 记录数据已清空 (${logCount || 0} 条)`);
                            }
                          } else {
                            console.warn('⚠️ 无法获取 userId 或 supabase 客户端');
                            // #region agent log
                            fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1369',message:'无法获取userId或supabase',data:{hasUserId:!!userId,hasSupabase:!!supabase},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K'})}).catch(()=>{});
                            // #endregion
                          }
                        } catch (e) {
                          console.error('❌ Supabase 清除失败:', e);
                          // #region agent log
                          fetch('http://127.0.0.1:7245/ingest/6c2f9245-7e42-4252-9b86-fbe37b1bc17e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1374',message:'Supabase清除异常',data:{error:String(e)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'K'})}).catch(()=>{});
                          // #endregion
                        }
                        
                        // 【Realtime 统一模型】不再调用 loadData，Realtime 会自动更新 UI
                        console.log('🔄 数据已清除，等待 Realtime 同步...');
                        alert('✅ 所有药品数据已清除！\n\n已清除:\n- 本地数据库\n- 云端快照\n- Supabase数据库');
                        console.log('🎉 清除完成！');
                      } catch (error) {
                        console.error('❌ 清除数据失败:', error);
                        alert(`❌ 清除数据失败: ${error.message}\n\n请查看控制台了解详情`);
                      }
                    }
                  }
                }}
                className="bg-red-50 rounded-2xl p-5 shadow-sm border border-red-200 flex items-center justify-between hover:bg-red-100 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-700" />
                  </div>
                  <div>
                    <p className="font-black italic tracking-tighter text-red-700">清除所有药品</p>
                    <p className="text-xs text-red-500 font-bold">删除所有药品和服药记录</p>
                  </div>
                </div>
                <span className="text-red-400">›</span>
              </div>

              <div 
                onClick={async () => {
                  if (confirm('⚠️ 确定要清除 PWA 缓存吗？\n\n这将清除所有缓存的资源，应用将重新加载。\n你的数据不会丢失。')) {
                    try {
                      // 清除所有缓存
                      const cacheNames = await caches.keys();
                      await Promise.all(cacheNames.map(name => caches.delete(name)));
                      
                      // 注销 Service Worker
                      const registrations = await navigator.serviceWorker.getRegistrations();
                      await Promise.all(registrations.map(reg => reg.unregister()));
                      
                      alert('✅ PWA 缓存已清除！\n\n应用将在 2 秒后重新加载...');
                      
                      // 延迟重新加载
                      setTimeout(() => {
                        window.location.reload();
                      }, 2000);
                    } catch (error) {
                      console.error('清除缓存失败:', error);
                      alert('❌ 清除缓存失败，请重试');
                    }
                  }
                }}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Database className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-black italic tracking-tighter">清除缓存</p>
                    <p className="text-xs text-gray-400 font-bold">清除 PWA 缓存和 Service Worker</p>
                  </div>
                </div>
                <span className="text-gray-400">›</span>
              </div>

              {/* 诊断面板按钮 */}
              <div 
                onClick={() => setShowDebugPanel(true)}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-black italic tracking-tighter">诊断面板</h3>
                    <p className="text-xs text-gray-500 font-bold mt-1">查看系统状态</p>
                  </div>
                </div>
                <span className="text-gray-400">›</span>
              </div>

              {/* 关于应用按钮 - 已隐藏
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
                    <p className="text-xs text-gray-400 font-bold">版本 {APP_VERSION}</p>
                  </div>
                </div>
                <span className="text-gray-400">›</span>
              </div>
              */}

              <div 
                onClick={async () => {
                  try {
                    console.log('🔍 开始诊断数据来源...');
                    
                    // 1. 检查本地 IndexedDB
                    const localMeds = await db.medications.toArray();
                    const localLogs = await db.medicationLogs.toArray();
                    console.log('📦 本地 IndexedDB:', {
                      medications: localMeds.length,
                      logs: localLogs.length
                    });
                    
                    // 2. 检查 payload
                    const payload = getCurrentSnapshotPayload();
                    console.log('📦 Payload:', {
                      medications: payload?.medications?.length || 0,
                      logs: payload?.medication_logs?.length || 0
                    });
                    
                    // 3. 检查 Supabase
                    const user = getCurrentUser();
                    if (user && window.supabaseClient) {
                      const userTag = `user:${user.username}`;
                      
                      const { data: supaMeds } = await window.supabaseClient
                        .from('medications')
                        .select('*')
                        .contains('scene_tags', [userTag]);
                      
                      const { data: supaLogs } = await window.supabaseClient
                        .from('medication_logs')
                        .select('*')
                        .contains('scene_tags', [userTag]);
                      
                      console.log('📦 Supabase:', {
                        medications: supaMeds?.length || 0,
                        logs: supaLogs?.length || 0
                      });
                    }
                    
                    // 4. 检查当前显示的数据
                    console.log('📦 当前显示:', {
                      medications: medications.length,
                      logs: timelineLogs.length
                    });
                    
                    alert(`📊 数据诊断报告:\n\n` +
                      `本地数据库: ${localMeds.length} 个药品, ${localLogs.length} 条记录\n` +
                      `Payload: ${payload?.medications?.length || 0} 个药品, ${payload?.medication_logs?.length || 0} 条记录\n` +
                      `当前显示: ${medications.length} 个药品, ${timelineLogs.length} 条记录\n\n` +
                      `详细信息请查看控制台 (F12)`);
                  } catch (error) {
                    console.error('❌ 诊断失败:', error);
                    alert(`❌ 诊断失败: ${error.message}`);
                  }
                }}
                className="bg-blue-50 rounded-2xl p-5 shadow-sm border border-blue-100 flex items-center justify-between hover:bg-blue-100 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Info className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-black italic tracking-tighter text-blue-600">数据诊断</p>
                    <p className="text-xs text-blue-400 font-bold">查看数据来源和数量</p>
                  </div>
                </div>
                <span className="text-blue-400">›</span>
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

        {activeTab === 'medications' && (
          <div className="max-w-4xl">
            <h2 className="text-3xl font-black italic tracking-tighter mb-6">药品管理</h2>
            
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
                  <label className="block text-sm font-bold text-gray-600 mb-2">颜色主题</label>
                  <div className="grid grid-cols-6 gap-3">
                    {[
                      { value: '#E0F3A2', label: '青柠' },
                      { value: '#FFD1DC', label: '浆果' },
                      { value: '#BFEFFF', label: '薄荷' },
                      { value: '#A8D8FF', label: '蓝色' },
                      { value: '#D4A5FF', label: '紫色' },
                      { value: '#FFB84D', label: '橙色' },
                      { value: '#FF6B6B', label: '红色' },
                      { value: '#4ECDC4', label: '青色' },
                    ].map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setNewMedAccent(color.value)}
                        className={`h-12 rounded-xl border-2 transition-all ${
                          newMedAccent === color.value
                            ? 'border-black scale-110 shadow-lg'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.label}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    已选择: {[
                      { value: '#E0F3A2', label: '青柠' },
                      { value: '#FFD1DC', label: '浆果' },
                      { value: '#BFEFFF', label: '薄荷' },
                      { value: '#A8D8FF', label: '蓝色' },
                      { value: '#D4A5FF', label: '紫色' },
                      { value: '#FFB84D', label: '橙色' },
                      { value: '#FF6B6B', label: '红色' },
                      { value: '#4ECDC4', label: '青色' },
                    ].find(c => c.value === newMedAccent)?.label || '自定义'}
                  </p>
                </div>

                <button
                  onClick={async () => {
                    // 【彻底移除 app_state 依赖】不再使用 payload/app_state，只操作 medications 表
                      if (!newMedName || !newMedDosage || !newMedTime) {
                        alert('请填写完整信息');
                        return;
                      }

                    // 生成 UUID
                    const newMedication: Medication = {
                        id: (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                        name: newMedName,
                        dosage: newMedDosage,
                        scheduled_time: newMedTime,
                        accent: newMedAccent,
                        device_id: getDeviceId()
                      };

                    // 【强制性能修复】Optimistic UI：立即更新本地 state（UI 立即生效，<300ms）
                    safeSetMedications(prev => [...prev, {
                      ...newMedication,
                      status: 'pending',
                      lastTakenAt: undefined,
                      uploadedAt: undefined,
                      lastLog: undefined
                    }], 'add-medication-optimistic');
                    
                    // 【强制性能修复】立即关闭 loading，不阻塞 UI
                    // 不等待任何异步操作

                    // 【云端化】后台异步写入云端，不阻塞 UI
                    (async () => {
                      try {
                        const savedMed = await upsertMedicationToCloud(newMedication);
                        if (!savedMed) {
                          // 失败时回滚：从本地 state 移除
                          safeSetMedications(prev => prev.filter(m => m.id !== newMedication.id), 'add-medication-rollback');
                          alert('添加药品失败，请重试');
                          return;
                        }
                        console.log('✅ 新药品已直接写入云端:', savedMed.name);
                        
                        // 成功：用云端返回的数据更新本地 state（确保 ID 等字段一致）
                        if (savedMed.id !== newMedication.id) {
                          safeSetMedications(prev => {
                            const filtered = prev.filter(m => m.id !== newMedication.id);
                            return [...filtered, {
                              ...savedMed,
                              status: 'pending',
                              lastTakenAt: undefined,
                              uploadedAt: undefined,
                              lastLog: undefined
                            }];
                          }, 'add-medication-confirmed');
                        }
                      } catch (error: any) {
                        // 失败时回滚
                        safeSetMedications(prev => prev.filter(m => m.id !== newMedication.id), 'add-medication-error-rollback');
                        const errorMsg = error?.message || '添加药品失败，请重试';
                        console.error('❌ 添加药品失败:', errorMsg, error);
                        alert(`添加药品失败: ${errorMsg}`);
                      }
                    })();
                    
                    // 【禁止全量 reload】不再调用 loadData()，只做局部更新
                    // 【强制性能修复】不触发 logs 重算，不更新 Map
                      setNewMedName('');
                      setNewMedDosage('');
                      setNewMedTime('');
                      setNewMedAccent('#E0F3A2');
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
                  {medications.map((med) => {
                    const medColor = (med.accent?.startsWith('#') ? med.accent : 
                      med.accent === 'lime' ? '#E0F3A2' : 
                      med.accent === 'mint' ? '#BFEFFF' :
                      med.accent === 'berry' ? '#FFD1DC' : '#FFFFFF');
                    
                    return (
                      <div
                        key={med.id}
                        className="p-5 rounded-2xl border-2 flex items-center justify-between bg-white"
                        style={{ borderColor: medColor }}
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
                        
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => {
                              setEditingMed(med);
                              setEditMedName(med.name);
                              setEditMedDosage(med.dosage);
                              setEditMedTime(med.scheduled_time);
                              setEditMedAccent(medColor);
                            }}
                            className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-all"
                          >
                            <Edit2 className="w-5 h-5 text-blue-600" />
                          </button>
                          
                          <button
                            onClick={async () => {
                              // 【强制性能修复】彻底移除 app_state 依赖，直接删除
                                if (confirm(`确定要删除"${med.name}"吗？\n相关的服药记录也会被删除。`)) {
                                // 【强制性能修复】Optimistic UI：立即从本地 state 移除（UI 立即生效，<300ms）
                                safeSetMedications(prev => prev.filter(m => m.id !== med.id), 'delete-medication-optimistic');
                                
                                // 【强制性能修复】从 Map 中删除，不触发 logs 重算
                                lastLogByMedicationIdRef.current.delete(med.id);
                                
                                // 【强制性能修复】立即关闭 loading，不阻塞 UI
                                // 不等待任何异步操作

                                // 【云端化】后台异步删除云端，不阻塞 UI
                                (async () => {
                                  try {
                                    const success = await deleteMedicationFromCloud(med.id);
                                    if (!success) {
                                      // 失败时回滚：重新添加回本地 state
                                      safeSetMedications(prev => [...prev, med], 'delete-medication-rollback');
                                      alert('删除药品失败，请重试');
                                      return;
                                    }
                                    console.log('✅ 药品已从云端删除:', med.name);
                                  } catch (error: any) {
                                    // 失败时回滚
                                    safeSetMedications(prev => [...prev, med], 'delete-medication-error-rollback');
                                    const errorMsg = error?.message || '删除药品失败，请重试';
                                    console.error('❌ 删除药品失败:', errorMsg, error);
                                    alert(`删除药品失败: ${errorMsg}`);
                                  }
                                })();
                                
                                // 【禁止全量 reload】不再调用 loadData()，只做局部更新
                                // 【强制性能修复】不触发 logs 重算，不更新 Map（已删除）
                              }
                            }}
                            className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200 transition-all"
                          >
                            <Trash2 className="w-5 h-5 text-red-600" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>


      {/* Camera Modal */}
      {/* 诊断面板 */}
      {showDebugPanel && (
        <DebugPanel onClose={() => setShowDebugPanel(false)} />
      )}

      {showCameraModal && medications.length > 0 && (
        <CameraModal
          medications={medications}
          onClose={() => {
            setShowCameraModal(false);
            setSelectedMedicationId(null);
          }}
          onSuccess={handleRecordSuccess}
          preselectedMedicationId={selectedMedicationId}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, rgba(243, 232, 255, 0.95) 0%, rgba(232, 225, 255, 0.95) 100%)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
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
                onClick={async () => {
                  // 【时间戳权威模型】保存用户名到user_settings表
                  try {
                    await updateUserSettings({ userName });
                    console.log('✅ 用户名已保存到云端:', userName);
                    setShowProfileEdit(false);
                  } catch (error) {
                    console.error('❌ 保存用户名失败:', error);
                    alert('保存失败，请重试');
                  }
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
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
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
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
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
                    <span className="font-black italic tracking-tighter">云端数据</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 font-bold mb-4">
                  手动保存和读取云端备份数据
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      const result = await saveSnapshotLegacy();
                      alert(result.message);
                      // 【Realtime 统一模型】不再调用 loadData，Realtime 会自动更新 UI
                    }}
                    className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    云端保存
                  </button>
                  
                  <button
                    onClick={async () => {
                      const result = await loadSnapshotLegacy(false);
                      alert(result.message);
                      // 【Realtime 统一模型】不再调用 loadData，Realtime 会自动更新 UI
                    }}
                    className="flex-1 px-4 py-3 bg-green-500 text-white rounded-2xl font-bold hover:bg-green-600 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    云端读取
                  </button>
                </div>
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
                        // 【Realtime 统一模型】不再调用 loadData，Realtime 会自动更新 UI
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
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
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
                <p className="text-sm text-gray-500 font-bold">版本 {APP_VERSION}</p>
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

      {/* 版本更新提示 */}
      <UpdateNotification />
      
      {/* 编辑药品模态框 */}
      {editingMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, rgba(243, 232, 255, 0.95) 0%, rgba(232, 225, 255, 0.95) 100%)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black italic tracking-tighter">编辑药品</h3>
              <button
                onClick={() => setEditingMed(null)}
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
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
                  placeholder="例如：降压药"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">剂量</label>
                <input
                  type="text"
                  value={editMedDosage}
                  onChange={(e) => setEditMedDosage(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
                  placeholder="例如：1片"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">服用时间</label>
                <input
                  type="time"
                  value={editMedTime}
                  onChange={(e) => setEditMedTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-pink-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">颜色主题</label>
                <div className="grid grid-cols-6 gap-3">
                  {[
                    { value: '#E0F3A2', label: '青柠' },
                    { value: '#FFD1DC', label: '浆果' },
                    { value: '#BFEFFF', label: '薄荷' },
                    { value: '#A8D8FF', label: '蓝色' },
                    { value: '#D4A5FF', label: '紫色' },
                    { value: '#FFB84D', label: '橙色' },
                    { value: '#FF6B6B', label: '红色' },
                    { value: '#4ECDC4', label: '青色' },
                  ].map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setEditMedAccent(color.value)}
                      className={`h-12 rounded-xl border-2 transition-all ${
                        editMedAccent === color.value
                          ? 'border-black scale-110 shadow-lg'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  已选择: {[
                    { value: '#E0F3A2', label: '青柠' },
                    { value: '#FFD1DC', label: '浆果' },
                    { value: '#BFEFFF', label: '薄荷' },
                    { value: '#A8D8FF', label: '蓝色' },
                    { value: '#D4A5FF', label: '紫色' },
                    { value: '#FFB84D', label: '橙色' },
                    { value: '#FF6B6B', label: '红色' },
                    { value: '#4ECDC4', label: '青色' },
                  ].find(c => c.value === editMedAccent)?.label || '自定义'}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingMed(null)}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 font-black italic rounded-full tracking-tighter hover:bg-gray-200 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    // 【彻底移除 app_state 依赖】不再使用 payload/app_state，只操作 medications 表
                      if (!editMedName || !editMedDosage || !editMedTime) {
                        alert('请填写完整信息');
                        return;
                      }

                    if (!editingMed) return;

                    // 【强制性能修复】Optimistic UI：立即更新本地 state（UI 立即生效，<300ms）
                    const updatedMed: Medication = {
                      ...editingMed,
                          name: editMedName,
                          dosage: editMedDosage,
                          scheduled_time: editMedTime,
                          accent: editMedAccent
                        };
                    
                    // 保存原始值用于回滚
                    const originalMed = { ...editingMed };
                    
                    // 【强制性能修复】立即更新 UI，不等待任何异步操作
                    safeSetMedications(prev => prev.map(m => m.id === editingMed.id ? {
                      ...m,
                      ...updatedMed
                    } : m), 'edit-medication-optimistic');
                    
                    // 【强制性能修复】立即关闭弹窗，不阻塞 UI
                    setEditingMed(null);

                    // 【云端化】后台异步更新云端，不阻塞 UI
                    (async () => {
                      try {
                        const savedMed = await upsertMedicationToCloud(updatedMed);
                        if (!savedMed) {
                          // 失败时回滚：恢复原始值
                          safeSetMedications(prev => prev.map(m => m.id === editingMed.id ? {
                            ...m,
                            ...originalMed
                          } : m), 'edit-medication-rollback');
                          alert('更新药品失败，请重试');
                          return;
                        }
                        console.log('✅ 药品已直接更新到云端:', savedMed.name);
                        
                        // 成功：用云端返回的数据更新本地 state（确保字段一致）
                        safeSetMedications(prev => prev.map(m => m.id === editingMed.id ? {
                          ...m,
                          ...savedMed
                        } : m), 'edit-medication-confirmed');
                      } catch (error: any) {
                        // 失败时回滚
                        safeSetMedications(prev => prev.map(m => m.id === editingMed.id ? {
                          ...m,
                          ...originalMed
                        } : m), 'edit-medication-error-rollback');
                        const errorMsg = error?.message || '更新药品失败，请重试';
                        console.error('❌ 更新药品失败:', errorMsg, error);
                        alert(`更新药品失败: ${errorMsg}`);
                      }
                    })();
                    
                    // 【禁止全量 reload】不再调用 loadData()，只做局部更新
                    // 【强制性能修复】不触发 logs 重算，不更新 Map
                  }}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black italic rounded-full tracking-tighter hover:scale-105 active:scale-95 transition-all"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
