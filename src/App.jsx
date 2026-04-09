import React, { useState, useEffect, useRef } from 'react';
import { Clock, Plus, X, LogOut, Copy, Check, UserPlus, HelpCircle, Trophy, User, Flame, Zap, Star, TrendingUp, ArrowLeftRight, Edit3, Calendar, ChevronLeft, ChevronRight, Crown, Target, ArrowUp, ArrowDown, Minus as MinusIcon, GripVertical, BarChart3, Sun, Moon, ChevronDown, Trash2, Settings, Home, CheckSquare, Users } from 'lucide-react';
import { supabase } from './supabase';

// ─── PUSH NOTIFICATIONS ───
const VAPID_PUBLIC_KEY = 'BEcFKhe3DpVfW8crc-iYvCm8KGAfrZvqKS0ysp9QxEpUuhIpUw8u8qJlV7Pb73nKgyUkqxEmZ4mSjJ4BoyTXdvo';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (err) { console.error('SW registration failed:', err); return null; }
}

async function subscribeToPush(reg) {
  if (!('PushManager' in window)) return null;
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    return sub;
  } catch (err) { console.error('Push subscription failed:', err); return null; }
}

async function sendLocalNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.ready;
  if (reg) {
    reg.showNotification(title, {
      body, icon: '/icon-192.png', badge: '/icon-192.png',
      tag: tag || 'versa-' + Date.now(), renotify: true
    });
  }
}

// ─── CONFETTI ───
function ConfettiCanvas({ trigger }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    const particles = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width, y: -20 - Math.random() * 200, w: 4 + Math.random() * 6, h: 8 + Math.random() * 12,
      vx: (Math.random() - 0.5) * 6, vy: 2 + Math.random() * 4, rot: Math.random() * 360, rotV: (Math.random() - 0.5) * 12,
      color: colors[Math.floor(Math.random() * colors.length)], life: 1
    }));
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        if (p.life <= 0) return; alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.rot += p.rotV; p.life -= 0.005;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180); ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      if (alive) animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [trigger]);
  return <canvas ref={canvasRef} className="fixed inset-0 z-[100] pointer-events-none" />;
}

function ProgressRing({ progress, size = 56, stroke = 4, color = '#3b82f6' }) {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={circ - Math.min(progress, 1) * circ} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
}

// ─── AVATAR (with photo support) ───
function Avatar({ user, size = 28, className = '' }) {
  const s = { width: size, height: size, minWidth: size };
  if (user?.photoURL) return <img src={user.photoURL} className={`rounded-full object-cover ${className}`} style={s} referrerPolicy="no-referrer" />;
  const letter = user?.username?.charAt(0)?.toUpperCase() || '?';
  return <div className={`rounded-full flex items-center justify-center font-black ${className}`} style={{ ...s, fontSize: size * 0.4 }}>{letter}</div>;
}

// ─── PUNISHMENT WHEEL ───
const PUNISHMENTS = [
  '☕ Buy winner coffee',
  '📸 Embarrassing post',
  '💪 50 pushups on camera',
  '🧺 Do winner\'s laundry',
  '🎤 Sing in public',
  '🍳 Cook winner a meal',
  '📱 No phone for 2hrs',
  '🏃 Run a mile on camera',
  '🤡 Wear a silly outfit to class',
  '📝 Write winner a compliment essay',
  '🧹 Clean winner\'s room',
  '🎬 Embarrassing TikTok',
];
function Modal({ show, onClose, children, wide, dark }) {
  if (!show) return null;
  const isDark = dark !== undefined ? dark : true;
  const mbg = isDark ? 'bg-[#122040] border-[#1e3050]' : 'bg-white border-[#dce4ee]';
  return (
    <div className="modal-overlay fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className={`modal-content rounded-2xl w-full p-6 border shadow-2xl max-h-[85vh] overflow-y-auto ${mbg} ` + (wide ? 'max-w-md' : 'max-w-sm')} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose, icon, dark }) {
  const isDark = dark !== undefined ? dark : true;
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">{icon}{typeof title === 'string' ? <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-[#1a1a1a]'}`}>{title}</h2> : title}</div>
      <button onClick={onClose} className={`${isDark ? 'text-[#5a5244] hover:text-white' : 'text-[#c4b9a8] hover:text-[#1a1a1a]'} transition-colors`}><X size={20} /></button>
    </div>
  );
}


class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'monospace', background: '#0f1b2d', color: '#ff6b6b', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>App Error</h1>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#ccc' }}>{this.state.error.toString()}</pre>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10, color: '#888', marginTop: 8 }}>{this.state.error.stack}</pre>
        <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '10px 20px', background: '#5b7cf5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Reload</button>
      </div>
    );
    return this.props.children;
  }
}

