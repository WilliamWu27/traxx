import React, { useState, useEffect, useRef } from 'react';
import { Clock, Plus, X, LogOut, Copy, Check, UserPlus, HelpCircle, Trophy, User, Flame, Zap, Star, TrendingUp, ArrowLeftRight, Edit3, Calendar, ChevronLeft, ChevronRight, Crown, Target, ArrowUp, ArrowDown, Minus as MinusIcon, GripVertical, BarChart3, Sun, Moon, ChevronDown } from 'lucide-react';
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

// ─── MODAL WRAPPER ───
function Modal({ show, onClose, children, wide, dark = true }) {
  if (!show) return null;
  const mbg = dark ? 'bg-[#12121a] border-white/[0.06]' : 'bg-white border-gray-200';
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className={`rounded-2xl w-full p-6 border shadow-2xl max-h-[85vh] overflow-y-auto ${mbg} ` + (wide ? 'max-w-md' : 'max-w-sm')} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose, icon }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">{icon}{typeof title === 'string' ? <h2 className="text-lg font-bold text-white">{title}</h2> : title}</div>
      <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors"><X size={20} /></button>
    </div>
  );
}

export default function TraxApp() {
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
  const [newHabit, setNewHabit] = useState({ name: '', category: 'Mind', points: 10, isRepeatable: false, maxCompletions: 1 });
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
    try { const stored = localStorage.getItem('trax-theme'); return stored ? stored === 'dark' : true; } catch { return true; }
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
  const [insightsData, setInsightsData] = useState(null);
  const [streakMilestone, setStreakMilestone] = useState(null);
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
  const toggleTheme = () => { const next = !darkMode; setDarkMode(next); try { localStorage.setItem('trax-theme', next ? 'dark' : 'light'); } catch {} };
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
      { name: 'Study / homework', category: 'Mind', points: 10, isRepeatable: true, maxCompletions: 12, unit: 'per hour' },
      { name: 'Read', category: 'Mind', points: 8, isRepeatable: true, maxCompletions: 6, unit: 'per 30 min' },
      { name: 'Practice a new skill', category: 'Mind', points: 12, isRepeatable: true, maxCompletions: 4, unit: 'per 30 min' },
      { name: 'Work on side project', category: 'Mind', points: 15, isRepeatable: true, maxCompletions: 8, unit: 'per 30 min' },
      { name: 'Workout / exercise', category: 'Body', points: 10, isRepeatable: true, maxCompletions: 8, unit: 'per 30 min' },
      { name: 'Drink water', category: 'Body', points: 2, isRepeatable: true, maxCompletions: 8, unit: 'per glass' },
      { name: 'No junk food', category: 'Body', points: 20, isRepeatable: false, maxCompletions: 1 },
      { name: 'Sleep 7+ hours', category: 'Body', points: 25, isRepeatable: false, maxCompletions: 1 },
      { name: 'Stretch / mobility', category: 'Body', points: 8, isRepeatable: false, maxCompletions: 1 },
      { name: 'Skincare routine', category: 'Body', points: 5, isRepeatable: true, maxCompletions: 2, unit: 'AM/PM' },
      { name: 'Meditate', category: 'Spirit', points: 5, isRepeatable: true, maxCompletions: 6, unit: 'per 5 min' },
      { name: 'Journal', category: 'Spirit', points: 5, isRepeatable: true, maxCompletions: 3, unit: 'per 5 min' },
      { name: 'No social media', category: 'Spirit', points: 20, isRepeatable: false, maxCompletions: 1 },
      { name: 'Maintain organized space', category: 'Spirit', points: 8, isRepeatable: false, maxCompletions: 1 },
      { name: 'Compliment or help someone', category: 'Spirit', points: 8, isRepeatable: true, maxCompletions: 3 },
      { name: 'No vaping / substances', category: 'Spirit', points: 15, isRepeatable: false, maxCompletions: 1 },
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
          mc.forEach(c=>{const h=habits.find(x=>x.id===c.habitId);const cat=h?.category||c.habitCategory||'Mind';catPts[cat]+=(h?.points||c.habitPoints||0)*(c.count||1);});
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
        const dates = [...new Set(snap.docs.map(d=>d.data().date))].sort().reverse();
        let streak = 0;
        const today = getToday(), yStr = getYesterday();
        if (dates.includes(today) || dates.includes(yStr)) {
          let check = dates.includes(today) ? new Date() : new Date(Date.now()-86400000);
          while (dates.includes(formatDateStr(check))) { streak++; check.setDate(check.getDate()-1); }
        }
        // Yesterday's points for solo mode
        const yComps = snap.docs.filter(d => d.data().date === yStr && d.data().roomId === currentRoom.id);
        let yPts = 0;
        yComps.forEach(d => {
          const data = d.data();
          // Use stored points if available (orphan-proof), else look up habit
          const pts = data.habitPoints || habits.find(h=>h.id===data.habitId)?.points || 0;
          yPts += pts * (data.count || 1);
        });
        setYesterdayPoints(yPts);
        // Check for streak milestone (tier thresholds)
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
    try {
      await setDoc(doc(db, 'stakes', currentRoom.id), { type: newStake.type, description: newStake.description.trim(), duration: newStake.duration, createdBy: currentUser.id, createdAt: new Date().toISOString(), roomId: currentRoom.id, active: true });
      setShowStakes(false);
    } catch (err) { setError('Failed to save stakes'); }
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
        roomId: currentRoom.id, createdBy: currentUser.id, createdAt: new Date().toISOString()
      });
      // Auto-add to personal board if one exists
      if (myBoardIds) {
        const boardDocId = currentUser.id+'_'+currentRoom.id;
        await setDoc(doc(db, 'myBoard', boardDocId), { habitIds: [...myBoardIds, hid], userId: currentUser.id, roomId: currentRoom.id });
      }
      setNewHabit({ name:'', category:'Mind', points:10, isRepeatable:false, maxCompletions:1 }); setShowAddHabit(false);
    } catch { setError('Failed to add'); }
  };
  const saveEditHabit = async () => {
    if (!showEditHabit || !editHabitData.name?.trim()) return;
    try {
      await updateDoc(doc(db, 'habits', showEditHabit), {
        name: editHabitData.name.trim(), category: editHabitData.category,
        points: parseInt(editHabitData.points)||10, isRepeatable: editHabitData.isRepeatable,
        maxCompletions: parseInt(editHabitData.maxCompletions)||1
      });
      setShowEditHabit(null);
    } catch { setError('Failed to save'); }
  };
  const deleteHabit = async (hid) => { if (!confirm('Delete this habit?')) return; try { await deleteDoc(doc(db, 'habits', hid)); } catch {} };
  const openEditHabit = (habit) => { setEditHabitData({ name: habit.name, category: habit.category, points: habit.points, isRepeatable: habit.isRepeatable, maxCompletions: habit.maxCompletions }); setShowEditHabit(habit.id); };

  // ─── COMPLETIONS (with embedded habit data for orphan-proofing) ───
  const getExisting = (hid) => { const t = getToday(); return completions.find(c=>c.userId===currentUser.id&&c.habitId===hid&&c.date===t); };

  // Mystery bonus: 10% chance 2x, 1% chance jackpot (5x)
  const rollBonus = () => {
    const roll = Math.random();
    if (roll < 0.01) return { multi: 5, label: '🎰 JACKPOT! 5×', type: 'jackpot' };
    if (roll < 0.10) return { multi: 2, label: '✨ 2× BONUS!', type: 'bonus' };
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
    try { if(ex.count>1) await updateDoc(doc(db,'completions',ex.id),{count:ex.count-1}); else await deleteDoc(doc(db,'completions',ex.id)); } catch(err){console.error(err);}
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
  const getCatPts = (uid, cat) => completions.filter(c=>c.userId===uid&&c.date===getToday()).reduce((s,c)=>{ const h=habits.find(x=>x.id===c.habitId); if(h&&h.category===cat) return s+(h.points*(c.count||1)); return s; },0);
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
  const getTodayPts = (uid) => completions.filter(c=>c.userId===uid&&c.date===getToday()).reduce((s,c)=>{ const h=habits.find(x=>x.id===c.habitId); return s+((h?.points||c.habitPoints||0)*(c.count||1)); },0);
  const getWeeklyPts = (uid) => { const ws=getWeekStart(),we=getWeekEnd(); return allCompletions.filter(c=>c.userId===uid&&c.date>=ws&&c.date<=we).reduce((s,c)=>{ const h=habits.find(x=>x.id===c.habitId); return s+((h?.points||c.habitPoints||0)*(c.count||1)); },0); };
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
  const getDailyProgress = () => { const dh=myBoardIds?habits.filter(h=>myBoardIds.includes(h.id)):habits; if(!dh.length)return 0; let tm=0,td=0; dh.forEach(h=>{const mx=h.isRepeatable?(h.maxCompletions||1):1;tm+=mx;td+=Math.min(getCount(h.id),mx);}); return tm>0?td/tm:0; };
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
    { name:'Mind', colorIdx:0, icon:'🧠' },
    { name:'Body', colorIdx:1, icon:'💪' },
    { name:'Spirit', colorIdx:2, icon:'✨' },
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
    if (['Mind','Body','Spirit'].includes(catName)) { setError("Can't delete default categories"); setTimeout(()=>setError(''),2000); return; }
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
        <h1 className="text-4xl font-black tracking-[0.4em] text-white mb-5">TRAX</h1>
        <div className="flex justify-center gap-2">{['bg-blue-500','bg-orange-500','bg-emerald-500'].map((c,i)=><div key={i} className={`w-1.5 h-1.5 rounded-full ${c} animate-pulse`} style={{animationDelay:i*200+'ms'}} />)}</div>
      </div>
    </div>
  );

  const myCr = currentUser&&currentRoom ? getTodayCrystals(currentUser.id) : {};
  const myPts = currentUser&&currentRoom ? getTodayPts(currentUser.id) : 0;
  const isPerfect = allCatNames.length > 0 && allCatNames.every(c => myCr[c]);
  const dailyProg = currentUser&&currentRoom ? getDailyProgress() : 0;
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
            <h1 className="text-5xl font-black tracking-[0.35em] text-white mb-2">TRAX</h1>
            <p className="text-gray-600 text-[11px] tracking-[0.25em] uppercase font-medium">Compete · Track · Dominate</p>
          </div>

          {/* Feature cards */}
          <div className="space-y-3 mb-8">
            {[
              { icon: '🎯', title: 'Track Daily Habits', desc: 'Mind, Body & Spirit. Earn points for every completion.', color: 'from-blue-500/10 to-blue-600/5' },
              { icon: '🔥', title: 'Streak Multipliers', desc: 'Stay consistent → earn up to 2× points.', color: 'from-orange-500/10 to-red-600/5' },
              { icon: '🏆', title: 'Compete with Friends', desc: 'Real-time leaderboards. Set stakes. Win bragging rights.', color: 'from-amber-500/10 to-yellow-600/5' },
              { icon: '💎', title: 'Win Crystals', desc: 'Dominate a category to earn glowing crystal rewards.', color: 'from-purple-500/10 to-indigo-600/5' },
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
            <h1 className="text-4xl font-black tracking-[0.3em] text-white mb-1">TRAX</h1>
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
              <p className="text-gray-500 text-sm leading-relaxed">TRAX turns your daily habits into a competition.<br/>Let's get you set up in 30 seconds.</p>
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
    { icon: '💎', title: 'Win crystals', desc: 'Score the most points in any category (Mind, Body, Spirit) to earn a glowing crystal for the day.' },
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
          <div className={`px-6 py-3 rounded-2xl shadow-2xl text-center ${bonusMsg.type==='jackpot'?'bg-gradient-to-r from-amber-500 to-yellow-500 text-black':'bg-gradient-to-r from-purple-600 to-blue-600 text-white'}`}>
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
      {/* Header */}
      <div className={`${T.headerBg} ${T.blurBg} border-b ${T.border} sticky top-0 z-40`}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-[0.2em]">TRAX</h1>
              <span className={`text-[8px] ${T.textDim}`}>v9</span>
              <div className="flex gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"/><div className="w-1.5 h-1.5 rounded-full bg-orange-500"/><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/></div>
              <button onClick={()=>setShowSwitchRoom(true)} className={`ml-2 flex items-center gap-1 px-2 py-1 ${T.bgCard} border ${T.border} rounded-lg text-[10px] ${T.textMuted} hover:${T.text} transition-all`}><span className="font-mono tracking-wider">{currentRoom?.code}</span>{userRooms.length>1&&<ArrowLeftRight size={10}/>}</button>
              {isRoomCreator&&<button onClick={()=>setShowRoomSettings(true)} className={`p-1.5 ${T.textDim} hover:text-amber-400 transition-colors`} title="Room Settings"><Crown size={13}/></button>}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={()=>setShowLeaderboard(true)} className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/20 text-amber-400 rounded-lg hover:border-amber-500/40 transition-all text-xs font-semibold"><Trophy size={12}/></button>
              {roomStakes&&<button onClick={()=>setShowStakes(true)} className="p-1.5 text-red-400"><Zap size={14}/></button>}
              <button onClick={()=>{setHistoryDate(getYesterday());loadHistoryDate(getYesterday());setShowHistory(true);}} className={`p-1.5 ${T.textDim} hover:${T.text} transition-colors`}><Calendar size={14}/></button>
              {lastWeekData&&<button onClick={()=>setShowWeeklyRecap(true)} className={`p-1.5 ${T.textDim} hover:text-purple-400 transition-colors`}><BarChart3 size={14}/></button>}
              <button onClick={()=>setShowInviteModal(true)} className={`p-1.5 ${T.textDim} hover:${T.text} transition-colors`}><UserPlus size={14}/></button>
              <button onClick={toggleTheme} className={`p-1.5 ${T.textDim} hover:text-amber-400 transition-colors`}>{darkMode?<Sun size={14}/>:<Moon size={14}/>}</button>
              <button onClick={()=>setShowProfile(true)} className={`p-2 ${T.textDim} hover:${T.text} transition-colors`}><User size={16}/></button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Greeting */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div><h2 className="text-lg font-bold">{getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400">{currentUser.username}</span></h2><p className="text-gray-600 text-xs mt-0.5 italic">{getMotivation()}</p></div>
            {streakData.streak>0&&<div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full"><Flame size={14} className="text-orange-400"/><span className="text-orange-400 text-sm font-bold">{streakData.streak}</span>{streakMulti.multi>1&&<span className={`text-[9px] font-bold ${streakMulti.color} ml-0.5`}>{streakMulti.label}</span>}</div>}
          </div>

          {/* Weekly winner / countdown banner */}
          {weeklyWinner && (
            <div className="mb-3 p-3 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/15 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2"><Crown size={14} className="text-amber-400"/><span className="text-sm text-amber-300 font-medium">{weeklyWinner.member.username}</span>{getRoomRole(weeklyWinner.member.id)&&<span className={`text-[9px] font-bold ${getRoomRole(weeklyWinner.member.id).color}`}>{getRoomRole(weeklyWinner.member.id).icon} {getRoomRole(weeklyWinner.member.id).role}</span>}<span className={`text-xs ${T.textDim}`}>leads this week</span></div>
              <span className={`text-[10px] ${T.textDim}`}>{weeklyWinner.daysLeft > 0 ? weeklyWinner.daysLeft+'d left' : timeDisplay+' left'}</span>
            </div>
          )}

          {/* Solo mode banner */}
          {soloMode && (
            <div className="mb-3 p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/15 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2"><Target size={14} className="text-purple-400"/><span className="text-sm text-purple-300">Solo mode — beat yesterday's {yesterdayPoints} pts</span></div>
              {myPts > yesterdayPoints && myPts > 0 && <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5"><ArrowUp size={10}/>Ahead!</span>}
            </div>
          )}

          {/* Stakes banner */}
          {roomStakes && <button onClick={()=>setShowStakes(true)} className="w-full mb-3 p-3 bg-gradient-to-r from-red-500/10 via-pink-500/10 to-purple-500/10 border border-red-500/15 rounded-xl flex items-center justify-between hover:border-red-500/30 transition-all"><div className="flex items-center gap-2"><Zap size={14} className="text-red-400"/><span className="text-sm text-red-300 font-medium">{roomStakes.description}</span></div><span className="text-[10px] text-gray-600 uppercase tracking-wider">{roomStakes.duration}</span></button>}

          {/* Progress bar */}
          <div className="relative h-2 bg-white/[0.04] rounded-full overflow-hidden"><div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out" style={{width:(dailyProg*100)+'%',background:dailyProg>=1?'linear-gradient(90deg,#10b981,#34d399)':'linear-gradient(90deg,#3b82f6,#8b5cf6,#10b981)'}}/></div>
          <div className="flex justify-between mt-1.5"><span className={`text-[10px] ${T.textDim}`}>{dailyProg>=1?'🎉 All habits complete!':Math.round(dailyProg*100)+'% daily progress'}</span><span className={`text-[10px] ${T.textDim}`}>{timeDisplay} left</span></div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className={`relative ${T.bgCard} rounded-2xl border ${T.border} p-4 overflow-hidden`}><div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl -translate-y-4 translate-x-4"/><div className={`${T.textMuted} text-[10px] tracking-wider uppercase mb-1 flex items-center gap-1`}><Zap size={9}/>Points</div><div className={`text-2xl font-black ${darkMode?'text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400':''}`}>{myPts}</div></div>
          <div className={`relative ${T.bgCard} rounded-2xl border ${T.border} p-4 overflow-hidden`}><div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 rounded-full blur-xl -translate-y-4 translate-x-4"/><div className={`${T.textMuted} text-[10px] tracking-wider uppercase mb-1 flex items-center gap-1`}><Flame size={9}/>Streak</div><div className="flex items-baseline gap-1.5"><span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-orange-300 to-orange-600">{streakData.streak||0}<span className={`text-sm font-medium ${T.textDim} ml-1`}>d</span></span>{streakMulti.multi>1&&<span className={`text-[9px] font-bold ${streakMulti.color} ${streakMulti.bg} px-1.5 py-0.5 rounded-full`}>{streakMulti.label}</span>}</div>{(()=>{const s=streakData.streak||0;const tiers=[3,7,14,30,60];const next=tiers.find(t=>t>s);if(!next)return null;const prev=tiers[tiers.indexOf(next)-1]||0;const pct=((s-prev)/(next-prev))*100;return<div className="mt-1.5"><div className={`h-1 rounded-full overflow-hidden ${darkMode?'bg-white/[0.06]':'bg-gray-200'}`}><div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-400 transition-all" style={{width:pct+'%'}}/></div><div className={`text-[8px] ${T.textDim} mt-0.5`}>{next-s}d to next tier</div></div>;})()}</div>
          <div className={`relative ${T.bgCard} rounded-2xl border ${T.border} p-4 overflow-hidden`}><div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-full blur-xl -translate-y-4 translate-x-4"/><div className={`${T.textMuted} text-[10px] tracking-wider uppercase mb-2`}>Crystals{isPerfect&&<span className="text-amber-400 ml-1">&#9830;</span>}</div><div className="flex items-center gap-2.5">{allCatNames.map(c=><div key={c} className={'w-5 h-5 rounded-full transition-all duration-500 '+(myCr[c]?getCT(c).bg+' shadow-md '+getCT(c).glow:darkMode?'bg-white/[0.06] border border-white/[0.08]':'bg-gray-200 border border-gray-300')}/>)}</div></div>
        </div>

        {/* ─── RIVAL STATUS (always visible) ─── */}
        {rivalStatus.length > 0 && (
          <div className={`mb-4 rounded-2xl border ${T.border} ${T.bgCard} overflow-hidden`}>
            <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
              <span className={`text-[10px] font-bold tracking-wider uppercase ${T.textMuted}`}>Rival Status</span>
              <span className={`text-[10px] ${T.textDim}`}>Live</span>
            </div>
            <div className="divide-y divide-white/[0.04]">{rivalStatus.slice(0,3).map(r => {
              const role = getRoomRole(r.member.id);
              const ahead = r.pts > myPts;
              const diff = Math.abs(r.pts - myPts);
              return (
                <div key={r.member.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${ahead?'bg-red-500/20 text-red-400':'bg-emerald-500/20 text-emerald-400'}`}>{r.member.username?.charAt(0)?.toUpperCase()}</div>
                    <div>
                      <div className="flex items-center gap-1.5"><span className={`text-sm font-medium ${darkMode?'text-gray-300':'text-gray-700'}`}>{r.member.username}</span>{role&&<span className={`text-[9px] ${role.color} font-semibold`}>{role.icon} {role.role}</span>}</div>
                      <div className={`text-[10px] ${T.textDim}`}>{r.habitCount===0?'No habits logged yet':r.habitCount+' habit'+(r.habitCount>1?'s':'')+' today'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${ahead?'text-red-400':'text-emerald-400'}`}>{r.pts} pts</div>
                    {diff>0&&<div className={`text-[9px] font-medium ${ahead?'text-red-400/70':'text-emerald-400/70'}`}>{ahead?'+'+diff+' ahead':''+diff+' behind'}</div>}
                  </div>
                </div>
              );
            })}</div>
            {/* Loss aversion nudge */}
            {myPts === 0 && rivalStatus.some(r=>r.pts>0) && (
              <div className="px-4 py-2 bg-red-500/5 border-t border-red-500/10">
                <p className="text-[10px] text-red-400">⚠️ Your rivals are logging. You haven't started today.</p>
              </div>
            )}
            {myPts > 0 && rivalStatus[0]?.pts > myPts && (
              <div className="px-4 py-2 bg-amber-500/5 border-t border-amber-500/10">
                <p className="text-[10px] text-amber-400">📉 You're {rivalStatus[0].pts - myPts} pts behind {rivalStatus[0].member.username}. Keep pushing.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── ACTIVITY FEED ─── */}
        {activityFeed.length > 0 && (
          <div className={`mb-4 rounded-2xl border ${T.border} ${T.bgCard} overflow-hidden`}>
            <div className="px-4 py-2.5 border-b border-white/[0.04]">
              <span className={`text-[10px] font-bold tracking-wider uppercase ${T.textMuted}`}>Activity</span>
            </div>
            <div className="max-h-32 overflow-y-auto divide-y divide-white/[0.04]">{activityFeed.slice(0,8).map(a => {
              const isMe = a.userId === currentUser.id;
              const ts = a.ts ? new Date(a.ts) : null;
              const timeAgo = ts ? (Math.floor((Date.now()-ts.getTime())/60000)<60 ? Math.floor((Date.now()-ts.getTime())/60000)+'m ago' : Math.floor((Date.now()-ts.getTime())/3600000)+'h ago') : '';
              return (
                <div key={a.id} className="px-4 py-2 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs ${isMe?'text-blue-400':'text-gray-400'} font-medium`}>{isMe?'You':a.username}</span>
                    <span className={`text-xs ${T.textDim} ml-1.5`}>{a.text}</span>
                    {a.bonus==='jackpot'&&<span className="ml-1 text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">JACKPOT</span>}
                    {a.bonus==='bonus'&&<span className="ml-1 text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full font-bold">2×</span>}
                  </div>
                  <span className={`text-[9px] ${T.textFaint} shrink-0 ml-2`}>{timeAgo}</span>
                </div>
              );
            })}</div>
          </div>
        )}

        {/* ─── WEEKLY DRAMA COUNTDOWN (Sunday) ─── */}
        {weeklyWinner && weeklyWinner.daysLeft <= 1 && activeMembers.length > 1 && (
          <div className="mb-4 p-4 bg-gradient-to-r from-amber-500/10 via-red-500/10 to-purple-500/10 border border-amber-500/20 rounded-2xl text-center">
            <div className="text-2xl mb-1">{weeklyWinner.daysLeft === 0 ? '⏰' : '⚡'}</div>
            <div className="text-sm font-bold text-amber-300">{weeklyWinner.daysLeft === 0 ? 'Final Hours — '+timeDisplay+' to go' : 'Final Day — Last Chance'}</div>
            <div className={`text-xs ${T.textDim} mt-1`}>{weeklyWinner.member.username} leads with {weeklyWinner.pts} pts</div>
          </div>
        )}

        {/* Board approval requests from other members */}
        {boardRequests.length > 0 && boardRequests.map(br => (
          <div key={br.id} className={`mb-3 p-3 rounded-xl border ${darkMode?'bg-purple-500/5 border-purple-500/15':'bg-purple-50 border-purple-200'}`}>
            <div className="flex items-center justify-between">
              <div><span className="text-sm font-medium text-purple-400">{br.username}</span><span className={`text-xs ${T.textDim} ml-1`}>wants a custom board</span></div>
              <div className="flex gap-2">
                <button onClick={()=>voteOnBoard(br,true)} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg hover:bg-emerald-500/30">Approve</button>
                <button onClick={()=>voteOnBoard(br,false)} className="px-3 py-1 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg hover:bg-red-500/30">Deny</button>
              </div>
            </div>
            <div className={`text-[10px] ${T.textDim} mt-1`}>{br.habitIds?.length||0} habits selected · {(br.approvals||[]).length} approval(s) so far</div>
          </div>
        ))}

        {/* Board indicator */}
        {boardActive && (
          <div className={`mb-3 p-2.5 rounded-xl border flex items-center justify-between ${darkMode?'bg-indigo-500/5 border-indigo-500/15':'bg-indigo-50 border-indigo-200'}`}>
            <span className="text-[10px] text-indigo-400 font-medium">🎯 Custom Board — {myBoardIds?.length||0} of {habits.length} habits</span>
            <button onClick={resetBoard} className="text-[10px] text-gray-500 hover:text-red-400">Show All</button>
          </div>
        )}

        {/* Toolbar: Heat Map, Insights, Reorder */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
          <div className="flex gap-1">
            <button onClick={loadHeatMap} className={`text-[10px] font-medium tracking-wider uppercase px-3 py-1.5 rounded-lg transition-all ${T.textDim} hover:text-purple-400`}>📊 Map</button>
            <button onClick={loadInsights} className={`text-[10px] font-medium tracking-wider uppercase px-3 py-1.5 rounded-lg transition-all ${T.textDim} hover:text-blue-400`}>📈 Insights</button>
            <button onClick={()=>{setCustomBoardHabits(myBoardIds||habits.map(h=>h.id));setShowCustomBoard(true);}} className={`text-[10px] font-medium tracking-wider uppercase px-3 py-1.5 rounded-lg transition-all ${T.textDim} hover:text-indigo-400`}>🎯 Board</button>
          </div>
          <div className="flex gap-1">
            {habits.length>0&&<button onClick={()=>setEditMode(!editMode)} className={'text-[10px] font-medium tracking-wider uppercase px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 '+(editMode?'bg-blue-500/20 text-blue-400 border border-blue-500/30':T.textDim+' hover:text-gray-400')}>{editMode?'Done':'✏️ Edit Board'}</button>}
          </div>
        </div>
        {editMode && (
          <div className={`mb-3 p-3 rounded-xl border ${darkMode?'bg-blue-500/5 border-blue-500/15':'bg-blue-50 border-blue-200'}`}>
            <p className={`text-[10px] ${darkMode?'text-blue-300':'text-blue-600'}`}>
              <strong>Editing:</strong> Drag to reorder · <span className="text-indigo-400">✓</span> to show/hide habits on your board · ✏️ to edit · ✕ to delete
            </p>
          </div>
        )}

        {/* Habits */}
        <div className="space-y-6">
          {allCatNames.map(cat => {
            const ch = getOrderedHabits(cat); if(!ch.length) return null;
            const t = getCT(cat);
            return (
              <div key={cat}>
                <div className="flex items-center gap-2.5 mb-3 px-1"><span className="text-sm">{t.icon}</span><h2 className={'text-[11px] font-bold tracking-[0.2em] uppercase '+t.txt}>{t.label}</h2><div className={'flex-1 h-px ml-1 '+(darkMode?'bg-white/[0.04]':'bg-gray-200')}/><span className={'text-[10px] font-semibold '+t.txt}>{getCatPts(currentUser.id,cat)} pts</span></div>
                <div className="space-y-2">{ch.map((h, idx) => {
                  const cnt = getCount(h.id), mx = h.isRepeatable?(h.maxCompletions||1):1, done=cnt>0, maxed=cnt>=mx, pct=mx>0?cnt/mx:0;
                  return (
                    <div key={h.id}
                      draggable={editMode}
                      onDragStart={editMode?(e)=>{e.dataTransfer.setData('text/plain',cat+'|'+idx);e.dataTransfer.effectAllowed='move';}:undefined}
                      onDragOver={editMode?(e)=>{e.preventDefault();}:undefined}
                      onDrop={editMode?(e)=>{e.preventDefault();const data=e.dataTransfer.getData('text/plain');const [srcCat,srcIdx]=data.split('|');if(srcCat!==cat)return;const ni=parseInt(srcIdx);if(ni===idx)return;const arr=[...ch];const [moved]=arr.splice(ni,1);arr.splice(idx,0,moved);saveHabitOrder(cat,arr);}:undefined}
                      className={'relative rounded-xl p-3 flex items-center justify-between transition-all border '+(editMode?'cursor-grab active:cursor-grabbing ':'')+
                        (editMode && !isOnBoard(h.id)?'opacity-40 ':'')+
                        (maxed?t.bdr+' '+(darkMode?t.bgS:'bg-white')+' shadow-lg '+t.glow:done?t.bdr+' '+(darkMode?t.bgS:'bg-white'):darkMode?'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.03]':'border-gray-200 bg-white hover:bg-gray-50')+
                        (maxedHabit===h.id?' animate-pulse ring-2 ring-offset-2 ring-offset-transparent':'')}>
                      {/* Maxout flash overlay */}
                      {maxedHabit===h.id&&<div className="absolute inset-0 rounded-xl animate-ping opacity-20" style={{backgroundColor:t.neon}}/>}
                      {mx>1&&<div className={'absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden '+(darkMode?'bg-white/[0.03]':'bg-gray-100')}><div className="h-full rounded-full transition-all duration-500" style={{width:(pct*100)+'%',backgroundColor:t.neon}}/></div>}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {editMode?<div className={darkMode?'text-gray-600':'text-gray-400'}><GripVertical size={16}/></div>:(
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={()=>handleDecrement(h.id)} disabled={cnt===0} className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-90 '+(cnt===0?'border '+(darkMode?'border-white/[0.06] text-gray-700':'border-gray-200 text-gray-300')+' cursor-not-allowed':'border-2 '+t.bdr+' '+t.txt)}>&minus;</button>
                          <div className={'w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-black transition-all duration-300 '+(maxed?t.bg+' border-transparent text-white shadow-lg '+t.glow+' scale-110':done?'border-current '+t.txt+' '+t.bgM:'border-'+(darkMode?'white/[0.08]':'gray-200')+' '+(darkMode?'text-gray-600':'text-gray-400')+' '+(darkMode?'bg-white/[0.02]':'bg-gray-50'))}>{maxed?'✓':cnt}</div>
                          <button onClick={()=>handleIncrement(h.id)} disabled={maxed} className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-90 '+(maxed?'border '+(darkMode?'border-white/[0.06] text-gray-700':'border-gray-200 text-gray-300')+' cursor-not-allowed':'border-2 '+t.bdr+' '+t.txt)}>+</button>
                        </div>)}
                        <div className="min-w-0 flex-1">
                          <div className={'text-sm font-medium truncate '+(done?(darkMode?'text-gray-200':'text-gray-800'):(darkMode?'text-gray-500':'text-gray-600'))}>{h.name}</div>
                          <div className={(darkMode?'text-gray-600':'text-gray-400')+' text-[11px] flex items-center gap-1.5 flex-wrap'}><span>{h.points}pts</span><span>&middot;</span><span className={maxed?'font-bold '+t.txtB:''}>{cnt}/{mx}</span>{h.unit&&<span>{h.unit}</span>}{maxed&&<span className={t.pill+' text-[9px] font-bold px-1.5 py-0.5 rounded-full'+(maxedHabit===h.id?' animate-bounce':'')}>✓ MAXED</span>}</div>
                        </div>
                      </div>
                      {editMode&&<div className="flex items-center gap-0.5 shrink-0 ml-1">
                        <button onClick={()=>toggleHabitOnBoard(h.id)} title={isOnBoard(h.id)?'Hide from board':'Show on board'} className={'p-1.5 transition-colors '+(isOnBoard(h.id)?(darkMode?'text-indigo-400 hover:text-indigo-300':'text-indigo-500 hover:text-indigo-400'):(darkMode?'text-gray-700 hover:text-indigo-400':'text-gray-400 hover:text-indigo-500'))}>{isOnBoard(h.id)?<Check size={11}/>:<MinusIcon size={11}/>}</button>
                        <button onClick={()=>openEditHabit(h)} className={'p-1.5 transition-colors '+(darkMode?'text-gray-700 hover:text-blue-400':'text-gray-400 hover:text-blue-500')}><Edit3 size={11}/></button>
                        <button onClick={()=>deleteHabit(h.id)} className={'p-1.5 transition-colors '+(darkMode?'text-gray-700 hover:text-red-400':'text-gray-400 hover:text-red-500')}><X size={12}/></button>
                      </div>}
                    </div>
                  );
                })}</div>
              </div>
            );
          })}
          {habits.length===0 ? (
            <div className="text-center py-16"><div className="text-5xl mb-4">&#x1F3AF;</div><p className="text-gray-500 text-sm mb-5">No habits yet</p><button onClick={()=>setShowAddHabit(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/20 text-sm font-bold active:scale-[0.98]"><Plus size={18}/>Add Habits</button></div>
          ) : (
            <div className="flex gap-2">
              <button onClick={()=>setShowAddHabit(true)} className={'flex-1 border border-dashed rounded-xl p-4 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 flex items-center justify-center gap-2 transition-all '+(darkMode?'border-white/[0.08] text-gray-600':'border-gray-300 text-gray-400')}><Plus size={15}/><span className="text-xs font-medium tracking-wide">Add Habit</span></button>
              <button onClick={()=>setShowAddCategory(true)} className={'border border-dashed rounded-xl p-4 hover:text-purple-400 hover:border-purple-500/30 hover:bg-purple-500/5 flex items-center justify-center gap-2 transition-all '+(darkMode?'border-white/[0.08] text-gray-600':'border-gray-300 text-gray-400')}><span className="text-xs font-medium tracking-wide">+ Category</span></button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Add Habit */}
      <Modal show={showAddHabit} onClose={()=>setShowAddHabit(false)}>
        <ModalHeader title="Add Habit" onClose={()=>setShowAddHabit(false)}/>
        <button onClick={loadDefaultHabits} disabled={loading} className="w-full mb-5 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl shadow-lg shadow-violet-500/20 text-sm font-bold active:scale-[0.98] disabled:opacity-50">{loading?'Loading...':'⚡ Load Defaults (16 habits)'}</button>
        <div className="space-y-3">
          <input type="text" placeholder="Habit name" value={newHabit.name} onChange={e=>setNewHabit({...newHabit,name:e.target.value})} className={inputCls}/>
          <div className="grid grid-cols-2 gap-3">
            <select value={newHabit.category} onChange={e=>setNewHabit({...newHabit,category:e.target.value})} className={inputCls}>{allCatNames.map(c=><option key={c} value={c} className={darkMode?'bg-[#12121a]':'bg-white'}>{c}</option>)}</select>
            <input type="number" placeholder="Points" value={newHabit.points} onChange={e=>setNewHabit({...newHabit,points:e.target.value})} className={inputCls}/>
          </div>
          <label className="flex items-center gap-3 py-1 cursor-pointer"><input type="checkbox" checked={newHabit.isRepeatable} onChange={e=>setNewHabit({...newHabit,isRepeatable:e.target.checked,maxCompletions:e.target.checked?5:1})} className="w-4 h-4 rounded accent-blue-500"/><span className="text-sm text-gray-400">Repeatable</span></label>
          {newHabit.isRepeatable&&<input type="number" placeholder="Max per day" value={newHabit.maxCompletions} onChange={e=>setNewHabit({...newHabit,maxCompletions:e.target.value})} className={inputCls}/>}
          {error&&<p className="text-red-400 text-xs text-center">{error}</p>}
          <div className="flex gap-3 pt-2"><button onClick={()=>setShowAddHabit(false)} className="flex-1 px-4 py-3 border border-white/[0.08] rounded-xl text-sm text-gray-400 hover:bg-white/[0.04]">Cancel</button><button onClick={addHabit} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]">Add</button></div>
        </div>
      </Modal>

      {/* Edit Habit */}
      <Modal show={!!showEditHabit} onClose={()=>setShowEditHabit(null)}>
        <ModalHeader title="Edit Habit" onClose={()=>setShowEditHabit(null)} icon={<Edit3 size={18} className="text-blue-400"/>}/>
        <div className="space-y-3">
          <input type="text" placeholder="Name" value={editHabitData.name||''} onChange={e=>setEditHabitData({...editHabitData,name:e.target.value})} className={inputCls}/>
          <div className="grid grid-cols-2 gap-3">
            <select value={editHabitData.category||allCatNames[0]} onChange={e=>setEditHabitData({...editHabitData,category:e.target.value})} className={inputCls}>{allCatNames.map(c=><option key={c} value={c} className={darkMode?'bg-[#12121a]':'bg-white'}>{c}</option>)}</select>
            <input type="number" placeholder="Points" value={editHabitData.points||''} onChange={e=>setEditHabitData({...editHabitData,points:e.target.value})} className={inputCls}/>
          </div>
          <label className="flex items-center gap-3 py-1 cursor-pointer"><input type="checkbox" checked={editHabitData.isRepeatable||false} onChange={e=>setEditHabitData({...editHabitData,isRepeatable:e.target.checked,maxCompletions:e.target.checked?5:1})} className="w-4 h-4 rounded accent-blue-500"/><span className="text-sm text-gray-400">Repeatable</span></label>
          {editHabitData.isRepeatable&&<input type="number" placeholder="Max per day" value={editHabitData.maxCompletions||''} onChange={e=>setEditHabitData({...editHabitData,maxCompletions:e.target.value})} className={inputCls}/>}
          <div className="flex gap-3 pt-2"><button onClick={()=>setShowEditHabit(null)} className="flex-1 px-4 py-3 border border-white/[0.08] rounded-xl text-sm text-gray-400 hover:bg-white/[0.04]">Cancel</button><button onClick={saveEditHabit} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]">Save</button></div>
        </div>
      </Modal>

      {/* Add Category */}
      <Modal show={showAddCategory} onClose={()=>setShowAddCategory(false)} dark={darkMode}>
        <ModalHeader title="Manage Categories" onClose={()=>setShowAddCategory(false)}/>
        <div className="space-y-2 mb-5">{activeCategories.map(cat => {
          const ct = getCT(cat.name);
          return (
            <div key={cat.name} className={`flex items-center justify-between p-3 rounded-xl border ${ct.bdr} ${ct.bgS}`}>
              <div className="flex items-center gap-2"><span>{cat.icon}</span><span className={`text-sm font-semibold ${ct.txt}`}>{cat.name}</span></div>
              {!['Mind','Body','Spirit'].includes(cat.name) && <button onClick={()=>deleteCategory(cat.name)} className="text-[10px] text-gray-600 hover:text-red-400 uppercase tracking-wider">Remove</button>}
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
      <Modal show={showHistory} onClose={()=>setShowHistory(false)}>
        <ModalHeader title="History" onClose={()=>setShowHistory(false)} icon={<Calendar size={18} className="text-purple-400"/>}/>
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
              const cat = h?.category || c.habitCategory || 'Mind';
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
      <Modal show={showStakes} onClose={()=>setShowStakes(false)}>
        <ModalHeader title="Stakes" onClose={()=>setShowStakes(false)} icon={<Zap size={18} className="text-red-400"/>}/>
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
            <p className="text-gray-500 text-sm mb-4">Set what's on the line. The weekly loser pays up.</p>
            <div className="grid grid-cols-2 gap-2 mb-4">{stakePresets.map(sp=>(
              <button key={sp.type} onClick={()=>setNewStake({...newStake,type:sp.type,description:''})} className={'p-3 rounded-xl border text-left transition-all '+(newStake.type===sp.type?'border-red-500/40 bg-red-500/10':'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]')}><div className={'text-xs font-bold mb-0.5 '+(newStake.type===sp.type?'text-red-400':'text-gray-400')}>{sp.label}</div><div className="text-[10px] text-gray-600">{sp.desc}</div></button>
            ))}</div>
            <input type="text" placeholder={stakePresets.find(s=>s.type===newStake.type)?.ph||'Describe...'} value={newStake.description} onChange={e=>setNewStake({...newStake,description:e.target.value})} className={inputCls+' mb-3'}/>
            <div className="flex gap-2 mb-4">{['weekly','monthly'].map(d=><button key={d} onClick={()=>setNewStake({...newStake,duration:d})} className={'flex-1 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wider '+(newStake.duration===d?'bg-white/[0.08] text-white':'bg-white/[0.02] text-gray-600')}>{d}</button>)}</div>
            <button onClick={saveStake} disabled={!newStake.description.trim()} className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 active:scale-[0.98] disabled:opacity-40">Set Stakes</button>
          </div>
        )}
      </Modal>

      {/* Switch Room */}
      <Modal show={showSwitchRoom} onClose={()=>setShowSwitchRoom(false)}>
        <ModalHeader title="Your Rooms" onClose={()=>setShowSwitchRoom(false)}/>
        <div className="space-y-2 mb-4">{userRooms.map(rid=>(
          <div key={rid} className={'p-3 rounded-xl border flex items-center justify-between transition-all '+(currentRoom?.id===rid?'border-blue-500/30 bg-blue-500/10':'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]')}>
            <div className="flex items-center gap-3"><span className="font-mono text-sm tracking-widest text-white">{rid}</span>{currentRoom?.id===rid&&<span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}</div>
            <div className="flex items-center gap-2">{currentRoom?.id!==rid&&<button onClick={()=>switchRoom(rid)} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium uppercase tracking-wider">Switch</button>}<button onClick={()=>leaveRoom(rid)} className="text-[10px] text-gray-600 hover:text-red-400 font-medium uppercase tracking-wider">Leave</button></div>
          </div>
        ))}</div>
        <div className="border-t border-white/[0.06] pt-4"><p className="text-xs text-gray-500 mb-3">Join another room</p><div className="flex gap-2"><input type="text" placeholder="CODE" value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase())} className="flex-1 px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-gray-600 text-sm font-mono tracking-[0.2em] text-center" maxLength={6}/><button onClick={joinRoom} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]">Join</button></div>{error&&<p className="text-red-400 text-xs mt-2 text-center">{error}</p>}</div>
        <button onClick={createRoom} className="w-full mt-3 px-4 py-2.5 border border-white/[0.06] text-gray-400 rounded-xl hover:bg-white/[0.04] text-sm transition-all">+ Create New Room</button>
      </Modal>

      {/* Leaderboard */}
      <Modal show={showLeaderboard} onClose={()=>setShowLeaderboard(false)} wide>
        <ModalHeader title="Leaderboard" onClose={()=>setShowLeaderboard(false)} icon={<span className="text-xl">&#x1F3C6;</span>}/>
        <div className="flex gap-1 mb-5 bg-white/[0.03] rounded-xl p-1">{['today','week'].map(tab=><button key={tab} onClick={()=>setLeaderboardTab(tab)} className={'flex-1 py-2 text-xs font-bold rounded-lg transition-all tracking-wider uppercase '+(leaderboardTab===tab?'bg-white/[0.08] text-white':'text-gray-600 hover:text-gray-400')}>{tab==='today'?'Today':'This Week'}</button>)}</div>
        <div className="space-y-2">{getLeaderboard().map((item,i)=>{
          const pts=leaderboardTab==='today'?item.todayPts:item.weeklyPts, isMe=item.member.id===currentUser.id;
          const medals=['\u{1F947}','\u{1F948}','\u{1F949}'];
          return (
            <div key={item.member.id} className={'rounded-xl p-4 border transition-all '+(isMe?'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500/30 shadow-lg shadow-blue-500/10':i===0?'bg-amber-500/5 border-amber-500/20':'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]')}>
              <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="text-lg w-8 text-center">{i<3?medals[i]:<span className="text-sm text-gray-600">{i+1}</span>}</div><div><div className={'text-sm font-semibold flex items-center gap-1.5 '+(isMe?'text-blue-300':'text-gray-300')}>{item.member.username}{isMe&&<span className="text-[10px] text-gray-600">(you)</span>}{getRoomRole(item.member.id)&&<span className={`text-[9px] font-bold ${getRoomRole(item.member.id).color}`}>{getRoomRole(item.member.id).icon}</span>}</div><div className="text-xs text-gray-600">{pts} pts{leaderboardTab==='week'?' \u00b7 '+item.weeklyCrystals+' crystals':''}</div></div></div>
                <div className="flex items-center gap-3">{leaderboardTab==='today'&&<div className="flex items-center gap-1.5">{allCatNames.map(c=><div key={c} className={'w-2.5 h-2.5 rounded-full '+(item.crystals[c]?getCT(c).bg.replace('bg-','bg-').replace('500','400')+' shadow-sm shadow-'+getCT(c).neon.replace('#','')+'/50':isMe?'bg-white/10':'bg-white/[0.06]')}/>)}</div>}{!isMe&&<button onClick={()=>{setShowLeaderboard(false);setShowCompetitor(item.member);}} className="text-[10px] text-gray-600 hover:text-white uppercase tracking-wider font-medium">View</button>}</div>
              </div>
            </div>
          );
        })}</div>
        {activeMembers.length<2&&<div className="text-center py-8"><p className="text-gray-600 text-sm">Invite friends to compete!</p></div>}
      </Modal>

      {/* Profile */}
      <Modal show={showProfile} onClose={()=>setShowProfile(false)}>
        <ModalHeader title="Profile" onClose={()=>setShowProfile(false)}/>
        <div className="text-center mb-6"><div className="relative inline-block"><ProgressRing progress={dailyProg} size={80} stroke={4} color={dailyProg>=1?'#10b981':'#3b82f6'}/><div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-black">{Math.round(dailyProg*100)}%</span></div></div><h3 className="text-xl font-bold mt-3">{currentUser.username}</h3><p className="text-gray-600 text-xs">{currentUser.email}</p></div>
        <div className="grid grid-cols-3 gap-3 mb-4">{[{v:streakData.streak||0,l:'Streak',c:'text-orange-400',i:<Flame size={16} className="text-orange-400 mx-auto mb-1"/>},{v:myPts,l:'Today',c:'text-blue-400',i:<Star size={16} className="text-blue-400 mx-auto mb-1"/>},{v:getWeeklyPts(currentUser.id),l:'Week',c:'text-emerald-400',i:<TrendingUp size={16} className="text-emerald-400 mx-auto mb-1"/>}].map((s,i)=><div key={i} className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">{s.i}<div className={'text-xl font-black '+s.c}>{s.v}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">{s.l}</div></div>)}</div>
        <div className="grid grid-cols-2 gap-3 mb-4"><div className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]"><div className="text-lg font-black text-purple-400">{streakData.activeDays||0}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Active Days</div></div><div className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]"><div className="text-lg font-black text-cyan-400">{streakData.totalCompletions||0}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Completions</div></div></div>
        <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]"><div className="text-[9px] text-gray-600 tracking-wider uppercase mb-2">Crystals</div><div className="flex justify-center gap-4">{allCatNames.map(c=><div key={c} className="text-center"><div className={'w-6 h-6 rounded-full mx-auto mb-1 transition-all '+(myCr[c]?getCT(c).bg+' shadow-md '+getCT(c).glow:'bg-white/[0.06]')}/><span className="text-[9px] text-gray-600">{c}</span></div>)}</div></div>
        <div className="mt-4 p-3 bg-white/[0.03] rounded-xl border border-white/[0.04] flex items-center justify-between"><div><div className="text-sm text-gray-300 font-medium">Email Reminders</div><div className="text-[10px] text-gray-600">Daily nudges at 12pm & 6pm</div></div><button onClick={async()=>{const newVal=currentUser.emailReminders===false?true:false;try{await updateDoc(doc(db,'users',currentUser.id),{emailReminders:!newVal});setCurrentUser(p=>({...p,emailReminders:!newVal}));}catch{}}} className={'relative w-11 h-6 rounded-full transition-all '+(currentUser.emailReminders!==false?'bg-blue-500':'bg-white/[0.08]')}><div className={'absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm '+(currentUser.emailReminders!==false?'left-6':'left-1')}/></button></div>
        {/* Quick actions */}
        <div className="mt-5 space-y-2">
          <button onClick={()=>{setShowProfile(false);setShowInviteModal(true);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300':'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'}`}><UserPlus size={16} className="text-blue-400"/><span className="text-sm">Invite to Room</span></button>
          <button onClick={()=>{setShowProfile(false);setShowStakes(true);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300':'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'}`}><Zap size={16} className="text-red-400"/><span className="text-sm">Stakes</span></button>
          {lastWeekData&&<button onClick={()=>{setShowProfile(false);setShowWeeklyRecap(true);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300':'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'}`}><BarChart3 size={16} className="text-purple-400"/><span className="text-sm">Weekly Recap</span></button>}
          <button onClick={()=>{setShowProfile(false);setShowHelp(true);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-gray-300':'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'}`}><HelpCircle size={16} className="text-gray-400"/><span className="text-sm">How TRAX Works</span></button>
          <button onClick={()=>signOut(auth)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${darkMode?'border-white/[0.06] bg-white/[0.02] hover:bg-red-500/5 text-red-400':'border-gray-200 bg-gray-50 hover:bg-red-50 text-red-500'}`}><LogOut size={16}/><span className="text-sm">Sign Out</span></button>
        </div>
      </Modal>

      {/* Help */}
      <Modal show={showHelp} onClose={()=>setShowHelp(false)}>
        <ModalHeader title="How TRAX Works" onClose={()=>setShowHelp(false)}/>
        <div className="space-y-3 text-sm text-gray-400">
          {[{i:'&#x1F3AF;',t:'Track & Earn',d:'Use + and \u2212 to track habits. Max them out for neon glow.'},{i:'&#x1F525;',t:'Streak Multipliers',d:'Keep your streak alive for bonus points: 3d→1.1× · 7d→1.25× · 14d→1.5× · 30d→1.75× · 60d→2× (max). Break your streak and you reset to 1×.'},{i:'&#x1F3C6;',t:'Compete',d:'Invite friends and dominate the leaderboard.'},{i:'&#x26A1;',t:'Stakes',d:'Set real consequences for the weekly loser.'},{i:'&#x1F465;',t:'Solo Mode',d:'No friends yet? Compete against your own yesterday.'}].map((s,i)=>(
            <div key={i} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]"><p className="font-bold text-white mb-1" dangerouslySetInnerHTML={{__html:s.i+' '+s.t}}/><p>{s.d}</p></div>
          ))}
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]"><p className="font-bold text-white mb-2">Categories</p><div className="space-y-1.5">{allCatNames.map(c=>{const ct=getCT(c);return(<div key={c} className="flex items-center gap-2"><div className={'w-3 h-3 rounded-full '+ct.bg+' shadow-sm '+ct.glow}/><span><strong className={ct.txt}>{c}</strong></span></div>);})}</div></div>
        </div>
      </Modal>

      {/* Invite */}
      <Modal show={showInviteModal} onClose={()=>setShowInviteModal(false)}>
        <div className="text-center"><h2 className="text-xl font-bold mb-2">Invite Friends</h2><p className="text-xs text-gray-600 mb-6 tracking-wider uppercase">Share this room code</p><div className="mb-6 relative inline-block"><code className="inline-block px-8 py-4 bg-gradient-to-b from-white/[0.08] to-white/[0.03] border border-white/[0.1] text-3xl font-mono rounded-xl tracking-[0.4em] shadow-2xl">{currentRoom?.code}</code><div className="absolute -inset-3 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 blur-xl rounded-xl -z-10"/></div><button onClick={copyCode} className="w-full mb-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 text-sm font-bold active:scale-[0.98]">{copied?<Check size={16}/>:<Copy size={16}/>}{copied?'Copied!':'Copy Code'}</button><button onClick={()=>setShowInviteModal(false)} className="w-full text-gray-600 py-2 hover:text-white text-sm transition-colors">Close</button></div>
      </Modal>

      {/* Competitor */}
      <Modal show={!!showCompetitor} onClose={()=>setShowCompetitor(null)}>
        {showCompetitor&&<><ModalHeader title={showCompetitor.username} onClose={()=>setShowCompetitor(null)}/>
        <div className="space-y-3"><div className="grid grid-cols-3 gap-3">{allCatNames.map(c=><div key={c} className={'text-center p-4 rounded-xl border '+getCT(c).bgS+' '+getCT(c).bdr}><div className={'text-2xl font-black '+getCT(c).txt}>{getCatPts(showCompetitor.id,c)}</div><div className="text-[9px] text-gray-600 mt-1 tracking-wider uppercase">{c}</div></div>)}</div><div className="text-center p-5 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-xl border border-blue-500/20"><div className="text-3xl font-black">{getTodayPts(showCompetitor.id)}</div><div className="text-[10px] text-gray-500 mt-1 tracking-wider uppercase">Total Today</div></div></div></>}
      </Modal>

      {/* Weekly Recap */}
      <Modal show={showWeeklyRecap} onClose={()=>setShowWeeklyRecap(false)} wide dark={darkMode}>
        <ModalHeader title="Weekly Recap" onClose={()=>setShowWeeklyRecap(false)} icon={<BarChart3 size={18} className="text-purple-400"/>}/>
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
                    <div className="flex items-center gap-2"><span className="text-sm">{i<3?medals[i]:(i+1)+'.'}</span><span className={'text-sm font-semibold '+(isMe?'text-blue-300':darkMode?'text-gray-300':'text-gray-700')}>{s.member.username}</span></div>
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
          </div>
        ) : (
          <p className={`${T.textDim} text-sm text-center py-8`}>No data from last week yet.</p>
        )}
      </Modal>

      {/* Heat Map Calendar */}
      <Modal show={showHeatMap} onClose={()=>setShowHeatMap(false)} wide dark={darkMode}>
        <ModalHeader title="90-Day Heat Map" onClose={()=>setShowHeatMap(false)} icon={<Calendar size={18} className="text-emerald-400"/>}/>
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
        <ModalHeader title="Your Insights" onClose={()=>setShowInsights(false)} icon={<TrendingUp size={18} className="text-blue-400"/>}/>
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
        <ModalHeader title="Custom Board" onClose={()=>setShowCustomBoard(false)}/>
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
            <input value={newHabit.name} onChange={e=>setNewHabit(p=>({...p,name:e.target.value}))} placeholder="Habit name" className={inputCls} maxLength={40}/>
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
        <ModalHeader title="Room Settings" onClose={()=>setShowRoomSettings(false)} icon={<Crown size={16} className="text-amber-400"/>}/>
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
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${isCreator?'bg-amber-500/20 text-amber-400':'bg-blue-500/20 text-blue-400'}`}>{m.username?.charAt(0)?.toUpperCase()}</div>
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
