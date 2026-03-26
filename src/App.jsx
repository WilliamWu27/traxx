import React, { useState, useEffect, useRef } from 'react';
import { Clock, Plus, X, LogOut, Copy, Check, UserPlus, HelpCircle, Trophy, User, Flame, Zap, Star, TrendingUp, ArrowLeftRight, Edit3, Calendar, ChevronLeft, ChevronRight, Crown, Target, ArrowUp, ArrowDown, Minus as MinusIcon, GripVertical, BarChart3, Sun, Moon, ChevronDown, Trash2 } from 'lucide-react';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider
} from 'firebase/auth';
import {
  collection, doc, setDoc, getDoc, onSnapshot, deleteDoc, updateDoc, query, where, getDocs, arrayUnion, arrayRemove, orderBy, limit
} from 'firebase/firestore';

// ─── CONFETTI ───
function ConfettiCanvas({ trigger }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const colors = ['#f43f5e','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
    const particles = Array.from({length:180}, () => ({
      x: Math.random()*canvas.width, y: -20-Math.random()*200, w: 4+Math.random()*6, h: 8+Math.random()*12,
      vx: (Math.random()-0.5)*6, vy: 2+Math.random()*4, rot: Math.random()*360, rotV: (Math.random()-0.5)*12,
      color: colors[Math.floor(Math.random()*colors.length)], life: 1
    }));
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        if (p.life <= 0) return; alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.rot += p.rotV; p.life -= 0.005;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot*Math.PI/180); ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
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
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={circ - Math.min(progress,1)*circ} strokeLinecap="round" style={{transition:'stroke-dashoffset 0.6s ease'}} />
    </svg>
  );
}

// ─── AVATAR (with photo support) ───
function Avatar({ user, size = 28, className = '' }) {
  const s = { width: size, height: size, minWidth: size };
  if (user?.photoURL) return <img src={user.photoURL} className={`rounded-full object-cover ${className}`} style={s} referrerPolicy="no-referrer"/>;
  const letter = user?.username?.charAt(0)?.toUpperCase() || '?';
  return <div className={`rounded-full flex items-center justify-center font-black ${className}`} style={{...s, fontSize: size * 0.4}}>{letter}</div>;
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
  const mbg = isDark ? 'bg-[#12121a] border-white/[0.06]' : 'bg-white border-gray-200';
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className={`rounded-2xl w-full p-6 border shadow-2xl max-h-[85vh] overflow-y-auto ${mbg} ` + (wide ? 'max-w-md' : 'max-w-sm')} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose, icon, dark }) {
  const isDark = dark !== undefined ? dark : true;
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">{icon}{typeof title === 'string' ? <h2 className={`text-lg font-bold ${isDark?'text-white':'text-gray-900'}`}>{title}</h2> : title}</div>
      <button onClick={onClose} className={`${isDark?'text-gray-600 hover:text-white':'text-gray-400 hover:text-gray-900'} transition-colors`}><X size={20} /></button>
    </div>
  );
}

