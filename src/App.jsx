import React, { useState, useEffect } from 'react';
import { Clock, Circle, CheckCircle, Plus, X, LogOut, Copy, Check, UserPlus, HelpCircle, Users, Trophy, Minus, Sparkles, Zap } from 'lucide-react';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot,
  deleteDoc,
  updateDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';

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
  const [newHabit, setNewHabit] = useState({
    name: '',
    category: 'Mind',
    points: 10,
    isRepeatable: false,
    maxCompletions: 1
  });

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const getWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  };

  const getToday = () => new Date().toISOString().split('T')[0];

  const loadDefaultHabits = async () => {
    const defaultHabits = [
      { name: 'Study/homework (per hour)', category: 'Mind', points: 15, isRepeatable: true, maxCompletions: 10 },
      { name: 'Learn something new', category: 'Mind', points: 20, isRepeatable: false, maxCompletions: 1 },
      { name: 'Side project', category: 'Mind', points: 20, isRepeatable: false, maxCompletions: 1 },
      { name: 'Reading (per 30 mins)', category: 'Mind', points: 10, isRepeatable: true, maxCompletions: 10 },
      { name: 'Exercise (per 30 mins)', category: 'Body', points: 10, isRepeatable: true, maxCompletions: 10 },
      { name: 'Water (per glass)', category: 'Body', points: 1, isRepeatable: true, maxCompletions: 8 },
      { name: 'Eating healthy all day', category: 'Body', points: 15, isRepeatable: false, maxCompletions: 1 },
      { name: 'Sleeping well and early', category: 'Body', points: 15, isRepeatable: false, maxCompletions: 1 },
      { name: 'Stretching (5 mins)', category: 'Body', points: 10, isRepeatable: false, maxCompletions: 1 },
      { name: 'Meditation (per min)', category: 'Spirit', points: 3, isRepeatable: true, maxCompletions: 30 },
      { name: 'Journaling (per 5 mins)', category: 'Spirit', points: 5, isRepeatable: true, maxCompletions: 2 },
      { name: 'No social media', category: 'Spirit', points: 15, isRepeatable: false, maxCompletions: 1 },
      { name: 'No video games', category: 'Spirit', points: 10, isRepeatable: false, maxCompletions: 1 }
    ];

    try {
      const habitsQuery = query(collection(db, 'habits'), where('roomId', '==', currentRoom.id));
      const existingHabits = await getDocs(habitsQuery);
      if (existingHabits.size > 0) {
        setError('Habits already loaded');
        setTimeout(() => setError(''), 2000);
        return;
      }
      for (const habit of defaultHabits) {
        const id = currentRoom.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await setDoc(doc(db, 'habits', id), {
          ...habit,
          roomId: currentRoom.id,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString()
        });
      }
      setShowAddHabit(false);
    } catch (err) {
      console.error('Load defaults error:', err);
      setError('Failed to load defaults');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = { id: user.uid, ...userDoc.data() };
            setCurrentUser(userData);
            if (userData.roomId) {
              const roomDoc = await getDoc(doc(db, 'rooms', userData.roomId));
              if (roomDoc.exists()) {
                setCurrentRoom({ id: roomDoc.id, ...roomDoc.data() });
                setView('dashboard');
              } else { setShowRoomModal(true); }
            } else { setShowRoomModal(true); }
          }
        } catch (err) { console.error('Auth error:', err); setError(err.message); }
      } else { setCurrentUser(null); }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser || !currentRoom) return;

    const habitsUnsub = onSnapshot(
      query(collection(db, 'habits'), where('roomId', '==', currentRoom.id)),
      (snap) => setHabits(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const today = getToday();
    const completionsUnsub = onSnapshot(
      query(collection(db, 'completions'), where('roomId', '==', currentRoom.id), where('date', '==', today)),
      (snap) => setCompletions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const weekStart = getWeekStart();
    const allCompletionsUnsub = onSnapshot(
      query(collection(db, 'completions'), where('roomId', '==', currentRoom.id), where('date', '>=', weekStart)),
      (snap) => setAllCompletions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const membersUnsub = onSnapshot(
      query(collection(db, 'users'), where('roomId', '==', currentRoom.id)),
      (snap) => setRoomMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { habitsUnsub(); completionsUnsub(); allCompletionsUnsub(); membersUnsub(); };
  }, [currentUser, currentRoom]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight - now;
      setTimeDisplay(Math.floor(diff / 3600000) + 'h ' + Math.floor((diff % 3600000) / 60000) + 'm');
    };
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    if (!username.trim()) { setError('Username required'); setLoading(false); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), { username: username.trim(), email, createdAt: new Date().toISOString() });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (err) { setError('Invalid email or password'); } finally { setLoading(false); }
  };

  const createRoom = async () => {
    setError(''); setLoading(true);
    try {
      const code = generateRoomCode();
      await setDoc(doc(db, 'rooms', code), { code, createdBy: currentUser.id, createdAt: new Date().toISOString() });
      await updateDoc(doc(db, 'users', currentUser.id), { roomId: code });
      setCurrentRoom({ id: code, code }); setShowRoomModal(false); setShowInviteModal(true); setView('dashboard');
    } catch (err) { setError('Failed to create room: ' + err.message); } finally { setLoading(false); }
  };

  const joinRoom = async () => {
    setError(''); setLoading(true);
    const code = roomCode.trim().toUpperCase();
    if (!code) { setError('Enter room code'); setLoading(false); return; }
    try {
      const roomDoc = await getDoc(doc(db, 'rooms', code));
      if (!roomDoc.exists()) { setError('Room not found'); setLoading(false); return; }
      await updateDoc(doc(db, 'users', currentUser.id), { roomId: code });
      setCurrentRoom({ id: code, ...roomDoc.data() }); setShowRoomModal(false); setView('dashboard');
    } catch (err) { setError('Failed to join room: ' + err.message); } finally { setLoading(false); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(currentRoom.code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const addHabit = async () => {
    if (!newHabit.name.trim()) return;
    try {
      await setDoc(doc(db, 'habits', Date.now().toString()), {
        name: newHabit.name.trim(), category: newHabit.category,
        points: parseInt(newHabit.points) || 10, isRepeatable: newHabit.isRepeatable,
        maxCompletions: parseInt(newHabit.maxCompletions) || 1,
        roomId: currentRoom.id, createdBy: currentUser.id, createdAt: new Date().toISOString()
      });
      setNewHabit({ name: '', category: 'Mind', points: 10, isRepeatable: false, maxCompletions: 1 });
      setShowAddHabit(false);
    } catch (err) { setError('Failed to add habit'); }
  };

  const deleteHabit = async (habitId) => {
    if (!window.confirm('Delete this habit?')) return;
    try { await deleteDoc(doc(db, 'habits', habitId)); } catch (err) { console.error(err); }
  };

  // ─── COMPLETION HANDLERS (FIXED FOR ALL HABITS) ───
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
        }
      } else {
        const compId = currentUser.id + '_' + habitId + '_' + today;
        await setDoc(doc(db, 'completions', compId), {
          userId: currentUser.id, habitId, roomId: currentRoom.id, date: today, count: 1
        });
      }
    } catch (err) { console.error('Increment error:', err); }
  };

  const handleDecrement = async (habitId) => {
    const existing = getExistingCompletion(habitId);
    if (!existing) return;
    try {
      if (existing.count > 1) {
        await updateDoc(doc(db, 'completions', existing.id), { count: existing.count - 1 });
      } else {
        await deleteDoc(doc(db, 'completions', existing.id));
      }
    } catch (err) { console.error('Decrement error:', err); }
  };

  const getCategoryPoints = (userId, category, source) => {
    const today = getToday();
    const src = source || completions;
    return src.filter(c => c.userId === userId && c.date === today).reduce((sum, c) => {
      const habit = habits.find(h => h.id === c.habitId);
      if (habit && habit.category === category) return sum + (habit.points * (c.count || 1));
      return sum;
    }, 0);
  };

  const getTodayCrystals = (userId) => {
    const crystals = { Mind: false, Body: false, Spirit: false };
    if (roomMembers.length < 2) return crystals;
    ['Mind', 'Body', 'Spirit'].forEach(cat => {
      let maxPts = -1, winner = null;
      roomMembers.forEach(m => {
        const pts = getCategoryPoints(m.id, cat);
        if (pts > maxPts) { maxPts = pts; winner = m; }
        else if (pts === maxPts && pts > 0) winner = null;
      });
      if (winner && winner.id === userId) crystals[cat] = true;
    });
    return crystals;
  };

  const getTodayPoints = (userId) => {
    const today = getToday();
    return completions.filter(c => c.userId === userId && c.date === today).reduce((sum, c) => {
      const habit = habits.find(h => h.id === c.habitId);
      return sum + ((habit?.points || 0) * (c.count || 1));
    }, 0);
  };

  const getWeeklyPoints = (userId) => {
    const weekStart = getWeekStart();
    return allCompletions.filter(c => c.userId === userId && c.date >= weekStart).reduce((sum, c) => {
      const habit = habits.find(h => h.id === c.habitId);
      return sum + ((habit?.points || 0) * (c.count || 1));
    }, 0);
  };

  const getWeeklyCrystals = (userId) => {
    let total = 0;
    const weekStart = getWeekStart();
    const today = getToday();
    const dates = [...new Set(allCompletions.filter(c => c.date >= weekStart && c.date <= today).map(c => c.date))];
    dates.forEach(date => {
      ['Mind', 'Body', 'Spirit'].forEach(cat => {
        let maxPts = -1, winner = null;
        roomMembers.forEach(m => {
          const pts = allCompletions.filter(c => c.userId === m.id && c.date === date).reduce((sum, c) => {
            const habit = habits.find(h => h.id === c.habitId);
            if (habit && habit.category === cat) return sum + (habit.points * (c.count || 1));
            return sum;
          }, 0);
          if (pts > maxPts) { maxPts = pts; winner = m; }
          else if (pts === maxPts && pts > 0) winner = null;
        });
        if (winner && winner.id === userId) total++;
      });
    });
    return total;
  };

  const getCompletionCount = (habitId) => {
    const existing = getExistingCompletion(habitId);
    return existing?.count || 0;
  };

  const getLeaderboardData = () => {
    return roomMembers.map(member => ({
      member, todayPts: getTodayPoints(member.id), weeklyPts: getWeeklyPoints(member.id),
      crystals: getTodayCrystals(member.id), weeklyCrystals: getWeeklyCrystals(member.id)
    })).sort((a, b) => leaderboardTab === 'today' ? b.todayPts - a.todayPts : b.weeklyPts - a.weeklyPts);
  };

  // Category themes - Spirit is GREEN
  const catTheme = {
    Mind: { gradient: 'from-blue-500 to-indigo-600', lightBg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', dot: 'bg-blue-500', pillBg: 'bg-blue-100', pillText: 'text-blue-700', btnFill: 'bg-blue-500 border-blue-500 text-white', btnMaxed: 'bg-blue-700 border-blue-700 text-white', icon: '\u{1F9E0}' },
    Body: { gradient: 'from-orange-500 to-red-500', lightBg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', dot: 'bg-orange-500', pillBg: 'bg-orange-100', pillText: 'text-orange-700', btnFill: 'bg-orange-500 border-orange-500 text-white', btnMaxed: 'bg-orange-700 border-orange-700 text-white', icon: '\u{1F4AA}' },
    Spirit: { gradient: 'from-emerald-500 to-green-600', lightBg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', dot: 'bg-emerald-500', pillBg: 'bg-emerald-100', pillText: 'text-emerald-700', btnFill: 'bg-emerald-500 border-emerald-500 text-white', btnMaxed: 'bg-emerald-700 border-emerald-700 text-white', icon: '\u2728' }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-widest text-white mb-3 animate-pulse">TRAX</h1>
          <div className="text-slate-500 text-xs tracking-widest uppercase">Loading...</div>
        </div>
      </div>
    );
  }

  const myCrystals = currentUser && currentRoom ? getTodayCrystals(currentUser.id) : {};
  const myPoints = currentUser && currentRoom ? getTodayPoints(currentUser.id) : 0;
  const isPerfect = myCrystals.Mind && myCrystals.Body && myCrystals.Spirit;

  // ══ AUTH SCREEN ══
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-20 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 -right-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl"></div>
        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black tracking-widest text-white mb-3">TRAX</h1>
            <p className="text-slate-500 text-xs tracking-widest uppercase">Compete &middot; Track &middot; Win</p>
            <div className="flex justify-center gap-2 mt-4">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            </div>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
            {view === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-600/50 rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder-slate-500 text-sm transition-all" required disabled={loading} />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-600/50 rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder-slate-500 text-sm transition-all" required disabled={loading} />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3.5 rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 transition-all text-sm font-semibold tracking-wide shadow-lg shadow-blue-500/20">{loading ? 'Signing in...' : 'Sign In'}</button>
                <button type="button" onClick={() => { setView('signup'); setError(''); }} disabled={loading} className="w-full text-slate-400 py-2 hover:text-white text-sm transition-colors">Create Account</button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-600/50 rounded-xl focus:outline-none focus:border-emerald-500/50 text-white placeholder-slate-500 text-sm transition-all" required disabled={loading} />
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-600/50 rounded-xl focus:outline-none focus:border-emerald-500/50 text-white placeholder-slate-500 text-sm transition-all" required disabled={loading} />
                <input type="password" placeholder="Password (min 6)" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-600/50 rounded-xl focus:outline-none focus:border-emerald-500/50 text-white placeholder-slate-500 text-sm transition-all" required minLength={6} disabled={loading} />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3.5 rounded-xl hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 transition-all text-sm font-semibold tracking-wide shadow-lg shadow-emerald-500/20">{loading ? 'Creating...' : 'Sign Up'}</button>
                <button type="button" onClick={() => { setView('login'); setError(''); }} disabled={loading} className="w-full text-slate-400 py-2 hover:text-white text-sm transition-colors">Back to Login</button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ══ ROOM SELECTION ══
  if (showRoomModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-20 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 -right-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="w-full max-w-sm space-y-4 relative z-10">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-wider text-white mb-2">Welcome, {currentUser.username}</h1>
            <p className="text-slate-500 text-xs tracking-wider uppercase">Create or join a room</p>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Create Room</h2>
            <button onClick={createRoom} disabled={loading} className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3.5 rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 transition-all text-sm font-medium shadow-lg shadow-blue-500/20">{loading ? 'Creating...' : 'Create New Room'}</button>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Join Room</h2>
            <div className="flex gap-2">
              <input type="text" placeholder="CODE" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} className="flex-1 px-4 py-3.5 bg-slate-900/50 border border-slate-600/50 rounded-xl focus:outline-none focus:border-orange-500/50 text-white placeholder-slate-500 text-sm font-mono tracking-widest text-center" maxLength={6} disabled={loading} />
              <button onClick={joinRoom} disabled={loading} className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 disabled:opacity-50 transition-all text-sm font-medium shadow-lg shadow-orange-500/20">{loading ? '...' : 'Join'}</button>
            </div>
            {error && <p className="text-red-400 text-xs mt-3 text-center">{error}</p>}
          </div>
          <button onClick={() => signOut(auth)} className="w-full text-slate-600 py-2 hover:text-slate-400 text-xs transition-colors">Sign out</button>
        </div>
      </div>
    );
  }

  // ══ MAIN DASHBOARD ══
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-widest text-slate-900">TRAX</h1>
              <div className="flex gap-1 ml-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div><div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div></div>
            </div>
            <div className="flex items-center gap-1.5">
              {roomMembers.length > 1 && (
                <button onClick={() => setShowLeaderboard(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg hover:from-amber-500 hover:to-orange-600 transition-all text-xs font-semibold shadow-sm shadow-amber-500/20">
                  <Trophy size={13} /><span className="hidden sm:inline">Board</span>
                </button>
              )}
              <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-xs"><UserPlus size={13} /></button>
              <button onClick={() => setShowHelp(true)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"><HelpCircle size={15} /></button>
              <button onClick={() => signOut(auth)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"><LogOut size={15} /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] tracking-wider uppercase mb-1"><Clock size={10} /><span>Resets</span></div>
            <div className="text-lg font-bold text-slate-900 tabular-nums">{timeDisplay}</div>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-4 shadow-sm shadow-blue-500/10">
            <div className="text-blue-100 text-[10px] tracking-wider uppercase mb-1">Points</div>
            <div className="text-lg font-bold text-white">{myPoints}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
            <div className="text-slate-400 text-[10px] tracking-wider uppercase mb-1">Crystals {isPerfect && <span className="text-amber-500">PERFECT</span>}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={'w-4 h-4 rounded-full transition-all ' + (myCrystals.Mind ? 'bg-blue-500 shadow-sm shadow-blue-500/50' : 'bg-slate-200')}></div>
              <div className={'w-4 h-4 rounded-full transition-all ' + (myCrystals.Body ? 'bg-orange-500 shadow-sm shadow-orange-500/50' : 'bg-slate-200')}></div>
              <div className={'w-4 h-4 rounded-full transition-all ' + (myCrystals.Spirit ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-200')}></div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {['Mind', 'Body', 'Spirit'].map(category => {
            const categoryHabits = habits.filter(h => h.category === category);
            if (categoryHabits.length === 0) return null;
            const theme = catTheme[category];

            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className="text-base">{theme.icon}</span>
                  <h2 className="text-xs font-bold text-slate-500 tracking-widest uppercase">{category}</h2>
                  <div className="flex-1 h-px bg-slate-200/60 ml-1"></div>
                </div>
                <div className="space-y-2">
                  {categoryHabits.map(habit => {
                    const count = getCompletionCount(habit.id);
                    const max = habit.isRepeatable ? (habit.maxCompletions || 1) : 1;
                    const isComplete = count > 0;
                    const isMaxed = count >= max;

                    return (
                      <div key={habit.id} className={'bg-white border rounded-xl p-3 flex items-center justify-between transition-all shadow-sm ' + (isMaxed ? theme.border + ' ' + theme.lightBg + ' shadow-md' : isComplete ? theme.border + ' ' + theme.lightBg : 'border-slate-200/60')}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => handleDecrement(habit.id)} disabled={count === 0}
                              className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-95 ' + (count === 0 ? 'border border-slate-200 text-slate-300 cursor-not-allowed' : 'border-2 ' + theme.border + ' ' + theme.text + ' hover:opacity-80')}>
                              &minus;
                            </button>
                            <div className={'w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ' + (isMaxed ? theme.btnMaxed : isComplete ? theme.btnFill : 'border-slate-200 text-slate-400 bg-slate-50')}>
                              {count}
                            </div>
                            <button onClick={() => handleIncrement(habit.id)} disabled={isMaxed}
                              className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-95 ' + (isMaxed ? 'border border-slate-200 text-slate-300 cursor-not-allowed' : 'border-2 ' + theme.border + ' ' + theme.text + ' hover:opacity-80')}>
                              +
                            </button>
                          </div>
                          <div className="min-w-0">
                            <div className={'text-sm font-medium truncate ' + (isComplete ? 'text-slate-900' : 'text-slate-600')}>{habit.name}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5">
                              <span>{habit.points} pts</span>
                              <span>&middot;</span>
                              <span className={isMaxed ? 'font-semibold ' + theme.text : ''}>{count}/{max}</span>
                              {isMaxed && <span className={theme.pillBg + ' ' + theme.pillText + ' text-[9px] font-bold px-1.5 py-0.5 rounded-full'}>MAX</span>}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => deleteHabit(habit.id)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors shrink-0 ml-1"><X size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {habits.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">&#x1F3AF;</div>
              <p className="text-slate-400 text-sm mb-5">No habits yet</p>
              <button onClick={() => setShowAddHabit(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all text-sm font-semibold shadow-lg shadow-blue-500/20"><Plus size={18} />Add Your First Habit</button>
            </div>
          ) : (
            <button onClick={() => setShowAddHabit(true)} className="w-full border-2 border-dashed border-slate-300 rounded-xl p-4 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 flex items-center justify-center gap-2 transition-all"><Plus size={15} /><span className="text-xs font-medium tracking-wide">Add Habit</span></button>
          )}
        </div>
      </div>

      {/* Add Habit Modal */}
      {showAddHabit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Add Habit</h2>
              <button onClick={() => setShowAddHabit(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            {habits.length === 0 && (
              <button onClick={loadDefaultHabits} className="w-full mb-5 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 transition-all text-sm font-semibold shadow-lg shadow-violet-500/20">&#x26A1; Load Default Habits</button>
            )}
            <div className="space-y-3">
              <input type="text" placeholder="Habit name" value={newHabit.name} onChange={e => setNewHabit({...newHabit, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm transition-all" />
              <div className="grid grid-cols-2 gap-3">
                <select value={newHabit.category} onChange={e => setNewHabit({...newHabit, category: e.target.value})} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm">
                  <option value="Mind">Mind</option><option value="Body">Body</option><option value="Spirit">Spirit</option>
                </select>
                <input type="number" placeholder="Points" value={newHabit.points} onChange={e => setNewHabit({...newHabit, points: e.target.value})} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm" />
              </div>
              <label className="flex items-center gap-3 py-1 cursor-pointer">
                <input type="checkbox" checked={newHabit.isRepeatable} onChange={e => setNewHabit({...newHabit, isRepeatable: e.target.checked, maxCompletions: e.target.checked ? 5 : 1})} className="w-4 h-4 rounded accent-blue-500" />
                <span className="text-sm text-slate-600">Repeatable (multiple times/day)</span>
              </label>
              {newHabit.isRepeatable && (
                <input type="number" placeholder="Max per day" value={newHabit.maxCompletions} onChange={e => setNewHabit({...newHabit, maxCompletions: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm" />
              )}
              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddHabit(false)} className="flex-1 px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm text-slate-600 transition-colors">Cancel</button>
                <button onClick={addHabit} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 text-sm font-semibold transition-all">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2"><span className="text-xl">&#x1F3C6;</span><h2 className="text-lg font-bold text-slate-900">Leaderboard</h2></div>
              <button onClick={() => setShowLeaderboard(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1">
              {['today', 'week'].map(tab => (
                <button key={tab} onClick={() => setLeaderboardTab(tab)} className={'flex-1 py-2 text-xs font-semibold rounded-lg transition-all tracking-wide uppercase ' + (leaderboardTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>{tab === 'today' ? 'Today' : 'This Week'}</button>
              ))}
            </div>
            <div className="space-y-2">
              {getLeaderboardData().map((item, index) => {
                const pts = leaderboardTab === 'today' ? item.todayPts : item.weeklyPts;
                const isMe = item.member.id === currentUser.id;
                const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
                return (
                  <div key={item.member.id} className={'rounded-xl p-4 transition-all ' + (isMe ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-blue-500/20' : index === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 hover:bg-slate-100')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-lg w-8 text-center">{index < 3 ? medals[index] : <span className="text-sm text-slate-400">{index + 1}</span>}</div>
                        <div>
                          <div className={'text-sm font-semibold ' + (isMe ? 'text-white' : 'text-slate-900')}>{item.member.username}{isMe && <span className="text-[10px] ml-1.5 opacity-60">(you)</span>}</div>
                          <div className={'text-xs ' + (isMe ? 'text-blue-100' : 'text-slate-400')}>{pts} points{leaderboardTab === 'week' ? ' \u00b7 ' + item.weeklyCrystals + ' crystals' : ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {leaderboardTab === 'today' && (
                          <div className="flex items-center gap-1.5">
                            <div className={'w-2.5 h-2.5 rounded-full ' + (item.crystals.Mind ? 'bg-blue-400' : isMe ? 'bg-white/20' : 'bg-slate-200')}></div>
                            <div className={'w-2.5 h-2.5 rounded-full ' + (item.crystals.Body ? 'bg-orange-400' : isMe ? 'bg-white/20' : 'bg-slate-200')}></div>
                            <div className={'w-2.5 h-2.5 rounded-full ' + (item.crystals.Spirit ? 'bg-emerald-400' : isMe ? 'bg-white/20' : 'bg-slate-200')}></div>
                          </div>
                        )}
                        {!isMe && <button onClick={() => { setShowLeaderboard(false); setShowCompetitor(item.member); }} className="text-[10px] text-slate-400 hover:text-slate-600 tracking-wider uppercase font-medium">View</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {roomMembers.length < 2 && <div className="text-center py-8"><div className="text-3xl mb-2">&#x1F44B;</div><p className="text-slate-400 text-sm">Invite friends to compete!</p></div>}
          </div>
        </div>
      )}

      {/* Help */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">How TRAX Works</h2>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-4 text-sm text-slate-500">
              <div className="bg-slate-50 rounded-xl p-4"><p className="font-semibold text-slate-900 mb-1">Complete habits, earn points</p><p>Use + and - buttons to track any habit. Win each category daily to earn a crystal.</p></div>
              <div className="bg-slate-50 rounded-xl p-4"><p className="font-semibold text-slate-900 mb-1">Compete with friends</p><p>Share your room code and check the leaderboard for daily and weekly rankings.</p></div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="font-semibold text-slate-900 mb-1">Categories</p>
                <div className="space-y-1.5 mt-2">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span><strong>Mind</strong> &mdash; Learning, reading, studying</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span><strong>Body</strong> &mdash; Exercise, nutrition, sleep</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span><strong>Spirit</strong> &mdash; Meditation, journaling, mindfulness</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Invite Friends</h2>
            <p className="text-xs text-slate-400 mb-6 tracking-wider uppercase">Share this room code</p>
            <div className="mb-6"><code className="inline-block px-8 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white text-3xl font-mono rounded-xl tracking-widest shadow-lg">{currentRoom?.code}</code></div>
            <button onClick={copyCode} className="w-full mb-3 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-blue-500/20">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied!' : 'Copy Code'}</button>
            <button onClick={() => setShowInviteModal(false)} className="w-full text-slate-500 py-2 hover:text-slate-900 text-sm transition-colors">Close</button>
          </div>
        </div>
      )}

      {/* Competitor */}
      {showCompetitor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">{showCompetitor.username}</h2>
              <button onClick={() => setShowCompetitor(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100"><div className="text-2xl font-bold text-blue-600">{getCategoryPoints(showCompetitor.id, 'Mind')}</div><div className="text-[10px] text-slate-400 mt-1 tracking-wider uppercase">Mind</div></div>
                <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100"><div className="text-2xl font-bold text-orange-600">{getCategoryPoints(showCompetitor.id, 'Body')}</div><div className="text-[10px] text-slate-400 mt-1 tracking-wider uppercase">Body</div></div>
                <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100"><div className="text-2xl font-bold text-emerald-600">{getCategoryPoints(showCompetitor.id, 'Spirit')}</div><div className="text-[10px] text-slate-400 mt-1 tracking-wider uppercase">Spirit</div></div>
              </div>
              <div className="text-center p-5 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/10"><div className="text-3xl font-bold text-white">{getTodayPoints(showCompetitor.id)}</div><div className="text-[10px] text-blue-100 mt-1 tracking-wider uppercase">Total Today</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