function VersaAppMain() {
  // ─── DATE HELPERS (must be before state that uses them) ───
  const formatDateStr = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const getToday = () => { const d = new Date(); return formatDateStr(d); };
  const getYesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return formatDateStr(d); };

  // ─── STATE ───
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('login'); // login | signup | forgot | onboarding | dashboard
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showStakes, setShowStakes] = useState(false);
  const [showSwitchRoom, setShowSwitchRoom] = useState(false);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [roomKicked, setRoomKicked] = useState([]);
  const [roomCreatedBy, setRoomCreatedBy] = useState(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);
  const [showPunishmentWheel, setShowPunishmentWheel] = useState(false);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState(null);
  const [devMode, setDevMode] = useState(() => {
    try { return localStorage.getItem('versa-devmode') === 'true'; } catch { return false; }
  });
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const logoTapRef = useRef({ count: 0, timer: null });
  const toggleDevMode = () => { const next = !devMode; setDevMode(next); try { localStorage.setItem('versa-devmode', next ? 'true' : 'false'); } catch { } };
  const [showHistory, setShowHistory] = useState(false);
  const [showEditHabit, setShowEditHabit] = useState(null);
  const [copied, setCopied] = useState(false);
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [allCompletions, setAllCompletions] = useState([]);
  const [historyCompletions, setHistoryCompletions] = useState([]);
  const [roomMembers, setRoomMembers] = useState([]);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showCompetitor, setShowCompetitor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState('today');
  const [timeDisplay, setTimeDisplay] = useState('');
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [streakData, setStreakData] = useState({});
  const [userRooms, setUserRooms] = useState([]);
  const [roomStakes, setRoomStakes] = useState(null);
  const [archivedStakes, setArchivedStakes] = useState([]);
  const [showSettleStake, setShowSettleStake] = useState(false);
  const [settleStakeData, setSettleStakeData] = useState({ winnerId: '', loserId: '' });
  const [newStake, setNewStake] = useState({ type: 'custom', description: '', duration: 'weekly' });
  const [stakeMode, setStakeMode] = useState('fixed'); // 'fixed' | 'wheel'
  const [wheelOptions, setWheelOptions] = useState([...PUNISHMENTS.slice(0, 5)]);
  const [newWheelOption, setNewWheelOption] = useState('');
  const [newHabit, setNewHabit] = useState({ name: '', category: 'Study', points: 10, isRepeatable: false, unit: '', description: '', isNegative: false });
  const [historyDate, setHistoryDate] = useState(null);
  const [editHabitData, setEditHabitData] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [weeklyWinner, setWeeklyWinner] = useState(null);
  const [yesterdayPoints, setYesterdayPoints] = useState(0);
  const [dateKey, setDateKey] = useState(getToday());
  const [editMode, setEditMode] = useState(false);
  const [habitOrder, setHabitOrder] = useState([]);
  const [showWeeklyRecap, setShowWeeklyRecap] = useState(false);
  const [lastWeekData, setLastWeekData] = useState(null);
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('versa-theme');
      if (stored === 'dark') return 'navy-dark';
      if (stored === 'light') return 'navy-light';
      return stored || 'navy-dark';
    } catch { return 'navy-dark'; }
  });
  const darkMode = theme.includes('dark');
  const isSunset = theme.includes('sunset');
  const [roomCategories, setRoomCategories] = useState([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(0);
  const [newCatIcon, setNewCatIcon] = useState('⭐');
  const [maxedHabit, setMaxedHabit] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [heatMapData, setHeatMapData] = useState({});
  const [heatMapRange, setHeatMapRange] = useState('30d');
  const [bonusMsg, setBonusMsg] = useState(null);
  const [rivalStatus, setRivalStatus] = useState([]);
  const [showInsights, setShowInsights] = useState(false);
  const [showActivityExpanded, setShowActivityExpanded] = useState(false);
  const [insightsData, setInsightsData] = useState(null);
  const [streakMilestone, setStreakMilestone] = useState(null);
  const [streakFreeze, setStreakFreeze] = useState(0);
  const [freezeMsg, setFreezeMsg] = useState(null);
  const [mutualStreaks, setMutualStreaks] = useState({});
  const [showStoryCards, setShowStoryCards] = useState(false);
  const [storyCardIdx, setStoryCardIdx] = useState(0);
  const [storyTheme, setStoryTheme] = useState('dark');
  const [myBoardIds, setMyBoardIds] = useState(null); // null = show all, array = custom selection
  const [showCustomBoard, setShowCustomBoard] = useState(false);
  const [customBoardHabits, setCustomBoardHabits] = useState([]);
  const [pendingBoards, setPendingBoards] = useState([]);
  const [boardRequests, setBoardRequests] = useState([]);

  const [dailyTarget, setDailyTarget] = useState(400);
  const [streakTarget, setStreakTarget] = useState(80);

  const getDynamicStreakTarget = (baseTarget, multi) => {
    if (multi >= 3) return Math.round(baseTarget * 4.5);
    if (multi >= 2.5) return Math.round(baseTarget * 3.5);
    if (multi >= 2) return Math.round(baseTarget * 2.5);
    if (multi >= 1.5) return Math.round(baseTarget * 1.75);
    return baseTarget;
  };

  useEffect(() => {
    if (currentUser) {
      try {
        const dt = localStorage.getItem(`versa-dt-${currentUser.id}`);
        const st = localStorage.getItem(`versa-st-${currentUser.id}`);
        if (dt) setDailyTarget(parseInt(dt));
        if (st) setStreakTarget(parseInt(st));
      } catch { }
    }
  }, [currentUser]);

  const updateTargets = (newDt, newSt) => {
    setDailyTarget(newDt);
    setStreakTarget(newSt);
    if (currentUser) {
      try {
        localStorage.setItem(`versa-dt-${currentUser.id}`, newDt);
        localStorage.setItem(`versa-st-${currentUser.id}`, newSt);
      } catch { }
    }
  };

  const prevProgRef = useRef(0);
  const [celebrateComplete, setCelebrateComplete] = useState(false);
  useEffect(() => {
    if (celebrateComplete) {
      setConfettiTrigger(v => v + 1);
      setTimeout(() => setConfettiTrigger(v => v + 1), 400);
      setCelebrateComplete(false);
    }
  }, [celebrateComplete]);

  // ─── HELPERS ───
  const genCode = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; };
  const getWeekStart = () => { const n = new Date(), d = n.getDay(); const m = new Date(n); m.setDate(m.getDate() - d); m.setHours(0, 0, 0, 0); return formatDateStr(m); };
  const getWeekEnd = () => { const ws = getWeekStart(); const d = new Date(ws + 'T12:00:00'); d.setDate(d.getDate() + 6); return formatDateStr(d); };
  const formatDate = (ds) => { const d = new Date(ds + 'T12:00:00'); return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
  const getDaysUntilReset = () => { const d = new Date(); const day = d.getDay(); return 6 - day; }; // Saturday = 0 days left, Sunday = 6
  const getLastWeekStart = () => { const d = new Date(getWeekStart() + 'T12:00:00'); d.setDate(d.getDate() - 7); return formatDateStr(d); };
  const getLastWeekEnd = () => { const d = new Date(getWeekStart() + 'T12:00:00'); d.setDate(d.getDate() - 1); return formatDateStr(d); };
  const THEMES = ['navy-dark', 'navy-light', 'sunset-dark', 'sunset-light'];
  const THEME_LABELS = { 'navy-dark': '🌙 Navy Dark', 'navy-light': '☀️ Navy Light', 'sunset-dark': '🌅 Sunset Dark', 'sunset-light': '🌇 Sunset Light' };
  const setAppTheme = (t) => { setTheme(t); try { localStorage.setItem('versa-theme', t); } catch { } };
  const toggleTheme = () => { const idx = THEMES.indexOf(theme); setAppTheme(THEMES[(idx + 1) % THEMES.length]); };
  const getOrderedHabits = (cat) => {
    const pool = habits;
    const ch = pool.filter(h => h.category === cat);
    if (!habitOrder.length) return ch;
    return [...ch].sort((a, b) => { const ai = habitOrder.indexOf(a.id), bi = habitOrder.indexOf(b.id); if (ai === -1 && bi === -1) return 0; if (ai === -1) return 1; if (bi === -1) return -1; return ai - bi; });
  };
  const saveHabitOrder = async (cat, newOrderedHabits) => {
    const orderId = currentUser.id + '_' + currentRoom.id;
    const otherIds = habitOrder.filter(id => { const h = habits.find(x => x.id === id); return h && h.category !== cat; });
    const newIds = newOrderedHabits.map(h => h.id);
    const allOrdered = [];
    allCatNames.forEach(c => { if (c === cat) allOrdered.push(...newIds); else { const catIds = otherIds.filter(id => { const h = habits.find(x => x.id === id); return h?.category === c; }); const unordered = habits.filter(h => h.category === c && !catIds.includes(h.id)).map(h => h.id); allOrdered.push(...catIds, ...unordered); } });
    setHabitOrder(allOrdered);
    try { await supabase.from('habit_order').upsert({ id: orderId, order_ids: allOrdered, user_id: currentUser.id, room_id: currentRoom.id }); } catch (err) { console.error(err); }
  };
  const getGreeting = () => { const h = new Date().getHours(); if (h < 5) return 'Burning the midnight oil'; if (h < 12) return 'Good morning'; if (h < 17) return 'Good afternoon'; if (h < 21) return 'Good evening'; return 'Night owl mode'; };
  const getMotivation = () => {
    const msgs = ["Let's crush it today", "Every rep counts", "Build the future you", "Small wins, big results", "Discipline equals freedom", "Level up today", "Outwork yesterday", "Stay locked in", "The grind pays off", "Consistency beats talent", "One day or day one", "Make it count", "Your only limit is you", "Champions train daily", "Focus mode activated"];
    return msgs[new Date().getDate() % msgs.length];
  };

  // ─── DEFAULT HABITS ───
  const loadDefaultHabits = async () => {
    const defaultHabits = [
      // STUDY — time-based
      { name: 'Deep work', category: 'Study', points: 15, is_repeatable: true, unit: 'per 30 min' },
      { name: 'Read', category: 'Study', points: 15, is_repeatable: true, unit: 'per 30 min' },
      // STUDY — completion-based
      { name: 'Small task', category: 'Study', points: 10, is_repeatable: true },
      { name: 'Big task', category: 'Study', points: 30, is_repeatable: true },
      // HEALTH — gym, sleep, nutrition
      { name: 'Hit the gym', category: 'Health', points: 20, is_repeatable: true, unit: 'per 30 min' },
      { name: 'Slept 7+ hours', category: 'Health', points: 30, is_repeatable: false },
      { name: 'Woke up before 7', category: 'Health', points: 30, is_repeatable: false },
      { name: 'Junk food', category: 'Health', points: -15, is_repeatable: true, unit: 'per meal/snack' },
      // FOCUS — mindset, productivity
      { name: 'Work done before 9pm', category: 'Focus', points: 30, is_repeatable: false },
    ];
    try {
      setLoading(true);
      const rows = defaultHabits.map(habit => {
        const id = currentRoom.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        return { id, ...habit, room_id: currentRoom.id, created_by: currentUser.id };
      });
      const { error } = await supabase.from('habits').insert(rows);
      if (error) throw error;
      setShowAddHabit(false);
      setConfettiTrigger(v => v + 1);
    } catch (err) { console.error(err); setError('Failed to load defaults: ' + err.message); } finally { setLoading(false); }
  };

  // ─── AUTH LISTENER ───
  useEffect(() => {
    // Deep link: check URL for ?join=CODE
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) { setRoomCode(joinCode.toUpperCase()); window.history.replaceState({}, '', window.location.pathname); }

    let mounted = true;

    const handleUser = async (user) => {
      if (!mounted) return;
      if (!user) { setCurrentUser(null); setAuthLoading(false); return; }
      try {
        const { data: ud } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
        if (!mounted) return;
        if (ud) {
          const data = { id: user.id, ...ud, photoURL: ud.photo_url || user.user_metadata?.avatar_url };
          setCurrentUser(data);
          const rooms = data.rooms || [];
          setUserRooms(rooms);
          const active = data.active_room || (rooms.length > 0 ? rooms[0] : null);
          if (active) {
            const { data: rd } = await supabase.from('rooms').select('*').eq('id', active).maybeSingle();
            if (rd) { setCurrentRoom({ id: rd.id, ...rd, code: rd.code || rd.id }); setRoomKicked(rd.kicked || []); setRoomCreatedBy(rd.created_by || null); setView('dashboard'); }
            else setShowRoomModal(true);
          } else setShowRoomModal(true);
        } else {
          const username = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
          await supabase.from('users').upsert({ id: user.id, username, email: user.email, photo_url: user.user_metadata?.avatar_url, rooms: [], streak_freeze: 0 });
          setCurrentUser({ id: user.id, username, email: user.email, photoURL: user.user_metadata?.avatar_url, rooms: [] });
          setShowRoomModal(true);
        }
      } catch (err) { console.error('Auth error:', err); }
      if (mounted) setAuthLoading(false);
    };

    // Check existing session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUser(session?.user || null);
    }).catch(() => { if (mounted) setAuthLoading(false); });

    // Listen for changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUser(session?.user || null);
    });

    return () => { mounted = false; subscription?.unsubscribe(); };
  }, []);

  // ─── REALTIME DATA ───
  useEffect(() => {
    if (!currentUser || !currentRoom) return;
    const subs = [];

    // Fetch habits
    const fetchHabits = async () => {
      const { data, error } = await supabase.from('habits').select('*').eq('room_id', currentRoom.id);
      if (error) { console.error('Fetch habits error:', error); return; }
      if (data) setHabits(data.map(h => ({ ...h, id: h.id, roomId: h.room_id, isRepeatable: h.is_repeatable, createdBy: h.created_by })));
    };
    fetchHabits();
    subs.push(supabase.channel('habits-' + currentRoom.id).on('postgres_changes', { event: '*', schema: 'public', table: 'habits', filter: 'room_id=eq.' + currentRoom.id }, () => setTimeout(fetchHabits, 300)).subscribe());

    // Fetch today's completions
    const today = getToday();
    const fetchCompletions = async () => {
      const { data, error } = await supabase.from('completions').select('*').eq('room_id', currentRoom.id).eq('date', today);
      if (error) { console.error('Fetch completions error:', error); return; }
      if (data) setCompletions(data.map(c => ({ ...c, id: c.id, userId: c.user_id, habitId: c.habit_id, roomId: c.room_id, habitName: c.habit_name, habitCategory: c.habit_category, habitPoints: c.habit_points, bonusPoints: c.bonus_points, streakMultiplier: c.streak_multiplier })));
    };
    fetchCompletions();
    subs.push(supabase.channel('completions-today-' + currentRoom.id).on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, () => setTimeout(fetchCompletions, 300)).subscribe());

    // Fetch weekly completions
    const ws = getWeekStart(), we = getWeekEnd();
    const fetchWeekly = async () => {
      const { data, error } = await supabase.from('completions').select('*').eq('room_id', currentRoom.id).gte('date', ws).lte('date', we);
      if (error) { console.error('Fetch weekly error:', error); return; }
      if (data) setAllCompletions(data.map(c => ({ ...c, id: c.id, userId: c.user_id, habitId: c.habit_id, roomId: c.room_id, habitName: c.habit_name, habitCategory: c.habit_category, habitPoints: c.habit_points, bonusPoints: c.bonus_points })));
    };
    fetchWeekly();
    subs.push(supabase.channel('completions-week-' + currentRoom.id).on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, () => setTimeout(fetchWeekly, 500)).subscribe());

    // Fetch members (users who have this room in their rooms array)
    const fetchMembers = async () => {
      const { data, error } = await supabase.from('users').select('*').contains('rooms', [currentRoom.id]);
      if (error) { console.error('Fetch members error:', error); return; }
      if (data) setRoomMembers(data.map(u => ({ ...u, id: u.id, username: u.username, email: u.email, photoURL: u.photo_url, roomId: u.active_room, streakFreeze: u.streak_freeze, emailReminders: u.email_reminders })));
    };
    fetchMembers();
    subs.push(supabase.channel('members-' + currentRoom.id).on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => setTimeout(fetchMembers, 300)).subscribe());

    // Fetch stakes
    const fetchStakes = async () => {
      const { data } = await supabase.from('stakes').select('*').eq('room_id', currentRoom.id).eq('active', true).maybeSingle();
      if (data) setRoomStakes({ ...data, id: data.id, roomId: data.room_id, createdBy: data.created_by });
      else setRoomStakes(null);
    };
    fetchStakes();
    subs.push(supabase.channel('stakes-' + currentRoom.id).on('postgres_changes', { event: '*', schema: 'public', table: 'stakes' }, () => setTimeout(fetchStakes, 300)).subscribe());

    // Fetch archived stakes
    const fetchArchived = async () => {
      const { data } = await supabase.from('archived_stakes').select('*').eq('room_id', currentRoom.id).order('date_archived', { ascending: false });
      if (data) setArchivedStakes(data);
    };
    fetchArchived();
    subs.push(supabase.channel('archived-stakes-' + currentRoom.id).on('postgres_changes', { event: '*', schema: 'public', table: 'archived_stakes' }, () => setTimeout(fetchArchived, 300)).subscribe());

    // Fetch room categories
    const fetchCats = async () => {
      const { data } = await supabase.from('room_categories').select('*').eq('room_id', currentRoom.id).maybeSingle();
      if (data?.categories) setRoomCategories(data.categories);
      else setRoomCategories([]);
    };
    fetchCats();

    // Fetch activity feed
    const fetchActivity = async () => {
      const { data } = await supabase.from('activity').select('*').eq('room_id', currentRoom.id).eq('date', today).order('ts', { ascending: false }).limit(20);
      if (data) setActivityFeed(data.map(a => ({ ...a, id: a.id, userId: a.user_id, roomId: a.room_id })));
    };
    fetchActivity();
    subs.push(supabase.channel('activity-' + currentRoom.id).on('postgres_changes', { event: '*', schema: 'public', table: 'activity', filter: 'room_id=eq.' + currentRoom.id }, () => { setTimeout(fetchActivity, 300); setTimeout(fetchWeekly, 500); }).subscribe());

    // Fetch personal board
    const fetchBoard = async () => {
      const boardId = currentUser.id + '_' + currentRoom.id;
      const { data } = await supabase.from('my_board').select('*').eq('id', boardId).maybeSingle();
      if (data?.habit_ids) setMyBoardIds(data.habit_ids);
      else setMyBoardIds(null);
    };
    fetchBoard();

    // Fetch habit order
    const fetchOrder = async () => {
      const orderId = currentUser.id + '_' + currentRoom.id;
      const { data } = await supabase.from('habit_order').select('*').eq('id', orderId).maybeSingle();
      if (data?.order_ids) setHabitOrder(data.order_ids);
      else setHabitOrder([]);
    };
    fetchOrder();

    // Fetch board proposals
    const fetchProposals = async () => {
      const { data } = await supabase.from('board_proposals').select('*').eq('room_id', currentRoom.id);
      if (data) {
        const boards = data.map(b => ({ ...b, id: b.id, userId: b.user_id, roomId: b.room_id, habitIds: b.habit_ids }));
        setPendingBoards(boards);
        setBoardRequests(boards.filter(b => b.status === 'pending' && b.userId !== currentUser.id && !(b.approvals || []).includes(currentUser.id) && !(b.rejections || []).includes(currentUser.id)));
      }
    };
    fetchProposals();

    return () => { subs.forEach(s => supabase.removeChannel(s)); };
  }, [currentUser, currentRoom, dateKey]);

  // ─── LOAD ROOM KICKED LIST ───
  useEffect(() => {
    if (!currentRoom) { setRoomKicked([]); setRoomCreatedBy(null); return; }
    const load = async () => {
      try {
        const { data: rd } = await supabase.from('rooms').select('*').eq('id', currentRoom.id).maybeSingle();
        if (rd) {
          setRoomKicked(rd.kicked || []);
          setRoomCreatedBy(rd.created_by || null);
        }
      } catch { }
    };
    load();
    const sub = supabase.channel('room-kicked-' + currentRoom.id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: 'id=eq.' + currentRoom.id }, () => setTimeout(load, 300)).subscribe();
    return () => supabase.removeChannel(sub);
  }, [currentRoom?.id]);

  // ─── LAST WEEK DATA (for recap) ───
  useEffect(() => {
    if (!currentUser || !currentRoom || activeMembers.length < 1) return;
    const loadLastWeek = async () => {
      try {
        const lws = getLastWeekStart(), lwe = getLastWeekEnd();
        const { data: snapData } = await supabase.from('completions').select('*').eq('room_id', currentRoom.id).gte('date', lws).lte('date', lwe);
        const comps = (snapData || []).map(d => ({ id: d.id, ...d, userId: d.user_id, habitId: d.habit_id, habitPoints: d.habit_points, bonusPoints: d.bonus_points, habitCategory: d.habit_category }));
        if (!comps.length) { setLastWeekData(null); return; }
        const scores = activeMembers.map(m => {
          const mc = comps.filter(c => c.userId === m.id);
          const pts = mc.reduce((s, c) => { const h = habits.find(x => x.id === c.habitId); return s + ((c.habitPoints || h?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0); }, 0);
          const catPts = {}; allCatNames.forEach(c => catPts[c] = 0);
          mc.forEach(c => { const h = habits.find(x => x.id === c.habitId); const cat = h?.category || c.habitCategory || 'Study'; catPts[cat] += ((c.habitPoints || h?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0); });
          const activeDays = [...new Set(mc.map(c => c.date))].length;
          return { member: m, pts, catPts, activeDays, completions: mc.length };
        }).sort((a, b) => b.pts - a.pts);
        setLastWeekData({ scores, dateRange: formatDate(lws) + ' — ' + formatDate(lwe) });
      } catch { setLastWeekData(null); }
    };
    loadLastWeek();
  }, [currentUser, currentRoom, roomMembers, roomKicked, habits]);

  // ─── STREAK + YESTERDAY ───
  useEffect(() => {
    if (!currentUser || !currentRoom) return;
    const calc = async () => {
      try {
        const ago = new Date(); ago.setDate(ago.getDate() - 60);
        const { data: snapData } = await supabase.from('completions').select('*').eq('user_id', currentUser.id).gte('date', formatDateStr(ago));
        const allDocs = (snapData || []).map(d => ({ ...d, habitPoints: d.habit_points, bonusPoints: d.bonus_points, habitId: d.habit_id, userId: d.user_id, roomId: d.room_id }));

        // Calculate which dates hit 20% of daily target (60pts)
        const qualifyingDates = new Set();
        const datePts = {};
        const dateMultis = {};
        allDocs.forEach(d => {
          if (!datePts[d.date]) datePts[d.date] = 0;
          datePts[d.date] += ((d.habitPoints || habits.find(h => h.id === d.habitId)?.points || 0) * (d.count || 1)) + (d.bonusPoints || 0);
          if ((d.streak_multiplier || 1) > (dateMultis[d.date] || 0)) dateMultis[d.date] = d.streak_multiplier || 1;
        });
        Object.entries(datePts).forEach(([date, pts]) => {
          const multi = dateMultis[date] || 1;
          if (pts >= getDynamicStreakTarget(streakTarget, multi)) qualifyingDates.add(date);
        });

        const dates = [...qualifyingDates].sort().reverse();
        let streak = 0;
        const today = getToday(), yStr = getYesterday();

        // Load freeze from user doc
        const { data: userSnap } = await supabase.from('users').select('streak_freeze').eq('id', currentUser.id).maybeSingle();
        const savedFreeze = userSnap?.streak_freeze || 0;
        setStreakFreeze(savedFreeze);

        if (dates.includes(today) || dates.includes(yStr)) {
          let check = dates.includes(today) ? new Date() : new Date(Date.now() - 86400000);
          let freezeUsed = false;
          while (true) {
            const ds = formatDateStr(check);
            if (dates.includes(ds)) {
              streak++;
              check.setDate(check.getDate() - 1);
            } else if (!freezeUsed && savedFreeze > 0 && streak > 0) {
              freezeUsed = true;
              check.setDate(check.getDate() - 1);
            } else {
              break;
            }
          }
          if (freezeUsed && savedFreeze > 0) {
            await supabase.from('users').update({ streak_freeze: 0 }).eq('id', currentUser.id);
            setStreakFreeze(0);
            setFreezeMsg('🛡️ Streak freeze saved your streak!');
            setTimeout(() => setFreezeMsg(null), 4000);
          }
        }

        // Yesterday's points for solo mode
        const yComps = allDocs.filter(d => d.date === yStr && d.roomId === currentRoom.id);
        let yPts = 0;
        yComps.forEach(d => {
          const pts = d.habitPoints || habits.find(h => h.id === d.habitId)?.points || 0;
          yPts += pts * (d.count || 1);
        });
        setYesterdayPoints(yPts);
        // Check for streak milestone
        const milestones = [60, 30, 14, 7, 3];
        const prevStreak = streakData.streak || 0;
        if (streak > prevStreak) {
          const crossed = milestones.find(m => streak >= m && prevStreak < m);
          if (crossed) {
            const tierNames = { 3: 'Building 1.5×', 7: 'Consistent 2×', 14: 'Dedicated 2.5×', 30: 'Legend 3×' };
            setStreakMilestone({ days: crossed, tier: tierNames[crossed] });
            setConfettiTrigger(v => v + 1);
            setTimeout(() => setStreakMilestone(null), 4000);
          }
        }
        setStreakData({ streak, activeDays: dates.length, totalCompletions: allDocs.reduce((s, d) => s + (d.count || 1), 0) });
      } catch (err) { console.error(err); setStreakData({ streak: 0, activeDays: 0, totalCompletions: 0 }); }
    };
    calc();
  }, [currentUser, currentRoom, completions, habits, streakTarget]);

  // ─── MUTUAL STREAKS (Snapchat-style between pairs) ───
  useEffect(() => {
    if (!currentUser || !currentRoom || activeMembers.length < 2) { setMutualStreaks({}); return; }
    const calc = async () => {
      try {
        const ago = new Date(); ago.setDate(ago.getDate() - 60);
        const { data: snapData2 } = await supabase.from('completions').select('*').eq('room_id', currentRoom.id).gte('date', formatDateStr(ago));
        const allDocs = (snapData2 || []).map(d => ({ ...d, userId: d.user_id, habitPoints: d.habit_points, bonusPoints: d.bonus_points }));

        // Build a map of userId -> Set of qualifying dates (dynamic streakTarget+ pts)
        const userDates = {};
        const userDateMultis = {};
        activeMembers.forEach(m => { userDates[m.id] = {}; userDateMultis[m.id] = {}; });
        allDocs.forEach(d => {
          if (!userDates[d.userId]) return;
          if (!userDates[d.userId][d.date]) { userDates[d.userId][d.date] = 0; userDateMultis[d.userId][d.date] = 1; }
          userDates[d.userId][d.date] += ((d.habitPoints || 0) * (d.count || 1)) + (d.bonusPoints || 0);
          if ((d.streak_multiplier || 1) > userDateMultis[d.userId][d.date]) userDateMultis[d.userId][d.date] = d.streak_multiplier || 1;
        });
        const userQualDates = {};
        Object.entries(userDates).forEach(([uid, dates]) => {
          userQualDates[uid] = new Set(Object.entries(dates).filter(([date, pts]) => pts >= getDynamicStreakTarget(streakTarget, userDateMultis[uid]?.[date] || 1)).map(([date]) => date));
        });

        // For each pair (me + rival), count consecutive days both qualified
        const myId = currentUser.id;
        const myDates = userQualDates[myId] || new Set();
        const streaks = {};
        activeMembers.forEach(m => {
          if (m.id === myId) return;
          const theirDates = userQualDates[m.id] || new Set();
          let streak = 0;
          let check = new Date();
          // Start from today or yesterday
          const todayStr = formatDateStr(check);
          const yStr = formatDateStr(new Date(Date.now() - 86400000));
          const bothToday = myDates.has(todayStr) && theirDates.has(todayStr);
          const bothYesterday = myDates.has(yStr) && theirDates.has(yStr);
          if (!bothToday && !bothYesterday) { streaks[m.id] = 0; return; }
          if (!bothToday) check = new Date(Date.now() - 86400000);
          while (true) {
            const ds = formatDateStr(check);
            if (myDates.has(ds) && theirDates.has(ds)) {
              streak++;
              check.setDate(check.getDate() - 1);
            } else break;
          }
          streaks[m.id] = streak;
        });
        setMutualStreaks(streaks);
      } catch (err) { console.error('Mutual streaks error:', err); }
    };
    calc();
  }, [currentUser, currentRoom, completions, roomMembers, roomKicked, streakTarget]);

  // ─── WEEKLY WINNER ───
  useEffect(() => {
    if (!currentRoom || activeMembers.length < 2 || allCompletions.length === 0) { setWeeklyWinner(null); return; }
    // Check if we're past Sunday (i.e. it's a new week and last week had data)
    const today = getToday();
    const ws = getWeekStart();
    // Calculate last week's winner from allCompletions that might span into prev week
    // Actually, let's compute current week leader as "projected winner"
    const scores = activeMembers.map(m => ({
      member: m,
      pts: allCompletions.filter(c => c.userId === m.id && c.date >= ws && c.date <= today).reduce((s, c) => {
        const h = habits.find(hb => hb.id === c.habitId);
        return s + ((c.habitPoints || h?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0);
      }, 0)
    })).sort((a, b) => b.pts - a.pts);
    if (scores.length > 0 && scores[0].pts > 0) {
      const isTied = scores.length > 1 && scores[0].pts === scores[1].pts;
      setWeeklyWinner(isTied ? null : { ...scores[0], daysLeft: getDaysUntilReset() });
    } else setWeeklyWinner(null);
  }, [roomMembers, roomKicked, allCompletions, habits, currentRoom]);

  // ─── RIVAL STATUS (what your competition is doing today) ───
  useEffect(() => {
    if (!currentUser || !currentRoom || activeMembers.length < 1) { setRivalStatus([]); return; }
    const today = getToday();
    const rivals = activeMembers.map(m => {
      const todayComps = completions.filter(c => c.userId === m.id && c.date === today);
      const pts = todayComps.reduce((s, c) => { const h = habits.find(x => x.id === c.habitId); return s + ((c.habitPoints || h?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0); }, 0);
      const habitCount = todayComps.length;
      const weekPts = allCompletions.filter(c => c.userId === m.id && c.date >= getWeekStart() && c.date <= getWeekEnd()).reduce((s, c) => { const h = habits.find(x => x.id === c.habitId); return s + ((c.habitPoints || h?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0); }, 0);
      return { member: m, pts, habitCount, weekPts };
    }).sort((a, b) => b.pts - a.pts);
    setRivalStatus(rivals);
  }, [currentUser, currentRoom, roomMembers, roomKicked, completions, allCompletions, habits]);

  // ─── HEAT MAP (load on demand) ───
  const loadHeatMap = async () => {
    if (!currentUser || !currentRoom) return;
    try {
      const ago = new Date(); ago.setDate(ago.getDate() - 365);
      const agoStr = formatDateStr(ago);
      const { data: heatData2 } = await supabase.from('completions').select('*').eq('user_id', currentUser.id).eq('room_id', currentRoom.id).gte('date', agoStr);
      const map = {};
      (heatData2 || []).forEach(d => {
        const basePts = d.habit_points || habits.find(h => h.id === d.habit_id)?.points || 0;
        const pts = (basePts * (d.count || 1)) + (d.bonus_points || 0);
        if (pts > 0) map[d.date] = (map[d.date] || 0) + pts;
      });
      setHeatMapData(map);
      setShowHeatMap(true);
    } catch (err) { console.error('Heat map error:', err); setShowHeatMap(true); }
  };

  // ─── ROOM ROLES (computed from performance) ───
  const getRoomRole = (uid) => {
    if (!currentRoom) return null;
    if ((roomCreatedBy || currentRoom.createdBy) === uid) {
      if (weeklyWinner?.member?.id === uid) return { role: 'Champion', icon: '👑', color: 'text-[#e8864a]' };
      return { role: 'Creator', icon: '⚡', color: 'text-blue-400' };
    }
    if (weeklyWinner?.member?.id === uid) return { role: 'Defender', icon: '🛡️', color: 'text-[#e8864a]' };
    if (lastWeekData?.scores) {
      const lastIdx = lastWeekData.scores.findIndex(s => s.member.id === uid);
      if (lastIdx === lastWeekData.scores.length - 1 && lastWeekData.scores.length > 1) return { role: 'Underdog', icon: '🔥', color: 'text-red-400' };
    }
    const myWeekPts = allCompletions.filter(c => c.userId === uid && c.date >= getWeekStart() && c.date <= getWeekEnd()).reduce((s, c) => { const h = habits.find(x => x.id === c.habitId); return s + ((c.habitPoints || h?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0); }, 0);
    if (weeklyWinner && myWeekPts > 0 && myWeekPts >= (weeklyWinner.pts * 0.8)) return { role: 'Challenger', icon: '⚔️', color: 'text-purple-400' };
    return null;
  };

  // ─── PERSONAL INSIGHTS (load on demand) ───
  const loadInsights = async () => {
    if (!currentUser || !currentRoom) return;
    try {
      const ago = new Date(); ago.setDate(ago.getDate() - 60);
      const { data: insightData2 } = await supabase.from('completions').select('*').eq('user_id', currentUser.id).eq('room_id', currentRoom.id).gte('date', formatDateStr(ago));
      const snap = { docs: (insightData2 || []).map(d => ({ data: () => ({ ...d, habitId: d.habit_id, habitCategory: d.habit_category }) })) };
      const comps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!comps.length) { setInsightsData({ empty: true }); setShowInsights(true); return; }
      const dayMap = {};
      comps.forEach(c => { dayMap[c.date] = (dayMap[c.date] || 0) + 1; });
      const activeDays = Object.keys(dayMap).length;
      const avgPerDay = activeDays > 0 ? (comps.length / activeDays).toFixed(1) : 0;
      const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
      const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      comps.forEach(c => { const d = new Date(c.date + 'T12:00:00'); weekdayCounts[d.getDay()] += (c.count || 1); });
      const bestDayIdx = weekdayCounts.indexOf(Math.max(...weekdayCounts));
      const worstDayIdx = weekdayCounts.indexOf(Math.min(...weekdayCounts));
      const habitDays = {};
      comps.forEach(c => { if (!habitDays[c.habitId]) habitDays[c.habitId] = new Set(); habitDays[c.habitId].add(c.date); });
      let bestHabit = null, bestHabitDays = 0;
      Object.entries(habitDays).forEach(([hid, days]) => { if (days.size > bestHabitDays) { bestHabitDays = days.size; bestHabit = hid; } });
      const bestHabitName = habits.find(h => h.id === bestHabit)?.name || comps.find(c => c.habitId === bestHabit)?.habitName || 'Unknown';
      const totalPts = comps.reduce((s, c) => s + ((c.habitPoints || 0) * (c.count || 1)) + (c.bonusPoints || 0), 0);
      const avgPtsPerDay = activeDays > 0 ? Math.round(totalPts / activeDays) : 0;
      const completionRate = Math.round((activeDays / 60) * 100);
      const bestStreak = (() => {
        const dates = Object.keys(dayMap).sort(); let max = 0, cur = 0;
        for (let i = 0; i < dates.length; i++) {
          if (i === 0) { cur = 1; } else {
            const diff = (new Date(dates[i] + 'T12:00:00') - new Date(dates[i - 1] + 'T12:00:00')) / 86400000;
            cur = diff === 1 ? cur + 1 : 1;
          }
          if (cur > max) max = cur;
        }
        return max;
      })();
      setInsightsData({ avgPerDay, bestDay: weekdayNames[bestDayIdx], worstDay: weekdayNames[worstDayIdx], bestHabitName, bestHabitDays, completionRate, activeDays, totalPts, avgPtsPerDay, bestStreak, weekdayCounts, weekdayNames });
      setShowInsights(true);
    } catch (err) { console.error(err); setShowInsights(true); }
  };

  // ─── CUSTOM BOARDS ───
  // ─── PERSONAL BOARD ───
  const toggleHabitOnBoard = async (habitId) => {
    if (!currentUser || !currentRoom) return;
    const boardDocId = currentUser.id + '_' + currentRoom.id;
    const current = myBoardIds || habits.map(h => h.id);
    const updated = current.includes(habitId)
      ? current.filter(id => id !== habitId)
      : [...current, habitId];
    if (updated.length === 0) return; // can't have empty board
    try {
      await supabase.from('my_board').upsert({ id: boardDocId, habit_ids: updated, user_id: currentUser.id, room_id: currentRoom.id });
    } catch { }
  };
  const resetBoard = async () => {
    if (!currentUser || !currentRoom) return;
    try { await supabase.from('my_board').delete().eq('id', currentUser.id + '_' + currentRoom.id); } catch { }
  };
  const isOnBoard = (habitId) => !myBoardIds || myBoardIds.includes(habitId);
  const boardActive = myBoardIds !== null;

  // Custom board proposals (for approval flow)
  const proposeCustomBoard = async (selectedHabitIds) => {
    if (!currentUser || !currentRoom || !selectedHabitIds.length) return;
    try {
      const boardId = currentUser.id + '_' + currentRoom.id;
      const otherMembers = activeMembers.filter(m => m.id !== currentUser.id).length;
      if (otherMembers === 0) {
        // Solo mode: apply directly, no approval needed
        await supabase.from('my_board').upsert({ id: boardId, habit_ids: selectedHabitIds, user_id: currentUser.id, room_id: currentRoom.id });
        await supabase.from('board_proposals').upsert({ id: boardId, room_id: currentRoom.id, user_id: currentUser.id, username: currentUser.username, habit_ids: selectedHabitIds, status: 'pending' });
        setShowCustomBoard(false); setSuccessMsg('Board applied!'); setTimeout(() => setSuccessMsg(''), 2000);
      } else {
        await supabase.from('board_proposals').upsert({ id: boardId, room_id: currentRoom.id, user_id: currentUser.id, username: currentUser.username, habit_ids: customBoardHabits, status: 'pending' });
        setShowCustomBoard(false); setSuccessMsg('Board submitted for approval!'); setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch { setError('Failed to submit board'); }
  };
  const voteOnBoard = async (boardDoc, approve) => {
    try {
      const boardRef = boardDoc.id;
      const field = approve ? 'approvals' : 'rejections';
      const other = approve ? 'rejections' : 'approvals';
      const updList = [...(boardDoc[field] || []).filter(id => id !== currentUser.id), currentUser.id];
      const otherList = (boardDoc[other] || []).filter(id => id !== currentUser.id);
      const otherMembers = activeMembers.filter(m => m.id !== boardDoc.userId).length;
      const needed = Math.max(1, Math.ceil(otherMembers / 2));
      let status = boardDoc.status;
      if (approve && updList.length >= needed) status = 'approved';
      if (!approve && updList.length >= needed) status = 'rejected';
      await supabase.from('board_proposals').update({ [field]: updList, [other]: otherList, status }).eq('id', boardRef);
      // If approved, apply to the user's personal board
      if (status === 'approved') {
        await supabase.from('my_board').upsert({ id: boardDoc.user_id + '_' + currentRoom.id, habit_ids: boardDoc.habit_ids || boardDoc.habitIds, user_id: boardDoc.user_id || boardDoc.userId, room_id: currentRoom.id });
      }
    } catch { }
  };

  // ─── TIMER + MIDNIGHT RESET ───
  useEffect(() => {
    const update = () => {
      const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0);
      const d = m - n;
      setTimeDisplay(Math.floor(d / 3600000) + 'h ' + Math.floor((d % 3600000) / 60000) + 'm');
      // Check if date changed (midnight crossed) — triggers re-subscribe
      const today = getToday();
      setDateKey(prev => { if (prev !== today) return today; return prev; });
    };
    update(); const iv = setInterval(update, 30000); return () => clearInterval(iv);
  }, []);

  const freezeEarnedRef = useRef(false);
  useEffect(() => {
    if (!currentUser || !currentRoom) return;
    // Calculate progress inline (points / daily target)
    const dh = habits;
    if (!dh.length) return;
    const pts = completions.filter(c => c.userId === currentUser.id && c.date === getToday()).reduce((s, c) => { return s + ((c.habitPoints || habits.find(x => x.id === c.habitId)?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0); }, 0);
    const prog = Math.min(pts / dailyTarget, 1);
    if (prog >= 0.9 && streakFreeze === 0 && !freezeEarnedRef.current) {
      freezeEarnedRef.current = true;
      const award = async () => {
        try {
          await supabase.from('users').update({ streak_freeze: 1 }).eq('id', currentUser.id);
          setStreakFreeze(1);
          setFreezeMsg('🛡️ Streak freeze earned! Complete 90% tomorrow to earn another.');
          setTimeout(() => setFreezeMsg(null), 4000);
        } catch { }
      };
      award();
    } else if (prog < 0.9 && freezeEarnedRef.current && streakFreeze > 0) {
      // Progress dropped below 90% — revoke the freeze earned today
      freezeEarnedRef.current = false;
      const revoke = async () => {
        try {
          await supabase.from('users').update({ streak_freeze: 0 }).eq('id', currentUser.id);
          setStreakFreeze(0);
        } catch { }
      };
      revoke();
    }
  }, [currentUser, currentRoom, completions, habits, streakFreeze, dailyTarget]);
  useEffect(() => { freezeEarnedRef.current = false; }, [dateKey]);

  // ─── AUTH HANDLERS ───
  const handleSignup = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    if (!username.trim()) { setError('Username required'); setLoading(false); return; }
    try {
      const { data, error: authErr } = await supabase.auth.signUp({ email, password });
      if (authErr) throw authErr;
      if (data?.user) {
        await supabase.from('users').upsert({ id: data.user.id, username: username.trim(), email, rooms: [], streak_freeze: 0 });
      }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;
    } catch (err) { setError(err.message || 'Invalid email or password'); } finally { setLoading(false); }
  };
  const handleForgotPassword = async (e) => {
    e.preventDefault(); setError(''); setSuccessMsg(''); setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.resetPasswordForEmail(email);
      if (authErr) throw authErr;
      setSuccessMsg('Reset link sent! Check your email.');
    } catch (err) { setError(err.message || 'Could not send reset email.'); } finally { setLoading(false); }
  };
  const handleGoogleSignIn = async () => {
    setError(''); setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (authErr) throw authErr;
      // After redirect, the onAuthStateChange handler will create the user profile
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  // ─── ROOM ───
  const createRoom = async () => {
    setError(''); setLoading(true);
    try {
      const code = genCode();
      await supabase.from('rooms').insert({ id: code, code, created_by: currentUser.id, kicked: [] });
      const nr2 = [...new Set([...(userRooms || []), code])]; await supabase.from('users').update({ rooms: nr2, active_room: code }).eq('id', currentUser.id);
      setUserRooms(p => [...p, code]); setCurrentRoom({ id: code, code }); setShowRoomModal(false); setShowInviteModal(true); setView('dashboard');
    } catch (err) { setError('Failed: ' + err.message); } finally { setLoading(false); }
  };
  const joinRoom = async () => {
    setError(''); setLoading(true);
    const code = roomCode.trim().toUpperCase();
    if (!code) { setError('Enter room code'); setLoading(false); return; }
    try {
      const { data: rd2 } = await supabase.from('rooms').select('*').eq('id', code).maybeSingle();
      if (!rd2) { setError('Room not found'); setLoading(false); return; }
      const nr2 = [...new Set([...(userRooms || []), code])]; await supabase.from('users').update({ rooms: nr2, active_room: code }).eq('id', currentUser.id);
      setUserRooms(p => p.includes(code) ? p : [...p, code]); setCurrentRoom({ id: code, ...rd2, code: rd2.code || code }); setShowRoomModal(false); setShowSwitchRoom(false); setView('dashboard'); setRoomCode('');
    } catch (err) { setError('Failed: ' + err.message); } finally { setLoading(false); }
  };
  const switchRoom = async (rid) => {
    setLoading(true);
    try {
      const { data: rd3 } = await supabase.from('rooms').select('*').eq('id', rid).maybeSingle();
      if (rd3) { await supabase.from('users').update({ active_room: rid }).eq('id', currentUser.id); setCurrentRoom({ id: rd3.id, ...rd3, code: rd3.code || rd3.id }); setRoomKicked(rd3.kicked || []); setRoomCreatedBy(rd3.created_by || null); setShowSwitchRoom(false); }
    } catch { setError('Failed to switch'); } finally { setLoading(false); }
  };
  const leaveRoom = async (rid) => {
    if (!confirm('Leave this room?')) return;
    try {
      const newRooms = (userRooms || []).filter(r => r !== rid);
      await supabase.from('users').update({ rooms: newRooms }).eq('id', currentUser.id);
      const nr = userRooms.filter(r => r !== rid); setUserRooms(nr);
      if (currentRoom?.id === rid) { if (nr.length > 0) switchRoom(nr[0]); else { await supabase.from('users').update({ active_room: null }).eq('id', currentUser.id); setCurrentRoom(null); setShowRoomModal(true); } }
    } catch (err) { console.error(err); }
  };
  const copyCode = () => { navigator.clipboard.writeText(currentRoom.code); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ─── ROOM CREATOR PERMISSIONS ───
  const isRoomCreator = (roomCreatedBy || currentRoom?.createdBy) === currentUser?.id;
  const kickedIds = roomKicked;
  const activeMembers = roomMembers.filter(m => !kickedIds.includes(m.id));
  const kickMember = async (uid) => {
    if (!isRoomCreator || uid === currentUser.id) return;
    const m = activeMembers.find(x => x.id === uid);
    if (!confirm(`Remove ${m?.username || 'this member'} from the room?`)) return;
    try {
      const kickedList = [...(roomKicked || []), uid]; await supabase.from('rooms').update({ kicked: kickedList }).eq('id', currentRoom.id);
      setRoomKicked(prev => [...prev, uid]);
      setSuccessMsg(`${m?.username || 'Member'} removed`); setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err) { console.error(err); setError('Failed to remove member'); }
  };
  const clearAllHabits = async () => {
    if (!isRoomCreator) return;
    if (!confirm('Delete ALL habits in this room? This cannot be undone.')) return;
    try {
      await supabase.from('habits').delete().eq('room_id', currentRoom.id);
      setSuccessMsg('All habits cleared'); setTimeout(() => setSuccessMsg(''), 2000);
    } catch { setError('Failed to clear habits'); }
  };
  const transferOwnership = async (uid) => {
    if (!isRoomCreator || uid === currentUser.id) return;
    const m = activeMembers.find(x => x.id === uid);
    if (!confirm(`Transfer room ownership to ${m?.username || 'this member'}? You will lose creator permissions.`)) return;
    try {
      await supabase.from('rooms').update({ created_by: uid }).eq('id', currentRoom.id);
      setRoomCreatedBy(uid);
      setSuccessMsg('Ownership transferred'); setTimeout(() => setSuccessMsg(''), 2000);
    } catch { setError('Failed to transfer'); }
  };

  // ─── STAKES ───
  const saveStake = async () => {
    let finalDesc = newStake.description.trim();
    let finalType = newStake.type;

    if (stakeMode === 'wheel') {
      if (wheelOptions.length < 2) { setError('Add at least 2 wheel options'); return; }
      finalDesc = JSON.stringify(wheelOptions);
      finalType = 'wheel';
    } else {
      if (!finalDesc) { setError('Type a stake description'); return; }
    }

    if (!currentRoom?.id || !currentUser?.id) { setError('No room selected'); return; }
    setLoading(true); setError('');
    try {
      await supabase.from('stakes').upsert({ id: currentRoom.id, room_id: currentRoom.id, type: finalType, description: finalDesc, duration: newStake.duration, created_by: currentUser.id, active: true });
      setNewStake({ type: 'custom', description: '', duration: 'weekly' });
      setStakeMode('fixed');
      setShowStakes(false);
    } catch (err) { console.error('Stakes error:', err); setError(err.message || 'Failed to save'); }
    finally { setLoading(false); }
  };
  const clearStake = async () => { if (!isRoomCreator && roomStakes?.createdBy !== currentUser?.id) return; if (!confirm('Remove stake?')) return; try { await supabase.from('stakes').delete().eq('id', currentRoom.id); setRoomStakes(null); } catch { } };

  const archiveStake = async () => {
    if (!settleStakeData.winnerId || !settleStakeData.loserId) { setError('Select both a winner and a loser.'); return; }
    if (settleStakeData.winnerId === settleStakeData.loserId) { setError('Winner and loser cannot be the same person.'); return; }
    setLoading(true); setError('');
    try {
      await supabase.from('archived_stakes').insert({
        room_id: currentRoom.id,
        description: roomStakes.description,
        type: roomStakes.type,
        winner_id: settleStakeData.winnerId,
        loser_id: settleStakeData.loserId,
        date_archived: getToday()
      });
      await supabase.from('stakes').delete().eq('id', currentRoom.id);
      setRoomStakes(null);
      setShowSettleStake(false);
      setSettleStakeData({ winnerId: '', loserId: '' });
      setConfettiTrigger(v => v + 1);
      setSuccessMsg('Stake settled into Trophy Room!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to archive stake (You might need to create the table first in Supabase)');
    } finally {
      setLoading(false);
    }
  };

  // ─── HABITS (CREATE, EDIT, DELETE) ───
  const addHabit = async () => {
    if (!newHabit.name.trim()) return;
    const hid = currentRoom.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const finalPoints = (parseInt(newHabit.points) || 10) * (newHabit.isNegative ? -1 : 1);
    // Optimistic update
    setHabits(prev => [...prev, { id: hid, name: newHabit.name.trim(), category: newHabit.category, points: finalPoints, isRepeatable: newHabit.isRepeatable, unit: newHabit.unit?.trim() || null, description: newHabit.description?.trim() || null, roomId: currentRoom.id, createdBy: currentUser.id }]);
    setNewHabit({ name: '', category: 'Study', points: 10, isRepeatable: false, isNegative: false, unit: '', description: '' }); setShowAddHabit(false);
    try {
      await supabase.from('habits').insert({
        id: hid, name: newHabit.name.trim(), category: newHabit.category, points: finalPoints,
        is_repeatable: newHabit.isRepeatable,
        unit: newHabit.unit?.trim() || null, description: newHabit.description?.trim() || null,
        room_id: currentRoom.id, created_by: currentUser.id
      });
      if (myBoardIds) {
        const boardDocId = currentUser.id + '_' + currentRoom.id;
        await supabase.from('my_board').upsert({ id: boardDocId, habit_ids: [...myBoardIds, hid], user_id: currentUser.id, room_id: currentRoom.id });
      }
    } catch { setError('Failed to add'); }
  };
  const saveEditHabit = async () => {
    if (!showEditHabit || !editHabitData.name?.trim()) return;
    const hid = showEditHabit;
    const finalPoints = (parseInt(editHabitData.points) || 10) * (editHabitData.isNegative ? -1 : 1);
    // Optimistic update
    setHabits(prev => prev.map(h => h.id === hid ? { ...h, name: editHabitData.name.trim(), category: editHabitData.category, points: finalPoints, isRepeatable: editHabitData.isRepeatable, unit: editHabitData.unit?.trim() || null, description: editHabitData.description?.trim() || null } : h));
    setShowEditHabit(null);
    try {
      await supabase.from('habits').update({
        name: editHabitData.name.trim(), category: editHabitData.category,
        points: finalPoints, is_repeatable: editHabitData.isRepeatable,
        unit: editHabitData.unit?.trim() || null, description: editHabitData.description?.trim() || null
      }).eq('id', hid);
    } catch { setError('Failed to save'); }
  };
  const deleteHabit = async (hid) => {
    if (!confirm('Delete this habit?')) return;
    // Optimistic update
    setHabits(prev => prev.filter(h => h.id !== hid));
    try {
      await supabase.from('habits').delete().eq('id', hid);
    } catch (err) { console.error('Delete habit error:', err); }
  };
  const openEditHabit = (habit) => { setEditHabitData({ name: habit.name, category: habit.category, points: Math.abs(habit.points || 10), isNegative: (habit.points || 0) < 0, isRepeatable: habit.isRepeatable, unit: habit.unit || '', description: habit.description || '' }); setShowEditHabit(habit.id); };

  // ─── COMPLETIONS (with embedded habit data for orphan-proofing) ───
  const getExisting = (hid) => { const t = getToday(); return completions.find(c => c.userId === currentUser.id && c.habitId === hid && c.date === t); };

  // Mystery bonus: flat point bonuses with different probabilities
  // ~10% total chance of getting a bonus on any completion
  const rollBonus = () => {
    const roll = Math.random();
    if (roll < 0.002) return { flat: 50, label: '🎰 JACKPOT! +50', type: 'jackpot' };
    if (roll < 0.007) return { flat: 20, label: '🔥 +20 BONUS!', type: 'epic' };
    if (roll < 0.02) return { flat: 15, label: '⚡ +15 BONUS!', type: 'rare' };
    if (roll < 0.05) return { flat: 10, label: '✨ +10 BONUS!', type: 'bonus' };
    if (roll < 0.10) return { flat: 5, label: '🌟 +5 BONUS!', type: 'common' };
    return null;
  };

  // ─── STREAK MULTIPLIER (clean numbers) ───
  const getStreakMultiplier = (streak) => {
    if (streak >= 30) return { multi: 3, label: '3×', tier: 'Legend', color: 'text-red-400', bg: 'bg-red-500/20' };
    if (streak >= 14) return { multi: 2.5, label: '2.5×', tier: 'Dedicated', color: 'text-[#e8864a]', bg: 'bg-[#e8864a]/20' };
    if (streak >= 7) return { multi: 2, label: '2×', tier: 'Consistent', color: 'text-purple-400', bg: 'bg-purple-500/20' };
    if (streak >= 3) return { multi: 1.5, label: '1.5×', tier: 'Building', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    return { multi: 1, label: '1×', tier: null, color: 'text-gray-500', bg: '' };
  };
  const streakMulti = getStreakMultiplier(streakData.streak || 0);

  const postActivity = async (text, bonus) => {
    try {
      const aid = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await supabase.from('activity').insert({
        id: aid, user_id: currentUser.id, username: currentUser.username, room_id: currentRoom.id,
        text, bonus: bonus?.type || null, date: getToday()
      });
    } catch { }
  };

  const DEFAULT_REACTION_EMOJIS = ['🔥', '💀', '👏', '😤'];
  const [reactionEmojis, setReactionEmojis] = useState(() => {
    try { const stored = localStorage.getItem('versa-reaction-emojis'); return stored ? JSON.parse(stored) : DEFAULT_REACTION_EMOJIS; } catch { return DEFAULT_REACTION_EMOJIS; }
  });
  const [showEmojiEditor, setShowEmojiEditor] = useState(false);
  const [emojiDraft, setEmojiDraft] = useState('');
  const saveReactionEmojis = (emojis) => { setReactionEmojis(emojis); try { localStorage.setItem('versa-reaction-emojis', JSON.stringify(emojis)); } catch {} };
  const reactToActivity = async (activityId, emoji) => {
    if (!currentUser) return;
    // Optimistic update
    setActivityFeed(prev => prev.map(a => {
      if (a.id !== activityId) return a;
      const reactions = { ...(a.reactions || {}) };
      if (reactions[currentUser.id] === emoji) {
        delete reactions[currentUser.id];
      } else {
        reactions[currentUser.id] = emoji;
      }
      return { ...a, reactions };
    }));
    // Persist
    try {
      const { data } = await supabase.from('activity').select('reactions').eq('id', activityId).maybeSingle();
      if (!data) return;
      const reactions = data.reactions || {};
      if (reactions[currentUser.id] === emoji) {
        delete reactions[currentUser.id];
      } else {
        reactions[currentUser.id] = emoji;
      }
      await supabase.from('activity').update({ reactions }).eq('id', activityId);
    } catch (err) { console.error('Reaction error:', err); }
  };

  const handleIncrement = async (hid) => {
    const t = getToday(), h = habits.find(x => x.id === hid); if (!h) return;
    const max = h.isRepeatable ? 999999 : 1;
    const ex = getExisting(hid);
    const triggerMaxed = () => { setConfettiTrigger(v => v + 1); setMaxedHabit(hid); setTimeout(() => setMaxedHabit(null), 1500); };

    // Roll for mystery bonus (flat addition)
    const bonus = rollBonus();
    const baseWithStreak = h.points * streakMulti.multi;
    const bonusAmt = bonus ? bonus.flat : 0;
    const finalPts = baseWithStreak + bonusAmt;

    // Optimistic update — immediately update local state
    if (ex) {
      if (!h.isRepeatable && ex.count >= 1) return;
      setCompletions(prev => prev.map(c => c.id === ex.id ? { ...c, count: c.count + 1, habitPoints: baseWithStreak, bonusPoints: (c.bonusPoints || 0) + bonusAmt } : c));
      if (!h.isRepeatable && ex.count + 1 >= 1) triggerMaxed();
    } else {
      const cid = currentUser.id + '_' + hid + '_' + t;
      setCompletions(prev => [...prev, { id: cid, userId: currentUser.id, habitId: hid, roomId: currentRoom.id, date: t, count: 1, habitName: h.name, habitPoints: baseWithStreak, habitCategory: h.category, streakMultiplier: streakMulti.multi, bonusPoints: bonusAmt }]);
      if (max === 1) triggerMaxed();
    }

    try {
      if (ex) {
        if (h.isRepeatable || ex.count < 1) {
          await supabase.from('completions').update({
            count: ex.count + 1,
            habit_points: baseWithStreak,
            ...(bonusAmt > 0 ? { bonus_points: (ex.bonusPoints || 0) + bonusAmt } : {}),
            streak_multiplier: streakMulti.multi
          }).eq('id', ex.id);
        }
      } else {
        const cid = currentUser.id + '_' + hid + '_' + t;
        await supabase.from('completions').insert({
          id: cid, user_id: currentUser.id, habit_id: hid, room_id: currentRoom.id, date: t, count: 1,
          habit_name: h.name, habit_points: baseWithStreak, habit_category: h.category,
          streak_multiplier: streakMulti.multi,
          ...(bonusAmt > 0 ? { bonus_points: bonusAmt } : {})
        });
      }
      // Show bonus notification
      if (bonus) {
        setBonusMsg(bonus);
        setConfettiTrigger(v => v + 1);
        setTimeout(() => setBonusMsg(null), 2500);
      }
      // Post to activity feed
      const newCount = ex ? ex.count + 1 : 1;
      const streakTag = streakMulti.multi > 1 ? ` 🔥${streakMulti.label}` : '';
      const feedText = bonus
        ? `${h.name} (${baseWithStreak > 0 ? '+' : ''}${baseWithStreak} ${bonus.label})${streakTag}`
        : `${h.name} (${baseWithStreak > 0 ? '+' : ''}${baseWithStreak})${streakTag}`;
      if (newCount >= max) {
        postActivity(`Maxed out ${h.name}! 💎${streakTag}`, bonus);
      } else if (newCount === 1 || Math.random() < 0.3) {
        postActivity(feedText, bonus);
      }
    } catch (err) { console.error(err); }
  };
  const handleDecrement = async (hid) => {
    const ex = getExisting(hid); if (!ex) return;

    // Optimistic update
    if (ex.count > 1) {
      const newCount = ex.count - 1;
      const newBonus = ex.bonusPoints ? Math.round((ex.bonusPoints / ex.count) * newCount) : 0;
      setCompletions(prev => prev.map(c => c.id === ex.id ? { ...c, count: newCount, bonusPoints: newBonus } : c));
    } else {
      setCompletions(prev => prev.filter(c => c.id !== ex.id));
    }

    try {
      if (ex.count > 1) {
        const newCount = ex.count - 1;
        const newBonus = ex.bonusPoints ? Math.round((ex.bonusPoints / ex.count) * newCount) : 0;
        await supabase.from('completions').update({
          count: newCount,
          ...(ex.bonusPoints ? { bonus_points: newBonus } : {})
        }).eq('id', ex.id);
      } else {
        await supabase.from('completions').delete().eq('id', ex.id);
      }
    } catch (err) { console.error(err); }
  };

  // ─── HISTORY ───
  const loadHistoryDate = async (dateStr) => {
    setHistoryDate(dateStr);
    try {
      const { data: histSnap } = await supabase.from('completions').select('*').eq('room_id', currentRoom.id).eq('date', dateStr);
      const snap = { docs: (histSnap || []).map(d => ({ id: d.id, data: () => ({ ...d, userId: d.user_id, habitId: d.habit_id, habitPoints: d.habit_points, bonusPoints: d.bonus_points, habitName: d.habit_name, habitCategory: d.habit_category }) })) };
      setHistoryCompletions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { setHistoryCompletions([]); }
  };
  const shiftHistoryDate = (dir) => {
    const d = new Date(historyDate + 'T12:00:00');
    d.setDate(d.getDate() + dir);
    const ds = formatDateStr(d);
    if (ds > getToday()) return;
    loadHistoryDate(ds);
  };

  // ─── SCORING ───
  const getCatPts = (uid, cat) => completions.filter(c => c.userId === uid && c.date === getToday()).reduce((s, c) => { const h = habits.find(x => x.id === c.habitId); if ((h?.category || c.habitCategory) === cat) return s + ((c.habitPoints || h?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0); return s; }, 0);
  const getTodayCrystals = (uid) => {
    const cr = {}; allCatNames.forEach(c => cr[c] = false);
    // Solo mode: earn crystal if you beat yesterday's category points
    if (activeMembers.length < 2) {
      allCatNames.forEach(cat => { if (getCatPts(uid, cat) > 0) cr[cat] = true; });
      return cr;
    }
    allCatNames.forEach(cat => {
      let mx = 0, w = null;
      activeMembers.forEach(m => { const p = getCatPts(m.id, cat); if (p > mx) { mx = p; w = m; } else if (p === mx && p > 0) w = null; });
      if (w && w.id === uid) cr[cat] = true;
    });
    return cr;
  };
  const getTodayPts = (uid) => completions.filter(c => c.userId === uid && c.date === getToday()).reduce((s, c) => { return s + ((c.habitPoints || habits.find(x => x.id === c.habitId)?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0); }, 0);
  const getWeeklyPts = (uid) => { const ws = getWeekStart(), we = getWeekEnd(); return allCompletions.filter(c => c.userId === uid && c.date >= ws && c.date <= we).reduce((s, c) => { return s + ((c.habitPoints || habits.find(x => x.id === c.habitId)?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0); }, 0); };
  const getWeeklyCrystals = (uid) => {
    let t = 0; const ws = getWeekStart(), td = getToday();
    const dates = [...new Set(allCompletions.filter(c => c.date >= ws && c.date <= td).map(c => c.date))];
    dates.forEach(date => {
      allCatNames.forEach(cat => {
        let mx = 0, w = null;
        activeMembers.forEach(m => { const p = allCompletions.filter(c => c.userId === m.id && c.date === date).reduce((s, c) => { const h = habits.find(x => x.id === c.habitId); if (h && h.category === cat) return s + (h.points * (c.count || 1)); return s; }, 0); if (p > mx) { mx = p; w = m; } else if (p === mx && p > 0) w = null; });
        if (w && w.id === uid) t++;
      });
    });
    return t;
  };
  const getCount = (hid) => { const e = getExisting(hid); return e?.count || 0; };
  const getDailyProgress = () => { if (!currentUser || !currentRoom) return 0; const pts = getTodayPts(currentUser.id); return Math.max(0, Math.min(pts / dailyTarget, 1)); };
  const getLeaderboard = () => activeMembers.map(m => ({ member: m, todayPts: getTodayPts(m.id), weeklyPts: getWeeklyPts(m.id), crystals: getTodayCrystals(m.id), weeklyCrystals: getWeeklyCrystals(m.id) })).sort((a, b) => leaderboardTab === 'today' ? b.todayPts - a.todayPts : b.weeklyPts - a.weeklyPts);

  const DEFAULT_CATEGORIES = [
    { name: 'Study', colorIdx: 0, icon: '📚' },
    { name: 'Health', colorIdx: 1, icon: '💪' },
    { name: 'Focus', colorIdx: 2, icon: '🎯' },
  ];
  const activeCategories = roomCategories.length > 0 ? roomCategories : DEFAULT_CATEGORIES;
  const allCatNames = activeCategories.map(c => c.name);
  const COLOR_PALETTE = [
    { name: 'Dusty Blue', neon: '#5b7cf5', bg: 'bg-[#5b7cf5]', bgS: 'bg-[#5b7cf5]/10', bgM: 'bg-[#5b7cf5]/20', bdr: 'border-[#5b7cf5]/30', txt: 'text-[#5b7cf5]', txtB: 'text-[#7b9cf7]', pill: 'bg-[#5b7cf5]/20 text-[#5b7cf5]', glow: 'shadow-[#5b7cf5]/20' },
    { name: 'Warm Tan', neon: '#e8864a', bg: 'bg-[#e8864a]', bgS: 'bg-[#e8864a]/10', bgM: 'bg-[#e8864a]/20', bdr: 'border-[#e8864a]/30', txt: 'text-[#e8864a]', txtB: 'text-[#eba06a]', pill: 'bg-[#e8864a]/20 text-[#e8864a]', glow: 'shadow-[#e8864a]/20' },
    { name: 'Sage', neon: '#4aba7a', bg: 'bg-[#4aba7a]', bgS: 'bg-[#4aba7a]/10', bgM: 'bg-[#4aba7a]/20', bdr: 'border-[#4aba7a]/30', txt: 'text-[#4aba7a]', txtB: 'text-[#6ace92]', pill: 'bg-[#4aba7a]/20 text-[#4aba7a]', glow: 'shadow-[#4aba7a]/20' },
    { name: 'Dusty Rose', neon: '#e05d8c', bg: 'bg-[#e05d8c]', bgS: 'bg-[#e05d8c]/10', bgM: 'bg-[#e05d8c]/20', bdr: 'border-[#e05d8c]/30', txt: 'text-[#e05d8c]', txtB: 'text-[#e87da6]', pill: 'bg-[#e05d8c]/20 text-[#e05d8c]', glow: 'shadow-[#e05d8c]/20' },
    { name: 'Slate', neon: '#7c82a8', bg: 'bg-[#7c82a8]', bgS: 'bg-[#7c82a8]/10', bgM: 'bg-[#7c82a8]/20', bdr: 'border-[#7c82a8]/30', txt: 'text-[#7c82a8]', txtB: 'text-[#9498be]', pill: 'bg-[#7c82a8]/20 text-[#7c82a8]', glow: 'shadow-[#7c82a8]/20' },
    { name: 'Clay', neon: '#d06b4a', bg: 'bg-[#d06b4a]', bgS: 'bg-[#d06b4a]/10', bgM: 'bg-[#d06b4a]/20', bdr: 'border-[#d06b4a]/30', txt: 'text-[#d06b4a]', txtB: 'text-[#e08b6a]', pill: 'bg-[#d06b4a]/20 text-[#d06b4a]', glow: 'shadow-[#d06b4a]/20' },
    { name: 'Mauve', neon: '#9b6bc8', bg: 'bg-[#9b6bc8]', bgS: 'bg-[#9b6bc8]/10', bgM: 'bg-[#9b6bc8]/20', bdr: 'border-[#9b6bc8]/30', txt: 'text-[#9b6bc8]', txtB: 'text-[#b58be0]', pill: 'bg-[#9b6bc8]/20 text-[#9b6bc8]', glow: 'shadow-[#9b6bc8]/20' },
    { name: 'Ochre', neon: '#d4a04a', bg: 'bg-[#d4a04a]', bgS: 'bg-[#d4a04a]/10', bgM: 'bg-[#d4a04a]/20', bdr: 'border-[#d4a04a]/30', txt: 'text-[#d4a04a]', txtB: 'text-[#e0b86a]', pill: 'bg-[#d4a04a]/20 text-[#d4a04a]', glow: 'shadow-[#d4a04a]/20' },
  ];
  const ICON_OPTIONS = ['🧠', '💪', '✨', '⭐', '📚', '🎨', '💼', '🏃', '🧘', '💰', '🎯', '❤️', '🌱', '🔬', '🎮', '🍎'];
  const getCT = (catName) => {
    const cat = activeCategories.find(c => c.name === catName);
    const idx = cat?.colorIdx ?? 0;
    return COLOR_PALETTE[idx % COLOR_PALETTE.length];
  };
  const CT = {};
  activeCategories.forEach(c => { CT[c.name] = getCT(c.name); });

  const myCr = currentUser && currentRoom ? getTodayCrystals(currentUser.id) : {};
  const myPts = currentUser && currentRoom ? getTodayPts(currentUser.id) : 0;
  const isPerfect = allCatNames.length > 0 && allCatNames.every(c => myCr[c]);
  const dailyProg = currentUser && currentRoom ? getDailyProgress() : 0;
  const displayHabits = habits;

  const addCategory = async () => {
    if (!newCatName.trim() || activeCategories.find(c => c.name.toLowerCase() === newCatName.trim().toLowerCase())) return;
    const updated = [...activeCategories, { name: newCatName.trim(), colorIdx: newCatColor, icon: newCatIcon }];
    try {
      await supabase.from('room_categories').upsert({ room_id: currentRoom.id, categories: updated });
      setNewCatName(''); setNewCatColor(0); setNewCatIcon('⭐'); setShowAddCategory(false);
    } catch { setError('Failed to add category'); }
  };
  const deleteCategory = async (catName) => {
    const catHabits = habits.filter(h => h.category === catName);
    if (catHabits.length > 0) { setError('Delete habits in this category first'); setTimeout(() => setError(''), 2000); return; }
    if (['Study', 'Health', 'Focus'].includes(catName)) { setError("Can't delete default categories"); setTimeout(() => setError(''), 2000); return; }
    const updated = activeCategories.filter(c => c.name !== catName);
    try { await supabase.from('room_categories').upsert({ room_id: currentRoom.id, categories: updated }); } catch { }
  };
  const stakePresets = [
    { type: 'custom', label: 'Custom', desc: 'Set your own', ph: 'e.g. Loser does 50 pushups' },
    { type: 'buyout', label: 'Buyout', desc: 'Loser buys something', ph: 'e.g. Loser buys lunch' },
    { type: 'dare', label: 'Dare', desc: 'Loser performs a dare', ph: 'e.g. Embarrassing post' },
    { type: 'service', label: 'Service', desc: 'Loser does a favor', ph: "e.g. Loser's chores" },
  ];

  // ─── THEME CLASSES ───
  const THEME_DEFS = {
    'navy-dark': {
      bg: 'bg-[#0f1b2d]', bgCard: 'bg-[#182544]', bgCardHover: 'hover:bg-[#1e2e50]', bgInput: 'bg-[#182544]',
      border: 'border-[#223858]', borderInput: 'border-[#264060]', text: 'text-white', textMuted: 'text-[#7a8ba8]',
      textDim: 'text-[#4a6080]', textFaint: 'text-[#2a4060]', headerBg: 'bg-[#0f1b2d]/95', modalBg: 'bg-[#122040]',
      selectBg: 'bg-[#122040]', glowOrb: '/8', blurBg: 'backdrop-blur-xl', accent: '#5b7cf5', accentTxt: 'text-[#5b7cf5]', accentBg: 'bg-[#5b7cf5]',
    },
    'navy-light': {
      bg: 'bg-[#f0f4f8]', bgCard: 'bg-white', bgCardHover: 'hover:bg-gray-50', bgInput: 'bg-[#eef2f7]',
      border: 'border-[#dce4ee]', borderInput: 'border-[#ccd6e4]', text: 'text-[#1a2744]', textMuted: 'text-[#6b7e96]',
      textDim: 'text-[#9aaec0]', textFaint: 'text-[#c4d2e0]', headerBg: 'bg-[#f0f4f8]/95', modalBg: 'bg-white',
      selectBg: 'bg-white', glowOrb: '/5', blurBg: 'backdrop-blur-xl', accent: '#5b7cf5', accentTxt: 'text-[#5b7cf5]', accentBg: 'bg-[#5b7cf5]',
    },
    'sunset-dark': {
      bg: 'bg-[#151516]', bgCard: 'bg-[#1c1c1e]', bgCardHover: 'hover:bg-[#262628]', bgInput: 'bg-[#1c1c1e]',
      border: 'border-[#323236]', borderInput: 'border-[#404044]', text: 'text-white', textMuted: 'text-[#a1a1aa]',
      textDim: 'text-[#616168]', textFaint: 'text-[#38383e]', headerBg: 'bg-[#151516]/95', modalBg: 'bg-[#1c1c1e]',
      selectBg: 'bg-[#1c1c1e]', glowOrb: '/8', blurBg: 'backdrop-blur-xl', accent: '#ff7b29', accentTxt: 'text-[#ff7b29]', accentBg: 'bg-[#ff7b29]',
    },
    'sunset-light': {
      bg: 'bg-[#fcfcfc]', bgCard: 'bg-white', bgCardHover: 'hover:bg-orange-50/40', bgInput: 'bg-[#fafafa]',
      border: 'border-[#f0f0f0]', borderInput: 'border-[#e5e5e5]', text: 'text-[#1f1f22]', textMuted: 'text-[#85858a]',
      textDim: 'text-[#b8b8bc]', textFaint: 'text-[#e5e5e5]', headerBg: 'bg-[#fcfcfc]/95', modalBg: 'bg-white',
      selectBg: 'bg-white', glowOrb: '/5', blurBg: 'backdrop-blur-xl', accent: '#ff6200', accentTxt: 'text-[#ff6200]', accentBg: 'bg-[#ff6200]',
    },
  };
  const T = THEME_DEFS[theme] || THEME_DEFS['navy-dark'];
  const inputCls = `w-full px-4 py-3 ${T.bgInput} border ${T.borderInput} rounded-xl focus:outline-none focus:border-[${T.accent}]/50 ${T.text} placeholder-[#4a6080] text-sm transition-all`;
  const btnPrimary = "w-full py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all disabled:opacity-50 active:scale-[0.98]";

  // ─── NOTIFICATIONS STATE ───
  const [notifPermission, setNotifPermission] = useState(() => ('Notification' in window) ? Notification.permission : 'default');
  const prevCompletionsRef = useRef([]);
  const prevActivityRef = useRef([]);
  const notifThrottleRef = useRef({});
  const duoMilestoneRef = useRef({});

  const throttledNotify = (title, body, tag) => {
    const now = Date.now();
    if (now - (notifThrottleRef.current[tag] || 0) < 300000) return;
    notifThrottleRef.current[tag] = now;
    sendLocalNotification(title, body, tag);
  };

  // Setup service worker + save subscription
  useEffect(() => {
    if (!currentUser) return;
    const setup = async () => {
      const reg = await registerServiceWorker();
      if (!reg || !('Notification' in window)) return;
      setNotifPermission(Notification.permission);
      if (Notification.permission === 'granted') {
        const sub = await subscribeToPush(reg);
        if (sub) {
          await supabase.from('push_subscriptions').upsert({
            id: currentUser.id + '_push',
            user_id: currentUser.id,
            subscription: sub.toJSON()
          });
        }
      }
    };
    setup();
  }, [currentUser]);

  // Competition: rival passed you, rival on a tear, rival grinding
  useEffect(() => {
    if (!currentUser || !currentRoom || notifPermission !== 'granted') return;
    const prev = prevCompletionsRef.current;
    if (prev.length === 0) { prevCompletionsRef.current = completions; return; }
    const prevIds = new Set(prev.map(c => c.id + '_' + c.count));
    const newOnes = completions.filter(c => c.userId !== currentUser.id && !prevIds.has(c.id + '_' + c.count));
    if (newOnes.length > 0) {
      const latest = newOnes[newOnes.length - 1];
      const member = activeMembers.find(m => m.id === latest.userId);
      const habit = habits.find(h => h.id === latest.habitId);
      if (member) {
        const rivalPts = completions.filter(c => c.userId === latest.userId).reduce((s, c) => s + ((c.habitPoints || 0) * (c.count || 1)) + (c.bonusPoints || 0), 0);
        const prevRivalPts = prev.filter(c => c.userId === latest.userId).reduce((s, c) => s + ((c.habitPoints || 0) * (c.count || 1)) + (c.bonusPoints || 0), 0);
        const rivalCount = completions.filter(c => c.userId === latest.userId).reduce((s, c) => s + (c.count || 1), 0);
        if (rivalPts > myPts && prevRivalPts <= myPts && myPts > 0) {
          throttledNotify('🔥 ' + member.username + ' passed you!', rivalPts + ' pts vs your ' + myPts + '. Time to grind.', 'rival-pass-' + latest.userId);
        } else if (rivalCount >= 5 && rivalCount % 5 === 0) {
          throttledNotify(member.username + ' is on a tear 💪', rivalCount + ' habits logged today.', 'rival-tear-' + latest.userId);
        } else if (document.hidden && habit) {
          throttledNotify(member.username + ' is grinding', habit.name + ' (+' + (habit.points || 10) + ')', 'rival-log');
        }
      }
    }
    prevCompletionsRef.current = completions;
  }, [completions, notifPermission]);

  // Reactions on your activity
  useEffect(() => {
    if (!currentUser || notifPermission !== 'granted' || !activityFeed.length) return;
    const prev = prevActivityRef.current;
    if (!prev.length) { prevActivityRef.current = activityFeed; return; }
    activityFeed.forEach(a => {
      if (a.userId !== currentUser.id) return;
      const prevA = prev.find(p => p.id === a.id);
      Object.entries(a.reactions || {}).forEach(([uid, emoji]) => {
        if (!(prevA?.reactions || {})[uid] && uid !== currentUser.id) {
          const reactor = activeMembers.find(m => m.id === uid);
          if (reactor) throttledNotify(reactor.username + ' reacted ' + emoji, 'to your ' + (a.text || 'activity'), 'reaction-' + a.id);
        }
      });
    });
    prevActivityRef.current = activityFeed;
  }, [activityFeed, notifPermission]);

  // Protection: streak warnings, daily nudge, last place
  useEffect(() => {
    if (!currentUser || notifPermission !== 'granted') return;
    const check = () => {
      const hour = new Date().getHours();
      const today = getToday();
      if (hour === 18 && myPts === 0) {
        const k = 'versa-nudge-' + today;
        if (!sessionStorage.getItem(k)) { sendLocalNotification('📋 Don\'t forget to log today', 'Your rivals might already be ahead.', 'daily-nudge'); sessionStorage.setItem(k, '1'); }
      }
      const currentDynamicTarget = getDynamicStreakTarget(streakTarget, streakMulti.multi);
      if (hour === 20 && myPts < currentDynamicTarget && streakData.streak > 0) {
        const k = 'versa-s8-' + today;
        if (!sessionStorage.getItem(k)) { sendLocalNotification('âš ️ Your ' + streakData.streak + '-day streak is at risk', 'Log ' + currentDynamicTarget + 'pts before midnight.', 'streak-8pm'); sessionStorage.setItem(k, '1'); }
      }
      if (hour === 22 && myPts < currentDynamicTarget && streakData.streak > 0) {
        const k = 'versa-s10-' + today;
        if (!sessionStorage.getItem(k)) { sendLocalNotification('🚨 2 hours left!', (streakFreeze > 0 ? 'Freeze will save you.' : 'No freeze — this is it.'), 'streak-10pm'); sessionStorage.setItem(k, '1'); }
      }
      if (new Date().getDay() === 0 && hour === 18 && activeMembers.length > 1) {
        const k = 'versa-lp-' + today;
        if (!sessionStorage.getItem(k)) {
          const lb = activeMembers.map(m => ({ id: m.id, pts: allCompletions.filter(c => c.userId === m.id).reduce((s, c) => s + ((c.habitPoints || 0) * (c.count || 1)) + (c.bonusPoints || 0), 0) })).sort((a, b) => b.pts - a.pts);
          if (lb.length > 0 && lb[lb.length - 1].id === currentUser.id) { sendLocalNotification('😬 You\'re in last place', 'The week resets tonight.', 'last-place'); sessionStorage.setItem(k, '1'); }
        }
      }
    };
    check();
    const iv = setInterval(check, 300000);
    return () => clearInterval(iv);
  }, [notifPermission, myPts, streakData.streak, streakMulti.multi, streakTarget]);

  // Celebration: won the week — only on Monday (day after reset)
  useEffect(() => {
    if (!currentUser || !lastWeekData || notifPermission !== 'granted') return;
    const day = new Date().getDay(); // 0=Sun, 1=Mon
    if (day !== 1) return; // Only fire on Monday
    const key = 'versa-weekwin-' + getWeekStart();
    try { if (localStorage.getItem(key)) return; } catch { }
    if (lastWeekData.scores.length > 0 && lastWeekData.scores[0].member.id === currentUser.id) {
      throttledNotify('🏆 You won the week!', lastWeekData.scores[0].pts + ' pts — you dominated.', 'week-win');
      try { localStorage.setItem(key, '1'); } catch { }
    }
  }, [lastWeekData, notifPermission]);

  // Celebration: duo streak milestones
  useEffect(() => {
    if (!currentUser || notifPermission !== 'granted') return;
    Object.entries(mutualStreaks).forEach(([uid, days]) => {
      const last = duoMilestoneRef.current[uid] || 0;
      const crossed = [3, 7, 14, 30].find(m => days >= m && last < m);
      if (crossed) {
        const rival = activeMembers.find(m => m.id === uid);
        if (rival) { duoMilestoneRef.current[uid] = crossed; throttledNotify('🔗 ' + crossed + '-day duo streak!', 'You and ' + rival.username + ' — ' + crossed + ' days.', 'duo-' + uid); }
      }
    });
  }, [mutualStreaks, notifPermission]);

  // Personal: progress milestones (independent — no rival needed)
  const prevProgressRef = useRef(0);
  useEffect(() => {
    if (!currentUser || notifPermission !== 'granted' || !habits.length) return;
    const prev = prevProgressRef.current;
    const prog = dailyProg;
    const today = getToday();
    if (prev < 0.5 && prog >= 0.5 && prog < 1) {
      const k = 'versa-50-' + today;
      if (!sessionStorage.getItem(k)) { throttledNotify('💪 Halfway there!', myPts + ' pts — keep pushing to 100%.', 'progress-50'); sessionStorage.setItem(k, '1'); }
    }
    if (prev < 0.75 && prog >= 0.75 && prog < 1) {
      const k = 'versa-75-' + today;
      if (!sessionStorage.getItem(k)) { throttledNotify('🔥 75% done!', myPts + ' pts — almost there.', 'progress-75'); sessionStorage.setItem(k, '1'); }
    }
    if (prev < 1 && prog >= 1) {
      const k = 'versa-100-' + today;
      if (!sessionStorage.getItem(k)) { throttledNotify('🎯 100% — Daily target crushed!', myPts + ' pts today. Legend.', 'progress-100'); sessionStorage.setItem(k, '1'); }
    }
    prevProgressRef.current = prog;
  }, [dailyProg, notifPermission]);

  // Personal: streak milestones (independent)
  const prevStreakNotifRef = useRef(0);
  useEffect(() => {
    if (!currentUser || notifPermission !== 'granted') return;
    const streak = streakData.streak || 0;
    const prev = prevStreakNotifRef.current;
    const milestones = [3, 7, 14, 30, 60, 100];
    const crossed = milestones.find(m => streak >= m && prev < m);
    if (crossed) {
      const k = 'versa-streak-' + crossed;
      try {
        if (!localStorage.getItem(k)) {
          throttledNotify('🔥 ' + crossed + '-day streak!', 'You\'ve been consistent for ' + crossed + ' days straight.', 'streak-milestone-' + crossed);
          localStorage.setItem(k, '1');
        }
      } catch { }
    }
    prevStreakNotifRef.current = streak;
  }, [streakData.streak, notifPermission]);

  // ─── LOADING ───
  if (authLoading) return (
    <div className="min-h-screen bg-[#0f1b2d] flex items-center justify-center relative overflow-hidden">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-[0.4em] text-white mb-2">VERSA</h1>
        <p className="text-[#4a6080] text-[10px] tracking-[0.25em] uppercase mb-6">Keep yourself accountable.</p>
        <div className="flex justify-center gap-2">{['bg-[#5b7cf5]', 'bg-[#e8864a]', 'bg-[#4aba7a]'].map((c, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${c} animate-pulse`} style={{ animationDelay: i * 200 + 'ms' }} />)}</div>
      </div>
    </div>
  );

  if (dailyProg >= 1 && prevProgRef.current < 1 && prevProgRef.current > 0) {
    // Schedule celebration (can't call hooks here but can set ref + trigger state in next tick)
    setTimeout(() => setCelebrateComplete(true), 0);
  }
  prevProgRef.current = dailyProg;
  const soloMode = activeMembers.length < 2;

  // ═══════════════════════════════════════
  // ONBOARDING
  // ═══════════════════════════════════════
  if (!currentUser && view === 'onboarding') {
    return (
      <div className="min-h-screen bg-[#0f1b2d] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-[#5b7cf5]/8 via-[#9b6bc8]/5 to-transparent rounded-full blur-[120px] -translate-y-1/2" />

        <div className="w-full max-w-sm relative z-10">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-[#5b7cf5] animate-pulse" /><div className="w-2 h-2 rounded-full bg-[#e8864a] animate-pulse" style={{ animationDelay: '150ms' }} /><div className="w-2 h-2 rounded-full bg-[#4aba7a] animate-pulse" style={{ animationDelay: '300ms' }} /></div>
            </div>
            <h1 className="text-5xl font-black tracking-[0.35em] text-white mb-2">VERSA</h1>
            <p className="text-[#4a6080] text-[11px] tracking-[0.25em] uppercase font-medium">Keep yourself accountable.</p>
          </div>

          {/* Feature cards */}
          <div className="space-y-3 mb-8">
            {[
              { icon: '📚', title: 'Track What Matters', desc: 'Studying, gym, screen time, sleep. Earn points for everything.', color: 'from-[#5b7cf5]/10 to-[#5b7cf5]/5' },
              { icon: '🔥', title: 'Streak Multipliers', desc: 'Don\'t break the chain → earn up to 2× points.', color: 'from-[#e8864a]/10 to-[#e8864a]/5' },
              { icon: '🏆', title: 'Compete with Friends', desc: 'Real-time leaderboards. Set stakes. Loser pays.', color: 'from-[#d4a04a]/10 to-[#d4a04a]/5' },
              { icon: '💎', title: 'Win Crystals', desc: 'Top scorer in Study, Health, or Focus earns the crystal.', color: 'from-[#9b6bc8]/10 to-[#9b6bc8]/5' },
            ].map((item, i) => (
              <div key={i} className={`bg-gradient-to-r ${item.color} backdrop-blur-sm border border-[#223858] rounded-2xl p-4 flex items-center gap-4`}>
                <span className="text-2xl">{item.icon}</span>
                <div><p className="text-white font-semibold text-[13px]">{item.title}</p><p className="text-[#7a8ba8] text-[11px] mt-0.5 leading-relaxed">{item.desc}</p></div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <button onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3.5 rounded-2xl text-sm font-bold tracking-wide transition-all active:scale-[0.98] bg-white text-[#0f1b2d] shadow-lg shadow-[#1e3050] flex items-center justify-center gap-3 hover:bg-gray-100 disabled:opacity-50">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Continue with Google
            </button>
            <div className="flex items-center gap-3"><div className="flex-1 h-px bg-[#223858]" /><span className="text-[#4a6080] text-[10px] tracking-wider uppercase">or</span><div className="flex-1 h-px bg-[#223858]" /></div>
            <button onClick={() => setView('signup')} className={btnPrimary + ' bg-[#5b7cf5] hover:bg-[#4a6be4] text-white shadow-lg shadow-[#5b7cf5]/15 rounded-2xl'}>Create Account with Email</button>
            <button onClick={() => setView('login')} className="w-full text-[#7a8ba8] py-2 hover:text-white text-sm transition-colors text-center">Already have an account? <span className="text-[#5b7cf5]">Sign in</span></button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // AUTH SCREENS
  // ═══════════════════════════════════════
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f1b2d] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-b from-blue-600/8 via-purple-600/5 to-transparent rounded-full blur-[120px] -translate-y-1/3" />
        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black tracking-[0.3em] text-white mb-1">VERSA</h1>
            <div className="flex justify-center gap-2 mt-3"><div className="w-6 h-0.5 rounded-full bg-blue-500" /><div className="w-6 h-0.5 rounded-full bg-orange-500" /><div className="w-6 h-0.5 rounded-full bg-emerald-500" /></div>
          </div>
          <div className="bg-[#151d30] backdrop-blur-xl rounded-3xl border border-[#223858] p-7">
            {view === 'forgot' ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <h2 className="text-lg font-bold text-white text-center mb-1">Reset Password</h2>
                <p className="text-gray-500 text-xs text-center mb-4">Enter your email and we'll send a reset link.</p>
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls + ' !rounded-xl'} required disabled={loading} />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                {successMsg && <p className="text-emerald-400 text-xs text-center">{successMsg}</p>}
                <button type="submit" disabled={loading} className={btnPrimary + ' bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-[#5b7cf5]/15 !rounded-xl'}>{loading ? 'Sending...' : 'Send Reset Link'}</button>
                <button type="button" onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }} className="w-full text-gray-500 py-2 hover:text-white text-sm transition-colors">← Back to Sign In</button>
              </form>
            ) : view === 'login' ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white text-center mb-1">Welcome back</h2>
                {/* Google button */}
                <button onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] bg-white text-gray-900 flex items-center justify-center gap-2.5 hover:bg-gray-100 disabled:opacity-50">
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3"><div className="flex-1 h-px bg-[#1e3050]" /><span className="text-gray-600 text-[10px] tracking-wider uppercase">or</span><div className="flex-1 h-px bg-[#1e3050]" /></div>
                <form onSubmit={handleLogin} className="space-y-3">
                  <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls + ' !rounded-xl'} required disabled={loading} />
                  <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls + ' !rounded-xl'} required disabled={loading} />
                  {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                  <button type="submit" disabled={loading} className={btnPrimary + ' bg-[#5b7cf5] text-white shadow-lg shadow-[#5b7cf5]/15 !rounded-xl'}>{loading ? 'Signing in...' : 'Sign In'}</button>
                </form>
                <div className="flex justify-between pt-1">
                  <button type="button" onClick={() => { setView('onboarding'); setError(''); }} className="text-gray-500 text-xs hover:text-white transition-colors">← Create Account</button>
                  <button type="button" onClick={() => { setView('forgot'); setError(''); }} className="text-gray-500 text-xs hover:text-blue-400 transition-colors">Forgot password?</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white text-center mb-1">Create your account</h2>
                {/* Google button */}
                <button onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] bg-white text-gray-900 flex items-center justify-center gap-2.5 hover:bg-gray-100 disabled:opacity-50">
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                  Sign up with Google
                </button>
                <div className="flex items-center gap-3"><div className="flex-1 h-px bg-[#1e3050]" /><span className="text-gray-600 text-[10px] tracking-wider uppercase">or</span><div className="flex-1 h-px bg-[#1e3050]" /></div>
                <form onSubmit={handleSignup} className="space-y-3">
                  <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className={inputCls + ' !rounded-xl'} required disabled={loading} />
                  <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls + ' !rounded-xl'} required disabled={loading} />
                  <input type="password" placeholder="Password (min 6)" value={password} onChange={e => setPassword(e.target.value)} className={inputCls + ' !rounded-xl'} required minLength={6} disabled={loading} />
                  {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                  <button type="submit" disabled={loading} className={btnPrimary + ' bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20 !rounded-xl'}>{loading ? 'Creating...' : 'Create Account'}</button>
                </form>
                <button type="button" onClick={() => { setView('login'); setError(''); }} className="w-full text-gray-500 py-1 hover:text-white text-xs transition-colors text-center">Already have an account? <span className="text-blue-400">Sign in</span></button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══ KICKED CHECK ═══
  const isKicked = currentRoom && roomKicked.includes(currentUser?.id);

  if (isKicked) return (
    <div className="min-h-screen bg-[#0f1b2d] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">🚫</div>
        <h2 className="text-lg font-bold text-white mb-2">You've been removed from this room</h2>
        <p className="text-gray-500 text-sm mb-6">The room creator has removed you from <span className="font-mono text-gray-400">{currentRoom.code}</span>.</p>
        <div className="space-y-3">
          {userRooms.filter(r => r !== currentRoom.id).length > 0 ? (
            <button onClick={() => switchRoom(userRooms.find(r => r !== currentRoom.id))} className="w-full py-3 rounded-xl text-sm font-bold bg-[#5b7cf5] text-white shadow-lg shadow-[#5b7cf5]/15 active:scale-[0.98]">Switch to Another Room</button>
          ) : (
            <button onClick={() => { leaveRoom(currentRoom.id); }} className="w-full py-3 rounded-xl text-sm font-bold bg-[#5b7cf5] text-white shadow-lg shadow-[#5b7cf5]/15 active:scale-[0.98]">Create or Join a Room</button>
          )}
        </div>
      </div>
    </div>
  );

  // ═══ ROOM SELECT ═══
  if (showRoomModal) return (
    <div className="min-h-screen bg-[#0f1b2d] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-blue-600/8 via-purple-600/5 to-transparent rounded-full blur-[120px] -translate-y-1/3" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-[100px] translate-y-1/3" />
      <div className="w-full max-w-sm relative z-10">

        {/* Step 0: Welcome */}
        {onboardingStep === 0 && (
          <div className="text-center space-y-6">
            <div>
              <div className="text-5xl mb-4">👋</div>
              <h1 className="text-2xl font-bold text-white mb-2">Welcome, <span className="text-[#5b7cf5]">{currentUser.username}</span></h1>
              <p className="text-gray-500 text-sm leading-relaxed">Compete with friends on real habits.<br />Let's get you set up in 30 seconds.</p>
            </div>
            <div className="space-y-3">
              {[
                { icon: '🏠', title: 'Create a room', desc: 'Start fresh and invite friends', action: () => setOnboardingStep(1) },
                { icon: '🔗', title: 'Join a room', desc: 'Got a code from a friend?', action: () => setOnboardingStep(2) },
              ].map((opt, i) => (
                <button key={i} onClick={opt.action} className="w-full flex items-center gap-4 p-4 bg-[#151d30] border border-[#223858] rounded-2xl text-left hover:bg-[#1e3050] transition-all active:scale-[0.98]">
                  <span className="text-2xl">{opt.icon}</span>
                  <div><p className="text-white font-semibold text-sm">{opt.title}</p><p className="text-gray-500 text-[11px]">{opt.desc}</p></div>
                  <ChevronRight size={16} className="text-gray-600 ml-auto" />
                </button>
              ))}
            </div>
            <button onClick={() => supabase.auth.signOut()} className="text-gray-700 text-xs hover:text-gray-400 transition-colors">Sign out</button>
          </div>
        )}

        {/* Step 1: Create Room */}
        {onboardingStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🏠</div>
              <h2 className="text-xl font-bold text-white mb-1">Create your room</h2>
              <p className="text-gray-500 text-sm">A room is where you and your friends track habits and compete. You'll get a code to share.</p>
            </div>
            <div className="bg-[#151d30] border border-[#223858] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3 text-gray-400 text-xs">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] font-bold">1</div>
                <span>We'll create a room with a unique invite code</span>
              </div>
              <div className="flex items-center gap-3 text-gray-400 text-xs">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] font-bold">2</div>
                <span>Default habits are loaded automatically</span>
              </div>
              <div className="flex items-center gap-3 text-gray-400 text-xs">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] font-bold">3</div>
                <span>Share the code with friends to start competing</span>
              </div>
            </div>
            <button onClick={async () => { await createRoom(); setShowInviteModal(false); setOnboardingStep(0); setShowOnboardingTour(true); }} disabled={loading} className={btnPrimary + ' bg-[#5b7cf5] text-white shadow-lg shadow-[#5b7cf5]/15 rounded-2xl'}>{loading ? 'Creating...' : 'Create Room'}</button>
            <button onClick={() => setOnboardingStep(0)} className="w-full text-gray-600 text-xs hover:text-gray-400 transition-colors text-center">← Back</button>
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          </div>
        )}

        {/* Step 2: Join Room */}
        {onboardingStep === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🔗</div>
              <h2 className="text-xl font-bold text-white mb-1">Join a room</h2>
              <p className="text-gray-500 text-sm">Enter the 6-letter code your friend shared with you.</p>
            </div>
            <div className="bg-[#151d30] border border-[#223858] rounded-2xl p-5">
              <input type="text" placeholder="ABCDEF" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} className="w-full px-4 py-4 bg-[#1e2e50] border border-[#2a4060] rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder-gray-600 text-lg font-mono tracking-[0.4em] text-center" maxLength={6} autoFocus />
            </div>
            <button onClick={async () => { await joinRoom(); setOnboardingStep(0); setShowOnboardingTour(true); }} disabled={loading || roomCode.length < 4} className={btnPrimary + ' bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20 rounded-2xl disabled:opacity-40'}>{loading ? 'Joining...' : 'Join Room'}</button>
            <button onClick={() => setOnboardingStep(0)} className="w-full text-gray-600 text-xs hover:text-gray-400 transition-colors text-center">← Back</button>
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          </div>
        )}

      </div>
    </div>
  );

  // ═══════════════════════════════════════
  // MAIN DASHBOARD
  // ═══════════════════════════════════════
  const tourSteps = [
    { icon: '🎯', title: 'Track your habits', desc: 'Tap the + button on any habit to log it. Each completion earns you points. Try it now!' },
    { icon: '🔥', title: 'Build your streak', desc: 'Complete at least one habit every day. The longer your streak, the higher your point multiplier — up to 3× at 30 days.' },
    { icon: '💎', title: 'Win crystals', desc: 'Score the most points in any category (Grind, Health, Discipline) to earn a crystal for the day.' },
    { icon: '🏆', title: 'Dominate the leaderboard', desc: 'Your weekly points determine the leaderboard rank. Set stakes to make losing hurt.' },
    { icon: '👥', title: 'Invite your friends', desc: 'Share your room code and start competing. The more rivals, the better.' },
  ];

  return (
    <div className={`min-h-screen pb-24 relative overflow-x-hidden ${T.bg} ${T.text} transition-all duration-500`}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { transform: scale(0.85); opacity: 0; } 40% { transform: scale(1.03); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes checkBounce { 0% { transform: scale(0); } 50% { transform: scale(1.4); } 70% { transform: scale(0.9); } 100% { transform: scale(1); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(91,124,245,0.4); } 50% { box-shadow: 0 0 16px 6px rgba(91,124,245,0.1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes ripple { 0% { transform: scale(0); opacity: 0.5; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes countUp { from { opacity: 0; transform: translateY(8px) scale(0.8); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes heroShine { 0% { left: -100%; } 100% { left: 200%; } }
        .anim-fade-up { animation: fadeUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .anim-fade-in { animation: fadeIn 0.3s ease-out both; }
        .anim-scale-in { animation: scaleIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .anim-slide-down { animation: slideDown 0.25s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .anim-pop-in { animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
        .anim-slide-right { animation: slideInRight 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .anim-count { animation: countUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .anim-float { animation: float 3s ease-in-out infinite; }
        .anim-stagger > * { animation: fadeUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .anim-stagger > *:nth-child(1) { animation-delay: 0ms; }
        .anim-stagger > *:nth-child(2) { animation-delay: 50ms; }
        .anim-stagger > *:nth-child(3) { animation-delay: 100ms; }
        .anim-stagger > *:nth-child(4) { animation-delay: 150ms; }
        .anim-stagger > *:nth-child(5) { animation-delay: 200ms; }
        .anim-stagger > *:nth-child(6) { animation-delay: 250ms; }
        .anim-stagger > *:nth-child(7) { animation-delay: 300ms; }
        .anim-stagger > *:nth-child(8) { animation-delay: 350ms; }
        .anim-stagger > *:nth-child(n+9) { animation-delay: 400ms; }
        .habit-card { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .habit-card:active { transform: scale(0.97); }
        .habit-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .tab-content { animation: fadeUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .modal-overlay { animation: fadeIn 0.2s ease-out both; }
        .modal-content { animation: popIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
        .check-anim { animation: checkBounce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .progress-shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); background-size: 200% 100%; animation: shimmer 2s ease-in-out infinite; }
        .bottom-nav { animation: slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: 0.2s; }
        .hero-card { position: relative; overflow: hidden; }
        .hero-card::after { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); animation: heroShine 4s ease-in-out infinite; }
        .hero-glow { animation: pulseGlow 4s ease-in-out infinite; }
        .btn-bounce:active { animation: checkBounce 0.2s ease; }
        * { transition-property: background-color, border-color, color, opacity, box-shadow; transition-duration: 0.35s; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        button, a { transition-property: all; transition-duration: 0.2s; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
        input, select { transition-property: border-color, background-color, box-shadow; transition-duration: 0.2s; }
        input:focus, select:focus { box-shadow: 0 0 0 3px rgba(91,124,245,0.15); }
      `}</style>
      <ConfettiCanvas trigger={confettiTrigger} />

      {/* Onboarding Tour Overlay */}
      {showOnboardingTour && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="bg-[#122040] rounded-3xl border border-[#223858] p-6 shadow-2xl">
              {/* Progress dots */}
              <div className="flex justify-center gap-1.5 mb-5">
                {tourSteps.map((_, i) => (
                  <div key={i} className={`h-1 rounded-full transition-all ${i === onboardingStep ? 'w-6 bg-blue-500' : i < onboardingStep ? 'w-2 bg-blue-500/40' : 'w-2 bg-[#1e3050]'}`} />
                ))}
              </div>

              {/* Content */}
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">{tourSteps[onboardingStep]?.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{tourSteps[onboardingStep]?.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{tourSteps[onboardingStep]?.desc}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => { setShowOnboardingTour(false); setOnboardingStep(0); }} className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors">Skip</button>
                <button onClick={() => {
                  if (onboardingStep < tourSteps.length - 1) {
                    setOnboardingStep(onboardingStep + 1);
                  } else {
                    setShowOnboardingTour(false);
                    setOnboardingStep(0);
                    setShowInviteModal(true);
                  }
                }} className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#5b7cf5] text-white shadow-lg shadow-[#5b7cf5]/15 active:scale-[0.98]">
                  {onboardingStep < tourSteps.length - 1 ? 'Next' : 'Start Tracking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Maxout screen flash */}
      {maxedHabit && <div className="fixed inset-0 z-[99] pointer-events-none animate-pulse" style={{ background: 'radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%)' }} />}
      {/* Mystery Bonus popup */}
      {bonusMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[101] anim-pop-in">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl text-center ${bonusMsg.type === 'jackpot' ? 'bg-gradient-to-r from-[#e8864a] to-[#d4a04a] text-white' : bonusMsg.type === 'epic' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white' : bonusMsg.type === 'rare' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : bonusMsg.type === 'bonus' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'}`}>
            <div className="text-lg font-black">{bonusMsg.label}</div>
          </div>
        </div>
      )}
      {/* Streak milestone popup */}
      {streakMilestone && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[101] anim-pop-in">
          <div className="px-6 py-3 rounded-2xl shadow-2xl text-center bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <div className="text-lg font-black">🔥 {streakMilestone.days}-Day Streak!</div>
            <div className="text-xs font-bold opacity-90">Unlocked: {streakMilestone.tier}</div>
          </div>
        </div>
      )}
      {/* Freeze popup */}
      {freezeMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[101] anim-pop-in">
          <div className="px-6 py-3 rounded-2xl shadow-2xl text-center bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
            <div className="text-sm font-black">{freezeMsg}</div>
          </div>
        </div>
      )}
      {/* ═══ HEADER ═══ */}
      <div className={`sticky top-0 ${T.headerBg} border-b ${T.border} z-40 shadow-sm`}>
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          {activeTab === 'overview' && (
            <>
              <div className="flex items-center gap-3">
                <h1 className={`text-xl font-black tracking-widest ${isSunset ? "text-[#ff7b29]" : "text-[#5b7cf5]"}`}>VERSA <span className="text-xl">✨</span></h1>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${darkMode ? (isSunset ? 'bg-[#2a1a28] text-gray-300' : 'bg-gray-800 text-gray-300') : 'bg-gray-100 text-gray-500'}`}>Study Group Code: <span className={T.text}>{currentRoom?.id}</span></div>
              </div>
              <div className="flex items-center cursor-pointer" onClick={() => setActiveTab('profile')}>
                <div className="relative">
                  {currentUser.photoURL ? <img src={currentUser.photoURL} className="w-9 h-9 rounded-full object-cover shadow-sm bg-gray-200" referrerPolicy="no-referrer" /> : <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center"><User size={16} className="text-gray-500" /></div>}
                  {streakData.streak > 0 && <div className="absolute -bottom-1 -right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#e8864a] border-2 border-white shadow-sm text-white text-[9px] font-black"><Flame size={10} />{streakData.streak}</div>}
                </div>
              </div>
            </>
          )}
          {activeTab === 'habits' && (
            <>
              <div>
                <h1 className={`text-2xl font-black ${T.text}`}>Log Progress</h1>
                <div className="text-[11px] font-semibold text-gray-400 mt-1">Consistency builds momentum.</div>
              </div>
              <div className="flex items-center gap-2">
                {streakMulti.multi > 1 && <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${darkMode ? (isSunset ? 'bg-[#ff7b29]/10 border-[#ff7b29]/20 text-[#e8864a]' : 'bg-blue-500/10 border-blue-500/20 text-blue-300') : (isSunset ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-blue-50 border-blue-200 text-blue-600')} text-xs font-bold shadow-sm`}><TrendingUp size={14} />{streakMulti.label}</div>}
                {habits.length > 0 && <button onClick={() => setEditMode(!editMode)} className={`p-2.5 rounded-2xl border shadow-sm ${editMode ? (darkMode ? (isSunset ? 'border-[#ff7b29]/50 bg-[#ff7b29]/10 text-[#ff7b29]' : 'border-blue-500/50 bg-blue-500/10 text-blue-400') : (isSunset ? 'border-orange-300 bg-orange-50 text-orange-600' : 'border-blue-300 bg-blue-50 text-blue-600')) : (darkMode ? (isSunset ? 'border-[#323236] text-gray-400 bg-[#1c1c1e]' : 'border-[#223858] text-gray-400 bg-[#182544]') : 'border-gray-200 text-gray-500 bg-white')}`}><Edit3 size={16} /></button>}
                <button onClick={() => setShowAddHabit(true)} className={`p-2.5 rounded-2xl border shadow-sm ${darkMode ? (isSunset ? 'border-[#323236] text-[#ff7b29] bg-[#1c1c1e]' : 'border-[#223858] text-blue-400 bg-[#182544]') : (isSunset ? 'border-gray-200 text-orange-600 bg-white' : 'border-gray-200 text-blue-600 bg-white')}`}><Plus size={18} /></button>
              </div>
            </>
          )}
          {activeTab === 'cohort' && (
            <>
              <div>
                <h1 className={`text-2xl font-black flex items-center gap-2 ${T.text}`}>Cohort <Users size={20} className={isSunset ? 'text-[#ff7b29]' : 'text-[#5b7cf5]'} /></h1>
                <div className="text-[11px] font-semibold text-gray-400 mt-1">Stay accountable with your group.</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowEmojiEditor(!showEmojiEditor)} className={`p-2.5 rounded-2xl border ${showEmojiEditor ? (darkMode ? (isSunset ? 'border-[#ff7b29]/50 bg-[#ff7b29]/10 text-[#ff7b29]' : 'border-blue-500/50 bg-blue-500/10 text-blue-400') : (isSunset ? 'border-orange-300 bg-orange-50 text-orange-600' : 'border-blue-300 bg-blue-50 text-blue-600')) : (T.border + ' text-gray-400 ' + T.bgCard)} shadow-sm`} title="Customize reactions">
                  <span className="text-sm">😀</span>
                </button>
                <button onClick={() => { setHistoryDate(getYesterday()); loadHistoryDate(getYesterday()); setShowHistory(true); }} className={`p-2.5 rounded-2xl border ${T.border + ' text-gray-400 ' + T.bgCard} shadow-sm`}>
                  <Calendar size={18} />
                </button>
              </div>
            </>
          )}
          {activeTab === 'stakes' && (
            <>
              <div>
                <h1 className={`text-2xl font-black flex items-center gap-2 ${T.text}`}>Weekly Stakes <Target size={20} className="text-red-500" /></h1>
                <div className="text-[11px] font-semibold text-gray-400 mt-1">Set a consequence for the lowest performer.</div>
              </div>
            </>
          )}
          {activeTab === 'profile' && (
            <>
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? <img src={currentUser.photoURL} className="w-12 h-12 rounded-full object-cover shadow-sm bg-gray-200" referrerPolicy="no-referrer" /> : <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center"><User size={24} className="text-gray-500" /></div>}
                <div>
                  <h1 className={`text-xl font-black ${T.text}`}>{currentUser.username} {isRoomCreator && <span className="text-[10px] text-gray-500 font-medium">(You)</span>}</h1>
                  <div className="text-xs font-semibold text-gray-500">Total Score: {myPts}</div>
                </div>
              </div>
              <div className="relative">
                <button onClick={() => setShowSettingsMenu(!showSettingsMenu)} className={`p-2.5 rounded-2xl border ${T.border + ' text-gray-400 ' + T.bgCard} shadow-sm`}>
                  <Settings size={18} />
                </button>
                {showSettingsMenu && <>
                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowSettingsMenu(false); }} />
                  <div className={`anim-slide-down absolute right-0 top-full mt-2 w-56 rounded-2xl border shadow-xl z-50 overflow-hidden ${T.bgCard} ${T.border}`}>
                    <div className="py-1">
                      <button onClick={(e) => { e.stopPropagation(); setShowAddHabit(true); setShowSettingsMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${T.textMuted} ${T.bgCardHover}`}><Plus size={15} className={isSunset ? 'text-[#ff7b29]' : 'text-blue-400'} />Add Habit</button>
                      <button onClick={(e) => { e.stopPropagation(); setShowAddCategory(true); setShowSettingsMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${T.textMuted} ${T.bgCardHover}`}><Plus size={15} className="text-purple-400" />Add Category</button>
                      {habits.length > 0 && <button onClick={(e) => { e.stopPropagation(); setEditMode(!editMode); setShowSettingsMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${editMode ? (isSunset ? 'text-[#ff7b29]' : 'text-blue-400') : (T.textMuted + ' ' + T.bgCardHover)}`}><Edit3 size={15} className={editMode ? (isSunset ? 'text-[#ff7b29]' : 'text-blue-400') : 'text-gray-500'} />{editMode ? 'Done Editing' : 'Edit Habits'}</button>}

                      {isRoomCreator && <button onClick={(e) => { e.stopPropagation(); setShowRoomSettings(true); setShowSettingsMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${T.textMuted} ${T.bgCardHover}`}><Crown size={15} className="text-[#e8864a]" />Room Settings</button>}
                      <div className={`px-4 py-3 border-t ${T.border}`}>
                        <div className={`text-[9px] font-bold tracking-widest uppercase mb-2.5 ${T.textDim}`}>Theme</div>
                        <div className="grid grid-cols-2 gap-2">
                          {THEMES.map(t => {
                            const isSun = t.includes('sunset');
                            const isDk = t.includes('dark');
                            const isActive = theme === t;
                            const previewBg = isDk ? (isSun ? '#1a1018' : '#0f1b2d') : (isSun ? '#fdf6f0' : '#f0f4f8');
                            const accent = isSun ? '#ff7b29' : '#5b7cf5';
                            return (
                              <button key={t} onClick={(e) => { e.stopPropagation(); setAppTheme(t); }} className={`p-2 rounded-xl text-left transition-all ${isActive ? (isSun ? 'ring-2 ring-[#ff7b29] bg-[#ff7b29]/10' : 'ring-2 ring-[#5b7cf5] bg-[#5b7cf5]/10') : (darkMode ? 'hover:bg-[#1e3050]' : 'hover:bg-gray-100')}`}>
                                <div className="rounded-lg mb-1.5 overflow-hidden" style={{ backgroundColor: previewBg, height: 28 }}>
                                  <div className="flex items-end gap-[2px] p-1.5 h-full">
                                    <div className="w-2 h-1.5 rounded-sm" style={{ backgroundColor: accent, opacity: 0.5 }} />
                                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: accent, opacity: 0.7 }} />
                                    <div className="w-2 h-3 rounded-sm" style={{ backgroundColor: accent }} />
                                  </div>
                                </div>
                                <div className={`text-[9px] font-bold ${isActive ? (isSun ? 'text-[#ff7b29]' : 'text-[#5b7cf5]') : T.textDim}`}>{THEME_LABELS[t]}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </>}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="w-full relative">
        <div className="max-w-xl mx-auto px-5 pt-6 pb-12">
        {/* ======================================= */}
        {/* TAB 1: OVERVIEW */}
        {/* ======================================= */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            {/* HERO CARD */}
            <div className={`hero-card anim-scale-in relative overflow-hidden w-full rounded-[2rem] ${isSunset ? "bg-gradient-to-br from-[#ff7b29] to-[#c44a6a]" : "bg-gradient-to-br from-[#5b7cf5] to-indigo-700"} leading-none text-white p-7 shadow-xl mb-8`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none hero-glow" />
              <div className={`font-bold tracking-widest uppercase text-[10px] mb-2 ${isSunset ? 'text-orange-100' : 'text-blue-100'}`}>WEEKLY POINTS</div>
              <div className="text-6xl font-black mb-1 anim-count">{getWeeklyPts(currentUser.id)}</div>

              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 px-4 py-2 anim-slide-right bg-white/20 backdrop-blur-md rounded-full border border-white/20 text-xs font-bold shadow-sm">
                  <TrendingUp size={14} /> {streakMulti.multi}x Multiplier
                </div>
                <div className={`text-[10px] font-semibold ${isSunset ? 'text-orange-200' : 'text-blue-200'}`}>Consistency mode active</div>
              </div>
            </div>

            {/* LIVE COHORT LEADERBOARD */}
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-black ${T.text}`}>Live Cohort Leaderboard</h2>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} shadow-sm text-[10px] text-gray-500 font-semibold`}><Clock size={12} /> Resets Sunday</div>
            </div>

            <div className="space-y-3 anim-stagger">
              {activeMembers.map(m => ({ ...m, weeklyPts: getWeeklyPts(m.id) })).sort((a, b) => b.weeklyPts - a.weeklyPts).map((member, i) => {
                const isMe = member.id === currentUser.id;
                return (
                  <div key={member.id} className={`anim-fade-up relative flex items-center p-4 rounded-2xl border ${isMe ? (darkMode ? (isSunset ? 'border-[#ff7b29]/50 bg-[#ff7b29]/10' : 'border-[#5b7cf5]/50 bg-[#5b7cf5]/10') : (isSunset ? 'border-[#ff7b29]/30 bg-white shadow-md shadow-orange-500/5' : 'border-[#5b7cf5]/30 bg-white shadow-md shadow-blue-500/5')) : (T.border + ' ' + T.bgCard + (darkMode ? '' : ' shadow-sm'))} transition-all`}>
                    {isMe && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 ${isSunset ? "bg-[#ff7b29]" : "bg-[#5b7cf5]"} rounded-r-full`} />}

                    <div className="w-8 flex justify-center text-sm font-black mr-2">
                      {i === 0 ? <Crown size={18} className="text-amber-500" /> : <span className={T.textDim}>{i + 1}</span>}
                    </div>

                    {member.photoURL ? <img src={member.photoURL} className="w-10 h-10 rounded-full object-cover mr-4" /> : <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-4"><User size={16} className="text-gray-400" /></div>}

                    <div className="flex-1">
                      <div className={`font-black text-sm ${T.text}`}>{member.username} {isMe && <span className="text-gray-500 font-medium">(You)</span>}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {member.weeklyPts > 0 && <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400"><Flame size={10} className="text-amber-500" />{member.weeklyPts} pts</span>}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xl font-black ${isMe ? (isSunset ? 'text-[#ff7b29]' : 'text-[#5b7cf5]') : (T.text)}`}>{member.weeklyPts}</div>
                      <div className="text-[9px] font-bold tracking-widest text-gray-400 uppercase">PTS</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* TAB 2: HABITS */}
        {/* ======================================= */}
        {activeTab === 'habits' && (
          <div className="tab-content">
            {/* Daily Target Progress */}
            <div className={`p-5 rounded-3xl border ${T.border} ${T.bgCard} ${darkMode ? '' : 'shadow-sm'} mb-8 anim-fade-up`}>
              <div className="flex justify-between items-center mb-3">
                <span className={`text-sm font-bold ${T.text}`}>Daily Target</span>
                <span className={`text-sm font-black ${isSunset ? "text-[#ff7b29]" : "text-[#5b7cf5]"}`}>{Math.min(100, Math.round(dailyProg * 100))}%</span>
              </div>
              <div className={`h-3 w-full ${darkMode ? (isSunset ? 'bg-[#120a14]' : 'bg-[#0f1b2d]') : 'bg-gray-100'} rounded-full overflow-hidden mb-3`}>
                <div className={`h-full ${isSunset ? "bg-[#ff7b29]" : "bg-[#5b7cf5]"} rounded-full transition-all duration-1000 ease-out relative overflow-hidden`} style={{ width: `${Math.min(100, dailyProg * 100)}%` }}><div className="progress-shimmer absolute inset-0 rounded-full" /></div>
              </div>
              <div className="text-[9px] font-bold tracking-widest text-gray-400 uppercase text-right">HIT 90% TO BANK A STREAK FREEZE</div>
            </div>

            {/* Habits grouped by category */}
            {allCatNames.map(cat => {
              const catHabits = habits.filter(h => h.category === cat);
              if (catHabits.length === 0 && !editMode) return null;
              const ct = getCT(cat);
              const catIcon = activeCategories.find(c => c.name === cat)?.icon || '⭐';
              return (
                <div key={cat} className="mb-6 anim-fade-up">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-sm">{catIcon}</span>
                    <span className={`text-[10px] font-bold tracking-widest uppercase ${ct.txt}`}>{cat}</span>
                    <span className={`text-[10px] ${T.textDim}`}>{catHabits.length}</span>
                  </div>
                  <div className="space-y-3 anim-stagger">
                    {catHabits.map(h => {
                      const cnt = getCount(h.id);
                      const done = cnt > 0;
                      const isNeg = h.points < 0;
                      const maxed = !h.isRepeatable && cnt >= 1;
                      const doneBorder = isNeg ? (darkMode ? 'border-rose-500/30 bg-rose-500/10' : 'border-rose-200 bg-rose-50/50') : (darkMode ? `${ct.bdr} ${ct.bgS}` : (isSunset ? `${ct.bdr} bg-orange-50/30` : `${ct.bdr} bg-blue-50/30`));
                      const defaultBorder = T.border + ' ' + T.bgCard + (darkMode ? '' : ' shadow-sm');
                      return (
                        <div key={h.id} className={`habit-card flex items-center p-4 rounded-2xl border ${done ? doneBorder : defaultBorder}`}>
                          {editMode ? (
                            <button onClick={() => deleteHabit(h.id)} className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mr-4"><X size={12} strokeWidth={3} /></button>
                          ) : isNeg ? (
                            <button onClick={() => handleIncrement(h.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-all ${done ? 'bg-rose-500 border-rose-500 text-white' : (darkMode ? 'border-gray-600' : 'border-gray-300')}`}>
                              {done ? <X size={12} strokeWidth={4} /> : null}
                            </button>
                          ) : (
                            <button onClick={() => !maxed ? handleIncrement(h.id) : handleDecrement(h.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-all ${done ? (isSunset ? 'bg-[#ff7b29] border-[#ff7b29] text-white' : 'bg-[#5b7cf5] border-[#5b7cf5] text-white') : (darkMode ? 'border-gray-600' : 'border-gray-300')}`}>
                              {done && <Check size={14} strokeWidth={4} />}
                            </button>
                          )}
                          <div className="flex-1">
                            <div className={`text-sm font-bold ${done ? (darkMode ? 'text-[#7a8ba8]' : 'text-gray-600') : (T.text)}`}>{h.name} {(h.isRepeatable || isNeg) && cnt > 0 && <span className={isNeg ? 'text-rose-400 ml-1' : `${ct.txt} ml-1`}>x{cnt}</span>}</div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`px-2 py-0.5 rounded-full ${isNeg ? (darkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-600') : (darkMode ? `${ct.bgS} ${ct.txt}` : (isSunset ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'))} text-[9px] font-bold tracking-widest uppercase`}>{isNeg ? '-' : '+'}{Math.abs(h.points)} pts</span>
                              {h.unit && <span className={`text-[9px] ${T.textDim}`}>{h.unit}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {cnt > 0 && !editMode && <button onClick={() => handleDecrement(h.id)} className={`w-6 h-6 rounded-full flex items-center justify-center opacity-30 hover:opacity-70 ${isNeg ? 'text-emerald-400' : 'text-gray-400'}`}><MinusIcon size={12} /></button>}
                            {editMode && <button onClick={() => openEditHabit(h)} className={`text-[10px] px-2.5 py-1 rounded-lg font-bold ${darkMode ? (isSunset ? 'text-[#ff7b29] bg-[#ff7b29]/10' : 'text-blue-400 bg-blue-500/10') : (isSunset ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50')}`}>Edit</button>}
                            {!editMode && !isNeg && <button onClick={() => openEditHabit(h)} className={darkMode ? 'text-gray-600' : 'text-gray-300'}><ChevronRight size={16} /></button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {habits.length === 0 && <div className="text-center py-12 text-sm text-gray-500">No habits added. Tap + to get started.</div>}
          </div>
        )}

        {/* ======================================= */}
        {/* TAB 3: COHORT (FEED) */}
        {/* ======================================= */}
        {activeTab === 'cohort' && (
          <div className="tab-content anim-stagger space-y-4 relative">
            {/* Emoji customizer */}
            {showEmojiEditor && (
              <div className={`p-4 rounded-3xl border ${T.border} ${T.bgCard} ${darkMode ? '' : 'shadow-sm'} anim-slide-down`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`text-xs font-black uppercase tracking-widest ${T.textDim}`}>Customize Reactions</div>
                  <button onClick={() => setShowEmojiEditor(false)} className={`text-xs font-bold ${T.textMuted} hover:${T.text}`}><X size={16} /></button>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {reactionEmojis.map((em, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${darkMode ? 'border-[#223858] bg-[#0f1b2d]' : 'border-gray-200 bg-gray-50'}`}>
                      <span className="text-lg">{em}</span>
                      <button onClick={() => saveReactionEmojis(reactionEmojis.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-400"><X size={12} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Paste an emoji..." value={emojiDraft} onChange={e => setEmojiDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && emojiDraft.trim()) { saveReactionEmojis([...reactionEmojis, emojiDraft.trim()]); setEmojiDraft(''); } }} className={inputCls} maxLength={4} style={{ flex: 1 }} />
                  <button onClick={() => { if (emojiDraft.trim()) { saveReactionEmojis([...reactionEmojis, emojiDraft.trim()]); setEmojiDraft(''); } }} className={`px-4 rounded-xl font-bold text-sm ${darkMode ? (isSunset ? 'bg-[#2a2a2e] text-[#ff7b29] hover:bg-[#333336]' : 'bg-[#264060] text-blue-400 hover:bg-[#2a4a70]') : (isSunset ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')}`}><Plus size={18} /></button>
                </div>
                {reactionEmojis.length === 0 && <button onClick={() => saveReactionEmojis(DEFAULT_REACTION_EMOJIS)} className={`mt-2 w-full text-center text-xs font-bold ${T.textMuted} hover:underline`}>Reset to defaults</button>}
              </div>
            )}
            {activityFeed.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">No activity yet</p> : activityFeed.map(a => {
              const ts = a.ts ? new Date(a.ts) : null;
              const timeAgo = ts ? (Math.floor((Date.now() - ts.getTime()) / 60000) < 60 ? Math.floor((Date.now() - ts.getTime()) / 60000) + 'M' : Math.floor((Date.now() - ts.getTime()) / 3600000) + 'H') + ' AGO' : '';
              const reactions = a.reactions || {};
              return (
                <div key={a.id} className={`p-4 rounded-3xl border ${T.border} ${T.bgCard} ${darkMode ? '' : 'shadow-sm'}`}>
                  <div className="flex gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full border ${darkMode ? 'border-[#223858] bg-[#0f1b2d]' : 'border-gray-100 bg-gray-50'} flex items-center justify-center text-lg shrink-0`}>
                      {a.text.includes('streak') ? '🔥' : a.bonus === 'jackpot' ? '🎰' : a.text.includes('caved') ? '💀' : '⚡'}
                    </div>
                    <div className="flex-1 mt-0.5">
                      <div className={`text-sm ${darkMode ? 'text-[#9aaec0]' : 'text-gray-600'}`}><span className={`font-black ${T.text}`}>{a.username}</span> {a.text}</div>
                      <div className="text-[9px] font-bold tracking-widest text-gray-400 mt-1">{timeAgo}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {reactionEmojis.map(emoji => {
                      const rxValues = Object.values(reactions);
                      const count = rxValues.filter(r => r === emoji).length;
                      const myReaction = reactions[currentUser.id] === emoji;
                      return (
                        <button key={emoji} onClick={() => reactToActivity(a.id, emoji)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95 ${myReaction ? (isSunset ? 'border-[#ff7b29]/50 bg-[#ff7b29]/15 text-[#ff7b29]' : 'border-[#5b7cf5]/50 bg-[#5b7cf5]/15 text-[#5b7cf5]') : (darkMode ? 'border-[#223858] bg-[#0f1b2d] text-gray-400 hover:bg-[#182544]' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100')}`}>
                          <span>{emoji}</span>{count > 0 && <span className="tabular-nums">{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ======================================= */}
        {/* TAB 4: STAKES */}
        {/* ======================================= */}
        {activeTab === 'stakes' && (
          <div className="tab-content pb-10">
            {/* ── Horizontal Distance Leaderboard ── */}
            {roomMembers.length > 0 && (() => {
              const ranked = [...activeMembers].map(m => ({ ...m, weeklyPts: getWeeklyPts(m.id) })).sort((a, b) => b.weeklyPts - a.weeklyPts);
              const topPts = ranked[0]?.weeklyPts || 1;
              const lastIdx = ranked.length - 1;

              const now = new Date();
              const sunday = new Date();
              sunday.setDate(now.getDate() + ((7 - now.getDay()) % 7));
              if (now.getDay() === 0 && now.getHours() > 0) sunday.setDate(now.getDate() + 7);
              sunday.setHours(23, 59, 59, 999);
              const hrsLeft = Math.max(0, Math.floor((sunday - now) / 3600000));
              const dLeft = Math.floor(hrsLeft / 24);
              const timeLeftStr = dLeft > 0 ? `${dLeft}d ${hrsLeft % 24}h` : `${hrsLeft}h`;

              return (
                <div className={`p-5 rounded-3xl border ${T.border} ${T.bgCard} ${darkMode ? '' : 'shadow-sm'} mb-8 anim-fade-up`}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className={`text-sm font-black ${T.text}`}>Point Race</div>
                      <div className={`text-[10px] font-bold tracking-widest uppercase ${T.textDim} mt-0.5`}>Who's at risk?</div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} shadow-sm`}>
                      <Clock size={12} className="text-gray-500" />
                      <span className="text-[10px] text-gray-500 font-bold tracking-wide">{timeLeftStr}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {ranked.map((m, i) => {
                      const pct = topPts > 0 ? Math.max(8, Math.round((m.weeklyPts / topPts) * 100)) : 8;
                      const isLast = i === lastIdx && ranked.length > 1;
                      const isMe = m.id === currentUser.id;
                      const barColor = isLast
                        ? 'bg-gradient-to-r from-red-500 to-red-400'
                        : i === 0
                          ? (isSunset ? 'bg-gradient-to-r from-[#ff7b29] to-[#e8864a]' : 'bg-gradient-to-r from-[#5b7cf5] to-indigo-500')
                          : (darkMode ? 'bg-gradient-to-r from-[#334868] to-[#223858]' : 'bg-gradient-to-r from-gray-300 to-gray-200');
                      return (
                        <div key={m.id} className="anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black w-4 text-center ${isLast ? 'text-red-500' : (i === 0 ? (isSunset ? 'text-[#ff7b29]' : 'text-[#5b7cf5]') : T.textDim)}`}>{i + 1}</span>
                              <span className={`text-sm font-bold ${isLast ? 'text-red-500' : (isMe ? T.text : T.textDim)}`}>{m.username}{isMe ? ' (you)' : ''}</span>
                              {isLast && <span className="text-[9px] font-black tracking-widest uppercase text-red-500/80 ml-1">AT RISK</span>}
                            </div>
                            <span className={`text-xs font-black tabular-nums ${isLast ? 'text-red-500' : (i === 0 ? (isSunset ? 'text-[#ff7b29]' : 'text-[#5b7cf5]') : T.textMuted)}`}>{m.weeklyPts} pts</span>
                          </div>
                          <div className={`w-full h-3 rounded-full overflow-hidden ${darkMode ? 'bg-[#0f1b2d]' : 'bg-gray-100'}`}>
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor} relative overflow-hidden`}
                              style={{ width: `${pct}%` }}
                            >
                              {i === 0 && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: 'shimmer 2s infinite' }} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Massive Target Icon ── */}
            <div className="flex flex-col items-center justify-center py-8 anim-fade-up" style={{ animationDelay: '150ms' }}>
              <button
                onClick={() => setShowStakes(true)}
                className="group relative w-44 h-44 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 hover:scale-105 cursor-pointer"
                style={{ filter: `drop-shadow(0 0 30px ${isSunset ? 'rgba(255,123,41,0.15)' : 'rgba(91,124,245,0.15)'})` }}
              >
                {/* Outer ring pulse */}
                <div className={`absolute inset-0 rounded-full border-2 ${isSunset ? 'border-[#ff7b29]/20' : 'border-[#5b7cf5]/20'} group-hover:scale-110 transition-transform duration-500`} />
                <div className={`absolute inset-2 rounded-full border ${isSunset ? 'border-[#ff7b29]/10' : 'border-[#5b7cf5]/10'} group-hover:scale-105 transition-transform duration-700`} />
                <Target size={100} className={`${isSunset ? 'text-[#ff7b29]' : 'text-[#5b7cf5]'} transition-all duration-300 group-hover:opacity-90`} strokeWidth={1} />
                {/* Center dot glow */}
                <div className={`absolute w-4 h-4 rounded-full ${isSunset ? 'bg-[#ff7b29]' : 'bg-[#5b7cf5]'} opacity-60 group-hover:opacity-100 transition-opacity`} style={{ animation: 'pulseGlow 2s ease-in-out infinite' }} />
              </button>
              <div className={`mt-5 text-[10px] font-black tracking-[0.2em] uppercase ${T.textDim}`}>
                Tap to set or spin stakes
              </div>
              {roomStakes && (
                <div className={`mt-3 px-4 py-2 rounded-full border text-xs font-bold ${darkMode ? 'border-[#223858] bg-[#182544] text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                  {roomStakes.type === 'wheel' ? '🎰 Wheel' : '⚖️ Fixed'}: {(() => { try { return roomStakes.type === 'wheel' ? `${JSON.parse(roomStakes.description).length} options` : `"${roomStakes.description.substring(0, 30)}${roomStakes.description.length > 30 ? '...' : ''}"`; } catch { return roomStakes.description?.substring(0, 30) || 'Custom'; } })()}
                </div>
              )}
            </div>

            {/* ── Graveyard / History Feed ── */}
            <div className="anim-fade-up" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className={`text-sm font-black uppercase tracking-widest ${T.textDim}`}>The Graveyard</h2>
                <div className={`text-[10px] uppercase font-bold tracking-widest ${T.textMuted}`}><span className="opacity-60">History</span></div>
              </div>
              
              {archivedStakes.length === 0 ? (
                <div className={`text-center py-10 rounded-3xl border-2 border-dashed ${darkMode ? 'border-[#223858] text-gray-600' : 'border-gray-200 text-gray-400'} text-sm font-bold`}>Nobody has suffered... yet.</div>
              ) : (
                <div className="space-y-3">
                  {[...archivedStakes].reverse().map(st => {
                    const lsr = roomMembers.find(m => m.id === st.loser_id)?.username || 'Someone';
                    const isMe = st.loser_id === currentUser.id;
                    const bdr = isMe ? (darkMode ? 'border-red-500/30' : 'border-red-300') : T.border;
                    const bgC = isMe ? (darkMode ? 'bg-red-500/10' : 'bg-red-50') : T.bgCard;
                    return (
                      <div key={st.id} className={`p-4 rounded-3xl border ${bdr} ${bgC} ${darkMode ? '' : 'shadow-sm'}`}>
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 mt-1 rounded-full flex items-center justify-center text-xl shrink-0 border ${isMe ? 'border-red-500/50 bg-red-500/20 text-red-500 shadow-inner' : (darkMode ? 'border-[#223858] bg-[#0f1b2d] text-gray-400' : 'border-gray-200 bg-white shadow-sm text-gray-500')}`}>
                            {st.type === 'wheel' ? '🎰' : '⚖️'}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <div className={`text-sm font-black ${isMe ? 'text-red-500' : T.text}`}>{lsr} <span className={T.textDim}>failed.</span></div>
                              <div className={`text-[9px] font-bold tracking-widest uppercase ${T.textMuted}`}>{st.type}</div>
                            </div>
                            <div className={`text-sm leading-relaxed font-medium ${isMe ? (darkMode ? 'text-red-300' : 'text-red-800') : T.textDim}`}>"{st.description}"</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ======================================= */}
        {/* TAB 5: PROFILE */}
        {/* ======================================= */}
        {activeTab === 'profile' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
            <div className="grid grid-cols-2 gap-4 mb-4 anim-stagger">
              <div className={`p-4 rounded-3xl border ${T.border} ${T.bgCard} ${darkMode ? '' : 'shadow-sm'}`}>
                <div className="text-[10px] font-bold tracking-widest text-[#9aaec0] uppercase mb-2">Trophies</div>
                <div className="flex items-end justify-between">
                  <div className={`text-4xl font-black ${T.text}`}>{archivedStakes.filter(st => st.winner_id === currentUser.id).length}</div>
                  <Trophy size={28} className="text-amber-400 opacity-50" strokeWidth={1.5} />
                </div>
              </div>
              <div className={`p-4 rounded-3xl border ${T.border} ${T.bgCard} ${darkMode ? '' : 'shadow-sm'}`}>
                <div className="text-[10px] font-bold tracking-widest text-[#9aaec0] uppercase mb-2">Penalties</div>
                <div className="flex items-end justify-between">
                  <div className={`text-4xl font-black ${T.text}`}>{archivedStakes.filter(st => st.loser_id === currentUser.id).length}</div>
                  <div className="w-7 h-7 rounded-full border border-red-400 text-red-400 flex items-center justify-center opacity-50 font-bold">!</div>
                </div>
              </div>
              <div className={`anim-fade-up p-4 rounded-3xl border ${darkMode ? (isSunset ? 'border-[#ff7b29]/30 bg-[#ff7b29]/10' : 'border-[#5b7cf5]/30 bg-[#5b7cf5]/10') : (isSunset ? 'border-orange-100 bg-orange-50/50 shadow-sm' : 'border-blue-100 bg-blue-50/50 shadow-sm')}`}>
                <div className={`text-[10px] font-bold tracking-widest uppercase mb-2 ${isSunset ? 'text-[#ff7b29]' : 'text-[#5b7cf5]'}`}>Top Streak</div>
                <div className="flex items-end justify-between">
                  <div className={`text-4xl font-black ${darkMode ? (isSunset ? 'text-orange-300' : 'text-blue-300') : (isSunset ? 'text-orange-900' : 'text-blue-900')}`}>{streakData.streak}</div>
                  <TrendingUp size={28} className={`opacity-50 ${isSunset ? 'text-[#ff7b29]' : 'text-[#5b7cf5]'}`} strokeWidth={1.5} />
                </div>
              </div>
              <div className={`anim-fade-up p-4 rounded-3xl border ${darkMode ? 'border-cyan-900/50 bg-cyan-900/20' : 'border-cyan-100 bg-cyan-50/50 shadow-sm'}`}>
                <div className="text-[10px] font-bold tracking-widest text-cyan-500 uppercase mb-2">Freezes</div>
                <div className="flex items-end justify-between">
                  <div className={`text-4xl font-black ${darkMode ? 'text-cyan-300' : 'text-cyan-900'}`}>{streakFreeze}</div>
                  <TrendingUp size={28} className="text-cyan-400 opacity-50" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            <div className={`p-5 rounded-3xl border ${T.border} ${T.bgCard} ${darkMode ? '' : 'shadow-sm'}`}>
              <div className="flex justify-between items-center mb-4">
                <div className="text-[10px] font-bold tracking-widest text-[#9aaec0] uppercase">Consistency</div>
                <div className={`px-2 py-1 rounded ${darkMode ? (isSunset ? 'bg-[#120a14]' : 'bg-[#0f1b2d]') : 'bg-gray-100'} text-[10px] font-bold ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>Last 90 Days</div>
              </div>
              <button onClick={loadHeatMap} className={`w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed ${darkMode ? (isSunset ? 'border-[#3d2640] text-gray-500 hover:text-[#ff7b29] hover:bg-[#ff7b29]/5' : 'border-[#223858] text-gray-500 hover:text-[#5b7cf5] hover:bg-[#5b7cf5]/5') : (isSunset ? 'border-gray-200 text-gray-400 hover:text-orange-600 hover:bg-orange-50' : 'border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-gray-50')} rounded-xl transition-all font-bold`}>
                <BarChart3 size={20} /> View Heatmap
              </button>
            </div>

            {/* Theme Picker */}
            <div className={`p-5 rounded-3xl border ${T.border} ${T.bgCard} ${darkMode ? '' : 'shadow-sm'} mt-4`}>
              <div className="text-[10px] font-bold tracking-widest text-[#9aaec0] uppercase mb-3">Appearance</div>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map(t => {
                  const isActive = theme === t;
                  const isSun = t.includes('sunset');
                  const isDk = t.includes('dark');
                  const previewBg = isDk ? (isSun ? '#1a1018' : '#0f1b2d') : (isSun ? '#fdf6f0' : '#f0f4f8');
                  const previewAccent = isSun ? '#ff7b29' : '#5b7cf5';
                  return (
                    <button key={t} onClick={() => setAppTheme(t)} className={`relative p-3 rounded-2xl border-2 transition-all active:scale-[0.97] ${isActive ? (isSun ? 'border-[#ff7b29] shadow-lg shadow-[#ff7b29]/20' : 'border-[#5b7cf5] shadow-lg shadow-[#5b7cf5]/20') : (darkMode ? 'border-[#223858] hover:border-[#334868]' : 'border-gray-200 hover:border-gray-300')}`}>
                      {/* Mini preview */}
                      <div className="rounded-xl overflow-hidden mb-2" style={{ backgroundColor: previewBg, height: 40 }}>
                        <div className="flex items-end gap-1 p-2 h-full">
                          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: previewAccent, opacity: 0.8 }} />
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: previewAccent, opacity: 0.6 }} />
                          <div className="w-3 h-4 rounded-sm" style={{ backgroundColor: previewAccent }} />
                        </div>
                      </div>
                      <div className={`text-[10px] font-bold ${isActive ? (isSun ? 'text-[#ff7b29]' : 'text-[#5b7cf5]') : T.textMuted}`}>{THEME_LABELS[t]}</div>
                      {isActive && <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] ${isSun ? 'bg-[#ff7b29]' : 'bg-[#5b7cf5]'}`}>✓</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 anim-fade-up">
              <button onClick={() => setShowInviteModal(true)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${T.border} ${T.bgCard} ${T.textMuted} ${T.bgCardHover}`}><UserPlus size={16} className={isSunset ? "text-[#ff7b29]" : "text-blue-400"} /><span className="text-sm font-medium">Invite to Room</span></button>
              {lastWeekData && <button onClick={() => setShowWeeklyRecap(true)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${T.border} ${T.bgCard} ${T.textMuted} ${T.bgCardHover}`}><BarChart3 size={16} className="text-purple-400" /><span className="text-sm font-medium">Weekly Recap</span></button>}
              <button onClick={() => setShowHelp(true)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${T.border} ${T.bgCard} ${T.textMuted} ${T.bgCardHover}`}><HelpCircle size={16} className="text-gray-400" /><span className="text-sm font-medium">How Versa Works</span></button>
              <button onClick={() => supabase.auth.signOut()} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${T.border} ${T.bgCard} hover:bg-red-500/5 text-red-400`}><LogOut size={16} /><span className="text-sm font-medium">Sign Out</span></button>
            </div>
          </div>
        )}
          </div>
        </div>

      {/* ═══ BOTTOM NAVIGATION TABS ═══ */}
      <div className={`fixed bottom-0 left-0 right-0 w-full bottom-nav z-[999] border-t shadow-[0_-10px_40px_rgba(0,0,0,0.1)] ${T.bgCard} ${T.border} ${showWeeklyRecap ? 'pointer-events-none opacity-40' : ''}`}>
        <div className="max-w-xl mx-auto flex items-center justify-between px-6 py-3 relative">
          {[
            { id: 'overview', icon: <Home size={22} className="mb-1" strokeWidth={2.5} />, label: 'OVERVIEW' },
            { id: 'habits', icon: <CheckSquare size={22} className="mb-1" strokeWidth={2.5} />, label: 'HABITS' },
            { id: 'cohort', icon: <Users size={22} className="mb-1" strokeWidth={2.5} />, label: 'COHORT' },
            { id: 'stakes', icon: <Target size={22} className="mb-1" strokeWidth={2.5} />, label: 'STAKES' },
            { id: 'profile', icon: <User size={22} className="mb-1" strokeWidth={2.5} />, label: 'PROFILE' }
          ].map(tab => (
            <button key={tab.id} onClick={(e) => { 
               e.preventDefault(); 
               if (showWeeklyRecap) return;
               setActiveTab(tab.id); 
               window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }} className={`flex flex-col items-center justify-center w-16 h-14 touch-manipulation cursor-pointer select-none transition-all ${activeTab === tab.id ? (T.accentTxt + ' scale-110') : (T.textMuted + ' hover:' + T.text)}`}>
              {tab.icon}
              <span className="text-[8px] font-black tracking-widest mt-0.5">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}{/* ═══ MODALS ═══ */}

      {/* Add Habit */}
      <Modal show={showAddHabit} onClose={() => setShowAddHabit(false)} dark={darkMode}>
        <ModalHeader title="Add Habit" onClose={() => setShowAddHabit(false)} dark={darkMode} />
        <button onClick={loadDefaultHabits} disabled={loading} className="w-full mb-5 px-4 py-3 bg-[#7c82a8] text-white rounded-xl shadow-lg shadow-violet-500/20 text-sm font-bold active:scale-[0.98] disabled:opacity-50">{loading ? 'Loading...' : '⚡ Load Preset (9 habits)'}</button>
        <div className="space-y-3">
          <input type="text" placeholder="Habit name" value={newHabit.name} onChange={e => setNewHabit({ ...newHabit, name: e.target.value })} className={inputCls} maxLength={30} />
          <div className="grid grid-cols-2 gap-3">
            <select value={newHabit.category} onChange={e => setNewHabit({ ...newHabit, category: e.target.value })} className={inputCls}>{allCatNames.map(c => <option key={c} value={c} className={darkMode ? 'bg-[#122040]' : 'bg-white'}>{c}</option>)}</select>
            <input type="number" placeholder="Points" value={newHabit.points} onChange={e => setNewHabit({ ...newHabit, points: e.target.value })} className={inputCls} />
          </div>
          <input type="text" placeholder="Time description (e.g. 30 min, per hour)" value={newHabit.unit} onChange={e => setNewHabit({ ...newHabit, unit: e.target.value })} className={inputCls} maxLength={20} />
          <input type="text" placeholder="Description (e.g. what counts?)" value={newHabit.description} onChange={e => setNewHabit({ ...newHabit, description: e.target.value })} className={inputCls} maxLength={60} />
          <div className="flex gap-4">
            <label className="flex items-center gap-3 py-1 cursor-pointer"><input type="checkbox" checked={newHabit.isRepeatable} onChange={e => setNewHabit({ ...newHabit, isRepeatable: e.target.checked })} className="w-4 h-4 rounded accent-blue-500" /><span className="text-sm text-gray-400">Repeatable</span></label>
            <label className="flex items-center gap-3 py-1 cursor-pointer"><input type="checkbox" checked={newHabit.isNegative} onChange={e => setNewHabit({ ...newHabit, isNegative: e.target.checked })} className="w-4 h-4 rounded accent-red-500" /><span className="text-sm text-red-500">Vice (Subtracts)</span></label>
          </div>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <div className="flex gap-3 pt-2"><button onClick={() => setShowAddHabit(false)} className={`flex-1 px-4 py-3 border ${T.border} rounded-xl text-sm ${T.textMuted} hover:${T.bgCardHover}`}>Cancel</button><button onClick={addHabit} className="flex-1 px-4 py-3 bg-[#5b7cf5] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#5b7cf5]/15 active:scale-[0.98]">Add</button></div>
        </div>
      </Modal>

      {/* Edit Habit */}
      <Modal show={!!showEditHabit} onClose={() => setShowEditHabit(null)} dark={darkMode}>
        <ModalHeader title="Edit Habit" onClose={() => setShowEditHabit(null)} icon={<Edit3 size={18} className="text-blue-400" />} dark={darkMode} />
        <div className="space-y-3">
          <input type="text" placeholder="Name" value={editHabitData.name || ''} onChange={e => setEditHabitData({ ...editHabitData, name: e.target.value })} className={inputCls} maxLength={30} />
          <div className="grid grid-cols-2 gap-3">
            <select value={editHabitData.category || allCatNames[0]} onChange={e => setEditHabitData({ ...editHabitData, category: e.target.value })} className={inputCls}>{allCatNames.map(c => <option key={c} value={c} className={darkMode ? 'bg-[#122040]' : 'bg-white'}>{c}</option>)}</select>
            <input type="number" placeholder="Points" value={editHabitData.points || ''} onChange={e => setEditHabitData({ ...editHabitData, points: e.target.value })} className={inputCls} />
          </div>
          <input type="text" placeholder="Time description (e.g. 30 min, per hour)" value={editHabitData.unit || ''} onChange={e => setEditHabitData({ ...editHabitData, unit: e.target.value })} className={inputCls} maxLength={20} />
          <input type="text" placeholder="Description (e.g. what counts?)" value={editHabitData.description || ''} onChange={e => setEditHabitData({ ...editHabitData, description: e.target.value })} className={inputCls} maxLength={60} />
          <div className="flex gap-4">
            <label className="flex items-center gap-3 py-1 cursor-pointer"><input type="checkbox" checked={editHabitData.isRepeatable || false} onChange={e => setEditHabitData({ ...editHabitData, isRepeatable: e.target.checked })} className="w-4 h-4 rounded accent-blue-500" /><span className="text-sm text-gray-400">Repeatable</span></label>
            <label className="flex items-center gap-3 py-1 cursor-pointer"><input type="checkbox" checked={editHabitData.isNegative || false} onChange={e => setEditHabitData({ ...editHabitData, isNegative: e.target.checked })} className="w-4 h-4 rounded accent-red-500" /><span className="text-sm text-red-500">Vice (Subtracts)</span></label>
          </div>
          <div className="flex gap-3 pt-2"><button onClick={() => setShowEditHabit(null)} className={`flex-1 px-4 py-3 border ${T.border} rounded-xl text-sm ${T.textMuted} hover:${T.bgCardHover}`}>Cancel</button><button onClick={saveEditHabit} className="flex-1 px-4 py-3 bg-[#5b7cf5] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#5b7cf5]/15 active:scale-[0.98]">Save</button></div>
        </div>
      </Modal>

      {/* Add Category */}
      <Modal show={showAddCategory} onClose={() => setShowAddCategory(false)} dark={darkMode}>
        <ModalHeader title="Manage Categories" onClose={() => setShowAddCategory(false)} dark={darkMode} />
        <div className="space-y-2 mb-5">{activeCategories.map(cat => {
          const ct = getCT(cat.name);
          return (
            <div key={cat.name} className={`flex items-center justify-between p-3 rounded-xl border ${ct.bdr} ${ct.bgS}`}>
              <div className="flex items-center gap-2"><span>{cat.icon}</span><span className={`text-sm font-semibold ${ct.txt}`}>{cat.name}</span></div>
              {!['Study', 'Health', 'Focus'].includes(cat.name) && <button onClick={() => deleteCategory(cat.name)} className="text-[10px] text-gray-600 hover:text-red-400 uppercase tracking-wider">Remove</button>}
            </div>
          );
        })}</div>
        <div className={`border-t ${T.border} pt-4`}>
          <p className={`text-xs ${T.textMuted} mb-3`}>Add a new category</p>
          <input type="text" placeholder="Category name" value={newCatName} onChange={e => setNewCatName(e.target.value)} className={inputCls + ' mb-3'} maxLength={20} />
          <p className={`text-[10px] ${T.textDim} mb-2`}>Icon</p>
          <div className="flex flex-wrap gap-1.5 mb-4">{ICON_OPTIONS.map(ic => <button key={ic} onClick={() => setNewCatIcon(ic)} className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all ${newCatIcon === ic ? 'bg-blue-500/20 border border-blue-500/30 scale-110' : darkMode ? 'bg-[#1e2e50] hover:bg-[#223858]' : 'bg-gray-100 hover:bg-gray-200'}`}>{ic}</button>)}</div>
          <p className={`text-[10px] ${T.textDim} mb-2`}>Color</p>
          <div className="flex flex-wrap gap-2 mb-4">{COLOR_PALETTE.map((cp, i) => <button key={i} onClick={() => setNewCatColor(i)} className={`w-7 h-7 rounded-full transition-all ${cp.bg} ${newCatColor === i ? 'ring-2 ring-offset-2 ring-white/30 scale-110' : ''}`} />)}</div>
          {error && <p className="text-red-400 text-xs text-center mb-2">{error}</p>}
          <button onClick={addCategory} disabled={!newCatName.trim()} className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 active:scale-[0.98] disabled:opacity-40">Add Category</button>
        </div>
      </Modal>

      {/* History */}
      <Modal show={showHistory} onClose={() => setShowHistory(false)} dark={darkMode}>
        <ModalHeader title="History" onClose={() => setShowHistory(false)} icon={<Calendar size={18} className="text-purple-400" />} dark={darkMode} />
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shiftHistoryDate(-1)} className="p-2 text-gray-600 hover:text-white"><ChevronLeft size={18} /></button>
          <span className="text-sm font-medium text-gray-300">{historyDate ? formatDate(historyDate) : ''}</span>
          <button onClick={() => shiftHistoryDate(1)} disabled={historyDate >= getToday()} className="p-2 text-gray-600 hover:text-white disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
        {historyCompletions.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">No activity this day</div>
        ) : (
          <div className="space-y-2">
            {historyCompletions.filter(c => c.userId === currentUser.id).map(c => {
              const h = habits.find(x => x.id === c.habitId);
              const name = h?.name || c.habitName || 'Deleted habit';
              const pts = ((c.habitPoints || h?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0);
              const cat = h?.category || c.habitCategory || 'Study';
              return (
                <div key={c.id} className={'p-3 rounded-xl border bg-[#182544] ' + (CT[cat] || getCT(cat)).bdr + ' flex items-center justify-between'}>
                  <div className="flex items-center gap-2"><span className="text-sm">{activeCategories.find(ac => ac.name === cat)?.icon || '⭐'}</span><span className="text-sm text-gray-300">{name}</span></div>
                  <div className="flex items-center gap-2"><span className="text-xs text-gray-500">x{c.count || 1}</span><span className={'text-sm font-bold ' + (CT[cat] || getCT(cat)).txt}>{pts} pts</span></div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-[#223858] flex justify-between items-center">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-lg font-black text-white">{historyCompletions.filter(c => c.userId === currentUser.id).reduce((s, c) => { const h = habits.find(x => x.id === c.habitId); return s + ((c.habitPoints || h?.points || 0) * (c.count || 1)) + (c.bonusPoints || 0); }, 0)} pts</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Stakes */}
      <Modal show={showStakes} onClose={() => setShowStakes(false)} dark={darkMode}>
        <ModalHeader title="Stakes" onClose={() => setShowStakes(false)} icon={<Zap size={18} className="text-red-400" />} dark={darkMode} />
        {roomStakes ? (
          <div>
            <div className="p-4 bg-gradient-to-r from-red-500/10 via-pink-500/10 to-purple-500/10 border border-red-500/15 rounded-xl mb-4">
              <div className="flex items-center gap-2 mb-2"><span className={'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ' + (roomStakes.type === 'buyout' ? 'bg-[#ff7b29]/20 text-[#ff7b29]' : roomStakes.type === 'dare' ? 'bg-pink-500/20 text-pink-400' : roomStakes.type === 'service' ? 'bg-cyan-500/20 text-cyan-400' : roomStakes.type === 'wheel' ? 'bg-[#5b7cf5]/20 text-[#5b7cf5]' : 'bg-purple-500/20 text-purple-400')}>{roomStakes.type}</span><span className="text-[10px] text-gray-600 uppercase tracking-wider">{roomStakes.duration}</span></div>
              {roomStakes.type === 'wheel' ? (
                <div className="text-white text-sm font-medium">Custom Punishment Wheel with {(() => { try { return JSON.parse(roomStakes.description).length; } catch { return 0; } })()} options</div>
              ) : (
                <p className="text-white font-medium">{roomStakes.description}</p>
              )}
              <p className="text-[11px] text-gray-600 mt-2">Set by {activeMembers.find(m => m.id === roomStakes.createdBy)?.username || 'unknown'}</p>
            </div>
            {(isRoomCreator || roomStakes.createdBy === currentUser.id) && <button onClick={clearStake} className="w-full px-4 py-2.5 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/10 text-sm transition-all">Remove Stake</button>}
          </div>
        ) : (
          <div>
            <div className="flex gap-1 mb-4 p-1 rounded-xl bg-black/20 shrink-0">
              <button onClick={() => setStakeMode('fixed')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all tracking-wider uppercase ${stakeMode === 'fixed' ? 'bg-[#d06b4a] text-white shadow-sm' : (T.textMuted + ' hover:text-white')}`}>Fixed Stake</button>
              <button onClick={() => setStakeMode('wheel')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all tracking-wider uppercase ${stakeMode === 'wheel' ? 'bg-[#d06b4a] text-white shadow-sm' : (T.textMuted + ' hover:text-white')}`}>Spin the Wheel</button>
            </div>

            {stakeMode === 'fixed' ? (
              <div className="anim-fade-in">
                <div className="grid grid-cols-2 gap-2 mb-4">{stakePresets.map(sp => (
                  <button key={sp.type} onClick={() => setNewStake({ ...newStake, type: sp.type, description: sp.ph.replace('e.g. ', '') })} className={'p-3 rounded-xl border text-left transition-all ' + (newStake.type === sp.type ? 'border-red-500/40 bg-red-500/10' : (T.border + ' ' + T.bgCard + ' ' + T.bgCardHover))}><div className={'text-xs font-bold mb-0.5 ' + (newStake.type === sp.type ? 'text-red-400' : 'text-gray-400')}>{sp.label}</div><div className="text-[10px] text-gray-600">{sp.desc}</div></button>
                ))}</div>
                <input type="text" placeholder={stakePresets.find(s => s.type === newStake.type)?.ph || 'Describe the stake...'} value={newStake.description} onChange={e => setNewStake({ ...newStake, description: e.target.value })} className={inputCls + ' mb-3'} maxLength={60} />
              </div>
            ) : (
              <div className="anim-fade-in mb-4">
                <p className={`text-xs ${T.textMuted} mb-3`}>Add multiple consequences. The loser spins the wheel to see what they get.</p>
                <div className="space-y-2 mb-4 max-h-[160px] overflow-y-auto pr-1">
                  {wheelOptions.map((opt, i) => (
                    <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl border ${T.border} ${T.bgCard}`}>
                      <span className="text-sm font-medium text-gray-300 truncate pr-2">{opt}</span>
                      <button onClick={() => setWheelOptions(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-400 px-1"><X size={14} /></button>
                    </div>
                  ))}
                  {wheelOptions.length === 0 && <div className="text-xs text-gray-500 text-center py-4">No options added</div>}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Add a wheel consequence..." value={newWheelOption} onChange={e => setNewWheelOption(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newWheelOption.trim()) { setWheelOptions([...wheelOptions, newWheelOption.trim()]); setNewWheelOption(''); } }} className={inputCls} maxLength={40} />
                  <button onClick={() => { if (newWheelOption.trim()) { setWheelOptions([...wheelOptions, newWheelOption.trim()]); setNewWheelOption(''); } }} className={`px-4 bg-[#264060] text-blue-400 rounded-xl font-bold flex shrink-0 items-center justify-center hover:bg-[#2a4a70]`}><Plus size={18} /></button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-4">{['weekly', 'monthly'].map(d => <button key={d} onClick={() => setNewStake({ ...newStake, duration: d })} className={'flex-1 py-2.5 text-xs font-bold rounded-xl transition-all uppercase tracking-wider ' + (newStake.duration === d ? (isSunset ? (darkMode ? 'bg-[#3d2640] text-white' : 'bg-orange-100 text-orange-900') : (darkMode ? 'bg-[#223858] text-white' : 'bg-gray-200 text-gray-900')) : (darkMode ? 'bg-[#182544] text-gray-600' : 'bg-gray-100 text-gray-400'))}>{d}</button>)}</div>
            <button onClick={saveStake} disabled={loading} className="w-full px-4 py-4 bg-[#d06b4a] text-white rounded-xl text-base font-bold shadow-lg shadow-red-500/20 active:scale-[0.98] disabled:opacity-30 transition-all">{loading ? 'Saving...' : '⚡ Set Stakes'}</button>
            {error && <p className="text-red-400 text-xs text-center mt-2">{error}</p>}
          </div>
        )}
      </Modal>

      {/* Switch Room */}
      {/* Leaderboard */}
      <Modal show={showLeaderboard} onClose={() => setShowLeaderboard(false)} wide dark={darkMode}>
        <ModalHeader title="Leaderboard" onClose={() => setShowLeaderboard(false)} icon={<span className="text-xl">&#x1F3C6;</span>} dark={darkMode} />
        <div className="flex gap-1 mb-5 bg-[#151d30] rounded-xl p-1">{['today', 'week'].map(tab => <button key={tab} onClick={() => setLeaderboardTab(tab)} className={'flex-1 py-2 text-xs font-bold rounded-lg transition-all tracking-wider uppercase ' + (leaderboardTab === tab ? (isSunset ? (darkMode ? 'bg-[#3d2640] text-white' : 'bg-orange-100 text-orange-900') : (darkMode ? 'bg-[#223858] text-white' : 'bg-gray-200 text-gray-900')) : (darkMode ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'))}>{tab === 'today' ? 'Today' : 'This Week'}</button>)}</div>
        <div className="space-y-2">{getLeaderboard().map((item, i) => {
          const pts = leaderboardTab === 'today' ? item.todayPts : item.weeklyPts, isMe = item.member.id === currentUser.id;
          const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
          const ms = !isMe ? (mutualStreaks[item.member.id] || 0) : 0;
          return (
            <div key={item.member.id} className={'rounded-xl p-4 border transition-all ' + (isMe ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500/30 shadow-lg shadow-[#5b7cf5]/10' : i === 0 ? 'bg-[#e8864a]/5 border-[#e8864a]/20' : (darkMode ? 'bg-[#182544] border-[#1e3050] hover:bg-[#1e2e50]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'))}>
              <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="text-lg w-8 text-center">{i < 3 ? medals[i] : <span className="text-sm text-gray-600">{i + 1}</span>}</div><Avatar user={item.member} size={28} className={isMe ? 'bg-blue-500/20 text-blue-400' : (darkMode ? 'bg-[#1e3050] text-gray-400' : 'bg-gray-100 text-gray-500')} /><div><div className={'text-sm font-semibold flex items-center gap-1.5 ' + (isMe ? 'text-blue-300' : (T.textMuted))}>{item.member.username}{isMe && <span className="text-[10px] text-gray-600">(you)</span>}{getRoomRole(item.member.id) && <span className={`text-[9px] font-bold ${getRoomRole(item.member.id).color}`}>{getRoomRole(item.member.id).icon}</span>}{ms > 0 && <span className={`text-[9px] font-bold ${ms >= 7 ? 'text-[#e8864a]' : 'text-[#e8864a]'}`}>🔗{ms}</span>}</div><div className="text-xs text-gray-600">{pts} pts{leaderboardTab === 'week' ? ' \u00b7 ' + item.weeklyCrystals + ' crystals' : ''}</div></div></div>
                <div className="flex items-center gap-3">{leaderboardTab === 'today' && <div className="flex items-center gap-1.5">{allCatNames.map(c => <div key={c} className={'w-2.5 h-2.5 rounded-full ' + (item.crystals[c] ? getCT(c).bg + ' shadow-sm' : (isMe ? 'bg-[#1e3050]' : (darkMode ? 'bg-[#1e3050]' : 'bg-gray-200')))} />)}</div>}{!isMe && <button onClick={() => { setShowLeaderboard(false); setShowCompetitor(item.member); }} className={`text-[10px] uppercase tracking-wider font-medium ${darkMode ? 'text-gray-600 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>View</button>}</div>
              </div>
            </div>
          );
        })}</div>
        {activeMembers.length < 2 && <div className="text-center py-8"><p className="text-gray-600 text-sm">Invite friends to compete!</p></div>}
      </Modal>

      {/* Profile */}
      <Modal show={showProfile} onClose={() => setShowProfile(false)} dark={darkMode}>
        <ModalHeader title="Profile" onClose={() => setShowProfile(false)} dark={darkMode} />
        <div className="text-center mb-6"><div className="relative inline-block">{currentUser.photoURL ? <img src={currentUser.photoURL} className="w-20 h-20 rounded-full object-cover border-2 border-blue-500/30" referrerPolicy="no-referrer" /> : <><ProgressRing progress={dailyProg} size={80} stroke={4} color={dailyProg >= 1 ? '#10b981' : '#3b82f6'} /><div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-black">{Math.round(dailyProg * 100)}%</span></div></>}</div><h3 className="text-xl font-bold mt-3">{currentUser.username}</h3><p className="text-gray-600 text-xs">{currentUser.email}</p></div>
        <div className="grid grid-cols-4 gap-2 mb-4">{[{ v: streakData.streak || 0, l: 'Streak', c: 'text-[#e8864a]', i: <Flame size={16} className="text-[#e8864a] mx-auto mb-1" /> }, { v: streakFreeze > 0 ? '🛡️' : '—', l: 'Freeze', c: streakFreeze > 0 ? 'text-cyan-400' : 'text-gray-600', i: null }, { v: myPts, l: 'Today', c: 'text-blue-400', i: <Star size={16} className="text-blue-400 mx-auto mb-1" /> }, { v: getWeeklyPts(currentUser.id), l: 'Week', c: 'text-emerald-400', i: <TrendingUp size={16} className="text-emerald-400 mx-auto mb-1" /> }].map((s, i) => <div key={i} className={`text-center p-3 ${T.bgCard} rounded-xl border ${T.border}`}>{s.i}<div className={'text-xl font-black ' + s.c}>{s.v}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">{s.l}</div></div>)}</div>
        <div className="grid grid-cols-2 gap-3 mb-4"><div className={`text-center p-3 ${T.bgCard} rounded-xl border ${T.border}`}><div className="text-lg font-black text-purple-400">{streakData.activeDays || 0}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Active Days</div></div><div className={`text-center p-3 ${T.bgCard} rounded-xl border ${T.border}`}><div className="text-lg font-black text-cyan-400">{streakData.totalCompletions || 0}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Completions</div></div></div>
        <div className={`p-3 ${T.bgCard} rounded-xl border ${T.border}`}><div className="text-[9px] text-gray-600 tracking-wider uppercase mb-2">Crystals</div><div className="flex justify-center gap-4">{allCatNames.map(c => <div key={c} className="text-center"><div className={'w-6 h-6 rounded-full mx-auto mb-1 transition-all ' + (myCr[c] ? getCT(c).bg + ' shadow-md ' + getCT(c).glow : 'bg-[#1e3050]')} /><span className="text-[9px] text-gray-600">{c}</span></div>)}</div></div>
        <div className={`mt-4 p-3 ${T.bgCard} rounded-xl border ${T.border} flex items-center justify-between`}><div><div className={`text-sm font-medium ${T.text}`}>Email Reminders</div><div className="text-[10px] text-gray-500">Daily nudges at 12pm & 6pm</div></div><button onClick={async () => { const current = currentUser.emailReminders !== false; const next = !current; try { await supabase.from('users').update({ email_reminders: next }).eq('id', currentUser.id); setCurrentUser(p => ({ ...p, emailReminders: next })); } catch (e) { console.error(e); } }} className={'relative w-11 h-6 rounded-full transition-all ' + (currentUser.emailReminders !== false ? 'bg-[#5b7cf5]' : (darkMode ? 'bg-[#223858]' : 'bg-gray-200'))}><div className={'absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ' + (currentUser.emailReminders !== false ? 'left-6' : 'left-1')} /></button></div>
        <div className={`mt-2 p-3 ${T.bgCard} rounded-xl border ${T.border} flex items-center justify-between`}><div><div className={`text-sm font-medium ${T.text}`}>Push Notifications</div><div className="text-[10px] text-gray-500">{notifPermission === 'granted' ? 'Rivals, streaks, reminders' : notifPermission === 'denied' ? 'Blocked in browser settings' : 'Get notified when rivals log habits'}</div></div>{notifPermission === 'granted' ? <div className="text-[#4aba7a] text-sm font-bold">✔ On</div> : notifPermission === 'denied' ? <div className="text-red-400 text-xs">Check browser settings</div> : <button onClick={async () => { try { const p = await Notification.requestPermission(); setNotifPermission(p); if (p === 'granted') { const r = await registerServiceWorker(); if (r) { const sub = await subscribeToPush(r); if (sub && currentUser) { await supabase.from('push_subscriptions').upsert({ id: currentUser.id + '_' + Date.now(), user_id: currentUser.id, subscription: sub.toJSON() }); } } } } catch (e) { console.error('Push setup error:', e); } }} className={`px-3 py-1.5 ${isSunset ? "bg-[#ff7b29]" : "bg-[#5b7cf5]"} text-white text-xs font-bold rounded-lg active:scale-[0.97]`}>Enable</button>}</div>
        <div className={`mt-2 p-3 ${T.bgCard} rounded-xl border ${T.border}`}>
          <div className={`text-sm font-medium ${T.text} mb-3`}>Custom Thresholds</div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">Daily Goal (100% Ring)</span>
            <input type="number" value={dailyTarget} onChange={e => { const v = parseInt(e.target.value) || 10; updateTargets(v, streakTarget); }} className={`w-16 px-2 py-1 text-center rounded bg-black/10 border ${T.borderInput} text-sm ${T.text} outline-none`} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Streak Point Threshold</span>
            <input type="number" value={streakTarget} onChange={e => { const v = parseInt(e.target.value) || 10; updateTargets(dailyTarget, v); }} className={`w-16 px-2 py-1 text-center rounded bg-black/10 border ${T.borderInput} text-sm ${T.text} outline-none`} />
          </div>
        </div>

        {/* Trophy Room & Hall of Shame */}
        {archivedStakes.filter(st => st.winner_id === currentUser.id || st.loser_id === currentUser.id).length > 0 && (
          <div className={`mt-4 p-3 ${T.bgCard} rounded-xl border ${T.border}`}>
            <div className={`text-sm font-medium ${T.text} flex items-center justify-between mb-3`}>
              <span>Trophy Room & Hall of Shame</span>
              <Trophy size={14} className="text-[#e8864a]" />
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {archivedStakes.filter(st => st.winner_id === currentUser.id || st.loser_id === currentUser.id).map(st => {
                const isWinner = st.winner_id === currentUser.id;
                const oppId = isWinner ? st.loser_id : st.winner_id;
                const oppName = roomMembers.find(m => m.id === oppId)?.username || 'Someone';
                return (
                  <div key={st.id} className={`p-2.5 rounded-xl border flex justify-between items-center ${isWinner ? (darkMode ? 'border-[#d4a04a]/30 bg-[#d4a04a]/10 text-white' : 'border-[#d4a04a]/30 bg-[#d4a04a]/5 text-gray-900') : (darkMode ? 'border-red-500/20 bg-red-500/10 text-gray-300' : 'border-red-500/20 bg-red-500/5 text-gray-700')}`}>
                    <div>
                      <div className="font-bold uppercase tracking-wider text-[10px] mb-0.5 flex items-center gap-1.5">{isWinner ? <span className="text-[#d4a04a]">🏆 Trophy Winner</span> : <span className="text-red-400">💀 Hall of Shame</span>}</div>
                      <div className="text-xs font-medium max-w-[200px] truncate" title={st.description}>"{st.description}"</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] opacity-60 uppercase tracking-widest mb-0.5 mt-0.5">{st.type}</div>
                      <div className="text-[10px] opacity-80 whitespace-nowrap">vs {oppName}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-5 space-y-2">
          <button onClick={() => { setShowProfile(false); setShowInviteModal(true); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${T.border + ' ' + T.bgCard + ' ' + T.bgCardHover + ' ' + T.textMuted}`}><UserPlus size={16} className="text-blue-400" /><span className="text-sm">Invite to Room</span></button>
          <button onClick={() => { setShowProfile(false); setShowStakes(true); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${T.border + ' ' + T.bgCard + ' ' + T.bgCardHover + ' ' + T.textMuted}`}><Zap size={16} className="text-red-400" /><span className="text-sm">Stakes</span></button>
          {lastWeekData && <button onClick={() => { setShowProfile(false); setShowWeeklyRecap(true); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${T.border + ' ' + T.bgCard + ' ' + T.bgCardHover + ' ' + T.textMuted}`}><BarChart3 size={16} className="text-purple-400" /><span className="text-sm">Weekly Recap</span></button>}
          <button onClick={() => { setShowProfile(false); setShowHelp(true); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${T.border + ' ' + T.bgCard + ' ' + T.bgCardHover + ' ' + T.textMuted}`}><HelpCircle size={16} className="text-gray-400" /><span className="text-sm">How Versa Works</span></button>
          <button onClick={() => supabase.auth.signOut()} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${T.border + ' ' + T.bgCard + ' hover:bg-red-500/5 text-red-400'}`}><LogOut size={16} /><span className="text-sm">Sign Out</span></button>
        </div>
      </Modal>

      {/* Help */}
      <Modal show={showHelp} onClose={() => setShowHelp(false)} dark={darkMode}>
        <ModalHeader title="How Versa Works" onClose={() => setShowHelp(false)} dark={darkMode} />
        <div className="space-y-3 text-sm text-gray-400">
          {[
            { i: '🎯', t: 'Track & Earn', d: 'Tap + to log habits. Each completion earns points. Hit ' + dailyTarget + 'pts for a perfect day.' },
            { i: '🔥', t: 'Streaks', d: 'Log at least ' + streakTarget + 'pts daily to maintain your streak (this threshold scales exponentially harder at higher tiers!). Tiers: 3d→1.5× · 7d→2× · 14d→2.5× · 30d→3×.' },
            { i: '🛡️', t: 'Streak Freeze', d: 'Hit 90% (' + Math.round(dailyTarget * 0.9) + 'pts) in a day to bank a freeze. If you miss tomorrow, the freeze saves your streak. Max 1 at a time — unlog habits and you lose it.' },
            { i: '🎰', t: 'Mystery Bonus', d: '~10% chance on every tap: +5 (common), +10, +15 (rare), +20 (epic), +50 (jackpot). Bonus points stack on top of streak multipliers.' },
            { i: '💎', t: 'Crystals', d: 'Score the most points in a category (Study, Health, Focus) to earn a crystal for the day. Ties = no crystal.' },
            { i: '🏆', t: 'Compete', d: 'Weekly leaderboard resets Sunday. Invite friends, set stakes, and see who actually follows through.' },
            { i: '⚡', t: 'Stakes', d: 'Set what the weekly loser has to do. Spin the punishment wheel for random consequences.' },
            { i: '🔥', t: 'Reactions', d: 'React to your rivals\' completions with 🔥 💀 👏 😤 in the activity feed.' },
            { i: '👤', t: 'Solo Mode', d: 'No friends yet? Compete against your own yesterday score.' },
          ].map((s, i) => (
            <div key={i} className={`${T.bgCard} rounded-xl p-4 border ${T.border}`}><p className={`font-bold ${T.text} mb-1`}>{s.i} {s.t}</p><p>{s.d}</p></div>
          ))}
          <div className={`${T.bgCard} rounded-xl p-4 border ${T.border}`}><p className={`font-bold ${T.text} mb-2`}>Categories</p><div className="space-y-1.5">{allCatNames.map(c => { const ct = getCT(c); return (<div key={c} className="flex items-center gap-2"><div className={'w-3 h-3 rounded-full ' + ct.bg + ' shadow-sm ' + ct.glow} /><span><strong className={ct.txt}>{c}</strong></span></div>); })}</div></div>
        </div>
      </Modal>

      {/* Invite & Rooms */}
      <Modal show={showInviteModal || showSwitchRoom} onClose={() => { setShowInviteModal(false); setShowSwitchRoom(false); }} dark={darkMode}>
        <ModalHeader title="Rooms" onClose={() => { setShowInviteModal(false); setShowSwitchRoom(false); }} dark={darkMode} />

        {/* Current room code */}
        <div className="text-center mb-4">
          <p className="text-xs text-gray-500 mb-3 tracking-wider uppercase">Share this room code</p>
          <div className="mb-4 relative inline-block"><code className={`inline-block px-8 py-4 ${darkMode ? 'bg-gradient-to-b from-white/[0.08] to-white/[0.03] border-[#2a4060] text-white' : 'bg-gradient-to-b from-gray-100 to-gray-50 border-gray-200 text-gray-900'} border text-3xl font-mono rounded-xl tracking-[0.4em] shadow-2xl`}>{currentRoom?.code}</code><div className="absolute -inset-3 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 blur-xl rounded-xl -z-10" /></div>
          <div className="flex gap-2">
            <button onClick={copyCode} className="flex-1 px-4 py-2.5 bg-[#5b7cf5] text-white rounded-xl shadow-lg shadow-[#5b7cf5]/15 flex items-center justify-center gap-2 text-sm font-bold active:scale-[0.98]">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied!' : 'Copy Code'}</button>
            {navigator.share && <button onClick={async () => { try { await navigator.share({ title: 'Join me on Versa', text: `Join my room on Versa! Code: ${currentRoom?.code}`, url: `${window.location.origin}?join=${currentRoom?.code}` }); } catch { } }} className={`flex-1 px-4 py-2.5 border ${darkMode ? 'border-[#2a4060] text-white hover:bg-[#1e2e50]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'} rounded-xl flex items-center justify-center gap-2 text-sm font-medium active:scale-[0.98]`}><UserPlus size={14} />Share</button>}
          </div>
        </div>

        {/* Your rooms */}
        {userRooms.length > 1 && <>
          <div className={`border-t ${T.border} pt-4 mt-4`}>
            <p className={`text-xs ${T.textMuted} mb-2 font-bold tracking-wider uppercase`}>Your Rooms</p>
            <div className="space-y-1.5">{userRooms.map(rid => (
              <div key={rid} className={`px-3 py-2.5 rounded-xl border flex items-center justify-between transition-all ${currentRoom?.id === rid ? 'border-blue-500/30 bg-blue-500/10' : (T.border + ' ' + T.bgCard + ' ' + T.bgCardHover)}`}>
                <div className="flex items-center gap-2"><span className={`font-mono text-sm tracking-widest ${T.text}`}>{rid}</span>{currentRoom?.id === rid && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}</div>
                <div className="flex items-center gap-2">{currentRoom?.id !== rid && <button onClick={() => { switchRoom(rid); setShowInviteModal(false); setShowSwitchRoom(false); }} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium uppercase tracking-wider">Switch</button>}<button onClick={() => leaveRoom(rid)} className="text-[10px] text-gray-600 hover:text-red-400 font-medium uppercase tracking-wider">Leave</button></div>
              </div>
            ))}</div>
          </div>
        </>}

        {/* Join / Create */}
        <div className={`border-t ${T.border} pt-4 mt-4`}>
          <p className={`text-xs ${T.textMuted} mb-2`}>Join another room</p>
          <div className="flex gap-2"><input type="text" placeholder="CODE" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} className={`flex-1 px-3 py-2.5 ${T.bgInput} border ${T.borderInput} rounded-xl ${T.text} placeholder-gray-400 text-sm font-mono tracking-[0.2em] text-center`} maxLength={6} /><button onClick={() => { joinRoom(); setShowInviteModal(false); setShowSwitchRoom(false); }} className="px-5 py-2.5 bg-[#5b7cf5] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#5b7cf5]/15 active:scale-[0.98]">Join</button></div>
          {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
          <button onClick={() => { createRoom(); setShowInviteModal(false); setShowSwitchRoom(false); }} className={`w-full mt-3 px-4 py-2.5 border ${T.border} ${T.textMuted} rounded-xl hover:${T.bgCardHover} text-sm transition-all`}>+ Create New Room</button>
        </div>
      </Modal>

      {/* Competitor */}
      <Modal show={!!showCompetitor} onClose={() => setShowCompetitor(null)} dark={darkMode}>
        {showCompetitor && (() => {
          const uid = showCompetitor.id;
          const theirPts = getTodayPts(uid);
          const theirWeekPts = getWeeklyPts(uid);
          const theirComps = completions.filter(c => c.userId === uid && c.date === getToday());
          const ms = mutualStreaks[uid] || 0;
          const ahead = theirPts > myPts;
          const diff = Math.abs(theirPts - myPts);
          return <><ModalHeader title={showCompetitor.username} onClose={() => setShowCompetitor(null)} dark={darkMode} />

            {/* Comparison bar */}
            {uid !== currentUser.id && <div className={`p-4 rounded-xl mb-4 ${ahead ? (darkMode ? 'bg-red-500/5 border border-red-500/15' : 'bg-red-50 border border-red-200') : (darkMode ? 'bg-emerald-500/5 border border-emerald-500/15' : 'bg-emerald-50 border border-emerald-200')}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${T.textMuted}`}>You</span>
                <span className={`text-[10px] font-bold ${ahead ? 'text-red-400' : 'text-emerald-400'}`}>{ahead ? 'Behind by ' + diff : (diff === 0 ? 'Tied' : 'Ahead by ' + diff)}</span>
                <span className={`text-xs font-medium ${T.textMuted}`}>{showCompetitor.username}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-black text-blue-400 w-12 text-right">{myPts}</span>
                <div className={`flex-1 h-2 rounded-full overflow-hidden ${darkMode ? 'bg-[#1e3050]' : 'bg-gray-200'}`}>
                  <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: ((myPts + theirPts) > 0 ? myPts / (myPts + theirPts) * 100 : 50) + '%' }} />
                </div>
                <span className={`text-lg font-black w-12 ${ahead ? 'text-red-400' : 'text-emerald-400'}`}>{theirPts}</span>
              </div>
            </div>}

            {/* Category breakdown */}
            <div className="grid grid-cols-3 gap-2 mb-4">{allCatNames.map(c => {
              const myC = getCatPts(currentUser.id, c), theirC = getCatPts(uid, c);
              const ct = getCT(c);
              return <div key={c} className={'text-center p-3 rounded-xl border ' + ct.bgS + ' ' + ct.bdr}>
                <div className={'text-xl font-black ' + ct.txt}>{theirC}</div>
                <div className="text-[9px] text-gray-600 mt-0.5 tracking-wider uppercase">{c}</div>
                <div className={`text-[9px] mt-1 font-bold ${theirC > myC ? 'text-red-400' : theirC < myC ? 'text-emerald-400' : 'text-gray-600'}`}>{theirC > myC ? '+' + (theirC - myC) : theirC < myC ? '' + (theirC - myC) : 'tied'}</div>
              </div>;
            })}</div>

            {/* What they logged today */}
            <div className={`rounded-xl border p-4 mb-4 ${T.border} ${T.bgCard}`}>
              <div className={`text-[10px] font-bold tracking-wider uppercase mb-3 ${T.textDim}`}>Logged today</div>
              {theirComps.length > 0 ? (
                <div className="space-y-2">{theirComps.map(c => {
                  const h = habits.find(x => x.id === c.habitId);
                  const cat = h?.category || c.habitCategory || 'Study';
                  const ct = getCT(cat);
                  const pts = (c.habitPoints || h?.points || 0) * (c.count || 1) + (c.bonusPoints || 0);
                  return <div key={c.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${ct.bg}`} />
                      <span className={`text-sm ${T.textMuted}`}>{h?.name || c.habitName || 'Unknown'}</span>
                      {c.count > 1 && <span className={`text-[10px] font-bold ${ct.txt}`}>×{c.count}</span>}
                    </div>
                    <span className={`text-sm font-bold ${ct.txt}`}>{pts}</span>
                  </div>;
                })}</div>
              ) : (
                <div className={`text-sm text-center py-3 ${T.textDim}`}>Nothing logged yet</div>
              )}
            </div>

            {/* Weekly + mutual streak */}
            <div className="flex gap-2">
              <div className={`flex-1 text-center p-3 rounded-xl border ${T.border} ${T.bgCard}`}>
                <div className="text-lg font-black text-emerald-400">{theirWeekPts}</div>
                <div className="text-[9px] text-gray-600 tracking-wider uppercase">This week</div>
              </div>
              {ms > 0 && <div className={`flex-1 text-center p-3 rounded-xl border ${darkMode ? 'border-[#e8864a]/20 bg-[#e8864a]/5' : 'border-orange-200 bg-orange-50'}`}>
                <div className="text-lg font-black text-[#e8864a]">🔗 {ms}d</div>
                <div className="text-[9px] text-gray-600 tracking-wider uppercase">Duo streak</div>
              </div>}
            </div>
          </>;
        })()}
      </Modal>

      {/* Weekly Recap */}
      <Modal show={showWeeklyRecap} onClose={() => setShowWeeklyRecap(false)} wide dark={darkMode}>
        <ModalHeader title="Weekly Recap" onClose={() => setShowWeeklyRecap(false)} icon={<BarChart3 size={18} className="text-purple-400" />} dark={darkMode} />
        {lastWeekData ? (
          <div>
            <p className={`text-xs ${T.textDim} mb-4`}>{lastWeekData.dateRange}</p>
            {lastWeekData.scores.length > 0 && (
              <div className="text-center p-5 bg-gradient-to-r from-[#e8864a]/10 to-[#d4a04a]/10 border border-[#e8864a]/15 rounded-xl mb-4">
                <span className="text-3xl anim-float">🏆</span>
                <h3 className="text-xl font-black text-[#e8864a] mt-2">{lastWeekData.scores[0].member.username}</h3>
                <p className={`text-sm ${T.textMuted} mt-1`}>{lastWeekData.scores[0].pts} points &middot; {lastWeekData.scores[0].activeDays} active days</p>
              </div>
            )}
            <div className="space-y-2 mb-4">{lastWeekData.scores.map((s, i) => {
              const medals = ['🥇', '🥈', '🥉']; const isMe = s.member.id === currentUser.id;
              return (
                <div key={s.member.id} className={'rounded-xl p-3 border transition-all ' + (isMe ? 'bg-blue-600/10 border-blue-500/20' : darkMode ? 'bg-[#182544] border-[#1e3050]' : 'bg-gray-50 border-gray-200')}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><span className="text-sm">{i < 3 ? medals[i] : (i + 1) + '.'}</span><Avatar user={s.member} size={22} className={isMe ? 'bg-blue-500/20 text-blue-400' : 'bg-[#1e3050] text-gray-400'} /><span className={'text-sm font-semibold ' + (isMe ? 'text-blue-300' : T.textMuted)}>{s.member.username}</span></div>
                    <span className={`text-sm font-bold ${T.text}`}>{s.pts} pts</span>
                  </div>
                  <div className="flex flex-wrap gap-2">{allCatNames.map(c => (
                    <div key={c} className={'flex-1 min-w-[60px] text-center p-1.5 rounded-lg ' + getCT(c).bgS}>
                      <div className={'text-xs font-bold ' + getCT(c).txt}>{s.catPts[c]}</div>
                      <div className="text-[8px] text-gray-500">{c}</div>
                    </div>
                  ))}</div>
                  <div className={`flex gap-3 mt-2 text-[10px] ${T.textDim}`}><span>{s.activeDays} active days</span><span>{s.completions} completions</span></div>
                </div>
              );
            })}</div>
            {/* Share */}
            <div className="flex gap-2">
              <button onClick={async () => {
                const text = `🏆 Versa Weekly Recap\n${lastWeekData.dateRange}\n\n${lastWeekData.scores.map((s, i) => ((['🥇', '🥈', '🥉'][i] || `${i + 1}.`) + ' ' + s.member.username + ' — ' + s.pts + 'pts')).join('\n')}\n\nJoin us: ${window.location.origin}?join=${currentRoom?.code}`;
                if (navigator.share) { try { await navigator.share({ title: 'Vers Weekly Recap', text }); } catch { } } else { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
              }} className="flex-1 px-4 py-3 bg-[#5b7cf5] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]"><Copy size={14} />{copied ? 'Copied!' : 'Share Recap'}</button>
              <button onClick={() => { setShowWeeklyRecap(false); setStoryCardIdx(0); setShowStoryCards(true); }} className="flex-1 px-4 py-3 bg-[#9b6bc8] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]">📸 Story</button>
            </div>
          </div>
        ) : (
          <p className={`${T.textDim} text-sm text-center py-8`}>No data from last week yet.</p>
        )}
      </Modal>

      {/* Punishment Wheel */}
      <Modal show={showPunishmentWheel} onClose={() => { setShowPunishmentWheel(false); setWheelResult(null); setWheelSpinning(false); }} wide dark={darkMode}>
        <ModalHeader title="🎰 Punishment Wheel" onClose={() => { setShowPunishmentWheel(false); setWheelResult(null); setWheelSpinning(false); }} dark={darkMode} />
        {lastWeekData && lastWeekData.scores.length > 1 && (() => {
          let currWheelOpts = [...PUNISHMENTS.slice(0, 8)];
          if (roomStakes?.type === 'wheel') {
            try { currWheelOpts = JSON.parse(roomStakes.description); } catch { }
          } else {
            const lastArchived = [...archivedStakes].reverse().find(s => s.type === 'wheel');
            if (lastArchived) { try { currWheelOpts = JSON.parse(lastArchived.description); } catch { } }
          }
          if (currWheelOpts.length === 0) currWheelOpts = [...PUNISHMENTS.slice(0, 8)];

          return (
            <div className="text-center">
              <div className="mb-4">
                <p className={`text-sm ${T.textMuted}`}>Loser this week:</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Avatar user={lastWeekData.scores[lastWeekData.scores.length - 1].member} size={32} className="bg-red-500/20 text-red-400" />
                  <span className="text-lg font-bold text-red-400">{lastWeekData.scores[lastWeekData.scores.length - 1].member.username}</span>
                </div>
                <p className={`text-xs ${T.textDim} mt-1`}>{lastWeekData.scores[lastWeekData.scores.length - 1].pts} pts</p>
              </div>

              {/* Wheel display */}
              <div className="relative mx-auto mb-6" style={{ width: 280, height: 280 }}>
                <div className={`w-full h-full rounded-full border-4 border-[#2a4060] overflow-hidden relative`} style={{ transform: `rotate(${wheelSpinning ? 3600 + Math.random() * 360 : 0}deg)`, transition: wheelSpinning ? 'transform 4s cubic-bezier(0.17,0.67,0.12,0.99)' : 'none' }}>
                  {currWheelOpts.map((p, i) => {
                    const angle = (360 / currWheelOpts.length) * i;
                    const skewAngle = currWheelOpts.length > 2 ? (90 - 360 / currWheelOpts.length) : 0;
                    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#e11d48', '#a855f7'];
                    return <div key={i} className="absolute font-bold text-white uppercase text-center break-words px-4 leading-[1.1] drop-shadow-md" style={{
                      width: '50%', height: '50%',
                      transformOrigin: '100% 100%',
                      transform: `rotate(${angle}deg) skewY(${Math.max(0, skewAngle)}deg)`,
                      left: 0, top: 0,
                      background: colors[i % colors.length],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: currWheelOpts.length > 6 ? 6 : 8
                    }}>
                      <div style={{ transform: `skewY(-${Math.max(0, skewAngle)}deg) rotate(${360 / currWheelOpts.length / 2}deg) translateY(-25px)` }}>{p}</div>
                    </div>;
                  })}
                </div>
                {/* Pointer */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-white z-10 drop-shadow-lg" />
              </div>

              {/* Result */}
              {wheelResult && (
                <div className="mb-4 p-4 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl animate-bounce">
                  <p className="text-lg font-black text-white">{wheelResult}</p>
                  <p className={`text-xs ${T.textDim} mt-1`}>{lastWeekData.scores[lastWeekData.scores.length - 1].member.username} has to do this!</p>
                </div>
              )}

              {/* Spin button */}
              {!wheelResult ? (
                <button onClick={() => {
                  if (wheelSpinning) return;
                  setWheelSpinning(true);
                  setTimeout(() => {
                    const result = currWheelOpts[Math.floor(Math.random() * currWheelOpts.length)];
                    setWheelResult(result);
                    setWheelSpinning(false);
                  }, 4200);
                }} disabled={wheelSpinning} className="w-full px-6 py-3 bg-[#d06b4a] text-white rounded-xl text-sm font-bold active:scale-[0.98] disabled:opacity-60 transition-all">
                  {wheelSpinning ? 'Spinning...' : 'Spin the Wheel'}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setWheelResult(null); }} className="flex-1 px-4 py-3 border border-[#2a4060] text-gray-400 rounded-xl text-sm font-medium hover:bg-[#1e2e50]">Spin Again</button>
                  <button onClick={async () => {
                    const text = `🎰 Versa Punishment Wheel\n\n${lastWeekData.scores[lastWeekData.scores.length - 1].member.username} lost and has to:\n${wheelResult}\n\nJoin us: ${window.location.origin}?join=${currentRoom?.code}`;
                    if (navigator.share) { try { await navigator.share({ title: 'Vers Punishment', text }); } catch { } } else { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
                  }} className="flex-1 px-4 py-3 bg-[#5b7cf5] text-white rounded-xl text-sm font-bold active:scale-[0.98]">{copied ? 'Copied!' : 'Share'}</button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* Weekly Story Cards */}
      <Modal show={showStoryCards} onClose={() => setShowStoryCards(false)} wide dark={darkMode}>
        {lastWeekData && lastWeekData.scores.length > 0 && (
          <div>
            {/* Theme picker */}
            <div className="flex justify-center gap-2 mb-4">
              {[{ id: 'dark', label: 'Dark', bg: 'bg-gray-900' }, { id: 'neon', label: 'Neon', bg: 'bg-purple-900' }, { id: 'light', label: 'Light', bg: 'bg-white' }].map(th => (
                <button key={th.id} onClick={() => setStoryTheme(th.id)} className={`w-8 h-8 rounded-full border-2 ${th.bg} ${storyTheme === th.id ? 'border-blue-500 scale-110' : 'border-gray-600'} transition-all`} />
              ))}
            </div>

            {/* Story Card */}
            <div id="story-card" className={`mx-auto rounded-2xl overflow-hidden ${storyTheme === 'dark' ? 'bg-[#0a0a0f] text-white' : storyTheme === 'neon' ? 'bg-gradient-to-b from-purple-900 via-indigo-900 to-black text-white' : 'bg-white text-gray-900'}`} style={{ width: 300, minHeight: 440 }}>
              <div className="p-6 flex flex-col justify-between h-full" style={{ minHeight: 440 }}>
                {/* Card 0: Winner */}
                {storyCardIdx === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className={`text-[10px] font-bold tracking-[0.3em] uppercase mb-6 ${storyTheme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>VERSA WEEKLY RECAP</div>
                    <div className="text-5xl mb-4">🏆</div>
                    <div className={`text-2xl font-black mb-1 ${storyTheme === 'neon' ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400' : ''}`}>{lastWeekData.scores[0].member.username}</div>
                    <div className={`text-sm ${storyTheme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>won the week</div>
                    <div className={`text-4xl font-black mt-4 ${storyTheme === 'neon' ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400' : 'text-blue-400'}`}>{lastWeekData.scores[0].pts}</div>
                    <div className={`text-xs ${storyTheme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>points · {lastWeekData.scores[0].activeDays} active days</div>
                    <div className={`text-[10px] mt-6 ${storyTheme === 'light' ? 'text-gray-300' : 'text-gray-700'}`}>{lastWeekData.dateRange}</div>
                  </div>
                )}

                {/* Card 1: Standings */}
                {storyCardIdx === 1 && (
                  <div className="flex-1">
                    <div className={`text-[10px] font-bold tracking-[0.3em] uppercase mb-5 text-center ${storyTheme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>FINAL STANDINGS</div>
                    <div className="space-y-3">
                      {lastWeekData.scores.map((s, i) => {
                        const medals = ['🥇', '🥈', '🥉'];
                        return (
                          <div key={s.member.id} className={`flex items-center justify-between p-3 rounded-xl ${i === 0 ? (storyTheme === 'neon' ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-blue-500/10 border border-blue-500/20') : (storyTheme === 'light' ? 'bg-gray-50' : 'bg-[#151d30]')} ${i > 0 ? 'border ' + (storyTheme === 'light' ? 'border-gray-100' : 'border-[#1e3050]') : ''}`}>
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{i < 3 ? medals[i] : (i + 1) + '.'}</span>
                              <div>
                                <div className={`text-sm font-bold ${i === 0 && storyTheme === 'neon' ? 'text-purple-300' : ''}`}>{s.member.username}</div>
                                <div className={`text-[10px] ${storyTheme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>{s.activeDays}d active</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black">{s.pts}</div>
                              <div className={`text-[9px] ${storyTheme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>pts</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className={`text-[10px] mt-4 text-center ${storyTheme === 'light' ? 'text-gray-300' : 'text-gray-700'}`}>{lastWeekData.dateRange}</div>
                  </div>
                )}

                {/* Card 2: Highlights */}
                {storyCardIdx === 2 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className={`text-[10px] font-bold tracking-[0.3em] uppercase mb-6 ${storyTheme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>HIGHLIGHTS</div>
                    <div className="space-y-5 w-full">
                      <div>
                        <div className={`text-[10px] uppercase tracking-wider ${storyTheme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>Most Consistent</div>
                        <div className="text-lg font-black">{[...lastWeekData.scores].sort((a, b) => b.activeDays - a.activeDays)[0]?.member.username}</div>
                        <div className={`text-xs ${storyTheme === 'neon' ? 'text-cyan-400' : 'text-blue-400'}`}>{[...lastWeekData.scores].sort((a, b) => b.activeDays - a.activeDays)[0]?.activeDays}/7 days</div>
                      </div>
                      <div>
                        <div className={`text-[10px] uppercase tracking-wider ${storyTheme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>Top Category</div>
                        <div className="text-lg font-black">{(() => { let best = '', bestPts = 0; allCatNames.forEach(c => { const p = lastWeekData.scores[0].catPts[c] || 0; if (p > bestPts) { bestPts = p; best = c; } }); return best || '—'; })()}</div>
                        <div className={`text-xs ${storyTheme === 'neon' ? 'text-purple-400' : 'text-emerald-400'}`}>for {lastWeekData.scores[0].member.username}</div>
                      </div>
                      {lastWeekData.scores.length > 1 && <div>
                        <div className={`text-[10px] uppercase tracking-wider ${storyTheme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>Closest Race</div>
                        <div className="text-lg font-black">{lastWeekData.scores[0].pts - lastWeekData.scores[1].pts} pts</div>
                        <div className={`text-xs ${storyTheme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>between 1st and 2nd</div>
                      </div>}
                      {(() => { const topMs = Object.entries(mutualStreaks).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1])[0]; if (!topMs) return null; const rival = activeMembers.find(m => m.id === topMs[0]); if (!rival) return null; return (<div><div className={`text-[10px] uppercase tracking-wider ${storyTheme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>Longest Duo Streak</div><div className="text-lg font-black">🔗 {topMs[1]} days</div><div className={`text-xs ${storyTheme === 'neon' ? 'text-[#e8864a]' : 'text-[#e8864a]'}`}>{currentUser.username} & {rival.username}</div></div>); })()}
                    </div>
                    <div className={`text-[10px] mt-6 ${storyTheme === 'light' ? 'text-gray-300' : 'text-gray-700'}`}>VERSA</div>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation dots */}
            <div className="flex justify-center gap-2 mt-4">
              {[0, 1, 2].map(i => (
                <button key={i} onClick={() => setStoryCardIdx(i)} className={`w-2 h-2 rounded-full transition-all ${storyCardIdx === i ? 'bg-blue-500 w-5' : 'bg-gray-600'}`} />
              ))}
            </div>

            {/* Nav + Save */}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setStoryCardIdx(p => Math.max(0, p - 1))} disabled={storyCardIdx === 0} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-20 ${darkMode ? 'text-gray-400 border border-[#223858]' : 'text-gray-500 border border-gray-200'}`}>← Prev</button>
              <button onClick={() => setStoryCardIdx(p => Math.min(2, p + 1))} disabled={storyCardIdx === 2} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-20 ${darkMode ? 'text-gray-400 border border-[#223858]' : 'text-gray-500 border border-gray-200'}`}>Next →</button>
            </div>
            <button onClick={async () => {
              try {
                const el = document.getElementById('story-card');
                const { default: html2canvas } = await import('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.js');
                const canvas = await html2canvas(el, { backgroundColor: null, scale: 2 });
                const link = document.createElement('a'); link.download = 'versa-recap.png'; link.href = canvas.toDataURL(); link.click();
              } catch {
                // Fallback: share as text
                const text = `🏆 Versa Weekly Recap\n${lastWeekData.dateRange}\n\nWinner: ${lastWeekData.scores[0].member.username} — ${lastWeekData.scores[0].pts}pts`;
                if (navigator.share) { try { await navigator.share({ title: 'Vers Recap', text }); } catch { } } else { navigator.clipboard.writeText(text); }
              }
            }} className="w-full mt-2 py-3 bg-[#9b6bc8] text-white rounded-xl text-sm font-bold active:scale-[0.98]">📸 Save as Image</button>
          </div>
        )}
      </Modal>

      {/* Heat Map Calendar */}
      <Modal show={showHeatMap} onClose={() => setShowHeatMap(false)} wide dark={darkMode}>
        <ModalHeader title="Activity" onClose={() => setShowHeatMap(false)} icon={<Calendar size={18} className="text-emerald-400" />} dark={darkMode} />
        {(() => {
          const today = new Date();

          let rangeDays = 30;
          if (heatMapRange === '7d') rangeDays = 7;
          if (heatMapRange === '90d') rangeDays = 90;
          if (heatMapRange === '1y') rangeDays = 365;

          const chartDates = [];
          for (let i = rangeDays - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            chartDates.push(formatDateStr(d));
          }

          const points = chartDates.map(date => heatMapData[date] || 0);
          const maxPoints = Math.max(dailyTarget * 1.5, ...points, 10); // Ensure peak is at least goal + 50%
          const minPoints = Math.min(0, ...points); // Accommodate negative habits going below 0

          const SVG_W = 400;
          const SVG_H = 160;
          const M_TOP = 20;
          const M_BTM = 20;
          const M_LR = 10;
          const USE_W = SVG_W - (M_LR * 2);
          const USE_H = SVG_H - M_TOP - M_BTM;
          const rangeY = maxPoints - minPoints;

          const getX = (idx) => M_LR + (idx / Math.max(1, rangeDays - 1)) * USE_W;
          const getY = (val) => SVG_H - M_BTM - ((val - minPoints) / Math.max(1, rangeY) * USE_H);

          // Path generation
          const pathStart = `M ${getX(0)} ${getY(points[0])}`;
          let lines = '';
          for (let i = 1; i < points.length; i++) {
            lines += ` L ${getX(i)} ${getY(points[i])}`;
          }

          const strokePath = pathStart + lines;
          // Filling down to the literal Y=0 line
          const fillPath = `${strokePath} L ${getX(points.length - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`;

          const yZero = getY(0);
          const yGoal = getY(dailyTarget);

          // Accent colors based on current theme
          const accentStr = isSunset ? '#ff7b29' : '#5b7cf5';
          const accentOp = isSunset ? 'rgba(255, 123, 41, 0.2)' : 'rgba(91, 124, 245, 0.2)';

          return (
            <div>
              {/* Range Toggle */}
              <div className={`flex gap-1 mb-5 p-1 rounded-xl ${darkMode ? 'bg-[#151d30]' : 'bg-gray-100'}`}>
                {[{ id: '7d', l: '1 Week' }, { id: '30d', l: '1 Month' }, { id: '90d', l: '3 Months' }, { id: '1y', l: '1 Year' }].map(r => (
                  <button key={r.id} onClick={() => setHeatMapRange(r.id)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all tracking-wider uppercase ${heatMapRange === r.id ? (isSunset ? (darkMode ? 'bg-[#ff7b29]/20 text-[#ff7b29]' : 'bg-orange-100 text-orange-900') : (darkMode ? 'bg-[#223858] text-white' : 'bg-white shadow-sm text-blue-600')) : (darkMode ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600')}`}>{r.l}</button>
                ))}
              </div>

              {/* Chart SVG */}
              <div className="relative mb-6">
                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto drop-shadow-xl overflow-visible">
                  <defs>
                    <linearGradient id="heatGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={accentStr} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={accentStr} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  {/* Goal Line */}
                  <line x1={M_LR} y1={yGoal} x2={SVG_W - M_LR} y2={yGoal} stroke={darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"} strokeWidth={1} strokeDasharray="4 4" />
                  <text x={M_LR} y={yGoal - 4} fontSize="8" fill={darkMode ? "#a1a1aa" : "#85858a"} fontWeight="bold">DAILY GOAL ({dailyTarget})</text>

                  {/* Zero Line */}
                  <line x1={M_LR} y1={yZero} x2={SVG_W - M_LR} y2={yZero} stroke={darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth={1} strokeDasharray="2 4" />

                  {/* Data Paths */}
                  <path d={fillPath} fill="url(#heatGradient)" />
                  <path d={strokePath} fill="none" stroke={accentStr} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                  {/* Active Point Highlight (Today) */}
                  <circle cx={getX(points.length - 1)} cy={getY(points[points.length - 1])} r="3.5" fill={darkMode ? "#1c1c1e" : "#ffffff"} stroke={accentStr} strokeWidth="2" />
                </svg>

                {/* Min / Max Date Labels */}
                <div className={`flex justify-between px-2 mt-1 text-[9px] font-medium ${T.textDim}`}>
                  <span>{new Date(chartDates[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <span>Today</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-5">{[
                { v: Object.keys(heatMapData).length, l: 'Active Days', c: 'text-emerald-400' },
                { v: Object.values(heatMapData).reduce((a, b) => a + b, 0), l: 'Total Points', c: 'text-[#5b7cf5]' },
                { v: streakData.streak || 0, l: 'Current Streak', c: 'text-[#e8864a]' }
              ].map((s, i) => (
                <div key={i} className={`text-center p-3 rounded-xl ${darkMode ? 'bg-[#0f1b2d] border border-[#1e3050]' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className={`text-xl font-black ${s.c}`}>{s.v}</div>
                  <div className={`text-[9px] ${T.textDim} tracking-wider uppercase mt-0.5`}>{s.l}</div>
                </div>
              ))}</div>
            </div>
          );
        })()}
      </Modal>

      {/* Personal Insights */}
      <Modal show={showInsights} onClose={() => setShowInsights(false)} wide dark={darkMode}>
        <ModalHeader title="Your Insights" onClose={() => setShowInsights(false)} icon={<TrendingUp size={18} className="text-blue-400" />} dark={darkMode} />
        {insightsData?.empty ? (
          <p className={`text-sm ${T.textDim} text-center py-8`}>Not enough data yet. Keep tracking!</p>
        ) : insightsData ? (
          <div>
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { v: insightsData.avgPerDay, l: 'Avg habits/day', c: 'text-blue-400', icon: '📊' },
                { v: insightsData.bestDay, l: 'Best day', c: 'text-emerald-400', icon: '🔥' },
                { v: insightsData.avgPtsPerDay, l: 'Avg pts/day', c: 'text-purple-400', icon: '⚡' },
                { v: insightsData.bestStreak + 'd', l: 'Best streak', c: 'text-[#e8864a]', icon: '🏆' },
              ].map((s, i) => (
                <div key={i} className={`p-3 rounded-xl ${darkMode ? (isSunset ? 'bg-[#1e1220] border border-[#3d2640]' : 'bg-[#151d30] border border-[#1e3050]') : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="text-sm mb-0.5">{s.icon}</div>
                  <div className={`text-lg font-black ${s.c}`}>{s.v}</div>
                  <div className={`text-[9px] ${T.textDim} tracking-wider uppercase`}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Most consistent habit */}
            <div className={`p-4 rounded-xl mb-4 ${darkMode ? (isSunset ? 'bg-[#1e1220] border border-[#3d2640]' : 'bg-[#151d30] border border-[#1e3050]') : 'bg-gray-50 border border-gray-200'}`}>
              <div className={`text-[10px] ${T.textDim} tracking-wider uppercase mb-1`}>Most Consistent Habit</div>
              <div className={`text-sm font-bold ${T.text}`}>{insightsData.bestHabitName}</div>
              <div className={`text-xs ${T.textDim}`}>{insightsData.bestHabitDays} out of {insightsData.activeDays} active days</div>
            </div>

            {/* Weekly pattern bar chart */}
            <div className={`p-4 rounded-xl mb-4 ${darkMode ? (isSunset ? 'bg-[#1e1220] border border-[#3d2640]' : 'bg-[#151d30] border border-[#1e3050]') : 'bg-gray-50 border border-gray-200'}`}>
              <div className={`text-[10px] ${T.textDim} tracking-wider uppercase mb-3`}>Weekly Pattern</div>
              <div className="flex items-end justify-between gap-1 h-20">
                {insightsData.weekdayNames.map((day, i) => {
                  const max = Math.max(1, ...insightsData.weekdayCounts);
                  const h = (insightsData.weekdayCounts[i] / max) * 100;
                  const isBest = i === insightsData.weekdayNames.indexOf(insightsData.bestDay);
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-md transition-all" style={{ height: Math.max(4, h) + '%', backgroundColor: isBest ? '#10b981' : (darkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb') }} />
                      <span className={`text-[8px] ${isBest ? 'text-emerald-400 font-bold' : T.textDim}`}>{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: insightsData.activeDays, l: 'Active Days' },
                { v: insightsData.completionRate + '%', l: 'Active Rate' },
                { v: insightsData.totalPts, l: 'Total Pts' },
              ].map((s, i) => (
                <div key={i} className={`text-center p-2 rounded-lg ${T.bgCard}`}>
                  <div className={`text-sm font-bold ${T.text}`}>{s.v}</div>
                  <div className={`text-[8px] ${T.textDim} tracking-wider uppercase`}>{s.l}</div>
                </div>
              ))}
            </div>

            <p className={`text-[10px] ${T.textDim} text-center mt-4 italic`}>Based on last 60 days · only you can see this</p>
          </div>
        ) : <p className={`text-sm ${T.textDim} text-center py-8`}>Loading...</p>}
      </Modal>

      {/* Custom Board Proposal */}
      <Modal show={showCustomBoard} onClose={() => setShowCustomBoard(false)} wide dark={darkMode}>
        <ModalHeader title="Custom Board" onClose={() => setShowCustomBoard(false)} dark={darkMode} />
        <p className={`text-xs ${T.textDim} mb-4`}>Pick which habits go on your personal board, or add new ones. Needs approval from your room.</p>
        {pendingBoards.find(b => b.userId === currentUser?.id && b.status === 'approved') && (
          <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <span className="text-xs text-emerald-400 font-medium">✔ You have an active custom board</span>
          </div>
        )}
        {pendingBoards.find(b => b.userId === currentUser?.id && b.status === 'pending') && (
          <div className="mb-3 p-3 bg-[#e8864a]/10 border border-[#e8864a]/20 rounded-xl">
            <span className="text-xs text-[#e8864a] font-medium">⏳ Your board is pending approval</span>
          </div>
        )}
        <div className="space-y-2 mb-3 max-h-52 overflow-y-auto">
          {habits.map(h => {
            const selected = customBoardHabits.includes(h.id);
            const ct = getCT(h.category);
            return (
              <button key={h.id} onClick={() => {
                setCustomBoardHabits(prev => selected ? prev.filter(id => id !== h.id) : [...prev, h.id]);
              }} className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${selected ? ct.bdr + ' ' + ct.bgS : darkMode ? 'border-[#1e3050] bg-[#182544] hover:bg-[#151d30]' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs ${selected ? ct.bg + ' border-transparent text-white' : 'border-gray-600'
                  }`}>{selected && '✔'}</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${selected ? (T.text) : T.textDim}`}>{h.name}</div>
                  <div className={`text-[10px] ${T.textDim}`}>{h.category} · {h.points} pts</div>
                </div>
              </button>
            );
          })}
        </div>
        {/* Inline add habit */}
        <details className={`mb-4 rounded-xl border overflow-hidden ${T.border} ${T.bgCard}`}>
          <summary className={`px-4 py-2.5 cursor-pointer text-xs font-medium ${T.textDim} hover:${T.text} transition-colors`}><Plus size={12} className="inline mr-1" />Add a new habit</summary>
          <div className="px-4 pb-4 pt-2 space-y-3">
            <input value={newHabit.name} onChange={e => setNewHabit(p => ({ ...p, name: e.target.value }))} placeholder="Habit name" className={inputCls} maxLength={30} />
            <div className="grid grid-cols-2 gap-3">
              <select value={newHabit.category} onChange={e => setNewHabit(p => ({ ...p, category: e.target.value }))} className={inputCls}>
                {allCatNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" value={newHabit.points} onChange={e => setNewHabit(p => ({ ...p, points: parseInt(e.target.value) || 0 }))} placeholder="Points" className={inputCls} min="1" max="100" />
            </div>
            <div className="flex items-center gap-3">
              <label className={`flex items-center gap-2 text-xs ${T.textDim}`}>
                <input type="checkbox" checked={newHabit.isRepeatable} onChange={e => setNewHabit(p => ({ ...p, isRepeatable: e.target.checked }))} className="rounded" />
                Repeatable
              </label>
            </div>
            <button onClick={async () => {
              if (!newHabit.name.trim()) return;
              try {
                const hid = currentRoom.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                await supabase.from('habits').insert({
                  id: hid,
                  name: newHabit.name.trim(), category: newHabit.category, points: parseInt(newHabit.points) || 10,
                  is_repeatable: newHabit.isRepeatable,
                  room_id: currentRoom.id, created_by: currentUser.id
                });
                setCustomBoardHabits(prev => [...prev, hid]);
                setNewHabit({ name: '', category: newHabit.category, points: 10, isRepeatable: false });
              } catch { setError('Failed to add'); }
            }} disabled={!newHabit.name.trim()} className={`w-full py-2.5 ${isSunset ? "bg-[#ff7b29]" : "bg-[#5b7cf5]"} text-white rounded-xl text-xs font-bold active:scale-[0.98] disabled:opacity-40`}>Add & Select</button>
          </div>
        </details>
        <div className={`text-xs ${T.textDim} mb-3`}>{customBoardHabits.length} habit{customBoardHabits.length !== 1 ? 's' : ''} selected</div>
        {error && <p className="text-red-400 text-xs text-center mb-2">{error}</p>}
        {successMsg && <p className="text-emerald-400 text-xs text-center mb-2">{successMsg}</p>}
        <button onClick={() => proposeCustomBoard(customBoardHabits)} disabled={customBoardHabits.length === 0} className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-40">{activeMembers.filter(m => m.id !== currentUser?.id).length > 0 ? 'Submit for Approval' : 'Apply Board'}</button>
        {activeMembers.filter(m => m.id !== currentUser?.id).length > 0 && <p className={`text-[10px] ${T.textDim} text-center mt-2`}>Needs majority approval from room members</p>}
      </Modal>

      {/* Room Settings (Creator only) */}
      <Modal show={showRoomSettings} onClose={() => setShowRoomSettings(false)} wide dark={darkMode}>
        <ModalHeader title="Room Settings" onClose={() => setShowRoomSettings(false)} icon={<Crown size={16} className="text-[#e8864a]" />} dark={darkMode} />
        <div className={`text-[10px] ${T.textDim} mb-4 flex items-center gap-2`}>
          <span className="font-mono tracking-wider bg-[#1e3050] px-2 py-1 rounded">{currentRoom?.code}</span>
          <span>·</span>
          <span>You are the room creator</span>
        </div>

        {/* Members */}
        <div className="mb-5">
          <h3 className={`text-xs font-bold ${T.textMuted} tracking-wider uppercase mb-3`}>Members ({activeMembers.length})</h3>
          <div className="space-y-2">
            {activeMembers.map(m => {
              const isMe = m.id === currentUser.id;
              const isCreator = m.id === (roomCreatedBy || currentRoom?.createdBy);
              return (
                <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl border ${T.border} ${T.bgCard}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${isCreator ? 'bg-[#e8864a]/20 text-[#e8864a]' : 'bg-blue-500/20 text-blue-400'}`}>{m.photoURL ? <img src={m.photoURL} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" /> : m.username?.charAt(0)?.toUpperCase()}</div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-medium ${T.text}`}>{m.username}</span>
                        {isCreator && <span className="text-[9px] bg-[#e8864a]/20 text-[#e8864a] px-1.5 py-0.5 rounded-full font-bold">Creator</span>}
                        {isMe && <span className={`text-[9px] ${T.textDim}`}>(you)</span>}
                      </div>
                      <div className={`text-[10px] ${T.textDim}`}>{m.email}</div>
                    </div>
                  </div>
                  {!isMe && isRoomCreator && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => transferOwnership(m.id)} className={`text-[9px] px-2 py-1 rounded-lg font-medium transition-all ${darkMode ? 'text-gray-600 hover:text-[#e8864a] hover:bg-[#e8864a]/10' : 'text-gray-400 hover:text-[#e8864a] hover:bg-[#e8864a]/8'}`}>Transfer</button>
                      <button onClick={() => kickMember(m.id)} className={`text-[9px] px-2 py-1 rounded-lg font-medium transition-all ${darkMode ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}>Remove</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {roomMembers.filter(m => kickedIds.includes(m.id)).length > 0 && (
            <div className="mt-4">
              <h3 className={`text-xs font-bold ${T.textDim} tracking-wider uppercase mb-2`}>Removed</h3>
              <div className="space-y-2">
                {roomMembers.filter(m => kickedIds.includes(m.id)).map(m => (
                  <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl border opacity-50 ${T.border} ${T.bgCard}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black bg-red-500/20 text-red-400">{m.username?.charAt(0)?.toUpperCase()}</div>
                      <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{m.username}</span>
                    </div>
                    {isRoomCreator && <button onClick={async () => { try { await supabase.from('rooms').update({ kicked: (roomKicked || []).filter(x => x !== m.id) }).eq('id', currentRoom.id); setRoomKicked(prev => prev.filter(x => x !== m.id)); } catch { } }} className={`text-[9px] px-2 py-1 rounded-lg font-medium transition-all ${darkMode ? 'text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>Restore</button>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Room Actions */}
        <div>
          <h3 className={`text-xs font-bold ${T.textMuted} tracking-wider uppercase mb-3`}>Room Actions</h3>
          <div className="space-y-2">
            {roomStakes && <button onClick={() => { setShowRoomSettings(false); setShowSettleStake(true); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left mb-2 ${darkMode ? 'border-[#d4a04a]/50 bg-[#d4a04a]/10 hover:bg-[#d4a04a]/20 text-[#d4a04a]' : 'border-[#d4a04a]/40 bg-[#d4a04a]/10 hover:bg-[#d4a04a]/20 text-[#c28e3b]'}`}><Trophy size={15} className="shrink-0" /><div><span className="text-sm font-bold">Settle Stake</span><div className={`text-[10px] opacity-80`}>Declare winner and move to Trophy Room</div></div></button>}
            {roomStakes && <button onClick={clearStake} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${T.border + ' ' + T.bgCard + ' ' + T.bgCardHover + ' ' + T.textMuted}`}><Zap size={15} className="text-red-400 shrink-0" /><div><span className="text-sm">Remove Stake</span><div className={`text-[10px] ${T.textDim}`}>Clear the current room stake</div></div></button>}
            <button onClick={clearAllHabits} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${T.border + ' ' + T.bgCard + ' hover:bg-red-500/5 ' + T.textMuted}`}><X size={15} className="text-red-400 shrink-0" /><div><span className="text-sm">Clear All Habits</span><div className={`text-[10px] ${T.textDim}`}>Delete every habit in this room</div></div></button>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}
        {successMsg && <p className="text-emerald-400 text-xs text-center mt-3">{successMsg}</p>}
      </Modal>

      {/* Settle Stake Modal */}
      <Modal show={showSettleStake} onClose={() => setShowSettleStake(false)} dark={darkMode}>
        <ModalHeader title="Settle Stake" onClose={() => setShowSettleStake(false)} dark={darkMode} />
        {roomStakes ? (
          <div>
            <div className={`p-4 rounded-xl border mb-6 text-center ${darkMode ? 'border-[#d4a04a]/30 bg-[#d4a04a]/10 text-white' : 'border-[#d4a04a]/30 bg-[#d4a04a]/5 text-gray-900'}`}>
              <div className="text-[10px] uppercase tracking-wider text-[#d4a04a] mb-1 font-bold">{roomStakes.type} &middot; {roomStakes.duration}</div>
              <div className="text-sm font-medium">"{roomStakes.description}"</div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-[10px] uppercase tracking-wider font-bold mb-2 ${T.textDim}`}>🏆 Who Won the Stake?</label>
                <select value={settleStakeData.winnerId} onChange={e => setSettleStakeData(prev => ({ ...prev, winnerId: e.target.value }))} className={`w-full p-3 rounded-xl border appearance-none outline-none text-sm ${darkMode ? 'bg-[#182544] border-[#223858] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                  <option value="" disabled>Select Winner...</option>
                  {roomMembers.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                </select>
              </div>

              <div>
                <label className={`block text-[10px] uppercase tracking-wider font-bold mb-2 ${T.textDim}`}>💀 Who Lost & Mentions the Hall of Shame?</label>
                <select value={settleStakeData.loserId} onChange={e => setSettleStakeData(prev => ({ ...prev, loserId: e.target.value }))} className={`w-full p-3 rounded-xl border appearance-none outline-none text-sm ${darkMode ? 'bg-[#182544] border-[#223858] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                  <option value="" disabled>Select Loser...</option>
                  {roomMembers.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                </select>
              </div>
            </div>

            <button onClick={archiveStake} disabled={loading || !settleStakeData.winnerId || !settleStakeData.loserId} className="w-full mt-6 px-4 py-3.5 bg-gradient-to-r from-[#d4a04a] to-[#c28e3b] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#d4a04a]/20 active:scale-[0.98] disabled:opacity-50 transition-all">
              {loading ? 'Saving...' : 'Finalize & Archive Stake'}
            </button>
            <p className={`text-[10px] text-center mt-3 ${T.textDim}`}>Archiving this stake will send it to the winner's Trophy Room and remove it from the room, allowing you to set a new one for next week.</p>
          </div>
        ) : (
          <p className="text-sm text-center text-gray-500 py-4">No active stake to settle</p>
        )}
        {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}
        {successMsg && <p className="text-emerald-400 text-xs text-center mt-3">{successMsg}</p>}
      </Modal>

    </div>
  );
}


export default function VersaApp() { return <ErrorBoundary><VersaAppMain /></ErrorBoundary>; }