export default function VersaApp() {
  // ─── DATE HELPERS (must be before state that uses them) ───
  const formatDateStr = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  const getToday = () => { const d = new Date(); return formatDateStr(d); };
  const getYesterday = () => { const d = new Date(); d.setDate(d.getDate()-1); return formatDateStr(d); };

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
  const toggleDevMode = () => { const next = !devMode; setDevMode(next); try { localStorage.setItem('versa-devmode', next ? 'true' : 'false'); } catch {} };
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
  const [newStake, setNewStake] = useState({ type: 'custom', description: '', duration: 'weekly' });
  const [newHabit, setNewHabit] = useState({ name: '', category: 'Study', points: 10, isRepeatable: false, maxCompletions: 1, unit: '', description: '' });
  const [historyDate, setHistoryDate] = useState(null);
  const [editHabitData, setEditHabitData] = useState({});
  const [weeklyWinner, setWeeklyWinner] = useState(null);
  const [yesterdayPoints, setYesterdayPoints] = useState(0);
  const [dateKey, setDateKey] = useState(getToday());
  const [editMode, setEditMode] = useState(false);
  const [habitOrder, setHabitOrder] = useState([]);
  const [showWeeklyRecap, setShowWeeklyRecap] = useState(false);
  const [lastWeekData, setLastWeekData] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    try { const stored = localStorage.getItem('versa-theme'); return stored ? stored === 'dark' : true; } catch { return true; }
  });
  const [roomCategories, setRoomCategories] = useState([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(0);
  const [newCatIcon, setNewCatIcon] = useState('⭐');
  const [maxedHabit, setMaxedHabit] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [heatMapData, setHeatMapData] = useState({});
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

  const prevProgRef = useRef(0);
  const [celebrateComplete, setCelebrateComplete] = useState(false);
  useEffect(() => {
    if (celebrateComplete) {
      setConfettiTrigger(v=>v+1);
      setTimeout(() => setConfettiTrigger(v=>v+1), 400);
      setCelebrateComplete(false);
    }
  }, [celebrateComplete]);

  // ─── HELPERS ───
  const genCode = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i=0;i<6;i++) r+=c[Math.floor(Math.random()*c.length)]; return r; };
  const getWeekStart = () => { const n = new Date(), d = n.getDay(); const m = new Date(n); m.setDate(m.getDate()-d); m.setHours(0,0,0,0); return formatDateStr(m); };
  const getWeekEnd = () => { const ws = getWeekStart(); const d = new Date(ws+'T12:00:00'); d.setDate(d.getDate()+6); return formatDateStr(d); };
  const formatDate = (ds) => { const d = new Date(ds+'T12:00:00'); return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
  const getDaysUntilReset = () => { const d = new Date(); const day = d.getDay(); return 6 - day; }; // Saturday = 0 days left, Sunday = 6
  const getLastWeekStart = () => { const d = new Date(getWeekStart()+'T12:00:00'); d.setDate(d.getDate()-7); return formatDateStr(d); };
  const getLastWeekEnd = () => { const d = new Date(getWeekStart()+'T12:00:00'); d.setDate(d.getDate()-1); return formatDateStr(d); };
  const toggleTheme = () => { const next = !darkMode; setDarkMode(next); try { localStorage.setItem('versa-theme', next ? 'dark' : 'light'); } catch {} };
  const getOrderedHabits = (cat) => {
    const pool = (myBoardIds && !editMode) ? habits.filter(h => myBoardIds.includes(h.id)) : habits;
    const ch = pool.filter(h=>h.category===cat);
    if (!habitOrder.length) return ch;
    return [...ch].sort((a,b)=>{const ai=habitOrder.indexOf(a.id),bi=habitOrder.indexOf(b.id);if(ai===-1&&bi===-1)return 0;if(ai===-1)return 1;if(bi===-1)return-1;return ai-bi;});
  };
  const saveHabitOrder = async (cat, newOrderedHabits) => {
    const orderId = currentUser.id+'_'+currentRoom.id;
    const otherIds = habitOrder.filter(id=>{const h=habits.find(x=>x.id===id);return h&&h.category!==cat;});
    const newIds = newOrderedHabits.map(h=>h.id);
    const allOrdered = [];
    allCatNames.forEach(c=>{if(c===cat)allOrdered.push(...newIds);else{const catIds=otherIds.filter(id=>{const h=habits.find(x=>x.id===id);return h?.category===c;});const unordered=habits.filter(h=>h.category===c&&!catIds.includes(h.id)).map(h=>h.id);allOrdered.push(...catIds,...unordered);}});
    setHabitOrder(allOrdered);
    try{await setDoc(doc(db,'habitOrder',orderId),{order:allOrdered,userId:currentUser.id,roomId:currentRoom.id});}catch(err){console.error(err);}
  };
  const getGreeting = () => { const h = new Date().getHours(); if(h<5) return 'Burning the midnight oil'; if(h<12) return 'Good morning'; if(h<17) return 'Good afternoon'; if(h<21) return 'Good evening'; return 'Night owl mode'; };
  const getMotivation = () => {
    const msgs = ["Let's crush it today","Every rep counts","Build the future you","Small wins, big results","Discipline equals freedom","Level up today","Outwork yesterday","Stay locked in","The grind pays off","Consistency beats talent","One day or day one","Make it count","Your only limit is you","Champions train daily","Focus mode activated"];
    return msgs[new Date().getDate() % msgs.length];
  };

  // ─── DEFAULT HABITS ───
  const loadDefaultHabits = async () => {
    const defaultHabits = [
      // STUDY — time-based
      { name: 'Deep work', category: 'Study', points: 10, isRepeatable: true, maxCompletions: 20, unit: 'per 30 min' },
      { name: 'Read', category: 'Study', points: 10, isRepeatable: true, maxCompletions: 6, unit: 'per 30 min' },
      // STUDY — completion-based
      { name: 'Small task', category: 'Study', points: 10, isRepeatable: true, maxCompletions: 5 },
      { name: 'Big task', category: 'Study', points: 30, isRepeatable: true, maxCompletions: 2 },
      // HEALTH — gym, sleep, nutrition
      { name: 'Hit the gym', category: 'Health', points: 20, isRepeatable: true, maxCompletions: 4, unit: 'per 30 min' },
      { name: 'Slept 7+ hours', category: 'Health', points: 30, isRepeatable: false, maxCompletions: 1 },
      { name: 'Woke up before 7', category: 'Health', points: 30, isRepeatable: false, maxCompletions: 1 },
      { name: 'Clean eating', category: 'Health', points: 10, isRepeatable: true, maxCompletions: 3, unit: 'per meal' },
      // FOCUS — screen time, substances, mindset
      { name: 'Screen time under 2.5hrs', category: 'Focus', points: 30, isRepeatable: false, maxCompletions: 1 },
      { name: 'No vaping / substances', category: 'Focus', points: 30, isRepeatable: false, maxCompletions: 1 },
      { name: 'Work done before 9pm', category: 'Focus', points: 30, isRepeatable: false, maxCompletions: 1 },
      { name: 'Journaled', category: 'Focus', points: 10, isRepeatable: true, maxCompletions: 3, unit: 'per 5 min' },
    ];
    try {
      setLoading(true);
      for (const habit of defaultHabits) {
        const id = currentRoom.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
        await setDoc(doc(db, 'habits', id), { ...habit, roomId: currentRoom.id, createdBy: currentUser.id, createdAt: new Date().toISOString() });
      }
      setShowAddHabit(false);
      setConfettiTrigger(v=>v+1);
    } catch (err) { console.error(err); setError('Failed to load defaults'); } finally { setLoading(false); }
  };

  // ─── AUTH LISTENER ───
  useEffect(() => {
    // Deep link: check URL for ?join=CODE
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) { setRoomCode(joinCode.toUpperCase()); window.history.replaceState({}, '', window.location.pathname); }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const ud = await getDoc(doc(db, 'users', user.uid));
          if (ud.exists()) {
            const data = { id: user.uid, ...ud.data() };
            setCurrentUser(data);
            const rooms = data.rooms || (data.roomId ? [data.roomId] : []);
            setUserRooms(rooms);
            const active = data.activeRoom || data.roomId || (rooms.length > 0 ? rooms[0] : null);
            if (active) {
              const rd = await getDoc(doc(db, 'rooms', active));
              if (rd.exists()) { setCurrentRoom({ id: rd.id, ...rd.data() }); setView('dashboard'); }
              else setShowRoomModal(true);
            } else setShowRoomModal(true);
          }
        } catch (err) { console.error(err); setError(err.message); }
      } else setCurrentUser(null);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ─── REALTIME DATA ───
  useEffect(() => {
    if (!currentUser || !currentRoom) return;
    const u1 = onSnapshot(query(collection(db, 'habits'), where('roomId', '==', currentRoom.id)), s => setHabits(s.docs.map(d => ({id:d.id,...d.data()}))));
    const today = getToday();
    const u2 = onSnapshot(query(collection(db, 'completions'), where('roomId', '==', currentRoom.id), where('date', '==', today)), s => setCompletions(s.docs.map(d => ({id:d.id,...d.data()}))));
    // Weekly: fetch each day individually to avoid needing a composite index
    const ws = getWeekStart();
    const we = getWeekEnd();
    const weekDays = [];
    { const d = new Date(ws+'T12:00:00'); const end = new Date(today+'T12:00:00'); while (d <= end) { weekDays.push(formatDateStr(d)); d.setDate(d.getDate()+1); } }
    // Stale-proof: capture the weekStart this effect was created for
    const effectWeekStart = ws;
    let cancelled = false;
    const weekData = {};
    setAllCompletions([]); // clear immediately
    const weekUnsubs = weekDays.map(day =>
      onSnapshot(query(collection(db, 'completions'), where('roomId', '==', currentRoom.id), where('date', '==', day)), s => {
        if (cancelled) return; // reject callbacks from stale effect
        weekData[day] = s.docs.map(d => ({id:d.id,...d.data()}));
        // Flatten + strict date filter: only this week's data
        const all = Object.values(weekData).flat();
        setAllCompletions(all.filter(c => c.date >= effectWeekStart && c.date <= today));
      })
    );    // Members: support both new rooms array and old roomId
    const u4 = onSnapshot(query(collection(db, 'users'), where('rooms', 'array-contains', currentRoom.id)), s => setRoomMembers(s.docs.map(d => ({id:d.id,...d.data()}))));
    const u5 = onSnapshot(query(collection(db, 'users'), where('roomId', '==', currentRoom.id)), s => {
      setRoomMembers(prev => { const ids = new Set(prev.map(m=>m.id)); const nw = s.docs.map(d=>({id:d.id,...d.data()})).filter(m=>!ids.has(m.id)); return [...prev,...nw]; });
    });
    const u6 = onSnapshot(doc(db, 'stakes', currentRoom.id), s => { if(s.exists()) setRoomStakes({id:s.id,...s.data()}); else setRoomStakes(null); });
    // Habit order listener
    const u7 = onSnapshot(doc(db, 'habitOrder', currentUser.id+'_'+currentRoom.id), s => { if(s.exists()) setHabitOrder(s.data().order||[]); else setHabitOrder([]); });
    // Room categories listener
    const u8 = onSnapshot(doc(db, 'roomCategories', currentRoom.id), s => { if(s.exists()) setRoomCategories(s.data().categories||[]); else setRoomCategories([]); });
    // Activity feed - today's completions from ALL room members (no composite index needed)
    let u9 = ()=>{}, u10 = ()=>{}, u11 = ()=>{};
    try {
      u9 = onSnapshot(query(collection(db, 'activity'), where('roomId', '==', currentRoom.id), where('date', '==', today)), s => {
        const items = s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.ts||'').localeCompare(a.ts||''));
        setActivityFeed(items);
      }, err => console.warn('Activity feed:', err));
    } catch(e) { console.warn('Activity listener failed:', e); }
    // Personal board listener
    try {
      u10 = onSnapshot(doc(db, 'myBoard', currentUser.id+'_'+currentRoom.id), s => {
        if (s.exists() && s.data().habitIds) setMyBoardIds(s.data().habitIds);
        else setMyBoardIds(null);
      }, err => console.warn('Board:', err));
    } catch(e) { console.warn('Board listener failed:', e); }
    // Custom board proposals listener
    try {
      u11 = onSnapshot(query(collection(db, 'customBoards'), where('roomId', '==', currentRoom.id)), s => {
        const boards = s.docs.map(d=>({id:d.id,...d.data()}));
        setPendingBoards(boards);
        setBoardRequests(boards.filter(b=>b.status==='pending'&&b.userId!==currentUser.id&&!(b.approvals||[]).includes(currentUser.id)&&!(b.rejections||[]).includes(currentUser.id)));
      }, err => console.warn('Custom boards:', err));
    } catch(e) { console.warn('Board proposals listener failed:', e); }
    return () => { cancelled = true; u1(); u2(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); weekUnsubs.forEach(u=>u()); };
  }, [currentUser, currentRoom, dateKey]);

  // ─── LOAD ROOM KICKED LIST ───
  useEffect(() => {
    if (!currentRoom) { setRoomKicked([]); setRoomCreatedBy(null); return; }
    const load = async () => {
      try {
        const rd = await getDoc(doc(db, 'rooms', currentRoom.id));
        if (rd.exists()) {
          setRoomKicked(rd.data().kicked || []);
          setRoomCreatedBy(rd.data().createdBy || null);
        }
      } catch {}
    };
    load();
  }, [currentRoom?.id]);

  // ─── LAST WEEK DATA (for recap) ───
  useEffect(() => {
    if (!currentUser || !currentRoom || activeMembers.length < 1) return;
    const loadLastWeek = async () => {
      try {
        const lws = getLastWeekStart(), lwe = getLastWeekEnd();
        const snap = await getDocs(query(collection(db,'completions'), where('roomId','==',currentRoom.id), where('date','>=',lws), where('date','<=',lwe)));
        const comps = snap.docs.map(d=>({id:d.id,...d.data()}));
        if (!comps.length) { setLastWeekData(null); return; }
        const scores = activeMembers.map(m => {
          const mc = comps.filter(c=>c.userId===m.id);
          const pts = mc.reduce((s,c)=>{const h=habits.find(x=>x.id===c.habitId);return s+((h?.points||c.habitPoints||0)*(c.count||1));},0);
          const catPts = {}; allCatNames.forEach(c => catPts[c] = 0);
          mc.forEach(c=>{const h=habits.find(x=>x.id===c.habitId);const cat=h?.category||c.habitCategory||'Study';catPts[cat]+=(h?.points||c.habitPoints||0)*(c.count||1);});
          const activeDays = [...new Set(mc.map(c=>c.date))].length;
          return {member:m, pts, catPts, activeDays, completions:mc.length};
        }).sort((a,b)=>b.pts-a.pts);
        setLastWeekData({scores, dateRange: formatDate(lws)+' — '+formatDate(lwe)});
      } catch { setLastWeekData(null); }
    };
    loadLastWeek();
  }, [currentUser, currentRoom, roomMembers, roomKicked, habits]);

  // ─── STREAK + YESTERDAY ───
  useEffect(() => {
    if (!currentUser || !currentRoom) return;
    const calc = async () => {
      try {
        const ago = new Date(); ago.setDate(ago.getDate()-60);
        const snap = await getDocs(query(collection(db, 'completions'), where('userId', '==', currentUser.id), where('date', '>=', formatDateStr(ago))));
        const allDocs = snap.docs.map(d => d.data());

        // Calculate which dates hit 20% of daily target (60pts)
        const qualifyingDates = new Set();
        const datePts = {};
        allDocs.forEach(d => {
          if (!datePts[d.date]) datePts[d.date] = 0;
          datePts[d.date] += ((d.habitPoints || habits.find(h => h.id === d.habitId)?.points || 0) * (d.count || 1)) + (d.bonusPoints || 0);
        });
        Object.entries(datePts).forEach(([date, pts]) => {
          if (pts >= 80) qualifyingDates.add(date);
        });

        const dates = [...qualifyingDates].sort().reverse();
        let streak = 0;
        const today = getToday(), yStr = getYesterday();

        // Load freeze from user doc
        const userSnap = await getDoc(doc(db, 'users', currentUser.id));
        const savedFreeze = userSnap.exists() ? (userSnap.data().streakFreeze || 0) : 0;
        setStreakFreeze(savedFreeze);

        if (dates.includes(today) || dates.includes(yStr)) {
          let check = dates.includes(today) ? new Date() : new Date(Date.now()-86400000);
          let freezeUsed = false;
          while (true) {
            const ds = formatDateStr(check);
            if (dates.includes(ds)) {
              streak++;
              check.setDate(check.getDate()-1);
            } else if (!freezeUsed && savedFreeze > 0 && streak > 0) {
              freezeUsed = true;
              check.setDate(check.getDate()-1);
            } else {
              break;
            }
          }
          if (freezeUsed && savedFreeze > 0) {
            await updateDoc(doc(db, 'users', currentUser.id), { streakFreeze: 0 });
            setStreakFreeze(0);
            setFreezeMsg('🛡️ Streak freeze saved your streak!');
            setTimeout(() => setFreezeMsg(null), 4000);
          }
        }

        // Yesterday's points for solo mode
        const yComps = snap.docs.filter(d => d.data().date === yStr && d.data().roomId === currentRoom.id);
        let yPts = 0;
        yComps.forEach(d => {
          const data = d.data();
          const pts = data.habitPoints || habits.find(h=>h.id===data.habitId)?.points || 0;
          yPts += pts * (data.count || 1);
        });
        setYesterdayPoints(yPts);
        // Check for streak milestone
        const milestones = [60, 30, 14, 7, 3];
        const prevStreak = streakData.streak || 0;
        if (streak > prevStreak) {
          const crossed = milestones.find(m => streak >= m && prevStreak < m);
          if (crossed) {
            const tierNames = {3:'Building 1.1×',7:'Consistent 1.25×',14:'Dedicated 1.5×',30:'Warrior 1.75×',60:'Legend 2×'};
            setStreakMilestone({ days: crossed, tier: tierNames[crossed] });
            setConfettiTrigger(v=>v+1);
            setTimeout(() => setStreakMilestone(null), 4000);
          }
        }
        setStreakData({ streak, activeDays: dates.length, totalCompletions: snap.docs.reduce((s,d)=>s+(d.data().count||1),0) });
      } catch (err) { console.error(err); setStreakData({streak:0,activeDays:0,totalCompletions:0}); }
    };
    calc();
  }, [currentUser, currentRoom, completions, habits]);

  // ─── MUTUAL STREAKS (Snapchat-style between pairs) ───
  useEffect(() => {
    if (!currentUser || !currentRoom || activeMembers.length < 2) { setMutualStreaks({}); return; }
    const calc = async () => {
      try {
        const ago = new Date(); ago.setDate(ago.getDate() - 60);
        const snap = await getDocs(query(collection(db, 'completions'), where('roomId', '==', currentRoom.id), where('date', '>=', formatDateStr(ago))));
        const allDocs = snap.docs.map(d => d.data());

        // Build a map of userId -> Set of qualifying dates (80+ pts)
        const userDates = {};
        activeMembers.forEach(m => { userDates[m.id] = {}; });
        allDocs.forEach(d => {
          if (!userDates[d.userId]) return;
          if (!userDates[d.userId][d.date]) userDates[d.userId][d.date] = 0;
          userDates[d.userId][d.date] += ((d.habitPoints || 0) * (d.count || 1)) + (d.bonusPoints || 0);
        });
        const userQualDates = {};
        Object.entries(userDates).forEach(([uid, dates]) => {
          userQualDates[uid] = new Set(Object.entries(dates).filter(([_, pts]) => pts >= 80).map(([date]) => date));
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
  }, [currentUser, currentRoom, completions, roomMembers, roomKicked]);

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
      pts: allCompletions.filter(c=>c.userId===m.id && c.date>=ws && c.date<=today).reduce((s,c)=>{
        const h = habits.find(hb=>hb.id===c.habitId);
        return s + ((h?.points || c.habitPoints || 0) * (c.count||1));
      },0)
    })).sort((a,b)=>b.pts-a.pts);
    if (scores.length > 0 && scores[0].pts > 0) {
      const isTied = scores.length > 1 && scores[0].pts === scores[1].pts;
      setWeeklyWinner(isTied ? null : { ...scores[0], daysLeft: getDaysUntilReset() });
    } else setWeeklyWinner(null);
  }, [roomMembers, roomKicked, allCompletions, habits, currentRoom]);

  // ─── RIVAL STATUS (what your competition is doing today) ───
  useEffect(() => {
    if (!currentUser || !currentRoom || activeMembers.length < 2) { setRivalStatus([]); return; }
    const today = getToday();
    const rivals = activeMembers.filter(m=>m.id!==currentUser.id).map(m => {
      const todayComps = completions.filter(c=>c.userId===m.id&&c.date===today);
      const pts = todayComps.reduce((s,c)=>{const h=habits.find(x=>x.id===c.habitId);return s+((h?.points||c.habitPoints||0)*(c.count||1));},0);
      const habitCount = todayComps.length;
      const weekPts = allCompletions.filter(c=>c.userId===m.id&&c.date>=getWeekStart()&&c.date<=getWeekEnd()).reduce((s,c)=>{const h=habits.find(x=>x.id===c.habitId);return s+((h?.points||c.habitPoints||0)*(c.count||1));},0);
      return { member: m, pts, habitCount, weekPts };
    }).sort((a,b)=>b.pts-a.pts);
    setRivalStatus(rivals);
  }, [currentUser, currentRoom, roomMembers, roomKicked, completions, allCompletions, habits]);

  // ─── HEAT MAP (load on demand) ───
  const loadHeatMap = async () => {
    if (!currentUser) return;
    try {
      const ago = new Date(); ago.setDate(ago.getDate()-90);
      const snap = await getDocs(query(collection(db,'completions'),where('userId','==',currentUser.id),where('date','>=',formatDateStr(ago))));
      const map = {};
      snap.docs.forEach(d => { const dt = d.data(); const pts = (dt.habitPoints||0)*(dt.count||1); map[dt.date] = (map[dt.date]||0) + pts; });
      setHeatMapData(map);
      setShowHeatMap(true);
    } catch { setShowHeatMap(true); }
  };

  // ─── ROOM ROLES (computed from performance) ───
  const getRoomRole = (uid) => {
    if (!currentRoom) return null;
    if ((roomCreatedBy || currentRoom.createdBy) === uid) {
      if (weeklyWinner?.member?.id === uid) return { role: 'Champion', icon: '👑', color: 'text-amber-400' };
      return { role: 'Creator', icon: '⚡', color: 'text-blue-400' };
    }
    if (weeklyWinner?.member?.id === uid) return { role: 'Defender', icon: '🛡️', color: 'text-amber-400' };
    if (lastWeekData?.scores) {
      const lastIdx = lastWeekData.scores.findIndex(s=>s.member.id===uid);
      if (lastIdx === lastWeekData.scores.length - 1 && lastWeekData.scores.length > 1) return { role: 'Underdog', icon: '🔥', color: 'text-red-400' };
    }
    const myWeekPts = allCompletions.filter(c=>c.userId===uid&&c.date>=getWeekStart()&&c.date<=getWeekEnd()).reduce((s,c)=>{const h=habits.find(x=>x.id===c.habitId);return s+((h?.points||c.habitPoints||0)*(c.count||1));},0);
    if (weeklyWinner && myWeekPts > 0 && myWeekPts >= (weeklyWinner.pts * 0.8)) return { role: 'Challenger', icon: '⚔️', color: 'text-purple-400' };
    return null;
  };

  // ─── PERSONAL INSIGHTS (load on demand) ───
  const loadInsights = async () => {
    if (!currentUser || !currentRoom) return;
    try {
      const ago = new Date(); ago.setDate(ago.getDate()-60);
      const snap = await getDocs(query(collection(db,'completions'),where('userId','==',currentUser.id),where('roomId','==',currentRoom.id),where('date','>=',formatDateStr(ago))));
      const comps = snap.docs.map(d=>({id:d.id,...d.data()}));
      if (!comps.length) { setInsightsData({ empty: true }); setShowInsights(true); return; }
      const dayMap = {};
      comps.forEach(c => { dayMap[c.date] = (dayMap[c.date]||0) + 1; });
      const activeDays = Object.keys(dayMap).length;
      const avgPerDay = activeDays > 0 ? (comps.length / activeDays).toFixed(1) : 0;
      const weekdayCounts = [0,0,0,0,0,0,0];
      const weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      comps.forEach(c => { const d = new Date(c.date+'T12:00:00'); weekdayCounts[d.getDay()] += (c.count||1); });
      const bestDayIdx = weekdayCounts.indexOf(Math.max(...weekdayCounts));
      const worstDayIdx = weekdayCounts.indexOf(Math.min(...weekdayCounts));
      const habitDays = {};
      comps.forEach(c => { if (!habitDays[c.habitId]) habitDays[c.habitId] = new Set(); habitDays[c.habitId].add(c.date); });
      let bestHabit = null, bestHabitDays = 0;
      Object.entries(habitDays).forEach(([hid, days]) => { if (days.size > bestHabitDays) { bestHabitDays = days.size; bestHabit = hid; } });
      const bestHabitName = habits.find(h=>h.id===bestHabit)?.name || comps.find(c=>c.habitId===bestHabit)?.habitName || 'Unknown';
      const totalPts = comps.reduce((s,c) => s + ((c.habitPoints||0)*(c.count||1)), 0);
      const avgPtsPerDay = activeDays > 0 ? Math.round(totalPts / activeDays) : 0;
      const completionRate = Math.round((activeDays / 60) * 100);
      const bestStreak = (() => {
        const dates = Object.keys(dayMap).sort(); let max = 0, cur = 0;
        for (let i = 0; i < dates.length; i++) {
          if (i === 0) { cur = 1; } else {
            const diff = (new Date(dates[i]+'T12:00:00') - new Date(dates[i-1]+'T12:00:00')) / 86400000;
            cur = diff === 1 ? cur + 1 : 1;
          }
          if (cur > max) max = cur;
        }
        return max;
      })();
      setInsightsData({ avgPerDay, bestDay: weekdayNames[bestDayIdx], worstDay: weekdayNames[worstDayIdx], bestHabitName, bestHabitDays, completionRate, activeDays, totalPts, avgPtsPerDay, bestStreak, weekdayCounts, weekdayNames });
      setShowInsights(true);
    } catch(err) { console.error(err); setShowInsights(true); }
  };

  // ─── CUSTOM BOARDS ───
  // ─── PERSONAL BOARD ───
  const toggleHabitOnBoard = async (habitId) => {
    if (!currentUser || !currentRoom) return;
    const boardDocId = currentUser.id+'_'+currentRoom.id;
    const current = myBoardIds || habits.map(h=>h.id);
    const updated = current.includes(habitId)
      ? current.filter(id=>id!==habitId)
      : [...current, habitId];
    if (updated.length === 0) return; // can't have empty board
    try {
      await setDoc(doc(db, 'myBoard', boardDocId), { habitIds: updated, userId: currentUser.id, roomId: currentRoom.id });
    } catch {}
  };
  const resetBoard = async () => {
    if (!currentUser || !currentRoom) return;
    try { await deleteDoc(doc(db, 'myBoard', currentUser.id+'_'+currentRoom.id)); } catch {}
  };
  const isOnBoard = (habitId) => !myBoardIds || myBoardIds.includes(habitId);
  const boardActive = myBoardIds !== null;

  // Custom board proposals (for approval flow)
  const proposeCustomBoard = async (selectedHabitIds) => {
    if (!currentUser || !currentRoom || !selectedHabitIds.length) return;
    try {
      const boardId = currentUser.id + '_' + currentRoom.id;
      const otherMembers = activeMembers.filter(m=>m.id!==currentUser.id).length;
      if (otherMembers === 0) {
        // Solo mode: apply directly, no approval needed
        await setDoc(doc(db, 'myBoard', boardId), { habitIds: selectedHabitIds, userId: currentUser.id, roomId: currentRoom.id });
        await setDoc(doc(db, 'customBoards', boardId), {
          userId: currentUser.id, username: currentUser.username, roomId: currentRoom.id,
          habitIds: selectedHabitIds, status: 'approved', createdAt: new Date().toISOString(), approvals: [], rejections: []
        });
        setShowCustomBoard(false); setSuccessMsg('Board applied!'); setTimeout(()=>setSuccessMsg(''),2000);
      } else {
        await setDoc(doc(db, 'customBoards', boardId), {
          userId: currentUser.id, username: currentUser.username, roomId: currentRoom.id,
          habitIds: selectedHabitIds, status: 'pending',
          createdAt: new Date().toISOString(), approvals: [], rejections: []
        });
        setShowCustomBoard(false); setSuccessMsg('Board submitted for approval!'); setTimeout(()=>setSuccessMsg(''),3000);
      }
    } catch { setError('Failed to submit board'); }
  };
  const voteOnBoard = async (boardDoc, approve) => {
    try {
      const ref = doc(db, 'customBoards', boardDoc.id);
      const field = approve ? 'approvals' : 'rejections';
      const other = approve ? 'rejections' : 'approvals';
      const updList = [...(boardDoc[field]||[]).filter(id=>id!==currentUser.id), currentUser.id];
      const otherList = (boardDoc[other]||[]).filter(id=>id!==currentUser.id);
      const otherMembers = activeMembers.filter(m=>m.id!==boardDoc.userId).length;
      const needed = Math.max(1, Math.ceil(otherMembers / 2));
      let status = boardDoc.status;
      if (approve && updList.length >= needed) status = 'approved';
      if (!approve && updList.length >= needed) status = 'rejected';
      await updateDoc(ref, { [field]: updList, [other]: otherList, status });
      // If approved, apply to the user's personal board
      if (status === 'approved') {
        await setDoc(doc(db, 'myBoard', boardDoc.userId+'_'+currentRoom.id), { habitIds: boardDoc.habitIds, userId: boardDoc.userId, roomId: currentRoom.id });
      }
    } catch {}
  };

  // ─── TIMER + MIDNIGHT RESET ───
  useEffect(() => {
    const update = () => {
      const n = new Date(), m = new Date(n); m.setHours(24,0,0,0);
      const d = m - n;
      setTimeDisplay(Math.floor(d/3600000)+'h '+Math.floor((d%3600000)/60000)+'m');
      // Check if date changed (midnight crossed) — triggers re-subscribe
      const today = getToday();
      setDateKey(prev => { if (prev !== today) return today; return prev; });
    };
    update(); const iv = setInterval(update, 30000); return () => clearInterval(iv);
  }, []);

  // ─── STREAK FREEZE EARN/REVOKE CHECK ───
  const freezeEarnedRef = useRef(false);
  useEffect(() => {
    if (!currentUser || !currentRoom) return;
    // Calculate progress inline (points / daily target)
    const dh = myBoardIds ? habits.filter(h=>myBoardIds.includes(h.id)) : habits;
    if (!dh.length) return;
    const pts = completions.filter(c=>c.userId===currentUser.id&&c.date===getToday()).reduce((s,c)=>{ return s+((c.habitPoints||habits.find(x=>x.id===c.habitId)?.points||0)*(c.count||1))+(c.bonusPoints||0); },0);
    const prog = Math.min(pts / 400, 1);
    if (prog >= 0.9 && streakFreeze === 0 && !freezeEarnedRef.current) {
      freezeEarnedRef.current = true;
      const award = async () => {
        try {
          await updateDoc(doc(db, 'users', currentUser.id), { streakFreeze: 1 });
          setStreakFreeze(1);
          setFreezeMsg('🛡️ Streak freeze earned! Complete 90% tomorrow to earn another.');
          setTimeout(() => setFreezeMsg(null), 4000);
        } catch {}
      };
      award();
    } else if (prog < 0.9 && freezeEarnedRef.current && streakFreeze > 0) {
      // Progress dropped below 90% — revoke the freeze earned today
      freezeEarnedRef.current = false;
      const revoke = async () => {
        try {
          await updateDoc(doc(db, 'users', currentUser.id), { streakFreeze: 0 });
          setStreakFreeze(0);
        } catch {}
      };
      revoke();
    }
  }, [currentUser, currentRoom, completions, habits, streakFreeze]);
  useEffect(() => { freezeEarnedRef.current = false; }, [dateKey]);

  // ─── AUTH HANDLERS ───
  const handleSignup = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    if (!username.trim()) { setError('Username required'); setLoading(false); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), { username: username.trim(), email, rooms: [], createdAt: new Date().toISOString() });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch { setError('Invalid email or password'); } finally { setLoading(false); }
  };
  const handleForgotPassword = async (e) => {
    e.preventDefault(); setError(''); setSuccessMsg(''); setLoading(true);
    try { await sendPasswordResetEmail(auth, email); setSuccessMsg('Reset link sent! Check your email.'); }
    catch { setError('Could not send reset email. Check the address.'); } finally { setLoading(false); }
  };
  const handleGoogleSignIn = async () => {
    setError(''); setLoading(true);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      // Check if user doc exists
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      if (!userDoc.exists()) {
        // New Google user — create their profile
        const displayName = cred.user.displayName || cred.user.email.split('@')[0];
        await setDoc(doc(db, 'users', cred.user.uid), {
          username: displayName, email: cred.user.email, photoURL: cred.user.photoURL || null,
          rooms: [], createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError(err.message);
    } finally { setLoading(false); }
  };

  // ─── ROOM ───
  const createRoom = async () => {
    setError(''); setLoading(true);
    try {
      const code = genCode();
      await setDoc(doc(db, 'rooms', code), { code, createdBy: currentUser.id, createdAt: new Date().toISOString() });
      await updateDoc(doc(db, 'users', currentUser.id), { rooms: arrayUnion(code), activeRoom: code, roomId: code });
      setUserRooms(p=>[...p,code]); setCurrentRoom({id:code,code}); setShowRoomModal(false); setShowInviteModal(true); setView('dashboard');
    } catch (err) { setError('Failed: '+err.message); } finally { setLoading(false); }
  };
  const joinRoom = async () => {
    setError(''); setLoading(true);
    const code = roomCode.trim().toUpperCase();
    if (!code) { setError('Enter room code'); setLoading(false); return; }
    try {
      const rd = await getDoc(doc(db, 'rooms', code));
      if (!rd.exists()) { setError('Room not found'); setLoading(false); return; }
      await updateDoc(doc(db, 'users', currentUser.id), { rooms: arrayUnion(code), activeRoom: code, roomId: code });
      setUserRooms(p=>p.includes(code)?p:[...p,code]); setCurrentRoom({id:code,...rd.data()}); setShowRoomModal(false); setShowSwitchRoom(false); setView('dashboard'); setRoomCode('');
    } catch (err) { setError('Failed: '+err.message); } finally { setLoading(false); }
  };
  const switchRoom = async (rid) => {
    setLoading(true);
    try {
      const rd = await getDoc(doc(db, 'rooms', rid));
      if (rd.exists()) { await updateDoc(doc(db, 'users', currentUser.id), { activeRoom: rid, roomId: rid }); setCurrentRoom({id:rd.id,...rd.data()}); setRoomKicked(rd.data().kicked||[]); setRoomCreatedBy(rd.data().createdBy||null); setShowSwitchRoom(false); }
    } catch { setError('Failed to switch'); } finally { setLoading(false); }
  };
  const leaveRoom = async (rid) => {
    if (!confirm('Leave this room?')) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.id), { rooms: arrayRemove(rid) });
      const nr = userRooms.filter(r=>r!==rid); setUserRooms(nr);
      if (currentRoom?.id === rid) { if (nr.length > 0) switchRoom(nr[0]); else { await updateDoc(doc(db, 'users', currentUser.id), { activeRoom: null, roomId: null }); setCurrentRoom(null); setShowRoomModal(true); } }
    } catch (err) { console.error(err); }
  };
  const copyCode = () => { navigator.clipboard.writeText(currentRoom.code); setCopied(true); setTimeout(()=>setCopied(false),2000); };

  // ─── ROOM CREATOR PERMISSIONS ───
  const isRoomCreator = (roomCreatedBy || currentRoom?.createdBy) === currentUser?.id;
  const kickedIds = roomKicked;
  const activeMembers = roomMembers.filter(m => !kickedIds.includes(m.id));
  const kickMember = async (uid) => {
    if (!isRoomCreator || uid === currentUser.id) return;
    const m = activeMembers.find(x=>x.id===uid);
    if (!confirm(`Remove ${m?.username||'this member'} from the room?`)) return;
    try {
      await updateDoc(doc(db, 'rooms', currentRoom.id), { kicked: arrayUnion(uid) });
      setRoomKicked(prev => [...prev, uid]);
      setSuccessMsg(`${m?.username||'Member'} removed`); setTimeout(()=>setSuccessMsg(''),2000);
    } catch (err) { console.error(err); setError('Failed to remove member'); }
  };
  const clearAllHabits = async () => {
    if (!isRoomCreator) return;
    if (!confirm('Delete ALL habits in this room? This cannot be undone.')) return;
    try {
      const snap = await getDocs(query(collection(db, 'habits'), where('roomId', '==', currentRoom.id)));
      for (const d of snap.docs) await deleteDoc(doc(db, 'habits', d.id));
      setSuccessMsg('All habits cleared'); setTimeout(()=>setSuccessMsg(''),2000);
    } catch { setError('Failed to clear habits'); }
  };
  const transferOwnership = async (uid) => {
    if (!isRoomCreator || uid === currentUser.id) return;
    const m = activeMembers.find(x=>x.id===uid);
    if (!confirm(`Transfer room ownership to ${m?.username||'this member'}? You will lose creator permissions.`)) return;
    try {
      await updateDoc(doc(db, 'rooms', currentRoom.id), { createdBy: uid });
      setRoomCreatedBy(uid);
      setSuccessMsg('Ownership transferred'); setTimeout(()=>setSuccessMsg(''),2000);
    } catch { setError('Failed to transfer'); }
  };

  // ─── STAKES ───
  const saveStake = async () => {
    if (!newStake.description.trim()) return;
    if (!currentRoom?.id || !currentUser?.id) { setError('No room selected'); return; }
    setLoading(true); setError('');
    try {
      await setDoc(doc(db, 'stakes', currentRoom.id), { type: newStake.type, description: newStake.description.trim(), duration: newStake.duration, createdBy: currentUser.id, createdAt: new Date().toISOString(), roomId: currentRoom.id, active: true });
      setNewStake({ type: 'custom', description: '', duration: 'weekly' });
      setShowStakes(false);
    } catch (err) { console.error('Stakes error:', err); setError(err.message || 'Failed to save'); }
    finally { setLoading(false); }
  };
  const clearStake = async () => { if (!isRoomCreator && roomStakes?.createdBy !== currentUser?.id) return; if (!confirm('Remove stake?')) return; try { await deleteDoc(doc(db, 'stakes', currentRoom.id)); } catch {} };

  // ─── HABITS (CREATE, EDIT, DELETE) ───
  const addHabit = async () => {
    if (!newHabit.name.trim()) return;
    try {
      const hid = currentRoom.id+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
      await setDoc(doc(db, 'habits', hid), {
        name: newHabit.name.trim(), category: newHabit.category, points: parseInt(newHabit.points)||10,
        isRepeatable: newHabit.isRepeatable, maxCompletions: parseInt(newHabit.maxCompletions)||1,
        ...(newHabit.unit?.trim() ? { unit: newHabit.unit.trim() } : {}),
        ...(newHabit.description?.trim() ? { description: newHabit.description.trim() } : {}),
        roomId: currentRoom.id, createdBy: currentUser.id, createdAt: new Date().toISOString()
      });
      // Auto-add to personal board if one exists
      if (myBoardIds) {
        const boardDocId = currentUser.id+'_'+currentRoom.id;
        await setDoc(doc(db, 'myBoard', boardDocId), { habitIds: [...myBoardIds, hid], userId: currentUser.id, roomId: currentRoom.id });
      }
      setNewHabit({ name:'', category:'Study', points:10, isRepeatable:false, maxCompletions:1, unit:'', description:'' }); setShowAddHabit(false);
    } catch { setError('Failed to add'); }
  };
  const saveEditHabit = async () => {
    if (!showEditHabit || !editHabitData.name?.trim()) return;
    try {
      await updateDoc(doc(db, 'habits', showEditHabit), {
        name: editHabitData.name.trim(), category: editHabitData.category,
        points: parseInt(editHabitData.points)||10, isRepeatable: editHabitData.isRepeatable,
        maxCompletions: parseInt(editHabitData.maxCompletions)||1,
        unit: editHabitData.unit?.trim() || null,
        description: editHabitData.description?.trim() || null
      });
      setShowEditHabit(null);
    } catch { setError('Failed to save'); }
  };
  const deleteHabit = async (hid) => { if (!confirm('Delete this habit?')) return; try { await deleteDoc(doc(db, 'habits', hid)); } catch {} };
  const openEditHabit = (habit) => { setEditHabitData({ name: habit.name, category: habit.category, points: habit.points, isRepeatable: habit.isRepeatable, maxCompletions: habit.maxCompletions, unit: habit.unit||'', description: habit.description||'' }); setShowEditHabit(habit.id); };

  // ─── COMPLETIONS (with embedded habit data for orphan-proofing) ───
  const getExisting = (hid) => { const t = getToday(); return completions.find(c=>c.userId===currentUser.id&&c.habitId===hid&&c.date===t); };

  // Mystery bonus: variable multipliers with different probabilities
  // ~10% total chance of getting a bonus on any completion
  const rollBonus = () => {
    const roll = Math.random();
    if (roll < 0.002) return { multi: 5, label: '🎰 JACKPOT! 5×', type: 'jackpot' };
    if (roll < 0.007) return { multi: 3, label: '🔥 3× BONUS!', type: 'epic' };
    if (roll < 0.02) return { multi: 2, label: '⚡ 2× BONUS!', type: 'rare' };
    if (roll < 0.05) return { multi: 1.5, label: '✨ 1.5× BONUS!', type: 'bonus' };
    if (roll < 0.10) return { multi: 1.25, label: '🌟 1.25× BONUS!', type: 'common' };
    return null;
  };

  // ─── STREAK MULTIPLIER (balanced tiers) ───
  const getStreakMultiplier = (streak) => {
    if (streak >= 60) return { multi: 2.0, label: '2×', tier: 'Legend', color: 'text-red-400', bg: 'bg-red-500/20' };
    if (streak >= 30) return { multi: 1.75, label: '1.75×', tier: 'Warrior', color: 'text-amber-400', bg: 'bg-amber-500/20' };
    if (streak >= 14) return { multi: 1.5, label: '1.5×', tier: 'Dedicated', color: 'text-purple-400', bg: 'bg-purple-500/20' };
    if (streak >= 7) return { multi: 1.25, label: '1.25×', tier: 'Consistent', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (streak >= 3) return { multi: 1.1, label: '1.1×', tier: 'Building', color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
    return { multi: 1.0, label: '1×', tier: null, color: 'text-gray-500', bg: '' };
  };
  const streakMulti = getStreakMultiplier(streakData.streak || 0);

  const postActivity = async (text, bonus) => {
    try {
      const aid = Date.now()+'_'+Math.random().toString(36).slice(2,6);
      await setDoc(doc(db,'activity',aid),{
        userId: currentUser.id, username: currentUser.username, roomId: currentRoom.id,
        text, bonus: bonus?.type||null, ts: new Date().toISOString(), date: getToday()
      });
    } catch {}
  };

  const REACTION_EMOJIS = ['🔥','💀','👏','😤'];
  const reactToActivity = async (activityId, emoji) => {
    if (!currentUser) return;
    try {
      const ref = doc(db, 'activity', activityId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const reactions = snap.data().reactions || {};
      if (reactions[currentUser.id] === emoji) {
        delete reactions[currentUser.id];
      } else {
        reactions[currentUser.id] = emoji;
      }
      await updateDoc(ref, { reactions });
    } catch (err) { console.error('Reaction error:', err); }
  };

  const handleIncrement = async (hid) => {
    const t = getToday(), h = habits.find(x=>x.id===hid); if(!h) return;
    const max = h.isRepeatable ? (h.maxCompletions||1) : 1;
    const ex = getExisting(hid);
    const triggerMaxed = () => { setConfettiTrigger(v=>v+1); setMaxedHabit(hid); setTimeout(()=>setMaxedHabit(null),1500); };

    // Roll for mystery bonus
    const bonus = rollBonus();
    // Apply streak multiplier to base points, then bonus on top
    const baseWithStreak = Math.round(h.points * streakMulti.multi);
    const finalPts = bonus ? baseWithStreak * bonus.multi : baseWithStreak;

    try {
      if (ex) {
        if (ex.count < max) {
          await updateDoc(doc(db, 'completions', ex.id), {
            count: ex.count+1,
            habitPoints: baseWithStreak,
            ...(bonus ? { bonusPoints: (ex.bonusPoints||0) + (finalPts - baseWithStreak) } : {}),
            streakMultiplier: streakMulti.multi
          });
          if(ex.count+1>=max) triggerMaxed();
        }
      } else {
        const cid = currentUser.id+'_'+hid+'_'+t;
        await setDoc(doc(db, 'completions', cid), {
          userId: currentUser.id, habitId: hid, roomId: currentRoom.id, date: t, count: 1,
          habitName: h.name, habitPoints: baseWithStreak, habitCategory: h.category,
          streakMultiplier: streakMulti.multi,
          ...(bonus ? { bonusPoints: finalPts - baseWithStreak } : {})
        });
        if (max===1) triggerMaxed();
      }
      // Show bonus notification
      if (bonus) {
        setBonusMsg(bonus);
        setConfettiTrigger(v=>v+1);
        setTimeout(() => setBonusMsg(null), 2500);
      }
      // Post to activity feed
      const newCount = ex ? ex.count + 1 : 1;
      const streakTag = streakMulti.multi > 1 ? ` 🔥${streakMulti.label}` : '';
      const feedText = bonus
        ? `${h.name} (+${finalPts}) ${bonus.label}${streakTag}`
        : `${h.name} (+${baseWithStreak})${streakTag}`;
      if (newCount >= max) {
        postActivity(`Maxed out ${h.name}! 💎${streakTag}`, bonus);
      } else if (newCount === 1 || Math.random() < 0.3) {
        postActivity(feedText, bonus);
      }
    } catch (err) { console.error(err); }
  };
  const handleDecrement = async (hid) => {
    const ex = getExisting(hid); if(!ex) return;
    try {
      if (ex.count > 1) {
        // Proportionally reduce bonus: bonusPoints scales with count
        const newCount = ex.count - 1;
        const newBonus = ex.bonusPoints ? Math.round((ex.bonusPoints / ex.count) * newCount) : 0;
        await updateDoc(doc(db, 'completions', ex.id), {
          count: newCount,
          ...(ex.bonusPoints ? { bonusPoints: newBonus } : {})
        });
      } else {
        await deleteDoc(doc(db, 'completions', ex.id));
      }
    } catch(err) { console.error(err); }
  };

  // ─── HISTORY ───
  const loadHistoryDate = async (dateStr) => {
    setHistoryDate(dateStr);
    try {
      const snap = await getDocs(query(collection(db,'completions'), where('roomId','==',currentRoom.id), where('date','==',dateStr)));
      setHistoryCompletions(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch { setHistoryCompletions([]); }
  };
  const shiftHistoryDate = (dir) => {
    const d = new Date(historyDate+'T12:00:00');
    d.setDate(d.getDate()+dir);
    const ds = formatDateStr(d);
    if (ds > getToday()) return;
    loadHistoryDate(ds);
  };

  // ─── SCORING ───
  const getCatPts = (uid, cat) => completions.filter(c=>c.userId===uid&&c.date===getToday()).reduce((s,c)=>{ const h=habits.find(x=>x.id===c.habitId); if((h?.category||c.habitCategory)===cat) return s+((c.habitPoints||h?.points||0)*(c.count||1))+(c.bonusPoints||0); return s; },0);
  const getTodayCrystals = (uid) => {
    const cr = {}; allCatNames.forEach(c => cr[c] = false);
    // Solo mode: earn crystal if you beat yesterday's category points
    if (activeMembers.length < 2) {
      allCatNames.forEach(cat => { if(getCatPts(uid,cat) > 0) cr[cat] = true; });
      return cr;
    }
    allCatNames.forEach(cat => {
      let mx=0, w=null;
      activeMembers.forEach(m=>{ const p=getCatPts(m.id,cat); if(p>mx){mx=p;w=m;}else if(p===mx&&p>0)w=null; });
      if(w&&w.id===uid) cr[cat]=true;
    });
    return cr;
  };
  const getTodayPts = (uid) => completions.filter(c=>c.userId===uid&&c.date===getToday()).reduce((s,c)=>{ return s+((c.habitPoints||habits.find(x=>x.id===c.habitId)?.points||0)*(c.count||1))+(c.bonusPoints||0); },0);
  const getWeeklyPts = (uid) => { const ws=getWeekStart(),we=getWeekEnd(); return allCompletions.filter(c=>c.userId===uid&&c.date>=ws&&c.date<=we).reduce((s,c)=>{ return s+((c.habitPoints||habits.find(x=>x.id===c.habitId)?.points||0)*(c.count||1))+(c.bonusPoints||0); },0); };
  const getWeeklyCrystals = (uid) => {
    let t=0; const ws=getWeekStart(), td=getToday();
    const dates=[...new Set(allCompletions.filter(c=>c.date>=ws&&c.date<=td).map(c=>c.date))];
    dates.forEach(date=>{ allCatNames.forEach(cat=>{
      let mx=0, w=null;
      activeMembers.forEach(m=>{ const p=allCompletions.filter(c=>c.userId===m.id&&c.date===date).reduce((s,c)=>{const h=habits.find(x=>x.id===c.habitId);if(h&&h.category===cat)return s+(h.points*(c.count||1));return s;},0); if(p>mx){mx=p;w=m;}else if(p===mx&&p>0)w=null; });
      if(w&&w.id===uid) t++;
    }); });
    return t;
  };
  const getCount = (hid) => { const e=getExisting(hid); return e?.count||0; };
  const DAILY_TARGET = 400;
  const getDailyProgress = () => { if(!currentUser||!currentRoom)return 0; const pts=getTodayPts(currentUser.id); return Math.min(pts/DAILY_TARGET,1); };
  const getLeaderboard = () => activeMembers.map(m=>({member:m,todayPts:getTodayPts(m.id),weeklyPts:getWeeklyPts(m.id),crystals:getTodayCrystals(m.id),weeklyCrystals:getWeeklyCrystals(m.id)})).sort((a,b)=>leaderboardTab==='today'?b.todayPts-a.todayPts:b.weeklyPts-a.weeklyPts);

  // ─── CATEGORY SYSTEM ───
  const COLOR_PALETTE = [
    { name:'Blue', neon:'#3b82f6', bg:'bg-blue-500', bgS:'bg-blue-500/10', bgM:'bg-blue-500/20', bdr:'border-blue-500/30', txt:'text-blue-400', txtB:'text-blue-300', pill:'bg-blue-500/20 text-blue-300', glow:'shadow-blue-500/30' },
    { name:'Orange', neon:'#f97316', bg:'bg-orange-500', bgS:'bg-orange-500/10', bgM:'bg-orange-500/20', bdr:'border-orange-500/30', txt:'text-orange-400', txtB:'text-orange-300', pill:'bg-orange-500/20 text-orange-300', glow:'shadow-orange-500/30' },
    { name:'Emerald', neon:'#10b981', bg:'bg-emerald-500', bgS:'bg-emerald-500/10', bgM:'bg-emerald-500/20', bdr:'border-emerald-500/30', txt:'text-emerald-400', txtB:'text-emerald-300', pill:'bg-emerald-500/20 text-emerald-300', glow:'shadow-emerald-500/30' },
    { name:'Purple', neon:'#8b5cf6', bg:'bg-violet-500', bgS:'bg-violet-500/10', bgM:'bg-violet-500/20', bdr:'border-violet-500/30', txt:'text-violet-400', txtB:'text-violet-300', pill:'bg-violet-500/20 text-violet-300', glow:'shadow-violet-500/30' },
    { name:'Pink', neon:'#ec4899', bg:'bg-pink-500', bgS:'bg-pink-500/10', bgM:'bg-pink-500/20', bdr:'border-pink-500/30', txt:'text-pink-400', txtB:'text-pink-300', pill:'bg-pink-500/20 text-pink-300', glow:'shadow-pink-500/30' },
    { name:'Cyan', neon:'#06b6d4', bg:'bg-cyan-500', bgS:'bg-cyan-500/10', bgM:'bg-cyan-500/20', bdr:'border-cyan-500/30', txt:'text-cyan-400', txtB:'text-cyan-300', pill:'bg-cyan-500/20 text-cyan-300', glow:'shadow-cyan-500/30' },
    { name:'Rose', neon:'#f43f5e', bg:'bg-rose-500', bgS:'bg-rose-500/10', bgM:'bg-rose-500/20', bdr:'border-rose-500/30', txt:'text-rose-400', txtB:'text-rose-300', pill:'bg-rose-500/20 text-rose-300', glow:'shadow-rose-500/30' },
    { name:'Amber', neon:'#f59e0b', bg:'bg-amber-500', bgS:'bg-amber-500/10', bgM:'bg-amber-500/20', bdr:'border-amber-500/30', txt:'text-amber-400', txtB:'text-amber-300', pill:'bg-amber-500/20 text-amber-300', glow:'shadow-amber-500/30' },
  ];
  const ICON_OPTIONS = ['🧠','💪','✨','⭐','📚','🎨','💼','🏃','🧘','💰','🎯','❤️','🌱','🔬','🎮','🍎'];
  const DEFAULT_CATEGORIES = [
    { name:'Study', colorIdx:0, icon:'📚' },
    { name:'Health', colorIdx:1, icon:'💪' },
    { name:'Focus', colorIdx:2, icon:'🎯' },
  ];
  const activeCategories = roomCategories.length > 0 ? roomCategories : DEFAULT_CATEGORIES;
  const getCT = (catName) => {
    const cat = activeCategories.find(c=>c.name===catName);
    const ci = cat ? cat.colorIdx : 0;
    const p = COLOR_PALETTE[ci % COLOR_PALETTE.length];
    return { ...p, icon: cat?.icon || '⭐', label: (catName||'').toUpperCase() };
  };
  // Backward compat: CT object for the 3 defaults
  const CT = {};
  activeCategories.forEach(c => { CT[c.name] = getCT(c.name); });
  const allCatNames = activeCategories.map(c=>c.name);

  const addCategory = async () => {
    if (!newCatName.trim() || activeCategories.find(c=>c.name.toLowerCase()===newCatName.trim().toLowerCase())) return;
    const updated = [...activeCategories, { name: newCatName.trim(), colorIdx: newCatColor, icon: newCatIcon }];
    try {
      await setDoc(doc(db, 'roomCategories', currentRoom.id), { categories: updated });
      setNewCatName(''); setNewCatColor(0); setNewCatIcon('⭐'); setShowAddCategory(false);
    } catch { setError('Failed to add category'); }
  };
  const deleteCategory = async (catName) => {
    const catHabits = habits.filter(h=>h.category===catName);
    if (catHabits.length > 0) { setError('Delete habits in this category first'); setTimeout(()=>setError(''),2000); return; }
    if (['Study','Health','Focus'].includes(catName)) { setError("Can't delete default categories"); setTimeout(()=>setError(''),2000); return; }
    const updated = activeCategories.filter(c=>c.name!==catName);
    try { await setDoc(doc(db, 'roomCategories', currentRoom.id), { categories: updated }); } catch {}
  };
  const stakePresets = [
    { type:'custom', label:'Custom', desc:'Set your own', ph:'e.g. Loser does 50 pushups' },
    { type:'buyout', label:'Buyout', desc:'Loser buys something', ph:'e.g. Loser buys lunch' },
    { type:'dare', label:'Dare', desc:'Loser performs a dare', ph:'e.g. Embarrassing post' },
    { type:'service', label:'Service', desc:'Loser does a favor', ph:"e.g. Loser's chores" },
  ];

  // ─── THEME CLASSES ───
  const T = darkMode ? {
    bg: 'bg-[#07070c]', bgCard: 'bg-white/[0.03]', bgCardHover: 'hover:bg-white/[0.04]', bgInput: 'bg-white/[0.04]',
    border: 'border-white/[0.06]', borderInput: 'border-white/[0.08]', text: 'text-white', textMuted: 'text-gray-500',
    textDim: 'text-gray-600', textFaint: 'text-gray-700', headerBg: 'bg-[#07070c]/90', modalBg: 'bg-[#0d0d14]',
    selectBg: 'bg-[#0d0d14]', glowOrb: '/8', blurBg: 'backdrop-blur-xl'
  } : {
    bg: 'bg-gray-50', bgCard: 'bg-white', bgCardHover: 'hover:bg-gray-50', bgInput: 'bg-gray-100',
    border: 'border-gray-200', borderInput: 'border-gray-300', text: 'text-gray-900', textMuted: 'text-gray-500',
    textDim: 'text-gray-400', textFaint: 'text-gray-300', headerBg: 'bg-white/80', modalBg: 'bg-white',
    selectBg: 'bg-white', glowOrb: '/5', blurBg: 'backdrop-blur-xl'
  };
  const inputCls = `w-full px-4 py-3 ${T.bgInput} border ${T.borderInput} rounded-xl focus:outline-none focus:border-blue-500/50 ${T.text} placeholder-gray-400 text-sm transition-all`;
  const btnPrimary = "w-full py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all disabled:opacity-50 active:scale-[0.98]";

  // ─── LOADING ───
  if (authLoading) return (
    <div className="min-h-screen bg-[#07070c] flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[100px] -translate-y-1/2"/>
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-[0.4em] text-white mb-5">VERSA</h1>
        <div className="flex justify-center gap-2">{['bg-blue-500','bg-orange-500','bg-emerald-500'].map((c,i)=><div key={i} className={`w-1.5 h-1.5 rounded-full ${c} animate-pulse`} style={{animationDelay:i*200+'ms'}} />)}</div>
      </div>
    </div>
  );

  const myCr = currentUser&&currentRoom ? getTodayCrystals(currentUser.id) : {};
  const myPts = currentUser&&currentRoom ? getTodayPts(currentUser.id) : 0;
  const isPerfect = allCatNames.length > 0 && allCatNames.every(c => myCr[c]);
  const dailyProg = currentUser&&currentRoom ? getDailyProgress() : 0;
  const displayHabits = (myBoardIds && !editMode) ? habits.filter(h => myBoardIds.includes(h.id)) : habits;
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
      <div className="min-h-screen bg-[#07070c] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-blue-600/10 via-purple-600/8 to-transparent rounded-full blur-[120px] -translate-y-1/2"/>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/6 rounded-full blur-[100px] translate-y-1/3"/>
        
        <div className="w-full max-w-sm relative z-10">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"/><div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" style={{animationDelay:'150ms'}}/><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{animationDelay:'300ms'}}/></div>
            </div>
            <h1 className="text-5xl font-black tracking-[0.35em] text-white mb-2">VERSA</h1>
            <p className="text-gray-600 text-[11px] tracking-[0.25em] uppercase font-medium">Outwork · Outgrind · Outlast</p>
          </div>

          {/* Feature cards */}
          <div className="space-y-3 mb-8">
            {[
              { icon: '📚', title: 'Track What Matters', desc: 'Studying, gym, screen time, sleep. Earn points for everything.', color: 'from-blue-500/10 to-blue-600/5' },
              { icon: '🔥', title: 'Streak Multipliers', desc: 'Don\'t break the chain → earn up to 2× points.', color: 'from-orange-500/10 to-red-600/5' },
              { icon: '🏆', title: 'Compete with Friends', desc: 'Real-time leaderboards. Set stakes. Loser pays.', color: 'from-amber-500/10 to-yellow-600/5' },
              { icon: '💎', title: 'Win Crystals', desc: 'Top scorer in Study, Health, or Focus earns the crystal.', color: 'from-purple-500/10 to-indigo-600/5' },
            ].map((item,i) => (
              <div key={i} className={`bg-gradient-to-r ${item.color} backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4`}>
                <span className="text-2xl">{item.icon}</span>
                <div><p className="text-white font-semibold text-[13px]">{item.title}</p><p className="text-gray-500 text-[11px] mt-0.5 leading-relaxed">{item.desc}</p></div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <button onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3.5 rounded-2xl text-sm font-bold tracking-wide transition-all active:scale-[0.98] bg-white text-gray-900 shadow-lg shadow-white/10 flex items-center justify-center gap-3 hover:bg-gray-100 disabled:opacity-50">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>
            <div className="flex items-center gap-3"><div className="flex-1 h-px bg-white/[0.06]"/><span className="text-gray-600 text-[10px] tracking-wider uppercase">or</span><div className="flex-1 h-px bg-white/[0.06]"/></div>
            <button onClick={()=>setView('signup')} className={btnPrimary + ' bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 rounded-2xl'}>Create Account with Email</button>
            <button onClick={()=>setView('login')} className="w-full text-gray-500 py-2 hover:text-white text-sm transition-colors text-center">Already have an account? <span className="text-blue-400">Sign in</span></button>
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
      <div className="min-h-screen bg-[#07070c] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-b from-blue-600/8 via-purple-600/5 to-transparent rounded-full blur-[120px] -translate-y-1/3"/>
        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black tracking-[0.3em] text-white mb-1">VERSA</h1>
            <div className="flex justify-center gap-2 mt-3"><div className="w-6 h-0.5 rounded-full bg-blue-500"/><div className="w-6 h-0.5 rounded-full bg-orange-500"/><div className="w-6 h-0.5 rounded-full bg-emerald-500"/></div>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/[0.06] p-7">
            {view === 'forgot' ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <h2 className="text-lg font-bold text-white text-center mb-1">Reset Password</h2>
                <p className="text-gray-500 text-xs text-center mb-4">Enter your email and we'll send a reset link.</p>
                <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className={inputCls+' !rounded-xl'} required disabled={loading} />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                {successMsg && <p className="text-emerald-400 text-xs text-center">{successMsg}</p>}
                <button type="submit" disabled={loading} className={btnPrimary+' bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 !rounded-xl'}>{loading?'Sending...':'Send Reset Link'}</button>
                <button type="button" onClick={()=>{setView('login');setError('');setSuccessMsg('');}} className="w-full text-gray-500 py-2 hover:text-white text-sm transition-colors">← Back to Sign In</button>
              </form>
            ) : view === 'login' ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white text-center mb-1">Welcome back</h2>
                {/* Google button */}
                <button onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] bg-white text-gray-900 flex items-center justify-center gap-2.5 hover:bg-gray-100 disabled:opacity-50">
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3"><div className="flex-1 h-px bg-white/[0.06]"/><span className="text-gray-600 text-[10px] tracking-wider uppercase">or</span><div className="flex-1 h-px bg-white/[0.06]"/></div>
                <form onSubmit={handleLogin} className="space-y-3">
                  <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className={inputCls+' !rounded-xl'} required disabled={loading} />
                  <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className={inputCls+' !rounded-xl'} required disabled={loading} />
                  {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                  <button type="submit" disabled={loading} className={btnPrimary+' bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 !rounded-xl'}>{loading?'Signing in...':'Sign In'}</button>
                </form>
                <div className="flex justify-between pt-1">
                  <button type="button" onClick={()=>{setView('onboarding');setError('');}} className="text-gray-500 text-xs hover:text-white transition-colors">← Create Account</button>
                  <button type="button" onClick={()=>{setView('forgot');setError('');}} className="text-gray-500 text-xs hover:text-blue-400 transition-colors">Forgot password?</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white text-center mb-1">Create your account</h2>
                {/* Google button */}
                <button onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] bg-white text-gray-900 flex items-center justify-center gap-2.5 hover:bg-gray-100 disabled:opacity-50">
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Sign up with Google
                </button>
                <div className="flex items-center gap-3"><div className="flex-1 h-px bg-white/[0.06]"/><span className="text-gray-600 text-[10px] tracking-wider uppercase">or</span><div className="flex-1 h-px bg-white/[0.06]"/></div>
                <form onSubmit={handleSignup} className="space-y-3">
                  <input type="text" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className={inputCls+' !rounded-xl'} required disabled={loading} />
                  <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className={inputCls+' !rounded-xl'} required disabled={loading} />
                  <input type="password" placeholder="Password (min 6)" value={password} onChange={e=>setPassword(e.target.value)} className={inputCls+' !rounded-xl'} required minLength={6} disabled={loading} />
                  {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                  <button type="submit" disabled={loading} className={btnPrimary+' bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20 !rounded-xl'}>{loading?'Creating...':'Create Account'}</button>
                </form>
                <button type="button" onClick={()=>{setView('login');setError('');}} className="w-full text-gray-500 py-1 hover:text-white text-xs transition-colors text-center">Already have an account? <span className="text-blue-400">Sign in</span></button>
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
    <div className="min-h-screen bg-[#07070c] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">🚫</div>
        <h2 className="text-lg font-bold text-white mb-2">You've been removed from this room</h2>
        <p className="text-gray-500 text-sm mb-6">The room creator has removed you from <span className="font-mono text-gray-400">{currentRoom.code}</span>.</p>
        <div className="space-y-3">
          {userRooms.filter(r=>r!==currentRoom.id).length > 0 ? (
            <button onClick={()=>switchRoom(userRooms.find(r=>r!==currentRoom.id))} className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]">Switch to Another Room</button>
          ) : (
            <button onClick={()=>{leaveRoom(currentRoom.id);}} className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]">Create or Join a Room</button>
          )}
        </div>
      </div>
    </div>
  );

  // ═══ ROOM SELECT ═══
  if (showRoomModal) return (
    <div className="min-h-screen bg-[#07070c] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-blue-600/8 via-purple-600/5 to-transparent rounded-full blur-[120px] -translate-y-1/3"/>
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-[100px] translate-y-1/3"/>
      <div className="w-full max-w-sm relative z-10">

        {/* Step 0: Welcome */}
        {onboardingStep === 0 && (
          <div className="text-center space-y-6">
            <div>
              <div className="text-5xl mb-4">👋</div>
              <h1 className="text-2xl font-bold text-white mb-2">Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">{currentUser.username}</span></h1>
              <p className="text-gray-500 text-sm leading-relaxed">Compete with friends on real habits.<br/>Let's get you set up in 30 seconds.</p>
            </div>
            <div className="space-y-3">
              {[
                { icon: '🏠', title: 'Create a room', desc: 'Start fresh and invite friends', action: () => setOnboardingStep(1) },
                { icon: '🔗', title: 'Join a room', desc: 'Got a code from a friend?', action: () => setOnboardingStep(2) },
              ].map((opt, i) => (
                <button key={i} onClick={opt.action} className="w-full flex items-center gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-left hover:bg-white/[0.06] transition-all active:scale-[0.98]">
                  <span className="text-2xl">{opt.icon}</span>
                  <div><p className="text-white font-semibold text-sm">{opt.title}</p><p className="text-gray-500 text-[11px]">{opt.desc}</p></div>
                  <ChevronRight size={16} className="text-gray-600 ml-auto"/>
                </button>
              ))}
            </div>
            <button onClick={()=>signOut(auth)} className="text-gray-700 text-xs hover:text-gray-400 transition-colors">Sign out</button>
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
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-4">
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
            <button onClick={async()=>{await createRoom(); setShowInviteModal(false); setOnboardingStep(0); setShowOnboardingTour(true);}} disabled={loading} className={btnPrimary+' bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 rounded-2xl'}>{loading?'Creating...':'Create Room'}</button>
            <button onClick={()=>setOnboardingStep(0)} className="w-full text-gray-600 text-xs hover:text-gray-400 transition-colors text-center">← Back</button>
            {error&&<p className="text-red-400 text-xs text-center">{error}</p>}
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
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <input type="text" placeholder="ABCDEF" value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase())} className="w-full px-4 py-4 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder-gray-600 text-lg font-mono tracking-[0.4em] text-center" maxLength={6} autoFocus/>
            </div>
            <button onClick={async()=>{await joinRoom(); setOnboardingStep(0); setShowOnboardingTour(true);}} disabled={loading||roomCode.length<4} className={btnPrimary+' bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20 rounded-2xl disabled:opacity-40'}>{loading?'Joining...':'Join Room'}</button>
            <button onClick={()=>setOnboardingStep(0)} className="w-full text-gray-600 text-xs hover:text-gray-400 transition-colors text-center">← Back</button>
            {error&&<p className="text-red-400 text-xs text-center">{error}</p>}
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
    { icon: '🔥', title: 'Build your streak', desc: 'Complete at least one habit every day. The longer your streak, the higher your point multiplier — up to 2× at 60 days.' },
    { icon: '💎', title: 'Win crystals', desc: 'Score the most points in any category (Grind, Health, Discipline) to earn a crystal for the day.' },
    { icon: '🏆', title: 'Dominate the leaderboard', desc: 'Your weekly points determine the leaderboard rank. Set stakes to make losing hurt.' },
    { icon: '👥', title: 'Invite your friends', desc: 'Share your room code and start competing. The more rivals, the better.' },
  ];

  return (
    <div className={`min-h-screen ${T.bg} ${T.text} transition-colors duration-300`}>
      <ConfettiCanvas trigger={confettiTrigger} />

      {/* Onboarding Tour Overlay */}
      {showOnboardingTour && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="bg-[#0d0d14] rounded-3xl border border-white/[0.08] p-6 shadow-2xl">
              {/* Progress dots */}
              <div className="flex justify-center gap-1.5 mb-5">
                {tourSteps.map((_, i) => (
                  <div key={i} className={`h-1 rounded-full transition-all ${i === onboardingStep ? 'w-6 bg-blue-500' : i < onboardingStep ? 'w-2 bg-blue-500/40' : 'w-2 bg-white/10'}`}/>
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
                <button onClick={()=>{setShowOnboardingTour(false); setOnboardingStep(0);}} className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors">Skip</button>
                <button onClick={()=>{
                  if (onboardingStep < tourSteps.length - 1) {
                    setOnboardingStep(onboardingStep + 1);
                  } else {
                    setShowOnboardingTour(false);
                    setOnboardingStep(0);
                    setShowInviteModal(true);
                  }
                }} className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]">
                  {onboardingStep < tourSteps.length - 1 ? 'Next' : 'Start Tracking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Maxout screen flash */}
      {maxedHabit && <div className="fixed inset-0 z-[99] pointer-events-none animate-pulse" style={{background:'radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%)'}}/>}
      {/* Mystery Bonus popup */}
      {bonusMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[101] animate-bounce">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl text-center ${bonusMsg.type==='jackpot'?'bg-gradient-to-r from-amber-500 to-yellow-500 text-black':bonusMsg.type==='epic'?'bg-gradient-to-r from-red-500 to-orange-500 text-white':bonusMsg.type==='rare'?'bg-gradient-to-r from-purple-600 to-blue-600 text-white':bonusMsg.type==='bonus'?'bg-gradient-to-r from-blue-500 to-cyan-500 text-white':'bg-gradient-to-r from-emerald-500 to-green-500 text-white'}`}>
            <div className="text-lg font-black">{bonusMsg.label}</div>
          </div>
        </div>
      )}
      {/* Streak milestone popup */}
      {streakMilestone && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[101] animate-bounce">
          <div className="px-6 py-3 rounded-2xl shadow-2xl text-center bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <div className="text-lg font-black">🔥 {streakMilestone.days}-Day Streak!</div>
            <div className="text-xs font-bold opacity-90">Unlocked: {streakMilestone.tier}</div>
          </div>
        </div>
      )}
      {/* Freeze popup */}
      {freezeMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[101] animate-bounce">
          <div className="px-6 py-3 rounded-2xl shadow-2xl text-center bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
            <div className="text-sm font-black">{freezeMsg}</div>
          </div>
        </div>
      )}
      {/* ═══ HEADER ═══ */}
      <div className={`${T.headerBg} ${T.blurBg} border-b ${T.border} sticky top-0 z-40`}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-black tracking-[0.15em]">VERSA</h1>
              {streakData.streak>0&&<div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${darkMode?'bg-orange-500/10':'bg-orange-50'}`}><Flame size={13} className="text-orange-400"/><span className="text-orange-400 text-sm font-bold">{streakData.streak}</span>{streakMulti.multi>1&&<span className={`text-[9px] font-bold ${streakMulti.color}`}>{streakMulti.label}</span>}{streakFreeze>0&&<span className="text-xs">🛡️</span>}</div>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className={`p-2 rounded-xl ${darkMode?'hover:bg-white/[0.06]':'hover:bg-gray-100'} transition-colors`}>{darkMode?<Sun size={16} className="text-gray-500"/>:<Moon size={16} className="text-gray-400"/>}</button>
              <button onClick={()=>setShowProfile(true)} className={`p-2 rounded-xl ${darkMode?'hover:bg-white/[0.06]':'hover:bg-gray-100'} transition-colors`}>{currentUser.photoURL?<img src={currentUser.photoURL} className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer"/>:<User size={16} className={T.textMuted}/>}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">

        {/* ═══ SCORE RING ═══ */}
        <div className="text-center mb-6">
          <div className="relative inline-block">
            <svg width="140" height="140" className="transform -rotate-90">
              <circle cx="70" cy="70" r="60" stroke={darkMode?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)"} strokeWidth="8" fill="none"/>
              <circle cx="70" cy="70" r="60" stroke="url(#scoreGrad)" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${dailyProg * 377} 377`} className="transition-all duration-700"/>
              <defs><linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3b82f6"/><stop offset="50%" stopColor="#8b5cf6"/><stop offset="100%" stopColor="#10b981"/></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-black ${T.text}`}>{myPts}</span>
              <span className={`text-[10px] font-bold ${dailyProg>=1?'text-emerald-400':'text-blue-400'}`}>{Math.round(dailyProg*100)}%</span>
            </div>
          </div>
          <div className="mt-2">
            {roomStakes ? (
              <button onClick={()=>setShowStakes(true)} className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-[0.97] ${darkMode?'bg-red-500/10 text-red-400 border border-red-500/20':'bg-red-50 text-red-500 border border-red-200'}`}><Zap size={12}/>{roomStakes.description}</button>
            ) : dailyProg >= 1 ? (
              <p className="text-sm font-medium text-emerald-400">🎉 All done — nice work.</p>
            ) : (
              <p className={`text-sm ${T.textDim} italic`}>{getMotivation()}</p>
            )}
          </div>
        </div>

        {/* ═══ CATEGORY CHIPS ═══ */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {allCatNames.map(c => {
            const ct = getCT(c);
            const pts = getCatPts(currentUser.id, c);
            const hasCrystal = myCr[c];
            return (
              <div key={c} className={`relative rounded-2xl p-3 text-center transition-all ${hasCrystal?ct.bgM+' border '+ct.bdr+' shadow-lg '+ct.glow:(darkMode?'bg-white/[0.03] border border-white/[0.06]':'bg-white border border-gray-200 shadow-sm')}`}>
                <div className="text-xl mb-0.5">{activeCategories.find(cat=>cat.name===c)?.icon||'📋'}</div>
                <div className={`text-lg font-black ${hasCrystal?ct.txt:T.text}`}>{pts}</div>
                <div className={`text-[9px] font-bold tracking-wider uppercase ${hasCrystal?ct.txt:T.textDim}`}>{c}</div>
                {hasCrystal&&<div className="absolute -top-1 -right-1 text-sm">💎</div>}
              </div>
            );
          })}
        </div>

        {/* ═══ RIVAL PILLS ═══ */}
        {rivalStatus.length > 0 && (
          <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
            {rivalStatus.slice(0,4).map(r => {
              const ahead = r.pts > myPts;
              const ms = mutualStreaks[r.member.id] || 0;
              return (
                <div key={r.member.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 ${ahead?(darkMode?'border-red-500/20 bg-red-500/5':'border-red-200 bg-red-50'):(darkMode?'border-emerald-500/20 bg-emerald-500/5':'border-emerald-200 bg-emerald-50')}`}>
                  <div className="relative">
                    <Avatar user={r.member} size={22} className={ahead?'bg-red-500/20 text-red-400':'bg-emerald-500/20 text-emerald-400'}/>
                    {ms > 0 && <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-white ${ms>=7?'bg-gradient-to-r from-orange-500 to-red-500':ms>=3?'bg-orange-500':'bg-amber-500'}`}>{ms}</div>}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[11px] font-medium ${darkMode?'text-gray-300':'text-gray-700'}`}>{r.member.username}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold ${ahead?'text-red-400':'text-emerald-400'}`}>{r.pts} pts</span>
                      {ms > 0 && <span className={`text-[9px] font-bold ${ms>=7?'text-orange-400':ms>=3?'text-amber-400':'text-amber-500/70'}`}>🔗{ms}d</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {myPts === 0 && rivalStatus.some(r=>r.pts>0) && <span className="text-[10px] text-red-400/70 shrink-0 font-medium">⚠️ They started</span>}
          </div>
        )}

        {soloMode && !rivalStatus.length && yesterdayPoints > 0 && (
          <div className={`flex items-center justify-between mb-4 px-4 py-2.5 rounded-xl ${darkMode?'bg-white/[0.03] border border-white/[0.06]':'bg-gray-50 border border-gray-200'}`}>
            <span className={`text-xs ${T.textDim}`}>Yesterday: {yesterdayPoints} pts</span>
            {myPts > yesterdayPoints && myPts > 0 && <span className="text-[11px] text-emerald-400 font-bold">↑ Ahead</span>}
          </div>
        )}

        {!roomStakes && <div className="flex justify-center mb-4"><button onClick={()=>setShowStakes(true)} className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all active:scale-[0.97] ${darkMode?'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-gray-300':'bg-gray-100 text-gray-400 border border-gray-200 hover:text-gray-600'}`}><Zap size={13}/>Set Stakes</button></div>}

        {devMode && boardRequests.length > 0 && boardRequests.map(br => (
          <div key={br.id} className={`mb-2 p-2.5 rounded-xl border ${darkMode?'bg-purple-500/5 border-purple-500/15':'bg-purple-50 border-purple-200'}`}>
            <div className="flex items-center justify-between"><span className={`text-xs ${T.textMuted}`}>{br.username} proposed a board</span><div className="flex gap-1"><button onClick={()=>voteBoardRequest(br,true)} className="text-[10px] text-emerald-400 font-bold px-2 py-1 bg-emerald-500/10 rounded-lg">✓</button><button onClick={()=>voteBoardRequest(br,false)} className="text-[10px] text-red-400 font-bold px-2 py-1 bg-red-500/10 rounded-lg">✗</button></div></div>
          </div>
        ))}
        {myBoardIds && <div className={`mb-3 px-3 py-1.5 rounded-xl text-center text-[10px] font-medium ${darkMode?'bg-indigo-500/10 text-indigo-300 border border-indigo-500/15':'bg-indigo-50 text-indigo-600 border border-indigo-200'}`}>Custom board active · <button onClick={()=>{setMyBoardIds(null);try{deleteDoc(doc(db,'myBoard',currentUser.id+'_'+currentRoom.id));}catch{}}} className="underline">Show All</button></div>}

        {/* ═══ HABITS ═══ */}
        <div className="space-y-2 mb-6">
          {allCatNames.map(catName => {
            const catHabits = displayHabits.filter(h => h.category === catName);
            if (!catHabits.length) return null;
            const t = getCT(catName);
            const catIcon = activeCategories.find(cat=>cat.name===catName)?.icon||'📋';
            return (
              <div key={catName}>
                <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0"><span className="text-base">{catIcon}</span><span className={`text-xs font-bold tracking-wider uppercase ${t.txt}`}>{catName}</span></div>
                {catHabits.map(h => {
                  const cnt = getCount(h.id), mx = h.isRepeatable ? (h.maxCompletions||1) : 1;
                  const done = cnt > 0, maxed = cnt >= mx;
                  return (
                    <div key={h.id} className={`flex items-center gap-3 mb-1.5 rounded-2xl p-3 pl-0 overflow-hidden transition-all ${maxed?(darkMode?'bg-gradient-to-r from-'+t.bg.replace('bg-','')+'10 to-transparent':'bg-'+t.bg.replace('bg-','').replace('500','50')):(darkMode?'bg-white/[0.02]':'bg-white')} ${darkMode?'border border-white/[0.04]':'border border-gray-100 shadow-sm'}`}>
                      <div className={`w-1 self-stretch rounded-r-full ${done?t.bg:'bg-transparent'} transition-all`}/>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[13px] font-semibold ${done?(darkMode?'text-white':'text-gray-900'):(darkMode?'text-gray-400':'text-gray-600')}`}>{h.name}</div>
                        {h.description&&<div className={`text-[10px] ${T.textDim} mt-0.5`}>{h.description}</div>}
                        <div className={`text-[10px] ${T.textDim} flex items-center gap-1.5 mt-0.5`}>
                          <span>{h.points}pts</span>
                          {h.unit&&<><span>·</span><span>{h.unit}</span></>}
                          {h.isRepeatable&&<><span>·</span><span className={maxed?'font-bold '+t.txt:''}>{cnt}/{mx}</span></>}
                          {maxed&&<span className={`${t.pill} text-[8px] font-bold px-1.5 py-0.5 rounded-full ${maxedHabit===h.id?'animate-bounce':''}`}>MAXED ✓</span>}
                        </div>
                        {h.isRepeatable && mx > 1 && cnt > 0 && !maxed && (
                          <div className={`mt-1.5 h-1 rounded-full overflow-hidden ${darkMode?'bg-white/[0.06]':'bg-gray-100'}`}><div className={`h-full rounded-full ${t.bg} transition-all duration-500`} style={{width:(cnt/mx*100)+'%'}}/></div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {cnt > 0 && !editMode && <button onClick={()=>handleDecrement(h.id)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${darkMode?'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08]':'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}><MinusIcon size={14}/></button>}
                        {!maxed && !editMode && <button onClick={()=>handleIncrement(h.id)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg text-white font-bold ${t.bg} hover:opacity-90`} style={{boxShadow:`0 4px 14px ${t.neon}40`}}><Plus size={18}/></button>}
                        {maxed && !editMode && <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.bg} text-white`}><Check size={18}/></div>}
                        {editMode && <><button onClick={()=>openEditHabit(h)} className="text-blue-400 p-1.5"><Edit3 size={14}/></button><button onClick={()=>deleteHabit(h.id)} className="text-red-400 p-1.5"><Trash2 size={14}/></button></>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {habits.length===0 ? (
            <div className="text-center py-16"><div className="text-5xl mb-4">🎯</div><p className={`${T.textMuted} text-sm mb-5`}>No habits yet</p><button onClick={()=>setShowAddHabit(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 text-sm font-bold active:scale-[0.98]"><Plus size={18}/>Add Habits</button></div>
          ) : devMode ? (
            <div className="flex gap-2 mt-2">
              <button onClick={()=>setShowAddHabit(true)} className={`flex-1 border border-dashed rounded-2xl p-4 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 flex items-center justify-center gap-2 transition-all ${darkMode?'border-white/[0.08] text-gray-600':'border-gray-300 text-gray-400'}`}><Plus size={15}/><span className="text-xs font-medium">Add Habit</span></button>
              <button onClick={()=>setShowAddCategory(true)} className={`border border-dashed rounded-2xl p-4 hover:text-purple-400 hover:border-purple-500/30 hover:bg-purple-500/5 flex items-center justify-center gap-2 transition-all ${darkMode?'border-white/[0.08] text-gray-600':'border-gray-300 text-gray-400'}`}><span className="text-xs font-medium">+ Category</span></button>
            </div>
          ) : null}
        </div>

        {/* ═══ SECONDARY ═══ */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className={`rounded-2xl p-3 text-center ${darkMode?'bg-white/[0.03] border border-white/[0.06]':'bg-white border border-gray-200 shadow-sm'}`}><div className="text-xl font-black text-blue-400">{myPts}</div><div className={`text-[9px] ${T.textDim} uppercase tracking-wider font-bold`}>Today</div></div>
          <div className={`rounded-2xl p-3 text-center ${darkMode?'bg-white/[0.03] border border-white/[0.06]':'bg-white border border-gray-200 shadow-sm'}`}><div className="text-xl font-black text-emerald-400">{getWeeklyPts(currentUser.id)}</div><div className={`text-[9px] ${T.textDim} uppercase tracking-wider font-bold`}>Week</div></div>
          <div className={`rounded-2xl p-3 text-center ${darkMode?'bg-white/[0.03] border border-white/[0.06]':'bg-white border border-gray-200 shadow-sm'}`}><div className="flex justify-center gap-2 mb-1">{allCatNames.map(c=><div key={c} className={`w-5 h-5 rounded-full transition-all ${myCr[c]?getCT(c).bg+' shadow-md '+getCT(c).glow:(darkMode?'bg-white/[0.06]':'bg-gray-200')}`}/>)}</div><div className={`text-[9px] ${T.textDim} uppercase tracking-wider font-bold`}>Crystals</div></div>
        </div>

        {weeklyWinner && <div className={`mb-3 p-3 rounded-2xl flex items-center justify-between ${darkMode?'bg-amber-500/5 border border-amber-500/10':'bg-amber-50 border border-amber-200'}`}><div className="flex items-center gap-2"><Crown size={14} className="text-amber-400"/><span className={`text-xs font-medium ${darkMode?'text-amber-300':'text-amber-700'}`}>{weeklyWinner.member.username} leads · {weeklyWinner.pts} pts</span></div><span className={`text-[10px] ${T.textDim}`}>{weeklyWinner.daysLeft > 0 ? weeklyWinner.daysLeft+'d left' : timeDisplay}</span></div>}

        {weeklyWinner && weeklyWinner.daysLeft <= 1 && activeMembers.length > 1 && <div className={`mb-3 p-3 rounded-2xl text-center ${darkMode?'bg-gradient-to-r from-amber-500/5 via-red-500/5 to-purple-500/5 border border-amber-500/10':'bg-gradient-to-r from-amber-50 via-red-50 to-purple-50 border border-amber-200'}`}><div className={`text-sm font-bold ${darkMode?'text-amber-300':'text-amber-700'}`}>{weeklyWinner.daysLeft === 0 ? '⏰ Final Hours — '+timeDisplay : '⚡ Final Day'}</div></div>}

        {/* ═══ ACTIVITY FEED (collapsible) ═══ */}
        {activityFeed.length > 0 && (
          <div className={`mb-4 rounded-2xl border overflow-hidden ${darkMode?'border-white/[0.06] bg-white/[0.02]':'border-gray-200 bg-white shadow-sm'}`}>
            <button onClick={()=>setShowActivityExpanded(!showActivityExpanded)} className={`w-full px-4 py-2.5 flex items-center justify-between ${darkMode?'hover:bg-white/[0.02]':'hover:bg-gray-50'} transition-colors`}>
              <span className={`text-[10px] font-bold tracking-wider uppercase ${T.textMuted}`}>Activity</span>
              <ChevronDown size={14} className={`${T.textDim} transition-transform ${showActivityExpanded?'rotate-180':''}`}/>
            </button>
            {showActivityExpanded && <div className={`max-h-48 overflow-y-auto border-t ${T.border}`}>{activityFeed.slice(0,10).map(a => {
              const isMe = a.userId === currentUser.id;
              const ts = a.ts ? new Date(a.ts) : null;
              const timeAgo = ts ? (Math.floor((Date.now()-ts.getTime())/60000)<60 ? Math.floor((Date.now()-ts.getTime())/60000)+'m' : Math.floor((Date.now()-ts.getTime())/3600000)+'h') : '';
              const reactions = a.reactions || {};
              const reactionCounts = {};
              Object.values(reactions).forEach(e => { reactionCounts[e] = (reactionCounts[e]||0)+1; });
              const myReaction = reactions[currentUser?.id];
              return (
                <div key={a.id} className={`px-4 py-2.5 border-b last:border-b-0 ${T.border}`}>
                  <div className="flex items-center gap-2">
                    <Avatar user={activeMembers.find(m=>m.id===a.userId)||{username:a.username}} size={20} className={isMe?'bg-blue-500/20 text-blue-400':(darkMode?'bg-white/[0.06] text-gray-500':'bg-gray-100 text-gray-500')}/>
                    <div className="flex-1 min-w-0 truncate"><span className={`text-[11px] ${isMe?'text-blue-400':(darkMode?'text-gray-400':'text-gray-600')} font-medium`}>{isMe?'You':a.username}</span><span className={`text-[11px] ${T.textDim} ml-1`}>{a.text}</span>{a.bonus==='jackpot'&&<span className="ml-1 text-[9px] text-amber-300 font-bold">5×</span>}{a.bonus==='epic'&&<span className="ml-1 text-[9px] text-red-400 font-bold">3×</span>}{a.bonus==='rare'&&<span className="ml-1 text-[9px] text-purple-400 font-bold">2×</span>}{a.bonus==='bonus'&&<span className="ml-1 text-[9px] text-cyan-400 font-bold">1.5×</span>}{a.bonus==='common'&&<span className="ml-1 text-[9px] text-emerald-400 font-bold">1.25×</span>}</div>
                    <span className={`text-[9px] ${T.textFaint} shrink-0`}>{timeAgo}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 ml-7">
                    {Object.keys(reactionCounts).length > 0 && Object.entries(reactionCounts).map(([emoji, count]) => (
                      <span key={emoji} className={`text-[9px] px-1.5 py-0.5 rounded-full ${myReaction===emoji?'bg-blue-500/20 border border-blue-500/30':(darkMode?'bg-white/[0.04]':'bg-gray-100')}`}>{emoji} {count}</span>
                    ))}
                    {!isMe && <div className="flex gap-0.5 ml-1">{REACTION_EMOJIS.map(e => (
                      <button key={e} onClick={()=>reactToActivity(a.id,e)} className={`text-[11px] w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 ${myReaction===e?'bg-blue-500/20':(darkMode?'hover:bg-white/[0.06]':'hover:bg-gray-100')}`}>{e}</button>
                    ))}</div>}
                  </div>
                </div>
              );
            })}</div>}
          </div>
        )}

        {/* Quick actions */}
        <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
          <button onClick={()=>setShowLeaderboard(true)} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold transition-all active:scale-[0.97] ${darkMode?'bg-amber-500/10 text-amber-400 border border-amber-500/20':'bg-amber-50 text-amber-600 border border-amber-200'}`}><Trophy size={13}/>Leaderboard</button>
          <button onClick={()=>setShowInviteModal(true)} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold transition-all active:scale-[0.97] ${darkMode?'bg-blue-500/10 text-blue-400 border border-blue-500/20':'bg-blue-50 text-blue-600 border border-blue-200'}`}><UserPlus size={13}/>Rooms</button>
          {isRoomCreator&&<button onClick={()=>setShowRoomSettings(true)} className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold transition-all active:scale-[0.97] ${darkMode?'bg-amber-500/10 text-amber-400 border border-amber-500/20':'bg-amber-50 text-amber-600 border border-amber-200'}`}><Crown size={12}/></button>}
        </div>

        {/* Settings */}
        <div className="mb-4">
          <div className="flex justify-center">
            <button onClick={toggleDevMode} className={`text-[10px] font-bold tracking-wider uppercase px-4 py-2 rounded-full transition-all ${devMode?(darkMode?'bg-amber-500/15 text-amber-400 border border-amber-500/20':'bg-amber-50 text-amber-600 border border-amber-200'):(darkMode?'text-gray-600 hover:text-gray-400':'text-gray-400 hover:text-gray-600')}`}>⚙️ Settings</button>
          </div>
          {devMode && (
            <div className={`mt-3 p-4 rounded-2xl border ${darkMode?'border-amber-500/10 bg-amber-500/5':'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button onClick={()=>setShowAddHabit(true)} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all ${T.textDim} hover:text-blue-400`}>➕ Habit</button>
                <button onClick={()=>setShowAddCategory(true)} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all ${T.textDim} hover:text-purple-400`}>➕ Category</button>
                {habits.length>0&&<button onClick={()=>setEditMode(!editMode)} className={'text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all '+(editMode?'bg-blue-500/20 text-blue-400':T.textDim+' hover:text-gray-400')}>{editMode?'Done':'✏️ Edit'}</button>}
                <button onClick={()=>{setCustomBoardHabits(myBoardIds||habits.map(h=>h.id));setShowCustomBoard(true);}} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all ${T.textDim} hover:text-indigo-400`}>🎯 Board</button>
                <button onClick={loadHeatMap} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all ${T.textDim} hover:text-purple-400`}>📊 Map</button>
                <button onClick={loadInsights} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all ${T.textDim} hover:text-blue-400`}>📈 Insights</button>
                <button onClick={()=>{setHistoryDate(getYesterday());loadHistoryDate(getYesterday());setShowHistory(true);}} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all ${T.textDim} hover:text-gray-400`}>📅 History</button>
                {lastWeekData&&<button onClick={()=>setShowWeeklyRecap(true)} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all ${T.textDim} hover:text-purple-400`}>📊 Recap</button>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Add Habit */}
      <Modal show={showAddHabit} onClose={()=>setShowAddHabit(false)} dark={darkMode}>
        <ModalHeader title="Add Habit" onClose={()=>setShowAddHabit(false)} dark={darkMode}/>
        <button onClick={loadDefaultHabits} disabled={loading} className="w-full mb-5 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl shadow-lg shadow-violet-500/20 text-sm font-bold active:scale-[0.98] disabled:opacity-50">{loading?'Loading...':'⚡ Load Student Preset (12 habits)'}</button>
        <div className="space-y-3">
          <input type="text" placeholder="Habit name" value={newHabit.name} onChange={e=>setNewHabit({...newHabit,name:e.target.value})} className={inputCls} maxLength={30}/>
          <div className="grid grid-cols-2 gap-3">
            <select value={newHabit.category} onChange={e=>setNewHabit({...newHabit,category:e.target.value})} className={inputCls}>{allCatNames.map(c=><option key={c} value={c} className={darkMode?'bg-[#12121a]':'bg-white'}>{c}</option>)}</select>
            <input type="number" placeholder="Points" value={newHabit.points} onChange={e=>setNewHabit({...newHabit,points:e.target.value})} className={inputCls}/>
          </div>
          <input type="text" placeholder="Time description (e.g. 30 min, per hour)" value={newHabit.unit} onChange={e=>setNewHabit({...newHabit,unit:e.target.value})} className={inputCls} maxLength={20}/>
          <input type="text" placeholder="Description (e.g. what counts?)" value={newHabit.description} onChange={e=>setNewHabit({...newHabit,description:e.target.value})} className={inputCls} maxLength={60}/>
          <label className="flex items-center gap-3 py-1 cursor-pointer"><input type="checkbox" checked={newHabit.isRepeatable} onChange={e=>setNewHabit({...newHabit,isRepeatable:e.target.checked,maxCompletions:e.target.checked?5:1})} className="w-4 h-4 rounded accent-blue-500"/><span className="text-sm text-gray-400">Repeatable</span></label>
          {newHabit.isRepeatable&&<input type="number" placeholder="Max per day" value={newHabit.maxCompletions} onChange={e=>setNewHabit({...newHabit,maxCompletions:e.target.value})} className={inputCls}/>}
          {error&&<p className="text-red-400 text-xs text-center">{error}</p>}
          <div className="flex gap-3 pt-2"><button onClick={()=>setShowAddHabit(false)} className={`flex-1 px-4 py-3 border ${T.border} rounded-xl text-sm ${T.textMuted} hover:${T.bgCardHover}`}>Cancel</button><button onClick={addHabit} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]">Add</button></div>
        </div>
      </Modal>

      {/* Edit Habit */}
      <Modal show={!!showEditHabit} onClose={()=>setShowEditHabit(null)} dark={darkMode}>
        <ModalHeader title="Edit Habit" onClose={()=>setShowEditHabit(null)} icon={<Edit3 size={18} className="text-blue-400"/>} dark={darkMode}/>
        <div className="space-y-3">
          <input type="text" placeholder="Name" value={editHabitData.name||''} onChange={e=>setEditHabitData({...editHabitData,name:e.target.value})} className={inputCls} maxLength={30}/>
          <div className="grid grid-cols-2 gap-3">
            <select value={editHabitData.category||allCatNames[0]} onChange={e=>setEditHabitData({...editHabitData,category:e.target.value})} className={inputCls}>{allCatNames.map(c=><option key={c} value={c} className={darkMode?'bg-[#12121a]':'bg-white'}>{c}</option>)}</select>
            <input type="number" placeholder="Points" value={editHabitData.points||''} onChange={e=>setEditHabitData({...editHabitData,points:e.target.value})} className={inputCls}/>
          </div>
          <input type="text" placeholder="Time description (e.g. 30 min, per hour)" value={editHabitData.unit||''} onChange={e=>setEditHabitData({...editHabitData,unit:e.target.value})} className={inputCls} maxLength={20}/>
          <input type="text" placeholder="Description (e.g. what counts?)" value={editHabitData.description||''} onChange={e=>setEditHabitData({...editHabitData,description:e.target.value})} className={inputCls} maxLength={60}/>
          <label className="flex items-center gap-3 py-1 cursor-pointer"><input type="checkbox" checked={editHabitData.isRepeatable||false} onChange={e=>setEditHabitData({...editHabitData,isRepeatable:e.target.checked,maxCompletions:e.target.checked?5:1})} className="w-4 h-4 rounded accent-blue-500"/><span className="text-sm text-gray-400">Repeatable</span></label>
          {editHabitData.isRepeatable&&<input type="number" placeholder="Max per day" value={editHabitData.maxCompletions||''} onChange={e=>setEditHabitData({...editHabitData,maxCompletions:e.target.value})} className={inputCls}/>}
          <div className="flex gap-3 pt-2"><button onClick={()=>setShowEditHabit(null)} className={`flex-1 px-4 py-3 border ${T.border} rounded-xl text-sm ${T.textMuted} hover:${T.bgCardHover}`}>Cancel</button><button onClick={saveEditHabit} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]">Save</button></div>
        </div>
      </Modal>

      {/* Add Category */}
      <Modal show={showAddCategory} onClose={()=>setShowAddCategory(false)} dark={darkMode}>
        <ModalHeader title="Manage Categories" onClose={()=>setShowAddCategory(false)} dark={darkMode}/>
        <div className="space-y-2 mb-5">{activeCategories.map(cat => {
          const ct = getCT(cat.name);
          return (
            <div key={cat.name} className={`flex items-center justify-between p-3 rounded-xl border ${ct.bdr} ${ct.bgS}`}>
              <div className="flex items-center gap-2"><span>{cat.icon}</span><span className={`text-sm font-semibold ${ct.txt}`}>{cat.name}</span></div>
              {!['Study','Health','Focus'].includes(cat.name) && <button onClick={()=>deleteCategory(cat.name)} className="text-[10px] text-gray-600 hover:text-red-400 uppercase tracking-wider">Remove</button>}
            </div>
          );
        })}</div>
        <div className={`border-t ${darkMode?'border-white/[0.06]':'border-gray-200'} pt-4`}>
          <p className={`text-xs ${T.textMuted} mb-3`}>Add a new category</p>
          <input type="text" placeholder="Category name" value={newCatName} onChange={e=>setNewCatName(e.target.value)} className={inputCls+' mb-3'} maxLength={20}/>
          <p className={`text-[10px] ${T.textDim} mb-2`}>Icon</p>
          <div className="flex flex-wrap gap-1.5 mb-4">{ICON_OPTIONS.map(ic=><button key={ic} onClick={()=>setNewCatIcon(ic)} className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all ${newCatIcon===ic?'bg-blue-500/20 border border-blue-500/30 scale-110':darkMode?'bg-white/[0.04] hover:bg-white/[0.08]':'bg-gray-100 hover:bg-gray-200'}`}>{ic}</button>)}</div>
          <p className={`text-[10px] ${T.textDim} mb-2`}>Color</p>
          <div className="flex flex-wrap gap-2 mb-4">{COLOR_PALETTE.map((cp,i)=><button key={i} onClick={()=>setNewCatColor(i)} className={`w-7 h-7 rounded-full transition-all ${cp.bg} ${newCatColor===i?'ring-2 ring-offset-2 ring-white/30 scale-110':''}`}/>)}</div>
          {error&&<p className="text-red-400 text-xs text-center mb-2">{error}</p>}
          <button onClick={addCategory} disabled={!newCatName.trim()} className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 active:scale-[0.98] disabled:opacity-40">Add Category</button>
        </div>
      </Modal>

      {/* History */}
      <Modal show={showHistory} onClose={()=>setShowHistory(false)} dark={darkMode}>
        <ModalHeader title="History" onClose={()=>setShowHistory(false)} icon={<Calendar size={18} className="text-purple-400"/>} dark={darkMode}/>
        <div className="flex items-center justify-between mb-4">
          <button onClick={()=>shiftHistoryDate(-1)} className="p-2 text-gray-600 hover:text-white"><ChevronLeft size={18}/></button>
          <span className="text-sm font-medium text-gray-300">{historyDate ? formatDate(historyDate) : ''}</span>
          <button onClick={()=>shiftHistoryDate(1)} disabled={historyDate>=getToday()} className="p-2 text-gray-600 hover:text-white disabled:opacity-30"><ChevronRight size={18}/></button>
        </div>
        {historyCompletions.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">No activity this day</div>
        ) : (
          <div className="space-y-2">
            {historyCompletions.filter(c=>c.userId===currentUser.id).map(c => {
              const h = habits.find(x=>x.id===c.habitId);
              const name = h?.name || c.habitName || 'Deleted habit';
              const pts = (h?.points || c.habitPoints || 0) * (c.count||1);
              const cat = h?.category || c.habitCategory || 'Study';
              return (
                <div key={c.id} className={'p-3 rounded-xl border bg-white/[0.02] '+(CT[cat]||getCT(cat)).bdr+' flex items-center justify-between'}>
                  <div className="flex items-center gap-2"><span className="text-sm">{(CT[cat]||getCT(cat)).icon}</span><span className="text-sm text-gray-300">{name}</span></div>
                  <div className="flex items-center gap-2"><span className="text-xs text-gray-500">x{c.count||1}</span><span className={'text-sm font-bold '+(CT[cat]||getCT(cat)).txt}>{pts} pts</span></div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-white/[0.06] flex justify-between items-center">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-lg font-black text-white">{historyCompletions.filter(c=>c.userId===currentUser.id).reduce((s,c)=>{const h=habits.find(x=>x.id===c.habitId);return s+((h?.points||c.habitPoints||0)*(c.count||1));},0)} pts</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Stakes */}
      <Modal show={showStakes} onClose={()=>setShowStakes(false)} dark={darkMode}>
        <ModalHeader title="Stakes" onClose={()=>setShowStakes(false)} icon={<Zap size={18} className="text-red-400"/>} dark={darkMode}/>
        {roomStakes ? (
          <div>
            <div className="p-4 bg-gradient-to-r from-red-500/10 via-pink-500/10 to-purple-500/10 border border-red-500/15 rounded-xl mb-4">
              <div className="flex items-center gap-2 mb-2"><span className={'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider '+(roomStakes.type==='buyout'?'bg-amber-500/20 text-amber-400':roomStakes.type==='dare'?'bg-pink-500/20 text-pink-400':roomStakes.type==='service'?'bg-cyan-500/20 text-cyan-400':'bg-purple-500/20 text-purple-400')}>{roomStakes.type}</span><span className="text-[10px] text-gray-600 uppercase tracking-wider">{roomStakes.duration}</span></div>
              <p className="text-white font-medium">{roomStakes.description}</p>
              <p className="text-[11px] text-gray-600 mt-2">Set by {activeMembers.find(m=>m.id===roomStakes.createdBy)?.username||'unknown'}</p>
            </div>
            {(isRoomCreator||roomStakes.createdBy===currentUser.id)&&<button onClick={clearStake} className="w-full px-4 py-2.5 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/10 text-sm transition-all">Remove Stake</button>}
          </div>
        ) : (
          <div>
            <p className={`${T.textMuted} text-sm mb-4`}>Set what's on the line. The weekly loser pays up.</p>
            <div className="grid grid-cols-2 gap-2 mb-4">{stakePresets.map(sp=>(
              <button key={sp.type} onClick={()=>setNewStake({...newStake,type:sp.type,description:sp.ph.replace('e.g. ','')})} className={'p-3 rounded-xl border text-left transition-all '+(newStake.type===sp.type?'border-red-500/40 bg-red-500/10':(darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]':'border-gray-200 bg-gray-50 hover:bg-gray-100'))}><div className={'text-xs font-bold mb-0.5 '+(newStake.type===sp.type?'text-red-400':'text-gray-400')}>{sp.label}</div><div className="text-[10px] text-gray-600">{sp.desc}</div></button>
            ))}</div>
            <input type="text" placeholder={stakePresets.find(s=>s.type===newStake.type)?.ph||'Describe the stake...'} value={newStake.description} onChange={e=>setNewStake({...newStake,description:e.target.value})} className={inputCls+' mb-3'} maxLength={60}/>
            <div className="flex gap-2 mb-4">{['weekly','monthly'].map(d=><button key={d} onClick={()=>setNewStake({...newStake,duration:d})} className={'flex-1 py-2.5 text-xs font-bold rounded-xl transition-all uppercase tracking-wider '+(newStake.duration===d?(darkMode?'bg-white/[0.1] text-white':'bg-gray-200 text-gray-900'):(darkMode?'bg-white/[0.02] text-gray-600':'bg-gray-100 text-gray-400'))}>{d}</button>)}</div>
            <button onClick={saveStake} disabled={!newStake.description.trim()||loading} className="w-full px-4 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl text-base font-bold shadow-lg shadow-red-500/20 active:scale-[0.98] disabled:opacity-30 transition-all">{loading?'Saving...':!newStake.description.trim()?'Type a stake above':'⚡ Set Stakes'}</button>
            {error&&<p className="text-red-400 text-xs text-center mt-2">{error}</p>}
          </div>
        )}
      </Modal>

      {/* Switch Room */}
      {/* Leaderboard */}
      <Modal show={showLeaderboard} onClose={()=>setShowLeaderboard(false)} wide dark={darkMode}>
        <ModalHeader title="Leaderboard" onClose={()=>setShowLeaderboard(false)} icon={<span className="text-xl">&#x1F3C6;</span>} dark={darkMode}/>
        <div className="flex gap-1 mb-5 bg-white/[0.03] rounded-xl p-1">{['today','week'].map(tab=><button key={tab} onClick={()=>setLeaderboardTab(tab)} className={'flex-1 py-2 text-xs font-bold rounded-lg transition-all tracking-wider uppercase '+(leaderboardTab===tab?(darkMode?'bg-white/[0.08] text-white':'bg-gray-200 text-gray-900'):(darkMode?'text-gray-600 hover:text-gray-400':'text-gray-400 hover:text-gray-600'))}>{tab==='today'?'Today':'This Week'}</button>)}</div>
        <div className="space-y-2">{getLeaderboard().map((item,i)=>{
          const pts=leaderboardTab==='today'?item.todayPts:item.weeklyPts, isMe=item.member.id===currentUser.id;
          const medals=['\u{1F947}','\u{1F948}','\u{1F949}'];
          const ms = !isMe ? (mutualStreaks[item.member.id] || 0) : 0;
          return (
            <div key={item.member.id} className={'rounded-xl p-4 border transition-all '+(isMe?'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500/30 shadow-lg shadow-blue-500/10':i===0?'bg-amber-500/5 border-amber-500/20':(darkMode?'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]':'bg-gray-50 border-gray-200 hover:bg-gray-100'))}>
              <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="text-lg w-8 text-center">{i<3?medals[i]:<span className="text-sm text-gray-600">{i+1}</span>}</div><Avatar user={item.member} size={28} className={isMe?'bg-blue-500/20 text-blue-400':(darkMode?'bg-white/[0.06] text-gray-400':'bg-gray-100 text-gray-500')}/><div><div className={'text-sm font-semibold flex items-center gap-1.5 '+(isMe?'text-blue-300':(darkMode?'text-gray-300':'text-gray-700'))}>{item.member.username}{isMe&&<span className="text-[10px] text-gray-600">(you)</span>}{getRoomRole(item.member.id)&&<span className={`text-[9px] font-bold ${getRoomRole(item.member.id).color}`}>{getRoomRole(item.member.id).icon}</span>}{ms>0&&<span className={`text-[9px] font-bold ${ms>=7?'text-orange-400':'text-amber-400'}`}>🔗{ms}</span>}</div><div className="text-xs text-gray-600">{pts} pts{leaderboardTab==='week'?' \u00b7 '+item.weeklyCrystals+' crystals':''}</div></div></div>
                <div className="flex items-center gap-3">{leaderboardTab==='today'&&<div className="flex items-center gap-1.5">{allCatNames.map(c=><div key={c} className={'w-2.5 h-2.5 rounded-full '+(item.crystals[c]?getCT(c).bg+' shadow-sm':(isMe?'bg-white/10':(darkMode?'bg-white/[0.06]':'bg-gray-200')))}/>)}</div>}{!isMe&&<button onClick={()=>{setShowLeaderboard(false);setShowCompetitor(item.member);}} className={`text-[10px] uppercase tracking-wider font-medium ${darkMode?'text-gray-600 hover:text-white':'text-gray-400 hover:text-gray-700'}`}>View</button>}</div>
              </div>
            </div>
          );
        })}</div>
        {activeMembers.length<2&&<div className="text-center py-8"><p className="text-gray-600 text-sm">Invite friends to compete!</p></div>}
      </Modal>

      {/* Profile */}
      <Modal show={showProfile} onClose={()=>setShowProfile(false)} dark={darkMode}>
        <ModalHeader title="Profile" onClose={()=>setShowProfile(false)} dark={darkMode}/>
        <div className="text-center mb-6"><div className="relative inline-block">{currentUser.photoURL?<img src={currentUser.photoURL} className="w-20 h-20 rounded-full object-cover border-2 border-blue-500/30" referrerPolicy="no-referrer"/>:<><ProgressRing progress={dailyProg} size={80} stroke={4} color={dailyProg>=1?'#10b981':'#3b82f6'}/><div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-black">{Math.round(dailyProg*100)}%</span></div></>}</div><h3 className="text-xl font-bold mt-3">{currentUser.username}</h3><p className="text-gray-600 text-xs">{currentUser.email}</p></div>
        <div className="grid grid-cols-4 gap-2 mb-4">{[{v:streakData.streak||0,l:'Streak',c:'text-orange-400',i:<Flame size={16} className="text-orange-400 mx-auto mb-1"/>},{v:streakFreeze>0?'🛡️':'—',l:'Freeze',c:streakFreeze>0?'text-cyan-400':'text-gray-600',i:null},{v:myPts,l:'Today',c:'text-blue-400',i:<Star size={16} className="text-blue-400 mx-auto mb-1"/>},{v:getWeeklyPts(currentUser.id),l:'Week',c:'text-emerald-400',i:<TrendingUp size={16} className="text-emerald-400 mx-auto mb-1"/>}].map((s,i)=><div key={i} className={`text-center p-3 ${T.bgCard} rounded-xl border ${T.border}`}>{s.i}<div className={'text-xl font-black '+s.c}>{s.v}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">{s.l}</div></div>)}</div>
        <div className="grid grid-cols-2 gap-3 mb-4"><div className={`text-center p-3 ${T.bgCard} rounded-xl border ${T.border}`}><div className="text-lg font-black text-purple-400">{streakData.activeDays||0}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Active Days</div></div><div className={`text-center p-3 ${T.bgCard} rounded-xl border ${T.border}`}><div className="text-lg font-black text-cyan-400">{streakData.totalCompletions||0}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Completions</div></div></div>
        <div className={`p-3 ${T.bgCard} rounded-xl border ${T.border}`}><div className="text-[9px] text-gray-600 tracking-wider uppercase mb-2">Crystals</div><div className="flex justify-center gap-4">{allCatNames.map(c=><div key={c} className="text-center"><div className={'w-6 h-6 rounded-full mx-auto mb-1 transition-all '+(myCr[c]?getCT(c).bg+' shadow-md '+getCT(c).glow:'bg-white/[0.06]')}/><span className="text-[9px] text-gray-600">{c}</span></div>)}</div></div>
        <div className={`mt-4 p-3 ${T.bgCard} rounded-xl border ${T.border} flex items-center justify-between`}><div><div className={`text-sm font-medium ${T.text}`}>Email Reminders</div><div className="text-[10px] text-gray-500">Daily nudges at 12pm & 6pm</div></div><button onClick={async()=>{const newVal=currentUser.emailReminders===false?true:false;try{await updateDoc(doc(db,'users',currentUser.id),{emailReminders:!newVal});setCurrentUser(p=>({...p,emailReminders:!newVal}));}catch{}}} className={'relative w-11 h-6 rounded-full transition-all '+(currentUser.emailReminders!==false?'bg-blue-500':(darkMode?'bg-white/[0.08]':'bg-gray-200'))}><div className={'absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm '+(currentUser.emailReminders!==false?'left-6':'left-1')}/></button></div>
        {/* Quick actions */}
        <div className="mt-5 space-y-2">
          <button onClick={()=>{setShowProfile(false);setShowInviteModal(true);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300':'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'}`}><UserPlus size={16} className="text-blue-400"/><span className="text-sm">Invite to Room</span></button>
          <button onClick={()=>{setShowProfile(false);setShowStakes(true);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300':'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'}`}><Zap size={16} className="text-red-400"/><span className="text-sm">Stakes</span></button>
          {lastWeekData&&<button onClick={()=>{setShowProfile(false);setShowWeeklyRecap(true);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300':'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'}`}><BarChart3 size={16} className="text-purple-400"/><span className="text-sm">Weekly Recap</span></button>}
          <button onClick={()=>{setShowProfile(false);setShowHelp(true);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300':'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'}`}><HelpCircle size={16} className="text-gray-400"/><span className="text-sm">How Versa Works</span></button>
          <button onClick={()=>signOut(auth)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-red-500/5 text-red-400':'border-gray-200 bg-gray-50 hover:bg-red-50 text-red-500'}`}><LogOut size={16}/><span className="text-sm">Sign Out</span></button>
        </div>
      </Modal>

      {/* Help */}
      <Modal show={showHelp} onClose={()=>setShowHelp(false)} dark={darkMode}>
        <ModalHeader title="How Versa Works" onClose={()=>setShowHelp(false)} dark={darkMode}/>
        <div className="space-y-3 text-sm text-gray-400">
          {[
            {i:'🎯',t:'Track & Earn',d:'Tap + to log habits. Each completion earns points. Hit 400pts for a perfect day.'},
            {i:'🔥',t:'Streaks',d:'Log at least 80pts daily to maintain your streak. Tiers: 3d→1.1× · 7d→1.25× · 14d→1.5× · 30d→1.75× · 60d→2×. Miss a day and it resets.'},
            {i:'🛡️',t:'Streak Freeze',d:'Hit 90% (360pts) in a day to bank a freeze. If you miss tomorrow, the freeze saves your streak. Max 1 at a time — unlog habits and you lose it.'},
            {i:'🎰',t:'Mystery Bonus',d:'~10% chance on every tap: 1.25× (common), 1.5×, 2× (rare), 3× (epic), 5× (jackpot). Bonus points stack on top of streak multipliers.'},
            {i:'💎',t:'Crystals',d:'Score the most points in a category (Study, Health, Focus) to earn a crystal for the day. Ties = no crystal.'},
            {i:'🏆',t:'Compete',d:'Weekly leaderboard resets Sunday. Invite friends, set stakes, and see who actually follows through.'},
            {i:'⚡',t:'Stakes',d:'Set what the weekly loser has to do. Spin the punishment wheel for random consequences.'},
            {i:'🔥',t:'Reactions',d:'React to your rivals\' completions with 🔥 💀 👏 😤 in the activity feed.'},
            {i:'👤',t:'Solo Mode',d:'No friends yet? Compete against your own yesterday score.'},
          ].map((s,i)=>(
            <div key={i} className={`${T.bgCard} rounded-xl p-4 border ${T.border}`}><p className={`font-bold ${T.text} mb-1`}>{s.i} {s.t}</p><p>{s.d}</p></div>
          ))}
          <div className={`${T.bgCard} rounded-xl p-4 border ${T.border}`}><p className={`font-bold ${T.text} mb-2`}>Categories</p><div className="space-y-1.5">{allCatNames.map(c=>{const ct=getCT(c);return(<div key={c} className="flex items-center gap-2"><div className={'w-3 h-3 rounded-full '+ct.bg+' shadow-sm '+ct.glow}/><span><strong className={ct.txt}>{c}</strong></span></div>);})}</div></div>
        </div>
      </Modal>

      {/* Invite & Rooms */}
      <Modal show={showInviteModal||showSwitchRoom} onClose={()=>{setShowInviteModal(false);setShowSwitchRoom(false);}} dark={darkMode}>
        <ModalHeader title="Rooms" onClose={()=>{setShowInviteModal(false);setShowSwitchRoom(false);}} dark={darkMode}/>

        {/* Current room code */}
        <div className="text-center mb-4">
          <p className="text-xs text-gray-500 mb-3 tracking-wider uppercase">Share this room code</p>
          <div className="mb-4 relative inline-block"><code className={`inline-block px-8 py-4 ${darkMode?'bg-gradient-to-b from-white/[0.08] to-white/[0.03] border-white/[0.1] text-white':'bg-gradient-to-b from-gray-100 to-gray-50 border-gray-200 text-gray-900'} border text-3xl font-mono rounded-xl tracking-[0.4em] shadow-2xl`}>{currentRoom?.code}</code><div className="absolute -inset-3 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 blur-xl rounded-xl -z-10"/></div>
          <div className="flex gap-2">
            <button onClick={copyCode} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 text-sm font-bold active:scale-[0.98]">{copied?<Check size={14}/>:<Copy size={14}/>}{copied?'Copied!':'Copy Code'}</button>
            {navigator.share && <button onClick={async()=>{try{await navigator.share({title:'Join me on Versa',text:`Join my room on Versa! Code: ${currentRoom?.code}`,url:`${window.location.origin}?join=${currentRoom?.code}`});}catch{}}} className={`flex-1 px-4 py-2.5 border ${darkMode?'border-white/[0.08] text-white hover:bg-white/[0.04]':'border-gray-200 text-gray-700 hover:bg-gray-50'} rounded-xl flex items-center justify-center gap-2 text-sm font-medium active:scale-[0.98]`}><UserPlus size={14}/>Share</button>}
          </div>
        </div>

        {/* Your rooms */}
        {userRooms.length > 1 && <>
          <div className={`border-t ${T.border} pt-4 mt-4`}>
            <p className={`text-xs ${T.textMuted} mb-2 font-bold tracking-wider uppercase`}>Your Rooms</p>
            <div className="space-y-1.5">{userRooms.map(rid=>(
              <div key={rid} className={`px-3 py-2.5 rounded-xl border flex items-center justify-between transition-all ${currentRoom?.id===rid?'border-blue-500/30 bg-blue-500/10':(darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]':'border-gray-200 bg-gray-50 hover:bg-gray-100')}`}>
                <div className="flex items-center gap-2"><span className={`font-mono text-sm tracking-widest ${T.text}`}>{rid}</span>{currentRoom?.id===rid&&<span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}</div>
                <div className="flex items-center gap-2">{currentRoom?.id!==rid&&<button onClick={()=>{switchRoom(rid);setShowInviteModal(false);setShowSwitchRoom(false);}} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium uppercase tracking-wider">Switch</button>}<button onClick={()=>leaveRoom(rid)} className="text-[10px] text-gray-600 hover:text-red-400 font-medium uppercase tracking-wider">Leave</button></div>
              </div>
            ))}</div>
          </div>
        </>}

        {/* Join / Create */}
        <div className={`border-t ${T.border} pt-4 mt-4`}>
          <p className={`text-xs ${T.textMuted} mb-2`}>Join another room</p>
          <div className="flex gap-2"><input type="text" placeholder="CODE" value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase())} className={`flex-1 px-3 py-2.5 ${T.bgInput} border ${T.borderInput} rounded-xl ${T.text} placeholder-gray-400 text-sm font-mono tracking-[0.2em] text-center`} maxLength={6}/><button onClick={()=>{joinRoom();setShowInviteModal(false);setShowSwitchRoom(false);}} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]">Join</button></div>
          {error&&<p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
          <button onClick={()=>{createRoom();setShowInviteModal(false);setShowSwitchRoom(false);}} className={`w-full mt-3 px-4 py-2.5 border ${T.border} ${T.textMuted} rounded-xl hover:${T.bgCardHover} text-sm transition-all`}>+ Create New Room</button>
        </div>
      </Modal>

      {/* Competitor */}
      <Modal show={!!showCompetitor} onClose={()=>setShowCompetitor(null)} dark={darkMode}>
        {showCompetitor&&<><ModalHeader title={showCompetitor.username} onClose={()=>setShowCompetitor(null)} dark={darkMode}/>
        <div className="space-y-3"><div className="grid grid-cols-3 gap-3">{allCatNames.map(c=><div key={c} className={'text-center p-4 rounded-xl border '+getCT(c).bgS+' '+getCT(c).bdr}><div className={'text-2xl font-black '+getCT(c).txt}>{getCatPts(showCompetitor.id,c)}</div><div className="text-[9px] text-gray-600 mt-1 tracking-wider uppercase">{c}</div></div>)}</div><div className="text-center p-5 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-xl border border-blue-500/20"><div className="text-3xl font-black">{getTodayPts(showCompetitor.id)}</div><div className="text-[10px] text-gray-500 mt-1 tracking-wider uppercase">Total Today</div></div></div></>}
      </Modal>

      {/* Weekly Recap */}
      <Modal show={showWeeklyRecap} onClose={()=>setShowWeeklyRecap(false)} wide dark={darkMode}>
        <ModalHeader title="Weekly Recap" onClose={()=>setShowWeeklyRecap(false)} icon={<BarChart3 size={18} className="text-purple-400"/>} dark={darkMode}/>
        {lastWeekData ? (
          <div>
            <p className={`text-xs ${T.textDim} mb-4`}>{lastWeekData.dateRange}</p>
            {lastWeekData.scores.length > 0 && (
              <div className="text-center p-5 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/15 rounded-xl mb-4">
                <span className="text-3xl">🏆</span>
                <h3 className="text-xl font-black text-amber-300 mt-2">{lastWeekData.scores[0].member.username}</h3>
                <p className={`text-sm ${T.textMuted} mt-1`}>{lastWeekData.scores[0].pts} points &middot; {lastWeekData.scores[0].activeDays} active days</p>
              </div>
            )}
            <div className="space-y-2 mb-4">{lastWeekData.scores.map((s,i) => {
              const medals = ['🥇','🥈','🥉']; const isMe = s.member.id === currentUser.id;
              return (
                <div key={s.member.id} className={'rounded-xl p-3 border transition-all '+(isMe?'bg-blue-600/10 border-blue-500/20':darkMode?'bg-white/[0.02] border-white/[0.04]':'bg-gray-50 border-gray-200')}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><span className="text-sm">{i<3?medals[i]:(i+1)+'.'}</span><Avatar user={s.member} size={22} className={isMe?'bg-blue-500/20 text-blue-400':'bg-white/[0.06] text-gray-400'}/><span className={'text-sm font-semibold '+(isMe?'text-blue-300':darkMode?'text-gray-300':'text-gray-700')}>{s.member.username}</span></div>
                    <span className={`text-sm font-bold ${T.text}`}>{s.pts} pts</span>
                  </div>
                  <div className="flex flex-wrap gap-2">{allCatNames.map(c=>(
                    <div key={c} className={'flex-1 min-w-[60px] text-center p-1.5 rounded-lg '+getCT(c).bgS}>
                      <div className={'text-xs font-bold '+getCT(c).txt}>{s.catPts[c]}</div>
                      <div className="text-[8px] text-gray-500">{c}</div>
                    </div>
                  ))}</div>
                  <div className={`flex gap-3 mt-2 text-[10px] ${T.textDim}`}><span>{s.activeDays} active days</span><span>{s.completions} completions</span></div>
                </div>
              );
            })}</div>
            {/* Share + Punishment */}
            <div className="flex gap-2">
              <button onClick={async()=>{
                const text = `🏆 Versa Weekly Recap\n${lastWeekData.dateRange}\n\n${lastWeekData.scores.map((s,i)=>((['🥇','🥈','🥉'][i]||`${i+1}.`)+' '+s.member.username+' — '+s.pts+'pts')).join('\n')}\n\nJoin us: ${window.location.origin}?join=${currentRoom?.code}`;
                if(navigator.share){try{await navigator.share({title:'Versa Weekly Recap',text});}catch{}}else{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}
              }} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]"><Copy size={14}/>{copied?'Copied!':'Share Recap'}</button>
              <button onClick={()=>{setShowWeeklyRecap(false);setStoryCardIdx(0);setShowStoryCards(true);}} className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]">📸 Story</button>
              {lastWeekData.scores.length>1&&<button onClick={()=>{setShowWeeklyRecap(false);setShowPunishmentWheel(true);setWheelResult(null);}} className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]">🎰 Wheel</button>}
            </div>
          </div>
        ) : (
          <p className={`${T.textDim} text-sm text-center py-8`}>No data from last week yet.</p>
        )}
      </Modal>

      {/* Punishment Wheel */}
      <Modal show={showPunishmentWheel} onClose={()=>{setShowPunishmentWheel(false);setWheelResult(null);setWheelSpinning(false);}} wide dark={darkMode}>
        <ModalHeader title="🎰 Punishment Wheel" onClose={()=>{setShowPunishmentWheel(false);setWheelResult(null);setWheelSpinning(false);}} dark={darkMode}/>
        {lastWeekData && lastWeekData.scores.length > 1 && (
          <div className="text-center">
            <div className="mb-4">
              <p className={`text-sm ${T.textMuted}`}>Loser this week:</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Avatar user={lastWeekData.scores[lastWeekData.scores.length-1].member} size={32} className="bg-red-500/20 text-red-400"/>
                <span className="text-lg font-bold text-red-400">{lastWeekData.scores[lastWeekData.scores.length-1].member.username}</span>
              </div>
              <p className={`text-xs ${T.textDim} mt-1`}>{lastWeekData.scores[lastWeekData.scores.length-1].pts} pts</p>
            </div>

            {/* Wheel display */}
            <div className="relative mx-auto mb-6" style={{width:280,height:280}}>
              <div className={`w-full h-full rounded-full border-4 border-white/[0.1] overflow-hidden relative`} style={{transform:`rotate(${wheelSpinning?3600+Math.random()*360:0}deg)`,transition:wheelSpinning?'transform 4s cubic-bezier(0.17,0.67,0.12,0.99)':'none'}}>
                {PUNISHMENTS.map((p,i)=>{
                  const angle = (360/PUNISHMENTS.length)*i;
                  const colors = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#6366f1','#14b8a6','#e11d48','#a855f7'];
                  return <div key={i} className="absolute text-[7px] font-bold text-white" style={{
                    width:'50%',height:'50%',
                    transformOrigin:'100% 100%',
                    transform:`rotate(${angle}deg) skewY(${90-360/PUNISHMENTS.length}deg)`,
                    left:0,top:0,
                    background:colors[i%colors.length],
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}/>;
                })}
              </div>
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-white z-10"/>
            </div>

            {/* Result */}
            {wheelResult && (
              <div className="mb-4 p-4 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl animate-bounce">
                <p className="text-lg font-black text-white">{wheelResult}</p>
                <p className={`text-xs ${T.textDim} mt-1`}>{lastWeekData.scores[lastWeekData.scores.length-1].member.username} has to do this!</p>
              </div>
            )}

            {/* Spin button */}
            {!wheelResult ? (
              <button onClick={()=>{
                if(wheelSpinning) return;
                setWheelSpinning(true);
                setTimeout(()=>{
                  const result = PUNISHMENTS[Math.floor(Math.random()*PUNISHMENTS.length)];
                  setWheelResult(result);
                  setWheelSpinning(false);
                },4200);
              }} disabled={wheelSpinning} className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl text-sm font-bold active:scale-[0.98] disabled:opacity-60">
                {wheelSpinning?'Spinning...':'Spin the Wheel'}
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={()=>{setWheelResult(null);}} className="flex-1 px-4 py-3 border border-white/[0.08] text-gray-400 rounded-xl text-sm font-medium hover:bg-white/[0.04]">Spin Again</button>
                <button onClick={async()=>{
                  const text = `🎰 Versa Punishment Wheel\n\n${lastWeekData.scores[lastWeekData.scores.length-1].member.username} lost and has to:\n${wheelResult}\n\nJoin us: ${window.location.origin}?join=${currentRoom?.code}`;
                  if(navigator.share){try{await navigator.share({title:'Versa Punishment',text});}catch{}}else{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}
                }} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold active:scale-[0.98]">{copied?'Copied!':'Share'}</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Weekly Story Cards */}
      <Modal show={showStoryCards} onClose={()=>setShowStoryCards(false)} wide dark={darkMode}>
        {lastWeekData && lastWeekData.scores.length > 0 && (
          <div>
            {/* Theme picker */}
            <div className="flex justify-center gap-2 mb-4">
              {[{id:'dark',label:'Dark',bg:'bg-gray-900'},{id:'neon',label:'Neon',bg:'bg-purple-900'},{id:'light',label:'Light',bg:'bg-white'}].map(th=>(
                <button key={th.id} onClick={()=>setStoryTheme(th.id)} className={`w-8 h-8 rounded-full border-2 ${th.bg} ${storyTheme===th.id?'border-blue-500 scale-110':'border-gray-600'} transition-all`}/>
              ))}
            </div>

            {/* Story Card */}
            <div id="story-card" className={`mx-auto rounded-2xl overflow-hidden ${storyTheme==='dark'?'bg-[#0a0a0f] text-white':storyTheme==='neon'?'bg-gradient-to-b from-purple-900 via-indigo-900 to-black text-white':'bg-white text-gray-900'}`} style={{width:300,minHeight:440}}>
              <div className="p-6 flex flex-col justify-between h-full" style={{minHeight:440}}>
                {/* Card 0: Winner */}
                {storyCardIdx === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className={`text-[10px] font-bold tracking-[0.3em] uppercase mb-6 ${storyTheme==='light'?'text-gray-400':'text-gray-500'}`}>VERSA WEEKLY RECAP</div>
                    <div className="text-5xl mb-4">🏆</div>
                    <div className={`text-2xl font-black mb-1 ${storyTheme==='neon'?'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400':''}`}>{lastWeekData.scores[0].member.username}</div>
                    <div className={`text-sm ${storyTheme==='light'?'text-gray-500':'text-gray-400'}`}>won the week</div>
                    <div className={`text-4xl font-black mt-4 ${storyTheme==='neon'?'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400':'text-blue-400'}`}>{lastWeekData.scores[0].pts}</div>
                    <div className={`text-xs ${storyTheme==='light'?'text-gray-400':'text-gray-600'}`}>points · {lastWeekData.scores[0].activeDays} active days</div>
                    <div className={`text-[10px] mt-6 ${storyTheme==='light'?'text-gray-300':'text-gray-700'}`}>{lastWeekData.dateRange}</div>
                  </div>
                )}

                {/* Card 1: Standings */}
                {storyCardIdx === 1 && (
                  <div className="flex-1">
                    <div className={`text-[10px] font-bold tracking-[0.3em] uppercase mb-5 text-center ${storyTheme==='light'?'text-gray-400':'text-gray-500'}`}>FINAL STANDINGS</div>
                    <div className="space-y-3">
                      {lastWeekData.scores.map((s,i) => {
                        const medals = ['🥇','🥈','🥉'];
                        return (
                          <div key={s.member.id} className={`flex items-center justify-between p-3 rounded-xl ${i===0?(storyTheme==='neon'?'bg-purple-500/20 border border-purple-500/30':'bg-blue-500/10 border border-blue-500/20'):(storyTheme==='light'?'bg-gray-50':'bg-white/[0.03]')} ${i>0?'border '+(storyTheme==='light'?'border-gray-100':'border-white/[0.04]'):''}`}>
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{i<3?medals[i]:(i+1)+'.'}</span>
                              <div>
                                <div className={`text-sm font-bold ${i===0&&storyTheme==='neon'?'text-purple-300':''}`}>{s.member.username}</div>
                                <div className={`text-[10px] ${storyTheme==='light'?'text-gray-400':'text-gray-600'}`}>{s.activeDays}d active</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black">{s.pts}</div>
                              <div className={`text-[9px] ${storyTheme==='light'?'text-gray-400':'text-gray-600'}`}>pts</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className={`text-[10px] mt-4 text-center ${storyTheme==='light'?'text-gray-300':'text-gray-700'}`}>{lastWeekData.dateRange}</div>
                  </div>
                )}

                {/* Card 2: Highlights */}
                {storyCardIdx === 2 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className={`text-[10px] font-bold tracking-[0.3em] uppercase mb-6 ${storyTheme==='light'?'text-gray-400':'text-gray-500'}`}>HIGHLIGHTS</div>
                    <div className="space-y-5 w-full">
                      <div>
                        <div className={`text-[10px] uppercase tracking-wider ${storyTheme==='light'?'text-gray-400':'text-gray-600'}`}>Most Consistent</div>
                        <div className="text-lg font-black">{[...lastWeekData.scores].sort((a,b)=>b.activeDays-a.activeDays)[0]?.member.username}</div>
                        <div className={`text-xs ${storyTheme==='neon'?'text-cyan-400':'text-blue-400'}`}>{[...lastWeekData.scores].sort((a,b)=>b.activeDays-a.activeDays)[0]?.activeDays}/7 days</div>
                      </div>
                      <div>
                        <div className={`text-[10px] uppercase tracking-wider ${storyTheme==='light'?'text-gray-400':'text-gray-600'}`}>Top Category</div>
                        <div className="text-lg font-black">{(()=>{let best='',bestPts=0;allCatNames.forEach(c=>{const p=lastWeekData.scores[0].catPts[c]||0;if(p>bestPts){bestPts=p;best=c;}});return best||'—';})()}</div>
                        <div className={`text-xs ${storyTheme==='neon'?'text-purple-400':'text-emerald-400'}`}>for {lastWeekData.scores[0].member.username}</div>
                      </div>
                      {lastWeekData.scores.length>1&&<div>
                        <div className={`text-[10px] uppercase tracking-wider ${storyTheme==='light'?'text-gray-400':'text-gray-600'}`}>Closest Race</div>
                        <div className="text-lg font-black">{lastWeekData.scores[0].pts-lastWeekData.scores[1].pts} pts</div>
                        <div className={`text-xs ${storyTheme==='light'?'text-gray-400':'text-gray-600'}`}>between 1st and 2nd</div>
                      </div>}
                      {(()=>{const topMs=Object.entries(mutualStreaks).filter(([_,v])=>v>0).sort((a,b)=>b[1]-a[1])[0];if(!topMs)return null;const rival=activeMembers.find(m=>m.id===topMs[0]);if(!rival)return null;return(<div><div className={`text-[10px] uppercase tracking-wider ${storyTheme==='light'?'text-gray-400':'text-gray-600'}`}>Longest Duo Streak</div><div className="text-lg font-black">🔗 {topMs[1]} days</div><div className={`text-xs ${storyTheme==='neon'?'text-orange-400':'text-orange-400'}`}>{currentUser.username} & {rival.username}</div></div>);})()}
                    </div>
                    <div className={`text-[10px] mt-6 ${storyTheme==='light'?'text-gray-300':'text-gray-700'}`}>VERSA</div>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation dots */}
            <div className="flex justify-center gap-2 mt-4">
              {[0,1,2].map(i=>(
                <button key={i} onClick={()=>setStoryCardIdx(i)} className={`w-2 h-2 rounded-full transition-all ${storyCardIdx===i?'bg-blue-500 w-5':'bg-gray-600'}`}/>
              ))}
            </div>

            {/* Nav + Save */}
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setStoryCardIdx(p=>Math.max(0,p-1))} disabled={storyCardIdx===0} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-20 ${darkMode?'text-gray-400 border border-white/[0.06]':'text-gray-500 border border-gray-200'}`}>← Prev</button>
              <button onClick={()=>setStoryCardIdx(p=>Math.min(2,p+1))} disabled={storyCardIdx===2} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-20 ${darkMode?'text-gray-400 border border-white/[0.06]':'text-gray-500 border border-gray-200'}`}>Next →</button>
            </div>
            <button onClick={async()=>{
              try{
                const el=document.getElementById('story-card');
                const {default:html2canvas}=await import('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.js');
                const canvas=await html2canvas(el,{backgroundColor:null,scale:2});
                const link=document.createElement('a');link.download='versa-recap.png';link.href=canvas.toDataURL();link.click();
              }catch{
                // Fallback: share as text
                const text=`🏆 Versa Weekly Recap\n${lastWeekData.dateRange}\n\nWinner: ${lastWeekData.scores[0].member.username} — ${lastWeekData.scores[0].pts}pts`;
                if(navigator.share){try{await navigator.share({title:'Versa Recap',text});}catch{}}else{navigator.clipboard.writeText(text);}
              }
            }} className="w-full mt-2 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-bold active:scale-[0.98]">📸 Save as Image</button>
          </div>
        )}
      </Modal>

      {/* Heat Map Calendar */}
      <Modal show={showHeatMap} onClose={()=>setShowHeatMap(false)} wide dark={darkMode}>
        <ModalHeader title="90-Day Heat Map" onClose={()=>setShowHeatMap(false)} icon={<Calendar size={18} className="text-emerald-400"/>} dark={darkMode}/>
        <div className="mb-3"><p className={`text-xs ${T.textDim}`}>Points per day · darker = more active</p></div>
        <div className="flex flex-wrap gap-[3px]">{(() => {
          const cells = [];
          const today = new Date();
          const maxPts = Math.max(1, ...Object.values(heatMapData));
          for (let i = 89; i >= 0; i--) {
            const d = new Date(today); d.setDate(d.getDate()-i);
            const ds = formatDateStr(d);
            const pts = heatMapData[ds] || 0;
            const intensity = pts / maxPts;
            const isToday = ds === getToday();
            const bg = pts === 0
              ? (darkMode ? 'bg-white/[0.04]' : 'bg-gray-100')
              : '';
            const style = pts > 0 ? {backgroundColor:`rgba(16,185,129,${0.2+intensity*0.8})`} : {};
            cells.push(
              <div key={ds} className={`w-[10px] h-[10px] rounded-[2px] ${bg} ${isToday?'ring-1 ring-white/30':''}`} style={style} title={`${formatDate(ds)}: ${pts} pts`}/>
            );
          }
          return cells;
        })()}</div>
        <div className="flex items-center justify-between mt-3">
          <span className={`text-[10px] ${T.textDim}`}>90 days ago</span>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] ${T.textDim} mr-1`}>Less</span>
            {[0,0.25,0.5,0.75,1].map((v,i)=><div key={i} className="w-[10px] h-[10px] rounded-[2px]" style={{backgroundColor:v===0?(darkMode?'rgba(255,255,255,0.04)':'#f3f4f6'):`rgba(16,185,129,${0.2+v*0.8})`}}/>)}
            <span className={`text-[10px] ${T.textDim} ml-1`}>More</span>
          </div>
          <span className={`text-[10px] ${T.textDim}`}>Today</span>
        </div>
        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3 mt-4">{[
          {v: Object.keys(heatMapData).length, l: 'Active Days'},
          {v: Object.values(heatMapData).reduce((a,b)=>a+b,0), l: 'Total Points'},
          {v: streakData.streak||0, l: 'Current Streak'}
        ].map((s,i)=>(
          <div key={i} className={`text-center p-3 rounded-xl ${darkMode?'bg-white/[0.03] border border-white/[0.04]':'bg-gray-50 border border-gray-200'}`}>
            <div className="text-lg font-black text-emerald-400">{s.v}</div>
            <div className={`text-[9px] ${T.textDim} tracking-wider uppercase`}>{s.l}</div>
          </div>
        ))}</div>
      </Modal>

      {/* Personal Insights */}
      <Modal show={showInsights} onClose={()=>setShowInsights(false)} wide dark={darkMode}>
        <ModalHeader title="Your Insights" onClose={()=>setShowInsights(false)} icon={<TrendingUp size={18} className="text-blue-400"/>} dark={darkMode}/>
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
                { v: insightsData.bestStreak+'d', l: 'Best streak', c: 'text-amber-400', icon: '🏆' },
              ].map((s,i) => (
                <div key={i} className={`p-3 rounded-xl ${darkMode?'bg-white/[0.03] border border-white/[0.04]':'bg-gray-50 border border-gray-200'}`}>
                  <div className="text-sm mb-0.5">{s.icon}</div>
                  <div className={`text-lg font-black ${s.c}`}>{s.v}</div>
                  <div className={`text-[9px] ${T.textDim} tracking-wider uppercase`}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Most consistent habit */}
            <div className={`p-4 rounded-xl mb-4 ${darkMode?'bg-white/[0.03] border border-white/[0.04]':'bg-gray-50 border border-gray-200'}`}>
              <div className={`text-[10px] ${T.textDim} tracking-wider uppercase mb-1`}>Most Consistent Habit</div>
              <div className={`text-sm font-bold ${darkMode?'text-white':'text-gray-900'}`}>{insightsData.bestHabitName}</div>
              <div className={`text-xs ${T.textDim}`}>{insightsData.bestHabitDays} out of {insightsData.activeDays} active days</div>
            </div>

            {/* Weekly pattern bar chart */}
            <div className={`p-4 rounded-xl mb-4 ${darkMode?'bg-white/[0.03] border border-white/[0.04]':'bg-gray-50 border border-gray-200'}`}>
              <div className={`text-[10px] ${T.textDim} tracking-wider uppercase mb-3`}>Weekly Pattern</div>
              <div className="flex items-end justify-between gap-1 h-20">
                {insightsData.weekdayNames.map((day,i) => {
                  const max = Math.max(1,...insightsData.weekdayCounts);
                  const h = (insightsData.weekdayCounts[i] / max) * 100;
                  const isBest = i === insightsData.weekdayNames.indexOf(insightsData.bestDay);
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-md transition-all" style={{height: Math.max(4, h)+'%', backgroundColor: isBest ? '#10b981' : (darkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb')}}/>
                      <span className={`text-[8px] ${isBest?'text-emerald-400 font-bold':T.textDim}`}>{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: insightsData.activeDays, l: 'Active Days' },
                { v: insightsData.completionRate+'%', l: 'Active Rate' },
                { v: insightsData.totalPts, l: 'Total Pts' },
              ].map((s,i) => (
                <div key={i} className={`text-center p-2 rounded-lg ${darkMode?'bg-white/[0.02]':'bg-gray-50'}`}>
                  <div className={`text-sm font-bold ${darkMode?'text-white':'text-gray-800'}`}>{s.v}</div>
                  <div className={`text-[8px] ${T.textDim} tracking-wider uppercase`}>{s.l}</div>
                </div>
              ))}
            </div>

            <p className={`text-[10px] ${T.textDim} text-center mt-4 italic`}>Based on last 60 days · only you can see this</p>
          </div>
        ) : <p className={`text-sm ${T.textDim} text-center py-8`}>Loading...</p>}
      </Modal>

      {/* Custom Board Proposal */}
      <Modal show={showCustomBoard} onClose={()=>setShowCustomBoard(false)} wide dark={darkMode}>
        <ModalHeader title="Custom Board" onClose={()=>setShowCustomBoard(false)} dark={darkMode}/>
        <p className={`text-xs ${T.textDim} mb-4`}>Pick which habits go on your personal board, or add new ones. Needs approval from your room.</p>
        {pendingBoards.find(b=>b.userId===currentUser?.id&&b.status==='approved') && (
          <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <span className="text-xs text-emerald-400 font-medium">✓ You have an active custom board</span>
          </div>
        )}
        {pendingBoards.find(b=>b.userId===currentUser?.id&&b.status==='pending') && (
          <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <span className="text-xs text-amber-400 font-medium">⏳ Your board is pending approval</span>
          </div>
        )}
        <div className="space-y-2 mb-3 max-h-52 overflow-y-auto">
          {habits.map(h => {
            const selected = customBoardHabits.includes(h.id);
            const ct = getCT(h.category);
            return (
              <button key={h.id} onClick={()=>{
                setCustomBoardHabits(prev=>selected?prev.filter(id=>id!==h.id):[...prev,h.id]);
              }} className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                selected ? ct.bdr+' '+ct.bgS : darkMode?'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.03]':'border-gray-200 bg-white hover:bg-gray-50'
              }`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs ${
                  selected?ct.bg+' border-transparent text-white':'border-gray-600'
                }`}>{selected&&'✓'}</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${selected?(darkMode?'text-white':'text-gray-900'):T.textDim}`}>{h.name}</div>
                  <div className={`text-[10px] ${T.textDim}`}>{h.category} · {h.points} pts</div>
                </div>
              </button>
            );
          })}
        </div>
        {/* Inline add habit */}
        <details className={`mb-4 rounded-xl border overflow-hidden ${darkMode?'border-white/[0.06] bg-white/[0.02]':'border-gray-200 bg-gray-50'}`}>
          <summary className={`px-4 py-2.5 cursor-pointer text-xs font-medium ${T.textDim} hover:${T.text} transition-colors`}><Plus size={12} className="inline mr-1"/>Add a new habit</summary>
          <div className="px-4 pb-4 pt-2 space-y-3">
            <input value={newHabit.name} onChange={e=>setNewHabit(p=>({...p,name:e.target.value}))} placeholder="Habit name" className={inputCls} maxLength={30}/>
            <div className="grid grid-cols-2 gap-3">
              <select value={newHabit.category} onChange={e=>setNewHabit(p=>({...p,category:e.target.value}))} className={inputCls}>
                {allCatNames.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" value={newHabit.points} onChange={e=>setNewHabit(p=>({...p,points:parseInt(e.target.value)||0}))} placeholder="Points" className={inputCls} min="1" max="100"/>
            </div>
            <div className="flex items-center gap-3">
              <label className={`flex items-center gap-2 text-xs ${T.textDim}`}>
                <input type="checkbox" checked={newHabit.isRepeatable} onChange={e=>setNewHabit(p=>({...p,isRepeatable:e.target.checked}))} className="rounded"/>
                Repeatable
              </label>
              {newHabit.isRepeatable && (
                <input type="number" value={newHabit.maxCompletions} onChange={e=>setNewHabit(p=>({...p,maxCompletions:parseInt(e.target.value)||1}))} className={inputCls+' !w-20 !py-2'} min="1" max="50" placeholder="Max"/>
              )}
            </div>
            <button onClick={async()=>{
              if(!newHabit.name.trim())return;
              try{
                const hid=currentRoom.id+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
                await setDoc(doc(db,'habits',hid),{
                  name:newHabit.name.trim(),category:newHabit.category,points:parseInt(newHabit.points)||10,
                  isRepeatable:newHabit.isRepeatable,maxCompletions:parseInt(newHabit.maxCompletions)||1,
                  roomId:currentRoom.id,createdBy:currentUser.id,createdAt:new Date().toISOString()
                });
                setCustomBoardHabits(prev=>[...prev,hid]);
                setNewHabit({name:'',category:newHabit.category,points:10,isRepeatable:false,maxCompletions:1});
              }catch{setError('Failed to add');}
            }} disabled={!newHabit.name.trim()} className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold active:scale-[0.98] disabled:opacity-40">Add & Select</button>
          </div>
        </details>
        <div className={`text-xs ${T.textDim} mb-3`}>{customBoardHabits.length} habit{customBoardHabits.length!==1?'s':''} selected</div>
        {error&&<p className="text-red-400 text-xs text-center mb-2">{error}</p>}
        {successMsg&&<p className="text-emerald-400 text-xs text-center mb-2">{successMsg}</p>}
        <button onClick={()=>proposeCustomBoard(customBoardHabits)} disabled={customBoardHabits.length===0} className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-40">{activeMembers.filter(m=>m.id!==currentUser?.id).length>0?'Submit for Approval':'Apply Board'}</button>
        {activeMembers.filter(m=>m.id!==currentUser?.id).length>0&&<p className={`text-[10px] ${T.textDim} text-center mt-2`}>Needs majority approval from room members</p>}
      </Modal>

      {/* Room Settings (Creator only) */}
      <Modal show={showRoomSettings} onClose={()=>setShowRoomSettings(false)} wide dark={darkMode}>
        <ModalHeader title="Room Settings" onClose={()=>setShowRoomSettings(false)} icon={<Crown size={16} className="text-amber-400"/>} dark={darkMode}/>
        <div className={`text-[10px] ${T.textDim} mb-4 flex items-center gap-2`}>
          <span className="font-mono tracking-wider bg-white/[0.06] px-2 py-1 rounded">{currentRoom?.code}</span>
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
                <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl border ${darkMode?'border-white/[0.06] bg-white/[0.02]':'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${isCreator?'bg-amber-500/20 text-amber-400':'bg-blue-500/20 text-blue-400'}`}>{m.photoURL?<img src={m.photoURL} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer"/>:m.username?.charAt(0)?.toUpperCase()}</div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-medium ${darkMode?'text-gray-200':'text-gray-800'}`}>{m.username}</span>
                        {isCreator&&<span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">Creator</span>}
                        {isMe&&<span className={`text-[9px] ${T.textDim}`}>(you)</span>}
                      </div>
                      <div className={`text-[10px] ${T.textDim}`}>{m.email}</div>
                    </div>
                  </div>
                  {!isMe && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={()=>transferOwnership(m.id)} className={`text-[9px] px-2 py-1 rounded-lg font-medium transition-all ${darkMode?'text-gray-600 hover:text-amber-400 hover:bg-amber-500/10':'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}>Transfer</button>
                      <button onClick={()=>kickMember(m.id)} className={`text-[9px] px-2 py-1 rounded-lg font-medium transition-all ${darkMode?'text-gray-600 hover:text-red-400 hover:bg-red-500/10':'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}>Remove</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {roomMembers.filter(m=>kickedIds.includes(m.id)).length > 0 && (
            <div className="mt-4">
              <h3 className={`text-xs font-bold ${T.textDim} tracking-wider uppercase mb-2`}>Removed</h3>
              <div className="space-y-2">
                {roomMembers.filter(m=>kickedIds.includes(m.id)).map(m => (
                  <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl border opacity-50 ${darkMode?'border-white/[0.06] bg-white/[0.02]':'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black bg-red-500/20 text-red-400">{m.username?.charAt(0)?.toUpperCase()}</div>
                      <span className={`text-sm font-medium ${darkMode?'text-gray-400':'text-gray-500'}`}>{m.username}</span>
                    </div>
                    <button onClick={async()=>{try{await updateDoc(doc(db,'rooms',currentRoom.id),{kicked:arrayRemove(m.id)});setRoomKicked(prev=>prev.filter(x=>x!==m.id));}catch{}}} className={`text-[9px] px-2 py-1 rounded-lg font-medium transition-all ${darkMode?'text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10':'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>Restore</button>
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
            {roomStakes&&<button onClick={clearStake} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300':'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'}`}><Zap size={15} className="text-red-400 shrink-0"/><div><span className="text-sm">Remove Stake</span><div className={`text-[10px] ${T.textDim}`}>Clear the current room stake</div></div></button>}
            <button onClick={clearAllHabits} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-red-500/5 text-gray-300':'border-gray-200 bg-gray-50 hover:bg-red-50 text-gray-700'}`}><X size={15} className="text-red-400 shrink-0"/><div><span className="text-sm">Clear All Habits</span><div className={`text-[10px] ${T.textDim}`}>Delete every habit in this room</div></div></button>
          </div>
        </div>

        {error&&<p className="text-red-400 text-xs text-center mt-3">{error}</p>}
        {successMsg&&<p className="text-emerald-400 text-xs text-center mt-3">{successMsg}</p>}
      </Modal>

    </div>
  );
}
