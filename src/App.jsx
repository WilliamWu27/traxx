import React, { useState, useEffect, useRef } from 'react';
import { Clock, Plus, X, LogOut, Copy, Check, UserPlus, HelpCircle, Trophy, User, Flame, Zap, Star, TrendingUp, DoorOpen, Settings, ArrowLeftRight, ChevronDown } from 'lucide-react';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'firebase/auth';
import {
  collection, doc, setDoc, getDoc, onSnapshot, deleteDoc, updateDoc, query, where, getDocs, arrayUnion, arrayRemove
} from 'firebase/firestore';

// ─── CONFETTI ───
function ConfettiCanvas({ trigger }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animRef = useRef(null);
  useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const colors = ['#f43f5e','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
    const particles = [];
    for (let i = 0; i < 120; i++) {
      particles.push({ x: Math.random()*canvas.width, y: -20-Math.random()*200, w: 4+Math.random()*6, h: 8+Math.random()*12, vx: (Math.random()-0.5)*6, vy: 2+Math.random()*4, rot: Math.random()*360, rotV: (Math.random()-0.5)*12, color: colors[Math.floor(Math.random()*colors.length)], life: 1 });
    }
    particlesRef.current = particles;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particlesRef.current.forEach(p => {
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

// ─── PROGRESS RING ───
function ProgressRing({ progress, size = 56, stroke = 4, color = '#3b82f6' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - Math.min(progress, 1) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{transition:'stroke-dashoffset 0.6s ease'}} />
    </svg>
  );
}

export default function TraxApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showStakes, setShowStakes] = useState(false);
  const [showSwitchRoom, setShowSwitchRoom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [allCompletions, setAllCompletions] = useState([]);
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

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = ''; for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random()*chars.length)]; return c;
  };

  const getWeekStart = () => {
    const now = new Date(); const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const m = new Date(now); m.setDate(diff); m.setHours(0,0,0,0);
    return m.toISOString().split('T')[0];
  };

  const getToday = () => new Date().toISOString().split('T')[0];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return 'Burning the midnight oil';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Night owl mode';
  };

  const getMotivation = () => {
    const msgs = ["Let's crush it today", "Every rep counts", "Build the future you",
      "Small wins, big results", "Discipline equals freedom", "Level up today",
      "Outwork yesterday", "Stay locked in", "The grind pays off",
      "Consistency beats talent", "One day or day one", "Make it count",
      "Your only limit is you", "Champions train daily", "Focus mode activated"];
    return msgs[new Date().getDate() % msgs.length];
  };

  // ─── IMPROVED DEFAULT HABITS ───
  const loadDefaultHabits = async () => {
    const defaultHabits = [
      // MIND (4) - academic, learning, growth
      { name: 'Study / homework', category: 'Mind', points: 10, isRepeatable: true, maxCompletions: 12, unit: 'per hour' },
      { name: 'Read', category: 'Mind', points: 8, isRepeatable: true, maxCompletions: 6, unit: 'per 30 min' },
      { name: 'Practice a new skill', category: 'Mind', points: 12, isRepeatable: true, maxCompletions: 4, unit: 'per 30 min' },
      { name: 'Work on side project', category: 'Mind', points: 15, isRepeatable: true, maxCompletions: 8, unit: 'per 30 min' },
      // BODY (6) - fitness, nutrition, rest, hygiene
      { name: 'Workout / exercise', category: 'Body', points: 10, isRepeatable: true, maxCompletions: 8, unit: 'per 30 min' },
      { name: 'Drink water', category: 'Body', points: 2, isRepeatable: true, maxCompletions: 8, unit: 'per glass' },
      { name: 'No junk food', category: 'Body', points: 20, isRepeatable: false, maxCompletions: 1 },
      { name: 'Sleep 7+ hours', category: 'Body', points: 25, isRepeatable: false, maxCompletions: 1 },
      { name: 'Stretch / mobility', category: 'Body', points: 8, isRepeatable: false, maxCompletions: 1 },
      { name: 'Skincare routine', category: 'Body', points: 5, isRepeatable: true, maxCompletions: 2, unit: 'AM/PM' },
      // SPIRIT (6) - mindfulness, discipline, self-care
      { name: 'Meditate', category: 'Spirit', points: 5, isRepeatable: true, maxCompletions: 6, unit: 'per 5 min' },
      { name: 'Journal', category: 'Spirit', points: 5, isRepeatable: true, maxCompletions: 3, unit: 'per 5 min' },
      { name: 'No social media', category: 'Spirit', points: 20, isRepeatable: false, maxCompletions: 1 },
      { name: 'Maintain organized space', category: 'Spirit', points: 8, isRepeatable: false, maxCompletions: 1 },
      { name: 'Compliment or help someone', category: 'Spirit', points: 8, isRepeatable: true, maxCompletions: 3 },
      { name: 'No vaping / substances', category: 'Spirit', points: 15, isRepeatable: false, maxCompletions: 1 },
    ];
    try {
      const habitsQuery = query(collection(db, 'habits'), where('roomId', '==', currentRoom.id));
      const existing = await getDocs(habitsQuery);
      if (existing.size > 0) { setError('Habits already loaded'); setTimeout(() => setError(''), 2000); return; }
      for (const habit of defaultHabits) {
        const id = currentRoom.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await setDoc(doc(db, 'habits', id), { ...habit, roomId: currentRoom.id, createdBy: currentUser.id, createdAt: new Date().toISOString() });
      }
      setShowAddHabit(false);
    } catch (err) { console.error('Load defaults error:', err); setError('Failed to load defaults'); }
  };

  // ─── AUTH LISTENER ───
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = { id: user.uid, ...userDoc.data() };
            setCurrentUser(userData);
            const rooms = userData.rooms || (userData.roomId ? [userData.roomId] : []);
            setUserRooms(rooms);
            const activeRoom = userData.activeRoom || userData.roomId || (rooms.length > 0 ? rooms[0] : null);
            if (activeRoom) {
              const roomDoc = await getDoc(doc(db, 'rooms', activeRoom));
              if (roomDoc.exists()) { setCurrentRoom({ id: roomDoc.id, ...roomDoc.data() }); setView('dashboard'); }
              else setShowRoomModal(true);
            } else setShowRoomModal(true);
          }
        } catch (err) { console.error('Auth error:', err); setError(err.message); }
      } else setCurrentUser(null);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // ─── REALTIME DATA ───
  useEffect(() => {
    if (!currentUser || !currentRoom) return;
    const habitsUnsub = onSnapshot(query(collection(db, 'habits'), where('roomId', '==', currentRoom.id)), s => setHabits(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const today = getToday();
    const completionsUnsub = onSnapshot(query(collection(db, 'completions'), where('roomId', '==', currentRoom.id), where('date', '==', today)), s => setCompletions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    // Fetch ALL completions from this room (not just this week) for proper history
    const weekStart = getWeekStart();
    const allCompletionsUnsub = onSnapshot(query(collection(db, 'completions'), where('roomId', '==', currentRoom.id), where('date', '>=', weekStart)), s => setAllCompletions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const membersUnsub = onSnapshot(query(collection(db, 'users'), where('rooms', 'array-contains', currentRoom.id)), s => setRoomMembers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    // Also listen with old roomId field for backward compatibility
    const membersUnsub2 = onSnapshot(query(collection(db, 'users'), where('roomId', '==', currentRoom.id)), s => {
      setRoomMembers(prev => {
        const ids = new Set(prev.map(m => m.id));
        const newMembers = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => !ids.has(m.id));
        return [...prev, ...newMembers];
      });
    });
    // Stakes listener
    const stakesUnsub = onSnapshot(doc(db, 'stakes', currentRoom.id), s => {
      if (s.exists()) setRoomStakes({ id: s.id, ...s.data() });
      else setRoomStakes(null);
    });
    return () => { habitsUnsub(); completionsUnsub(); allCompletionsUnsub(); membersUnsub(); membersUnsub2(); stakesUnsub(); };
  }, [currentUser, currentRoom]);

  // ─── STREAK ───
  useEffect(() => {
    if (!currentUser || !currentRoom) return;
    const calcStreak = async () => {
      try {
        const daysAgo = new Date(); daysAgo.setDate(daysAgo.getDate() - 60);
        const dateStr = daysAgo.toISOString().split('T')[0];
        const snap = await getDocs(query(collection(db, 'completions'), where('userId', '==', currentUser.id), where('date', '>=', dateStr)));
        const dates = [...new Set(snap.docs.map(d => d.data().date))].sort().reverse();
        let streak = 0;
        const today = getToday();
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        if (dates.includes(today) || dates.includes(yStr)) {
          let check = dates.includes(today) ? new Date() : yesterday;
          while (true) {
            const ds = check.toISOString().split('T')[0];
            if (dates.includes(ds)) { streak++; check.setDate(check.getDate() - 1); } else break;
          }
        }
        const totalPts = snap.docs.reduce((s, d) => {
          const data = d.data();
          return s + (data.count || 1);
        }, 0);
        setStreakData({ streak, activeDays: dates.length, totalCompletions: totalPts });
      } catch (err) { console.error('Streak error:', err); setStreakData({ streak: 0, activeDays: 0, totalCompletions: 0 }); }
    };
    calcStreak();
  }, [currentUser, currentRoom, completions]);

  useEffect(() => {
    const update = () => {
      const now = new Date(); const mid = new Date(now); mid.setHours(24,0,0,0);
      const diff = mid - now;
      setTimeDisplay(Math.floor(diff/3600000) + 'h ' + Math.floor((diff%3600000)/60000) + 'm');
    };
    update(); const iv = setInterval(update, 60000); return () => clearInterval(iv);
  }, []);

  // ─── AUTH ───
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
    catch (err) { setError('Invalid email or password'); } finally { setLoading(false); }
  };

  // ─── ROOM MANAGEMENT (MULTI-ROOM) ───
  const createRoom = async () => {
    setError(''); setLoading(true);
    try {
      const code = generateRoomCode();
      await setDoc(doc(db, 'rooms', code), { code, createdBy: currentUser.id, createdAt: new Date().toISOString() });
      await updateDoc(doc(db, 'users', currentUser.id), { rooms: arrayUnion(code), activeRoom: code, roomId: code });
      setUserRooms(prev => [...prev, code]);
      setCurrentRoom({ id: code, code }); setShowRoomModal(false); setShowInviteModal(true); setView('dashboard');
    } catch (err) { setError('Failed: ' + err.message); } finally { setLoading(false); }
  };

  const joinRoom = async () => {
    setError(''); setLoading(true);
    const code = roomCode.trim().toUpperCase();
    if (!code) { setError('Enter room code'); setLoading(false); return; }
    try {
      const roomDoc = await getDoc(doc(db, 'rooms', code));
      if (!roomDoc.exists()) { setError('Room not found'); setLoading(false); return; }
      await updateDoc(doc(db, 'users', currentUser.id), { rooms: arrayUnion(code), activeRoom: code, roomId: code });
      setUserRooms(prev => prev.includes(code) ? prev : [...prev, code]);
      setCurrentRoom({ id: code, ...roomDoc.data() }); setShowRoomModal(false); setShowSwitchRoom(false); setView('dashboard'); setRoomCode('');
    } catch (err) { setError('Failed: ' + err.message); } finally { setLoading(false); }
  };

  const switchRoom = async (roomId) => {
    setLoading(true);
    try {
      const roomDoc = await getDoc(doc(db, 'rooms', roomId));
      if (roomDoc.exists()) {
        await updateDoc(doc(db, 'users', currentUser.id), { activeRoom: roomId, roomId: roomId });
        setCurrentRoom({ id: roomDoc.id, ...roomDoc.data() }); setShowSwitchRoom(false);
      }
    } catch (err) { setError('Failed to switch'); } finally { setLoading(false); }
  };

  const leaveRoom = async (roomId) => {
    if (!window.confirm('Leave this room? You can rejoin later with the code.')) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.id), { rooms: arrayRemove(roomId) });
      const newRooms = userRooms.filter(r => r !== roomId);
      setUserRooms(newRooms);
      if (currentRoom && currentRoom.id === roomId) {
        if (newRooms.length > 0) { switchRoom(newRooms[0]); }
        else {
          await updateDoc(doc(db, 'users', currentUser.id), { activeRoom: null, roomId: null });
          setCurrentRoom(null); setShowRoomModal(true);
        }
      }
    } catch (err) { console.error('Leave room error:', err); }
  };

  const copyCode = () => { navigator.clipboard.writeText(currentRoom.code); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ─── STAKES ───
  const saveStake = async () => {
    if (!newStake.description.trim()) return;
    try {
      await setDoc(doc(db, 'stakes', currentRoom.id), {
        type: newStake.type,
        description: newStake.description.trim(),
        duration: newStake.duration,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
        roomId: currentRoom.id,
        active: true
      });
      setShowStakes(false);
    } catch (err) { console.error('Stakes error:', err); setError('Failed to save stakes'); }
  };

  const clearStake = async () => {
    if (!window.confirm('Remove the current stake?')) return;
    try { await deleteDoc(doc(db, 'stakes', currentRoom.id)); } catch (err) { console.error(err); }
  };

  // ─── HABITS ───
  const addHabit = async () => {
    if (!newHabit.name.trim()) return;
    try {
      await setDoc(doc(db, 'habits', Date.now().toString()), {
        name: newHabit.name.trim(), category: newHabit.category, points: parseInt(newHabit.points) || 10,
        isRepeatable: newHabit.isRepeatable, maxCompletions: parseInt(newHabit.maxCompletions) || 1,
        roomId: currentRoom.id, createdBy: currentUser.id, createdAt: new Date().toISOString()
      });
      setNewHabit({ name: '', category: 'Mind', points: 10, isRepeatable: false, maxCompletions: 1 }); setShowAddHabit(false);
    } catch (err) { setError('Failed to add habit'); }
  };
  const deleteHabit = async (habitId) => {
    if (!window.confirm('Delete this habit?')) return;
    try { await deleteDoc(doc(db, 'habits', habitId)); } catch (err) { console.error(err); }
  };

  // ─── COMPLETIONS ───
  const getExistingCompletion = (habitId) => {
    const today = getToday();
    return completions.find(c => c.userId === currentUser.id && c.habitId === habitId && c.date === today);
  };

  const handleIncrement = async (habitId) => {
    const today = getToday();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const max = habit.isRepeatable ? (habit.maxCompletions || 1) : 1;
    const existing = getExistingCompletion(habitId);
    try {
      if (existing) {
        if (existing.count < max) {
          await updateDoc(doc(db, 'completions', existing.id), { count: existing.count + 1 });
          if (existing.count + 1 >= max) setConfettiTrigger(t => t + 1);
        }
      } else {
        const compId = currentUser.id + '_' + habitId + '_' + today;
        await setDoc(doc(db, 'completions', compId), { userId: currentUser.id, habitId, roomId: currentRoom.id, date: today, count: 1 });
        if (max === 1) setConfettiTrigger(t => t + 1);
      }
    } catch (err) { console.error('Increment error:', err); }
  };

  const handleDecrement = async (habitId) => {
    const existing = getExistingCompletion(habitId);
    if (!existing) return;
    try {
      if (existing.count > 1) await updateDoc(doc(db, 'completions', existing.id), { count: existing.count - 1 });
      else await deleteDoc(doc(db, 'completions', existing.id));
    } catch (err) { console.error('Decrement error:', err); }
  };

  // ─── SCORING ───
  const getCategoryPoints = (userId, category) => {
    const today = getToday();
    return completions.filter(c => c.userId === userId && c.date === today).reduce((s, c) => {
      const h = habits.find(hb => hb.id === c.habitId);
      if (h && h.category === category) return s + (h.points * (c.count || 1));
      return s;
    }, 0);
  };
  const getTodayCrystals = (userId) => {
    const cr = { Mind: false, Body: false, Spirit: false };
    if (roomMembers.length < 2) return cr;
    ['Mind','Body','Spirit'].forEach(cat => {
      let max = -1, winner = null;
      roomMembers.forEach(m => {
        const pts = getCategoryPoints(m.id, cat);
        if (pts > max) { max = pts; winner = m; } else if (pts === max && pts > 0) winner = null;
      });
      if (winner && winner.id === userId) cr[cat] = true;
    });
    return cr;
  };
  const getTodayPoints = (userId) => {
    const today = getToday();
    return completions.filter(c => c.userId === userId && c.date === today).reduce((s, c) => {
      const h = habits.find(hb => hb.id === c.habitId);
      return s + ((h?.points || 0) * (c.count || 1));
    }, 0);
  };
  const getWeeklyPoints = (userId) => {
    const ws = getWeekStart();
    return allCompletions.filter(c => c.userId === userId && c.date >= ws).reduce((s, c) => {
      const h = habits.find(hb => hb.id === c.habitId);
      return s + ((h?.points || 0) * (c.count || 1));
    }, 0);
  };
  const getWeeklyCrystals = (userId) => {
    let total = 0; const ws = getWeekStart(); const today = getToday();
    const dates = [...new Set(allCompletions.filter(c => c.date >= ws && c.date <= today).map(c => c.date))];
    dates.forEach(date => {
      ['Mind','Body','Spirit'].forEach(cat => {
        let max = -1, winner = null;
        roomMembers.forEach(m => {
          const pts = allCompletions.filter(c => c.userId === m.id && c.date === date).reduce((s, c) => {
            const h = habits.find(hb => hb.id === c.habitId);
            if (h && h.category === cat) return s + (h.points * (c.count || 1)); return s;
          }, 0);
          if (pts > max) { max = pts; winner = m; } else if (pts === max && pts > 0) winner = null;
        });
        if (winner && winner.id === userId) total++;
      });
    });
    return total;
  };
  const getCompletionCount = (habitId) => { const e = getExistingCompletion(habitId); return e?.count || 0; };
  const getDailyProgress = () => {
    if (habits.length === 0) return 0;
    let totalMax = 0, totalDone = 0;
    habits.forEach(h => { const mx = h.isRepeatable ? (h.maxCompletions || 1) : 1; totalMax += mx; totalDone += Math.min(getCompletionCount(h.id), mx); });
    return totalMax > 0 ? totalDone / totalMax : 0;
  };
  const getLeaderboardData = () => {
    return roomMembers.map(m => ({
      member: m, todayPts: getTodayPoints(m.id), weeklyPts: getWeeklyPoints(m.id),
      crystals: getTodayCrystals(m.id), weeklyCrystals: getWeeklyCrystals(m.id)
    })).sort((a, b) => leaderboardTab === 'today' ? b.todayPts - a.todayPts : b.weeklyPts - a.weeklyPts);
  };

  // ─── THEMES ───
  const catTheme = {
    Mind: { neon: '#3b82f6', glow: 'shadow-blue-500/30', bg: 'bg-blue-500', bgSoft: 'bg-blue-500/10', bgMed: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', textBright: 'text-blue-300', pill: 'bg-blue-500/20 text-blue-300', icon: '\u{1F9E0}', label: 'MIND' },
    Body: { neon: '#f97316', glow: 'shadow-orange-500/30', bg: 'bg-orange-500', bgSoft: 'bg-orange-500/10', bgMed: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', textBright: 'text-orange-300', pill: 'bg-orange-500/20 text-orange-300', icon: '\u{1F4AA}', label: 'BODY' },
    Spirit: { neon: '#10b981', glow: 'shadow-emerald-500/30', bg: 'bg-emerald-500', bgSoft: 'bg-emerald-500/10', bgMed: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', textBright: 'text-emerald-300', pill: 'bg-emerald-500/20 text-emerald-300', icon: '\u2728', label: 'SPIRIT' }
  };

  const stakePresets = [
    { type: 'custom', label: 'Custom', desc: 'Set your own stakes', placeholder: 'e.g. Loser does 50 pushups' },
    { type: 'buyout', label: 'Buyout', desc: 'Loser buys winner something', placeholder: 'e.g. Loser buys lunch, Loser buys coffee for a week' },
    { type: 'dare', label: 'Dare', desc: 'Loser performs a dare', placeholder: 'e.g. Loser posts embarrassing photo, Loser wears a costume to school' },
    { type: 'service', label: 'Service', desc: 'Loser does a favor', placeholder: 'e.g. Loser does winner\'s chores, Loser carries books for a day' },
  ];

  // ─── LOADING ───
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center"><div className="relative inline-block"><h1 className="text-4xl font-black tracking-[0.4em] text-white">TRAX</h1><div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 blur-xl rounded-full"></div></div>
          <div className="mt-4 flex justify-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'0ms'}}></div><div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{animationDelay:'150ms'}}></div><div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{animationDelay:'300ms'}}></div></div></div>
      </div>
    );
  }

  const myCrystals = currentUser && currentRoom ? getTodayCrystals(currentUser.id) : {};
  const myPoints = currentUser && currentRoom ? getTodayPoints(currentUser.id) : 0;
  const isPerfect = myCrystals.Mind && myCrystals.Body && myCrystals.Spirit;
  const dailyProgress = currentUser && currentRoom ? getDailyProgress() : 0;

  // ═══ AUTH ═══
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-blue-600/8 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-emerald-600/8 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px]"></div>
        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-10">
            <div className="relative inline-block mb-4"><h1 className="text-6xl font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">TRAX</h1><div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 blur-2xl rounded-full -z-10"></div></div>
            <p className="text-gray-600 text-xs tracking-[0.4em] uppercase font-medium">Compete &middot; Track &middot; Dominate</p>
            <div className="flex justify-center gap-3 mt-5"><div className="w-8 h-1 rounded-full bg-blue-500"></div><div className="w-8 h-1 rounded-full bg-orange-500"></div><div className="w-8 h-1 rounded-full bg-emerald-500"></div></div>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] p-8">
            {view === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] text-white placeholder-gray-600 text-sm transition-all" required disabled={loading} />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] text-white placeholder-gray-600 text-sm transition-all" required disabled={loading} />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all disabled:opacity-50 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98]">{loading ? 'Signing in...' : 'Sign In'}</button>
                <button type="button" onClick={() => { setView('signup'); setError(''); }} className="w-full text-gray-500 py-2 hover:text-white text-sm transition-colors">Create Account</button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.06] text-white placeholder-gray-600 text-sm transition-all" required disabled={loading} />
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.06] text-white placeholder-gray-600 text-sm transition-all" required disabled={loading} />
                <input type="password" placeholder="Password (min 6)" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.06] text-white placeholder-gray-600 text-sm transition-all" required minLength={6} disabled={loading} />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all disabled:opacity-50 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98]">{loading ? 'Creating...' : 'Sign Up'}</button>
                <button type="button" onClick={() => { setView('login'); setError(''); }} className="w-full text-gray-500 py-2 hover:text-white text-sm transition-colors">Back to Login</button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══ ROOM SELECT ═══
  if (showRoomModal) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-20 -left-32 w-64 h-64 bg-blue-600/8 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-20 -right-32 w-64 h-64 bg-emerald-600/8 rounded-full blur-[100px]"></div>
        <div className="w-full max-w-sm space-y-4 relative z-10">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-wider text-white mb-2">Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">{currentUser.username}</span></h1>
            <p className="text-gray-600 text-xs tracking-wider uppercase">Create or join a room</p>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Create Room</h2>
            <button onClick={createRoom} disabled={loading} className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50">{loading ? 'Creating...' : 'Create New Room'}</button>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Join Room</h2>
            <div className="flex gap-2">
              <input type="text" placeholder="CODE" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} className="flex-1 px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-orange-500/50 text-white placeholder-gray-600 text-sm font-mono tracking-[0.3em] text-center" maxLength={6} disabled={loading} />
              <button onClick={joinRoom} disabled={loading} className="px-6 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] disabled:opacity-50">{loading ? '...' : 'Join'}</button>
            </div>
            {error && <p className="text-red-400 text-xs mt-3 text-center">{error}</p>}
          </div>
          <button onClick={() => signOut(auth)} className="w-full text-gray-700 py-2 hover:text-gray-400 text-xs transition-colors">Sign out</button>
        </div>
      </div>
    );
  }

  // ═══ DASHBOARD ═══
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <ConfettiCanvas trigger={confettiTrigger} />
      {/* Header */}
      <div className="bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.04] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-black tracking-[0.2em] text-white">TRAX</h1>
              <div className="flex gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div><div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div></div>
              {/* Room indicator */}
              <button onClick={() => setShowSwitchRoom(true)} className="ml-2 flex items-center gap-1 px-2 py-1 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[10px] text-gray-500 hover:text-white hover:border-white/[0.12] transition-all">
                <span className="font-mono tracking-wider">{currentRoom?.code}</span>
                {userRooms.length > 1 && <ArrowLeftRight size={10} />}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowLeaderboard(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/20 text-amber-400 rounded-lg hover:border-amber-500/40 transition-all text-xs font-semibold"><Trophy size={12} /><span className="hidden sm:inline">Board</span></button>
              {roomStakes && <button onClick={() => setShowStakes(true)} className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/20 text-red-400 rounded-lg hover:border-red-500/40 transition-all text-xs font-semibold"><Zap size={12} /><span className="hidden sm:inline">Stakes</span></button>}
              {!roomStakes && <button onClick={() => setShowStakes(true)} className="p-1.5 text-gray-700 hover:text-red-400 transition-colors" title="Set Stakes"><Zap size={14} /></button>}
              <button onClick={() => setShowProfile(true)} className="p-1.5 text-gray-600 hover:text-white transition-colors"><User size={14} /></button>
              <button onClick={() => setShowInviteModal(true)} className="p-1.5 text-gray-600 hover:text-white transition-colors"><UserPlus size={14} /></button>
              <button onClick={() => setShowHelp(true)} className="p-1.5 text-gray-600 hover:text-white transition-colors"><HelpCircle size={14} /></button>
              <button onClick={() => signOut(auth)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"><LogOut size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Greeting */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-white">{getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400">{currentUser.username}</span></h2>
              <p className="text-gray-600 text-xs mt-0.5 italic">{getMotivation()}</p>
            </div>
            {streakData.streak > 0 && <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full"><Flame size={14} className="text-orange-400" /><span className="text-orange-400 text-sm font-bold">{streakData.streak}</span></div>}
          </div>
          {/* Stakes banner */}
          {roomStakes && (
            <button onClick={() => setShowStakes(true)} className="w-full mb-3 p-3 bg-gradient-to-r from-red-500/10 via-pink-500/10 to-purple-500/10 border border-red-500/15 rounded-xl flex items-center justify-between hover:border-red-500/30 transition-all">
              <div className="flex items-center gap-2"><Zap size={14} className="text-red-400" /><span className="text-sm text-red-300 font-medium">{roomStakes.description}</span></div>
              <span className="text-[10px] text-gray-600 uppercase tracking-wider">{roomStakes.duration}</span>
            </button>
          )}
          {/* Progress bar */}
          <div className="relative h-2 bg-white/[0.04] rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out" style={{ width: (dailyProgress*100)+'%', background: dailyProgress >= 1 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6, #10b981)' }}></div>
          </div>
          <div className="flex justify-between mt-1.5"><span className="text-[10px] text-gray-600">{Math.round(dailyProgress*100)}% complete</span><span className="text-[10px] text-gray-600">{timeDisplay} left</span></div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="relative bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl -translate-y-4 translate-x-4"></div>
            <div className="text-gray-500 text-[10px] tracking-wider uppercase mb-1 flex items-center gap-1"><Zap size={9} />Points</div>
            <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">{myPoints}</div>
          </div>
          <div className="relative bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 rounded-full blur-xl -translate-y-4 translate-x-4"></div>
            <div className="text-gray-500 text-[10px] tracking-wider uppercase mb-1 flex items-center gap-1"><Flame size={9} />Streak</div>
            <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-orange-300 to-orange-600">{streakData.streak||0}<span className="text-sm font-medium text-gray-600 ml-1">d</span></div>
          </div>
          <div className="relative bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-full blur-xl -translate-y-4 translate-x-4"></div>
            <div className="text-gray-500 text-[10px] tracking-wider uppercase mb-2">Crystals{isPerfect && <span className="text-amber-400 ml-1">&#9830;</span>}</div>
            <div className="flex items-center gap-2.5">
              <div className={'w-5 h-5 rounded-full transition-all duration-500 '+(myCrystals.Mind?'bg-blue-500 shadow-md shadow-blue-500/50':'bg-white/[0.06] border border-white/[0.08]')}></div>
              <div className={'w-5 h-5 rounded-full transition-all duration-500 '+(myCrystals.Body?'bg-orange-500 shadow-md shadow-orange-500/50':'bg-white/[0.06] border border-white/[0.08]')}></div>
              <div className={'w-5 h-5 rounded-full transition-all duration-500 '+(myCrystals.Spirit?'bg-emerald-500 shadow-md shadow-emerald-500/50':'bg-white/[0.06] border border-white/[0.08]')}></div>
            </div>
          </div>
        </div>

        {/* Habits */}
        <div className="space-y-6">
          {['Mind','Body','Spirit'].map(category => {
            const ch = habits.filter(h => h.category === category);
            if (ch.length === 0) return null;
            const t = catTheme[category];
            return (
              <div key={category}>
                <div className="flex items-center gap-2.5 mb-3 px-1">
                  <span className="text-sm">{t.icon}</span>
                  <h2 className={'text-[11px] font-bold tracking-[0.2em] uppercase '+t.text}>{t.label}</h2>
                  <div className="flex-1 h-px bg-white/[0.04] ml-1"></div>
                  <span className={'text-[10px] font-semibold '+t.text}>{getCategoryPoints(currentUser.id, category)} pts</span>
                </div>
                <div className="space-y-2">
                  {ch.map(habit => {
                    const count = getCompletionCount(habit.id);
                    const max = habit.isRepeatable ? (habit.maxCompletions||1) : 1;
                    const isComplete = count > 0;
                    const isMaxed = count >= max;
                    const pct = max > 0 ? count/max : 0;
                    return (
                      <div key={habit.id} className={'relative rounded-xl p-3 flex items-center justify-between transition-all border '+(isMaxed ? t.border+' '+t.bgSoft+' shadow-lg '+t.glow : isComplete ? t.border+' '+t.bgSoft : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.03]')}>
                        {max > 1 && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/[0.03] rounded-b-xl overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{width:(pct*100)+'%',backgroundColor:t.neon}}></div></div>}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => handleDecrement(habit.id)} disabled={count===0} className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-90 '+(count===0?'border border-white/[0.06] text-gray-700 cursor-not-allowed':'border-2 '+t.border+' '+t.text+' hover:'+t.bgMed)}>&minus;</button>
                            <div className={'w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-black transition-all duration-300 '+(isMaxed?t.bg+' border-transparent text-white shadow-lg '+t.glow:isComplete?'border-current '+t.text+' '+t.bgMed:'border-white/[0.08] text-gray-600 bg-white/[0.02]')}>{count}</div>
                            <button onClick={() => handleIncrement(habit.id)} disabled={isMaxed} className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-90 '+(isMaxed?'border border-white/[0.06] text-gray-700 cursor-not-allowed':'border-2 '+t.border+' '+t.text+' hover:'+t.bgMed)}>+</button>
                          </div>
                          <div className="min-w-0">
                            <div className={'text-sm font-medium truncate '+(isComplete?'text-gray-200':'text-gray-500')}>{habit.name}</div>
                            <div className="text-[11px] text-gray-600 flex items-center gap-1.5 flex-wrap">
                              <span>{habit.points} pts</span><span className="text-gray-700">&middot;</span>
                              <span className={isMaxed?'font-bold '+t.textBright:''}>{count}/{max}</span>
                              {habit.unit && <span className="text-gray-700">{habit.unit}</span>}
                              {isMaxed && <span className={t.pill+' text-[9px] font-bold px-1.5 py-0.5 rounded-full'}>MAXED</span>}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => deleteHabit(habit.id)} className="p-1.5 text-gray-800 hover:text-red-400 transition-colors shrink-0 ml-1"><X size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {habits.length === 0 ? (
            <div className="text-center py-16"><div className="text-5xl mb-4">&#x1F3AF;</div><p className="text-gray-500 text-sm mb-5">No habits yet</p>
              <button onClick={() => setShowAddHabit(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/20 text-sm font-bold active:scale-[0.98]"><Plus size={18} />Add Your First Habit</button></div>
          ) : (
            <button onClick={() => setShowAddHabit(true)} className="w-full border border-dashed border-white/[0.08] rounded-xl p-4 text-gray-600 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 flex items-center justify-center gap-2 transition-all"><Plus size={15} /><span className="text-xs font-medium tracking-wide">Add Habit</span></button>
          )}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Add Habit */}
      {showAddHabit && (<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-[#12121a] rounded-2xl max-w-sm w-full p-6 border border-white/[0.06] shadow-2xl">
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold text-white">Add Habit</h2><button onClick={() => setShowAddHabit(false)} className="text-gray-600 hover:text-white"><X size={20} /></button></div>
        {habits.length === 0 && <button onClick={loadDefaultHabits} className="w-full mb-5 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl shadow-lg shadow-violet-500/20 text-sm font-bold transition-all active:scale-[0.98]">&#x26A1; Load Default Habits (16 habits)</button>}
        <div className="space-y-3">
          <input type="text" placeholder="Habit name" value={newHabit.name} onChange={e => setNewHabit({...newHabit, name: e.target.value})} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder-gray-600 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <select value={newHabit.category} onChange={e => setNewHabit({...newHabit, category: e.target.value})} className="px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none text-white text-sm"><option value="Mind" className="bg-[#12121a]">Mind</option><option value="Body" className="bg-[#12121a]">Body</option><option value="Spirit" className="bg-[#12121a]">Spirit</option></select>
            <input type="number" placeholder="Points" value={newHabit.points} onChange={e => setNewHabit({...newHabit, points: e.target.value})} className="px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none text-white text-sm" />
          </div>
          <label className="flex items-center gap-3 py-1 cursor-pointer"><input type="checkbox" checked={newHabit.isRepeatable} onChange={e => setNewHabit({...newHabit, isRepeatable: e.target.checked, maxCompletions: e.target.checked ? 5 : 1})} className="w-4 h-4 rounded accent-blue-500" /><span className="text-sm text-gray-400">Repeatable</span></label>
          {newHabit.isRepeatable && <input type="number" placeholder="Max per day" value={newHabit.maxCompletions} onChange={e => setNewHabit({...newHabit, maxCompletions: e.target.value})} className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none text-white text-sm" />}
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddHabit(false)} className="flex-1 px-4 py-3 border border-white/[0.08] rounded-xl hover:bg-white/[0.04] text-sm text-gray-400">Cancel</button>
            <button onClick={addHabit} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]">Add</button>
          </div>
        </div>
      </div></div>)}

      {/* Stakes Modal */}
      {showStakes && (<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-[#12121a] rounded-2xl max-w-sm w-full p-6 border border-white/[0.06] shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5"><div className="flex items-center gap-2"><Zap size={18} className="text-red-400" /><h2 className="text-lg font-bold text-white">Stakes</h2></div><button onClick={() => setShowStakes(false)} className="text-gray-600 hover:text-white"><X size={20} /></button></div>

        {roomStakes ? (
          <div>
            <div className="p-4 bg-gradient-to-r from-red-500/10 via-pink-500/10 to-purple-500/10 border border-red-500/15 rounded-xl mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ' + (roomStakes.type === 'buyout' ? 'bg-amber-500/20 text-amber-400' : roomStakes.type === 'dare' ? 'bg-pink-500/20 text-pink-400' : roomStakes.type === 'service' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400')}>{roomStakes.type}</span>
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">{roomStakes.duration}</span>
              </div>
              <p className="text-white font-medium">{roomStakes.description}</p>
              <p className="text-[11px] text-gray-600 mt-2">Set by {roomMembers.find(m => m.id === roomStakes.createdBy)?.username || 'unknown'}</p>
            </div>
            {roomStakes.createdBy === currentUser.id && <button onClick={clearStake} className="w-full px-4 py-2.5 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/10 text-sm transition-all">Remove Stake</button>}
          </div>
        ) : (
          <div>
            <p className="text-gray-500 text-sm mb-4">Set what's on the line. The weekly loser pays up.</p>
            {/* Stake type selector */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {stakePresets.map(sp => (
                <button key={sp.type} onClick={() => setNewStake({...newStake, type: sp.type, description: ''})}
                  className={'p-3 rounded-xl border text-left transition-all ' + (newStake.type === sp.type ? 'border-red-500/40 bg-red-500/10' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]')}>
                  <div className={'text-xs font-bold mb-0.5 ' + (newStake.type === sp.type ? 'text-red-400' : 'text-gray-400')}>{sp.label}</div>
                  <div className="text-[10px] text-gray-600">{sp.desc}</div>
                </button>
              ))}
            </div>
            <input type="text" placeholder={stakePresets.find(s => s.type === newStake.type)?.placeholder || 'Describe the stake...'} value={newStake.description} onChange={e => setNewStake({...newStake, description: e.target.value})}
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-red-500/50 text-white placeholder-gray-600 text-sm mb-3" />
            <div className="flex gap-2 mb-4">
              {['weekly', 'monthly'].map(d => (
                <button key={d} onClick={() => setNewStake({...newStake, duration: d})}
                  className={'flex-1 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wider '+(newStake.duration === d ? 'bg-white/[0.08] text-white' : 'bg-white/[0.02] text-gray-600 hover:text-gray-400')}>{d}</button>
              ))}
            </div>
            <button onClick={saveStake} disabled={!newStake.description.trim()} className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all active:scale-[0.98] disabled:opacity-40">Set Stakes</button>
          </div>
        )}
      </div></div>)}

      {/* Switch Room Modal */}
      {showSwitchRoom && (<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-[#12121a] rounded-2xl max-w-sm w-full p-6 border border-white/[0.06] shadow-2xl">
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold text-white">Your Rooms</h2><button onClick={() => setShowSwitchRoom(false)} className="text-gray-600 hover:text-white"><X size={20} /></button></div>
        <div className="space-y-2 mb-4">
          {userRooms.map(roomId => (
            <div key={roomId} className={'p-3 rounded-xl border flex items-center justify-between transition-all '+(currentRoom?.id === roomId ? 'border-blue-500/30 bg-blue-500/10' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]')}>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm tracking-widest text-white">{roomId}</span>
                {currentRoom?.id === roomId && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}
              </div>
              <div className="flex items-center gap-2">
                {currentRoom?.id !== roomId && <button onClick={() => switchRoom(roomId)} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium tracking-wider uppercase">Switch</button>}
                <button onClick={() => leaveRoom(roomId)} className="text-[10px] text-gray-600 hover:text-red-400 font-medium tracking-wider uppercase">Leave</button>
              </div>
            </div>
          ))}
        </div>
        {/* Join another room */}
        <div className="border-t border-white/[0.06] pt-4">
          <p className="text-xs text-gray-500 mb-3">Join another room</p>
          <div className="flex gap-2">
            <input type="text" placeholder="CODE" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} className="flex-1 px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-gray-600 text-sm font-mono tracking-[0.2em] text-center" maxLength={6} />
            <button onClick={joinRoom} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]">Join</button>
          </div>
          {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
        </div>
        <button onClick={createRoom} className="w-full mt-3 px-4 py-2.5 border border-white/[0.06] text-gray-400 rounded-xl hover:bg-white/[0.04] text-sm transition-all">+ Create New Room</button>
      </div></div>)}

      {/* Leaderboard */}
      {showLeaderboard && (<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-[#12121a] rounded-2xl max-w-md w-full p-6 border border-white/[0.06] shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5"><div className="flex items-center gap-2"><span className="text-xl">&#x1F3C6;</span><h2 className="text-lg font-bold text-white">Leaderboard</h2></div><button onClick={() => setShowLeaderboard(false)} className="text-gray-600 hover:text-white"><X size={20} /></button></div>
        <div className="flex gap-1 mb-5 bg-white/[0.03] rounded-xl p-1">
          {['today','week'].map(tab => (<button key={tab} onClick={() => setLeaderboardTab(tab)} className={'flex-1 py-2 text-xs font-bold rounded-lg transition-all tracking-wider uppercase '+(leaderboardTab===tab?'bg-white/[0.08] text-white':'text-gray-600 hover:text-gray-400')}>{tab==='today'?'Today':'This Week'}</button>))}
        </div>
        <div className="space-y-2">
          {getLeaderboardData().map((item, index) => {
            const pts = leaderboardTab==='today' ? item.todayPts : item.weeklyPts;
            const isMe = item.member.id === currentUser.id;
            const medals = ['\u{1F947}','\u{1F948}','\u{1F949}'];
            return (
              <div key={item.member.id} className={'rounded-xl p-4 transition-all border '+(isMe?'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-blue-500/30 shadow-lg shadow-blue-500/10':index===0?'bg-amber-500/5 border-amber-500/20':'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-lg w-8 text-center">{index<3?medals[index]:<span className="text-sm text-gray-600">{index+1}</span>}</div>
                    <div>
                      <div className={'text-sm font-semibold '+(isMe?'text-blue-300':'text-gray-300')}>{item.member.username}{isMe&&<span className="text-[10px] ml-1.5 text-gray-600">(you)</span>}</div>
                      <div className="text-xs text-gray-600">{pts} pts{leaderboardTab==='week'?' \u00b7 '+item.weeklyCrystals+' crystals':''}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {leaderboardTab==='today'&&<div className="flex items-center gap-1.5">
                      <div className={'w-2.5 h-2.5 rounded-full '+(item.crystals.Mind?'bg-blue-400 shadow-sm shadow-blue-400/50':'bg-white/[0.06]')}></div>
                      <div className={'w-2.5 h-2.5 rounded-full '+(item.crystals.Body?'bg-orange-400 shadow-sm shadow-orange-400/50':'bg-white/[0.06]')}></div>
                      <div className={'w-2.5 h-2.5 rounded-full '+(item.crystals.Spirit?'bg-emerald-400 shadow-sm shadow-emerald-400/50':'bg-white/[0.06]')}></div>
                    </div>}
                    {!isMe&&<button onClick={()=>{setShowLeaderboard(false);setShowCompetitor(item.member);}} className="text-[10px] text-gray-600 hover:text-white tracking-wider uppercase font-medium">View</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {roomMembers.length<2&&<div className="text-center py-8"><div className="text-3xl mb-2">&#x1F44B;</div><p className="text-gray-600 text-sm">Invite friends to compete!</p></div>}
      </div></div>)}

      {/* Profile */}
      {showProfile && (<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-[#12121a] rounded-2xl max-w-sm w-full p-6 border border-white/[0.06] shadow-2xl">
        <div className="flex items-center justify-between mb-6"><h2 className="text-lg font-bold text-white">Profile</h2><button onClick={() => setShowProfile(false)} className="text-gray-600 hover:text-white"><X size={20} /></button></div>
        <div className="text-center mb-6">
          <div className="relative inline-block"><ProgressRing progress={dailyProgress} size={80} stroke={4} color={dailyProgress>=1?'#10b981':'#3b82f6'} /><div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-black text-white">{Math.round(dailyProgress*100)}%</span></div></div>
          <h3 className="text-xl font-bold text-white mt-3">{currentUser.username}</h3><p className="text-gray-600 text-xs">{currentUser.email}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]"><Flame size={16} className="text-orange-400 mx-auto mb-1" /><div className="text-xl font-black text-orange-400">{streakData.streak||0}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Streak</div></div>
          <div className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]"><Star size={16} className="text-blue-400 mx-auto mb-1" /><div className="text-xl font-black text-blue-400">{myPoints}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Today</div></div>
          <div className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]"><TrendingUp size={16} className="text-emerald-400 mx-auto mb-1" /><div className="text-xl font-black text-emerald-400">{getWeeklyPoints(currentUser.id)}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Week</div></div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]"><div className="text-lg font-black text-purple-400">{streakData.activeDays||0}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Active Days</div></div>
          <div className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]"><div className="text-lg font-black text-cyan-400">{streakData.totalCompletions||0}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Completions</div></div>
        </div>
        <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
          <div className="text-[9px] text-gray-600 tracking-wider uppercase mb-2">Today's Crystals</div>
          <div className="flex justify-center gap-4">
            <div className="text-center"><div className={'w-6 h-6 rounded-full mx-auto mb-1 transition-all '+(myCrystals.Mind?'bg-blue-500 shadow-md shadow-blue-500/50':'bg-white/[0.06]')}></div><span className="text-[9px] text-gray-600">Mind</span></div>
            <div className="text-center"><div className={'w-6 h-6 rounded-full mx-auto mb-1 transition-all '+(myCrystals.Body?'bg-orange-500 shadow-md shadow-orange-500/50':'bg-white/[0.06]')}></div><span className="text-[9px] text-gray-600">Body</span></div>
            <div className="text-center"><div className={'w-6 h-6 rounded-full mx-auto mb-1 transition-all '+(myCrystals.Spirit?'bg-emerald-500 shadow-md shadow-emerald-500/50':'bg-white/[0.06]')}></div><span className="text-[9px] text-gray-600">Spirit</span></div>
          </div>
        </div>
      </div></div>)}

      {/* Help */}
      {showHelp && (<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-[#12121a] rounded-2xl max-w-sm w-full p-6 border border-white/[0.06] shadow-2xl">
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold text-white">How TRAX Works</h2><button onClick={() => setShowHelp(false)} className="text-gray-600 hover:text-white"><X size={20} /></button></div>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]"><p className="font-bold text-white mb-1">&#x1F3AF; Track &amp; Earn</p><p>Use + and &minus; to track habits. Max them out for neon glow. Win categories to earn crystals.</p></div>
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]"><p className="font-bold text-white mb-1">&#x1F525; Streaks</p><p>Complete at least one habit daily to keep your streak alive.</p></div>
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]"><p className="font-bold text-white mb-1">&#x1F3C6; Compete</p><p>Invite friends, set stakes, and dominate the leaderboard.</p></div>
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]"><p className="font-bold text-white mb-1">&#x26A1; Stakes</p><p>Set real consequences for the weekly loser: buyouts, dares, services, or custom stakes.</p></div>
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]">
            <p className="font-bold text-white mb-2">Categories</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></div><span><strong className="text-blue-400">Mind</strong> &mdash; Learning, reading, studying</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50"></div><span><strong className="text-orange-400">Body</strong> &mdash; Exercise, nutrition, sleep</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div><span><strong className="text-emerald-400">Spirit</strong> &mdash; Mindfulness, discipline, growth</span></div>
            </div>
          </div>
        </div>
      </div></div>)}

      {/* Invite */}
      {showInviteModal && (<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-[#12121a] rounded-2xl max-w-sm w-full p-8 border border-white/[0.06] shadow-2xl text-center">
        <h2 className="text-xl font-bold text-white mb-2">Invite Friends</h2><p className="text-xs text-gray-600 mb-6 tracking-wider uppercase">Share this room code</p>
        <div className="mb-6 relative inline-block"><code className="inline-block px-8 py-4 bg-gradient-to-b from-white/[0.08] to-white/[0.03] border border-white/[0.1] text-white text-3xl font-mono rounded-xl tracking-[0.4em] shadow-2xl">{currentRoom?.code}</code><div className="absolute -inset-3 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 blur-xl rounded-xl -z-10"></div></div>
        <button onClick={copyCode} className="w-full mb-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 text-sm font-bold active:scale-[0.98]">{copied?<Check size={16} />:<Copy size={16} />}{copied?'Copied!':'Copy Code'}</button>
        <button onClick={() => setShowInviteModal(false)} className="w-full text-gray-600 py-2 hover:text-white text-sm transition-colors">Close</button>
      </div></div>)}

      {/* Competitor */}
      {showCompetitor && (<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-[#12121a] rounded-2xl max-w-sm w-full p-6 border border-white/[0.06] shadow-2xl">
        <div className="flex items-center justify-between mb-6"><h2 className="text-lg font-bold text-white">{showCompetitor.username}</h2><button onClick={() => setShowCompetitor(null)} className="text-gray-600 hover:text-white"><X size={20} /></button></div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-4 bg-blue-500/10 rounded-xl border border-blue-500/20"><div className="text-2xl font-black text-blue-400">{getCategoryPoints(showCompetitor.id,'Mind')}</div><div className="text-[9px] text-gray-600 mt-1 tracking-wider uppercase">Mind</div></div>
            <div className="text-center p-4 bg-orange-500/10 rounded-xl border border-orange-500/20"><div className="text-2xl font-black text-orange-400">{getCategoryPoints(showCompetitor.id,'Body')}</div><div className="text-[9px] text-gray-600 mt-1 tracking-wider uppercase">Body</div></div>
            <div className="text-center p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20"><div className="text-2xl font-black text-emerald-400">{getCategoryPoints(showCompetitor.id,'Spirit')}</div><div className="text-[9px] text-gray-600 mt-1 tracking-wider uppercase">Spirit</div></div>
          </div>
          <div className="text-center p-5 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-xl border border-blue-500/20"><div className="text-3xl font-black text-white">{getTodayPoints(showCompetitor.id)}</div><div className="text-[10px] text-gray-500 mt-1 tracking-wider uppercase">Total Today</div></div>
        </div>
      </div></div>)}
    </div>
  );
}
