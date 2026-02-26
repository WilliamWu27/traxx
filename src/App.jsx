import React, { useState, useEffect, useRef } from 'react';
import { Clock, Plus, X, LogOut, Copy, Check, UserPlus, HelpCircle, Trophy, User, Flame, Zap, Star, TrendingUp, ArrowLeftRight, Edit3, Calendar, ChevronLeft, ChevronRight, Crown, Target, ArrowUp, ArrowDown, Minus as MinusIcon } from 'lucide-react';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail
} from 'firebase/auth';
import {
  collection, doc, setDoc, getDoc, onSnapshot, deleteDoc, updateDoc, query, where, getDocs, arrayUnion, arrayRemove
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
    const particles = Array.from({length:120}, () => ({
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
function Modal({ show, onClose, children, wide }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className={'bg-[#12121a] rounded-2xl w-full p-6 border border-white/[0.06] shadow-2xl max-h-[85vh] overflow-y-auto ' + (wide ? 'max-w-md' : 'max-w-sm')} onClick={e => e.stopPropagation()}>
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

  // ─── HELPERS ───
  const genCode = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i=0;i<6;i++) r+=c[Math.floor(Math.random()*c.length)]; return r; };
  const getWeekStart = () => { const n = new Date(), d = n.getDay(), diff = n.getDate()-d+(d===0?-6:1); const m = new Date(n); m.setDate(diff); m.setHours(0,0,0,0); return m.toISOString().split('T')[0]; };
  const getWeekEnd = () => { const ws = getWeekStart(); const d = new Date(ws); d.setDate(d.getDate()+6); return d.toISOString().split('T')[0]; };
  const getToday = () => new Date().toISOString().split('T')[0];
  const getYesterday = () => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; };
  const formatDate = (ds) => { const d = new Date(ds+'T12:00:00'); return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
  const getDaysUntilSunday = () => { const d = new Date(); const day = d.getDay(); return day === 0 ? 0 : 7 - day; };
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
      for (const habit of defaultHabits) {
        const id = currentRoom.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
        await setDoc(doc(db, 'habits', id), { ...habit, roomId: currentRoom.id, createdBy: currentUser.id, createdAt: new Date().toISOString() });
      }
      setShowAddHabit(false);
    } catch (err) { console.error(err); setError('Failed to load defaults'); }
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
    const ws = getWeekStart();
    const u3 = onSnapshot(query(collection(db, 'completions'), where('roomId', '==', currentRoom.id), where('date', '>=', ws)), s => setAllCompletions(s.docs.map(d => ({id:d.id,...d.data()}))));
    // Members: support both new rooms array and old roomId
    const u4 = onSnapshot(query(collection(db, 'users'), where('rooms', 'array-contains', currentRoom.id)), s => setRoomMembers(s.docs.map(d => ({id:d.id,...d.data()}))));
    const u5 = onSnapshot(query(collection(db, 'users'), where('roomId', '==', currentRoom.id)), s => {
      setRoomMembers(prev => { const ids = new Set(prev.map(m=>m.id)); const nw = s.docs.map(d=>({id:d.id,...d.data()})).filter(m=>!ids.has(m.id)); return [...prev,...nw]; });
    });
    const u6 = onSnapshot(doc(db, 'stakes', currentRoom.id), s => { if(s.exists()) setRoomStakes({id:s.id,...s.data()}); else setRoomStakes(null); });
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [currentUser, currentRoom]);

  // ─── STREAK + YESTERDAY ───
  useEffect(() => {
    if (!currentUser || !currentRoom) return;
    const calc = async () => {
      try {
        const ago = new Date(); ago.setDate(ago.getDate()-60);
        const snap = await getDocs(query(collection(db, 'completions'), where('userId', '==', currentUser.id), where('date', '>=', ago.toISOString().split('T')[0])));
        const dates = [...new Set(snap.docs.map(d=>d.data().date))].sort().reverse();
        let streak = 0;
        const today = getToday(), yStr = getYesterday();
        if (dates.includes(today) || dates.includes(yStr)) {
          let check = dates.includes(today) ? new Date() : new Date(Date.now()-86400000);
          while (dates.includes(check.toISOString().split('T')[0])) { streak++; check.setDate(check.getDate()-1); }
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
        setStreakData({ streak, activeDays: dates.length, totalCompletions: snap.docs.reduce((s,d)=>s+(d.data().count||1),0) });
      } catch (err) { console.error(err); setStreakData({streak:0,activeDays:0,totalCompletions:0}); }
    };
    calc();
  }, [currentUser, currentRoom, completions, habits]);

  // ─── WEEKLY WINNER ───
  useEffect(() => {
    if (!currentRoom || roomMembers.length < 2 || allCompletions.length === 0) { setWeeklyWinner(null); return; }
    // Check if we're past Sunday (i.e. it's a new week and last week had data)
    const today = getToday();
    const ws = getWeekStart();
    // Calculate last week's winner from allCompletions that might span into prev week
    // Actually, let's compute current week leader as "projected winner"
    const scores = roomMembers.map(m => ({
      member: m,
      pts: allCompletions.filter(c=>c.userId===m.id && c.date>=ws && c.date<=today).reduce((s,c)=>{
        const h = habits.find(hb=>hb.id===c.habitId);
        return s + ((h?.points || c.habitPoints || 0) * (c.count||1));
      },0)
    })).sort((a,b)=>b.pts-a.pts);
    if (scores.length > 0 && scores[0].pts > 0) {
      const isTied = scores.length > 1 && scores[0].pts === scores[1].pts;
      setWeeklyWinner(isTied ? null : { ...scores[0], daysLeft: getDaysUntilSunday() });
    } else setWeeklyWinner(null);
  }, [roomMembers, allCompletions, habits, currentRoom]);

  // ─── TIMER ───
  useEffect(() => {
    const update = () => { const n=new Date(), m=new Date(n); m.setHours(24,0,0,0); const d=m-n; setTimeDisplay(Math.floor(d/3600000)+'h '+Math.floor((d%3600000)/60000)+'m'); };
    update(); const iv=setInterval(update,60000); return()=>clearInterval(iv);
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
      if (rd.exists()) { await updateDoc(doc(db, 'users', currentUser.id), { activeRoom: rid, roomId: rid }); setCurrentRoom({id:rd.id,...rd.data()}); setShowSwitchRoom(false); }
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

  // ─── STAKES ───
  const saveStake = async () => {
    if (!newStake.description.trim()) return;
    try {
      await setDoc(doc(db, 'stakes', currentRoom.id), { type: newStake.type, description: newStake.description.trim(), duration: newStake.duration, createdBy: currentUser.id, createdAt: new Date().toISOString(), roomId: currentRoom.id, active: true });
      setShowStakes(false);
    } catch (err) { setError('Failed to save stakes'); }
  };
  const clearStake = async () => { if (!confirm('Remove stake?')) return; try { await deleteDoc(doc(db, 'stakes', currentRoom.id)); } catch {} };

  // ─── HABITS (CREATE, EDIT, DELETE) ───
  const addHabit = async () => {
    if (!newHabit.name.trim()) return;
    try {
      await setDoc(doc(db, 'habits', Date.now().toString()), {
        name: newHabit.name.trim(), category: newHabit.category, points: parseInt(newHabit.points)||10,
        isRepeatable: newHabit.isRepeatable, maxCompletions: parseInt(newHabit.maxCompletions)||1,
        roomId: currentRoom.id, createdBy: currentUser.id, createdAt: new Date().toISOString()
      });
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
  const handleIncrement = async (hid) => {
    const t = getToday(), h = habits.find(x=>x.id===hid); if(!h) return;
    const max = h.isRepeatable ? (h.maxCompletions||1) : 1;
    const ex = getExisting(hid);
    try {
      if (ex) {
        if (ex.count < max) { await updateDoc(doc(db, 'completions', ex.id), { count: ex.count+1 }); if(ex.count+1>=max) setConfettiTrigger(v=>v+1); }
      } else {
        const cid = currentUser.id+'_'+hid+'_'+t;
        // Store habit name & points on completion doc so history survives habit deletion
        await setDoc(doc(db, 'completions', cid), { userId: currentUser.id, habitId: hid, roomId: currentRoom.id, date: t, count: 1, habitName: h.name, habitPoints: h.points, habitCategory: h.category });
        if (max===1) setConfettiTrigger(v=>v+1);
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
    const ds = d.toISOString().split('T')[0];
    if (ds > getToday()) return;
    loadHistoryDate(ds);
  };

  // ─── SCORING ───
  const getCatPts = (uid, cat) => completions.filter(c=>c.userId===uid&&c.date===getToday()).reduce((s,c)=>{ const h=habits.find(x=>x.id===c.habitId); if(h&&h.category===cat) return s+(h.points*(c.count||1)); return s; },0);
  const getTodayCrystals = (uid) => {
    const cr = { Mind:false, Body:false, Spirit:false };
    // Solo mode: earn crystal if you beat yesterday's category points
    if (roomMembers.length < 2) {
      ['Mind','Body','Spirit'].forEach(cat => { if(getCatPts(uid,cat) > 0) cr[cat] = true; });
      return cr;
    }
    ['Mind','Body','Spirit'].forEach(cat => {
      let mx=-1, w=null;
      roomMembers.forEach(m=>{ const p=getCatPts(m.id,cat); if(p>mx){mx=p;w=m;}else if(p===mx&&p>0)w=null; });
      if(w&&w.id===uid) cr[cat]=true;
    });
    return cr;
  };
  const getTodayPts = (uid) => completions.filter(c=>c.userId===uid&&c.date===getToday()).reduce((s,c)=>{ const h=habits.find(x=>x.id===c.habitId); return s+((h?.points||c.habitPoints||0)*(c.count||1)); },0);
  const getWeeklyPts = (uid) => { const ws=getWeekStart(); return allCompletions.filter(c=>c.userId===uid&&c.date>=ws).reduce((s,c)=>{ const h=habits.find(x=>x.id===c.habitId); return s+((h?.points||c.habitPoints||0)*(c.count||1)); },0); };
  const getWeeklyCrystals = (uid) => {
    let t=0; const ws=getWeekStart(), td=getToday();
    const dates=[...new Set(allCompletions.filter(c=>c.date>=ws&&c.date<=td).map(c=>c.date))];
    dates.forEach(date=>{ ['Mind','Body','Spirit'].forEach(cat=>{
      let mx=-1, w=null;
      roomMembers.forEach(m=>{ const p=allCompletions.filter(c=>c.userId===m.id&&c.date===date).reduce((s,c)=>{const h=habits.find(x=>x.id===c.habitId);if(h&&h.category===cat)return s+(h.points*(c.count||1));return s;},0); if(p>mx){mx=p;w=m;}else if(p===mx&&p>0)w=null; });
      if(w&&w.id===uid) t++;
    }); });
    return t;
  };
  const getCount = (hid) => { const e=getExisting(hid); return e?.count||0; };
  const getDailyProgress = () => { if(!habits.length)return 0; let tm=0,td=0; habits.forEach(h=>{const mx=h.isRepeatable?(h.maxCompletions||1):1;tm+=mx;td+=Math.min(getCount(h.id),mx);}); return tm>0?td/tm:0; };
  const getLeaderboard = () => roomMembers.map(m=>({member:m,todayPts:getTodayPts(m.id),weeklyPts:getWeeklyPts(m.id),crystals:getTodayCrystals(m.id),weeklyCrystals:getWeeklyCrystals(m.id)})).sort((a,b)=>leaderboardTab==='today'?b.todayPts-a.todayPts:b.weeklyPts-a.weeklyPts);

  // ─── THEMES ───
  const CT = {
    Mind: { neon:'#3b82f6', glow:'shadow-blue-500/30', bg:'bg-blue-500', bgS:'bg-blue-500/10', bgM:'bg-blue-500/20', bdr:'border-blue-500/30', txt:'text-blue-400', txtB:'text-blue-300', pill:'bg-blue-500/20 text-blue-300', icon:'\u{1F9E0}', label:'MIND' },
    Body: { neon:'#f97316', glow:'shadow-orange-500/30', bg:'bg-orange-500', bgS:'bg-orange-500/10', bgM:'bg-orange-500/20', bdr:'border-orange-500/30', txt:'text-orange-400', txtB:'text-orange-300', pill:'bg-orange-500/20 text-orange-300', icon:'\u{1F4AA}', label:'BODY' },
    Spirit: { neon:'#10b981', glow:'shadow-emerald-500/30', bg:'bg-emerald-500', bgS:'bg-emerald-500/10', bgM:'bg-emerald-500/20', bdr:'border-emerald-500/30', txt:'text-emerald-400', txtB:'text-emerald-300', pill:'bg-emerald-500/20 text-emerald-300', icon:'\u2728', label:'SPIRIT' }
  };
  const stakePresets = [
    { type:'custom', label:'Custom', desc:'Set your own', ph:'e.g. Loser does 50 pushups' },
    { type:'buyout', label:'Buyout', desc:'Loser buys something', ph:'e.g. Loser buys lunch' },
    { type:'dare', label:'Dare', desc:'Loser performs a dare', ph:'e.g. Embarrassing post' },
    { type:'service', label:'Service', desc:'Loser does a favor', ph:"e.g. Loser's chores" },
  ];

  const inputCls = "w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder-gray-600 text-sm transition-all";
  const btnPrimary = "w-full py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all disabled:opacity-50 active:scale-[0.98]";

  // ─── LOADING ───
  if (authLoading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center"><h1 className="text-4xl font-black tracking-[0.4em] text-white relative">TRAX<div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 blur-xl rounded-full"></div></h1>
        <div className="mt-4 flex justify-center gap-1.5">{['bg-blue-500','bg-orange-500','bg-emerald-500'].map((c,i)=><div key={i} className={`w-2 h-2 rounded-full ${c} animate-bounce`} style={{animationDelay:i*150+'ms'}} />)}</div></div>
    </div>
  );

  const myCr = currentUser&&currentRoom ? getTodayCrystals(currentUser.id) : {};
  const myPts = currentUser&&currentRoom ? getTodayPts(currentUser.id) : 0;
  const isPerfect = myCr.Mind&&myCr.Body&&myCr.Spirit;
  const dailyProg = currentUser&&currentRoom ? getDailyProgress() : 0;
  const soloMode = roomMembers.length < 2;

  // ═══════════════════════════════════════
  // ONBOARDING
  // ═══════════════════════════════════════
  if (!currentUser && view === 'onboarding') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-blue-600/8 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-emerald-600/8 rounded-full blur-[100px]"></div>
        <div className="w-full max-w-sm relative z-10 space-y-6">
          <div className="text-center"><h1 className="text-4xl font-black tracking-[0.3em] text-white mb-2">TRAX</h1><p className="text-gray-600 text-xs tracking-widest uppercase">Habit Competition Platform</p></div>
          {[
            { icon: '\u{1F3AF}', title: 'Track Daily Habits', desc: 'Log Mind, Body & Spirit habits. Earn points for every completion.' },
            { icon: '\u{1F48E}', title: 'Win Crystals', desc: 'Beat your competitors in each category to earn daily crystals.' },
            { icon: '\u{1F525}', title: 'Build Streaks', desc: 'Complete habits every day to build an unstoppable streak.' },
            { icon: '\u26A1', title: 'Set Stakes', desc: 'Put something on the line. Loser buys lunch, does a dare, or worse.' },
          ].map((item,i) => (
            <div key={i} className="flex items-start gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4" style={{animationDelay:i*100+'ms'}}>
              <span className="text-2xl">{item.icon}</span>
              <div><p className="text-white font-semibold text-sm">{item.title}</p><p className="text-gray-500 text-xs mt-0.5">{item.desc}</p></div>
            </div>
          ))}
          <button onClick={()=>setView('signup')} className={btnPrimary + ' bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'}>Get Started</button>
          <button onClick={()=>setView('login')} className="w-full text-gray-500 py-2 hover:text-white text-sm transition-colors text-center">Already have an account? Sign in</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // AUTH SCREENS
  // ═══════════════════════════════════════
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-blue-600/8 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-emerald-600/8 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px]"></div>
        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 relative inline-block">TRAX<div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 blur-2xl rounded-full -z-10"></div></h1>
            <div className="flex justify-center gap-3 mt-4"><div className="w-8 h-1 rounded-full bg-blue-500"></div><div className="w-8 h-1 rounded-full bg-orange-500"></div><div className="w-8 h-1 rounded-full bg-emerald-500"></div></div>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] p-8">
            {view === 'forgot' ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <h2 className="text-lg font-bold text-white text-center mb-2">Reset Password</h2>
                <p className="text-gray-500 text-xs text-center mb-4">Enter your email and we'll send a reset link.</p>
                <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className={inputCls} required disabled={loading} />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                {successMsg && <p className="text-emerald-400 text-xs text-center">{successMsg}</p>}
                <button type="submit" disabled={loading} className={btnPrimary+' bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25'}>{loading?'Sending...':'Send Reset Link'}</button>
                <button type="button" onClick={()=>{setView('login');setError('');setSuccessMsg('');}} className="w-full text-gray-500 py-2 hover:text-white text-sm transition-colors">Back to Login</button>
              </form>
            ) : view === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className={inputCls} required disabled={loading} />
                <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className={inputCls} required disabled={loading} />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button type="submit" disabled={loading} className={btnPrimary+' bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25'}>{loading?'Signing in...':'Sign In'}</button>
                <div className="flex justify-between">
                  <button type="button" onClick={()=>{setView('onboarding');setError('');}} className="text-gray-500 text-sm hover:text-white transition-colors">Create Account</button>
                  <button type="button" onClick={()=>{setView('forgot');setError('');}} className="text-gray-500 text-sm hover:text-blue-400 transition-colors">Forgot password?</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <input type="text" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className={inputCls} required disabled={loading} />
                <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className={inputCls} required disabled={loading} />
                <input type="password" placeholder="Password (min 6)" value={password} onChange={e=>setPassword(e.target.value)} className={inputCls} required minLength={6} disabled={loading} />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button type="submit" disabled={loading} className={btnPrimary+' bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/25'}>{loading?'Creating...':'Sign Up'}</button>
                <button type="button" onClick={()=>{setView('login');setError('');}} className="w-full text-gray-500 py-2 hover:text-white text-sm transition-colors">Back to Login</button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══ ROOM SELECT ═══
  if (showRoomModal) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-20 -left-32 w-64 h-64 bg-blue-600/8 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-20 -right-32 w-64 h-64 bg-emerald-600/8 rounded-full blur-[100px]"></div>
      <div className="w-full max-w-sm space-y-4 relative z-10">
        <div className="text-center mb-6"><h1 className="text-2xl font-bold tracking-wider text-white mb-2">Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">{currentUser.username}</span></h1><p className="text-gray-600 text-xs tracking-wider uppercase">Create or join a room</p></div>
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] p-6"><h2 className="text-sm font-semibold text-gray-300 mb-4">Create Room</h2><button onClick={createRoom} disabled={loading} className={btnPrimary+' bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'}>{loading?'Creating...':'Create New Room'}</button></div>
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] p-6"><h2 className="text-sm font-semibold text-gray-300 mb-4">Join Room</h2><div className="flex gap-2"><input type="text" placeholder="CODE" value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase())} className="flex-1 px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:border-orange-500/50 text-white placeholder-gray-600 text-sm font-mono tracking-[0.3em] text-center" maxLength={6} /><button onClick={joinRoom} disabled={loading} className="px-6 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20 active:scale-[0.98] disabled:opacity-50">{loading?'...':'Join'}</button></div>{error&&<p className="text-red-400 text-xs mt-3 text-center">{error}</p>}</div>
        <button onClick={()=>signOut(auth)} className="w-full text-gray-700 py-2 hover:text-gray-400 text-xs transition-colors">Sign out</button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════
  // MAIN DASHBOARD
  // ═══════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <ConfettiCanvas trigger={confettiTrigger} />
      {/* Header */}
      <div className="bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.04] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-[0.2em]">TRAX</h1>
              <div className="flex gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"/><div className="w-1.5 h-1.5 rounded-full bg-orange-500"/><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/></div>
              <button onClick={()=>setShowSwitchRoom(true)} className="ml-2 flex items-center gap-1 px-2 py-1 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[10px] text-gray-500 hover:text-white hover:border-white/[0.12] transition-all"><span className="font-mono tracking-wider">{currentRoom?.code}</span>{userRooms.length>1&&<ArrowLeftRight size={10}/>}</button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={()=>setShowLeaderboard(true)} className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/20 text-amber-400 rounded-lg hover:border-amber-500/40 transition-all text-xs font-semibold"><Trophy size={12}/></button>
              <button onClick={()=>setShowStakes(true)} className={'p-1.5 transition-colors '+(roomStakes?'text-red-400 hover:text-red-300':'text-gray-700 hover:text-red-400')}><Zap size={14}/></button>
              <button onClick={()=>{setHistoryDate(getYesterday());loadHistoryDate(getYesterday());setShowHistory(true);}} className="p-1.5 text-gray-600 hover:text-white transition-colors"><Calendar size={14}/></button>
              <button onClick={()=>setShowProfile(true)} className="p-1.5 text-gray-600 hover:text-white transition-colors"><User size={14}/></button>
              <button onClick={()=>setShowInviteModal(true)} className="p-1.5 text-gray-600 hover:text-white transition-colors"><UserPlus size={14}/></button>
              <button onClick={()=>setShowHelp(true)} className="p-1.5 text-gray-600 hover:text-white transition-colors"><HelpCircle size={14}/></button>
              <button onClick={()=>signOut(auth)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"><LogOut size={14}/></button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Greeting */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div><h2 className="text-lg font-bold">{getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400">{currentUser.username}</span></h2><p className="text-gray-600 text-xs mt-0.5 italic">{getMotivation()}</p></div>
            {streakData.streak>0&&<div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full"><Flame size={14} className="text-orange-400"/><span className="text-orange-400 text-sm font-bold">{streakData.streak}</span></div>}
          </div>

          {/* Weekly winner / countdown banner */}
          {weeklyWinner && (
            <div className="mb-3 p-3 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/15 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2"><Crown size={14} className="text-amber-400"/><span className="text-sm text-amber-300 font-medium">{weeklyWinner.member.username} leads this week</span></div>
              <span className="text-[10px] text-gray-500">{weeklyWinner.daysLeft}d left</span>
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
          <div className="flex justify-between mt-1.5"><span className="text-[10px] text-gray-600">{Math.round(dailyProg*100)}% complete</span><span className="text-[10px] text-gray-600">{timeDisplay} left</span></div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="relative bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 overflow-hidden"><div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl -translate-y-4 translate-x-4"/><div className="text-gray-500 text-[10px] tracking-wider uppercase mb-1 flex items-center gap-1"><Zap size={9}/>Points</div><div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">{myPts}</div></div>
          <div className="relative bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 overflow-hidden"><div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 rounded-full blur-xl -translate-y-4 translate-x-4"/><div className="text-gray-500 text-[10px] tracking-wider uppercase mb-1 flex items-center gap-1"><Flame size={9}/>Streak</div><div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-orange-300 to-orange-600">{streakData.streak||0}<span className="text-sm font-medium text-gray-600 ml-1">d</span></div></div>
          <div className="relative bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 overflow-hidden"><div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-full blur-xl -translate-y-4 translate-x-4"/><div className="text-gray-500 text-[10px] tracking-wider uppercase mb-2">Crystals{isPerfect&&<span className="text-amber-400 ml-1">&#9830;</span>}</div><div className="flex items-center gap-2.5">{['Mind','Body','Spirit'].map(c=><div key={c} className={'w-5 h-5 rounded-full transition-all duration-500 '+(myCr[c]?CT[c].bg+' shadow-md '+CT[c].glow:'bg-white/[0.06] border border-white/[0.08]')}/>)}</div></div>
        </div>

        {/* Habits */}
        <div className="space-y-6">
          {['Mind','Body','Spirit'].map(cat => {
            const ch = habits.filter(h=>h.category===cat); if(!ch.length) return null;
            const t = CT[cat];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2.5 mb-3 px-1"><span className="text-sm">{t.icon}</span><h2 className={'text-[11px] font-bold tracking-[0.2em] uppercase '+t.txt}>{t.label}</h2><div className="flex-1 h-px bg-white/[0.04] ml-1"/><span className={'text-[10px] font-semibold '+t.txt}>{getCatPts(currentUser.id,cat)} pts</span></div>
                <div className="space-y-2">{ch.map(h => {
                  const cnt = getCount(h.id), mx = h.isRepeatable?(h.maxCompletions||1):1, done=cnt>0, maxed=cnt>=mx, pct=mx>0?cnt/mx:0;
                  return (
                    <div key={h.id} className={'relative rounded-xl p-3 flex items-center justify-between transition-all border '+(maxed?t.bdr+' '+t.bgS+' shadow-lg '+t.glow:done?t.bdr+' '+t.bgS:'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.03]')}>
                      {mx>1&&<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/[0.03] rounded-b-xl overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{width:(pct*100)+'%',backgroundColor:t.neon}}/></div>}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={()=>handleDecrement(h.id)} disabled={cnt===0} className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-90 '+(cnt===0?'border border-white/[0.06] text-gray-700 cursor-not-allowed':'border-2 '+t.bdr+' '+t.txt)}>&minus;</button>
                          <div className={'w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-black transition-all duration-300 '+(maxed?t.bg+' border-transparent text-white shadow-lg '+t.glow:done?'border-current '+t.txt+' '+t.bgM:'border-white/[0.08] text-gray-600 bg-white/[0.02]')}>{cnt}</div>
                          <button onClick={()=>handleIncrement(h.id)} disabled={maxed} className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-90 '+(maxed?'border border-white/[0.06] text-gray-700 cursor-not-allowed':'border-2 '+t.bdr+' '+t.txt)}>+</button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={'text-sm font-medium truncate '+(done?'text-gray-200':'text-gray-500')}>{h.name}</div>
                          <div className="text-[11px] text-gray-600 flex items-center gap-1.5 flex-wrap"><span>{h.points}pts</span><span className="text-gray-700">&middot;</span><span className={maxed?'font-bold '+t.txtB:''}>{cnt}/{mx}</span>{h.unit&&<span className="text-gray-700">{h.unit}</span>}{maxed&&<span className={t.pill+' text-[9px] font-bold px-1.5 py-0.5 rounded-full'}>MAXED</span>}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 ml-1">
                        <button onClick={()=>openEditHabit(h)} className="p-1.5 text-gray-800 hover:text-blue-400 transition-colors"><Edit3 size={11}/></button>
                        <button onClick={()=>deleteHabit(h.id)} className="p-1.5 text-gray-800 hover:text-red-400 transition-colors"><X size={12}/></button>
                      </div>
                    </div>
                  );
                })}</div>
              </div>
            );
          })}
          {habits.length===0 ? (
            <div className="text-center py-16"><div className="text-5xl mb-4">&#x1F3AF;</div><p className="text-gray-500 text-sm mb-5">No habits yet</p><button onClick={()=>setShowAddHabit(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/20 text-sm font-bold active:scale-[0.98]"><Plus size={18}/>Add Habits</button></div>
          ) : (
            <button onClick={()=>setShowAddHabit(true)} className="w-full border border-dashed border-white/[0.08] rounded-xl p-4 text-gray-600 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 flex items-center justify-center gap-2 transition-all"><Plus size={15}/><span className="text-xs font-medium tracking-wide">Add Habit</span></button>
          )}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Add Habit */}
      <Modal show={showAddHabit} onClose={()=>setShowAddHabit(false)}>
        <ModalHeader title="Add Habit" onClose={()=>setShowAddHabit(false)}/>
        <button onClick={loadDefaultHabits} className="w-full mb-5 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl shadow-lg shadow-violet-500/20 text-sm font-bold active:scale-[0.98]">&#x26A1; Load Defaults (16 habits)</button>
        <div className="space-y-3">
          <input type="text" placeholder="Habit name" value={newHabit.name} onChange={e=>setNewHabit({...newHabit,name:e.target.value})} className={inputCls}/>
          <div className="grid grid-cols-2 gap-3">
            <select value={newHabit.category} onChange={e=>setNewHabit({...newHabit,category:e.target.value})} className={inputCls}><option value="Mind" className="bg-[#12121a]">Mind</option><option value="Body" className="bg-[#12121a]">Body</option><option value="Spirit" className="bg-[#12121a]">Spirit</option></select>
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
            <select value={editHabitData.category||'Mind'} onChange={e=>setEditHabitData({...editHabitData,category:e.target.value})} className={inputCls}><option value="Mind" className="bg-[#12121a]">Mind</option><option value="Body" className="bg-[#12121a]">Body</option><option value="Spirit" className="bg-[#12121a]">Spirit</option></select>
            <input type="number" placeholder="Points" value={editHabitData.points||''} onChange={e=>setEditHabitData({...editHabitData,points:e.target.value})} className={inputCls}/>
          </div>
          <label className="flex items-center gap-3 py-1 cursor-pointer"><input type="checkbox" checked={editHabitData.isRepeatable||false} onChange={e=>setEditHabitData({...editHabitData,isRepeatable:e.target.checked,maxCompletions:e.target.checked?5:1})} className="w-4 h-4 rounded accent-blue-500"/><span className="text-sm text-gray-400">Repeatable</span></label>
          {editHabitData.isRepeatable&&<input type="number" placeholder="Max per day" value={editHabitData.maxCompletions||''} onChange={e=>setEditHabitData({...editHabitData,maxCompletions:e.target.value})} className={inputCls}/>}
          <div className="flex gap-3 pt-2"><button onClick={()=>setShowEditHabit(null)} className="flex-1 px-4 py-3 border border-white/[0.08] rounded-xl text-sm text-gray-400 hover:bg-white/[0.04]">Cancel</button><button onClick={saveEditHabit} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]">Save</button></div>
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
                <div key={c.id} className={'p-3 rounded-xl border bg-white/[0.02] '+CT[cat]?.bdr+' flex items-center justify-between'}>
                  <div className="flex items-center gap-2"><span className="text-sm">{CT[cat]?.icon}</span><span className="text-sm text-gray-300">{name}</span></div>
                  <div className="flex items-center gap-2"><span className="text-xs text-gray-500">x{c.count||1}</span><span className={'text-sm font-bold '+CT[cat]?.txt}>{pts} pts</span></div>
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
              <p className="text-[11px] text-gray-600 mt-2">Set by {roomMembers.find(m=>m.id===roomStakes.createdBy)?.username||'unknown'}</p>
            </div>
            {roomStakes.createdBy===currentUser.id&&<button onClick={clearStake} className="w-full px-4 py-2.5 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/10 text-sm transition-all">Remove Stake</button>}
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
              <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="text-lg w-8 text-center">{i<3?medals[i]:<span className="text-sm text-gray-600">{i+1}</span>}</div><div><div className={'text-sm font-semibold '+(isMe?'text-blue-300':'text-gray-300')}>{item.member.username}{isMe&&<span className="text-[10px] ml-1.5 text-gray-600">(you)</span>}</div><div className="text-xs text-gray-600">{pts} pts{leaderboardTab==='week'?' \u00b7 '+item.weeklyCrystals+' crystals':''}</div></div></div>
                <div className="flex items-center gap-3">{leaderboardTab==='today'&&<div className="flex items-center gap-1.5">{['Mind','Body','Spirit'].map(c=><div key={c} className={'w-2.5 h-2.5 rounded-full '+(item.crystals[c]?CT[c].bg.replace('bg-','bg-').replace('500','400')+' shadow-sm shadow-'+CT[c].neon.replace('#','')+'/50':isMe?'bg-white/10':'bg-white/[0.06]')}/>)}</div>}{!isMe&&<button onClick={()=>{setShowLeaderboard(false);setShowCompetitor(item.member);}} className="text-[10px] text-gray-600 hover:text-white uppercase tracking-wider font-medium">View</button>}</div>
              </div>
            </div>
          );
        })}</div>
        {roomMembers.length<2&&<div className="text-center py-8"><p className="text-gray-600 text-sm">Invite friends to compete!</p></div>}
      </Modal>

      {/* Profile */}
      <Modal show={showProfile} onClose={()=>setShowProfile(false)}>
        <ModalHeader title="Profile" onClose={()=>setShowProfile(false)}/>
        <div className="text-center mb-6"><div className="relative inline-block"><ProgressRing progress={dailyProg} size={80} stroke={4} color={dailyProg>=1?'#10b981':'#3b82f6'}/><div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-black">{Math.round(dailyProg*100)}%</span></div></div><h3 className="text-xl font-bold mt-3">{currentUser.username}</h3><p className="text-gray-600 text-xs">{currentUser.email}</p></div>
        <div className="grid grid-cols-3 gap-3 mb-4">{[{v:streakData.streak||0,l:'Streak',c:'text-orange-400',i:<Flame size={16} className="text-orange-400 mx-auto mb-1"/>},{v:myPts,l:'Today',c:'text-blue-400',i:<Star size={16} className="text-blue-400 mx-auto mb-1"/>},{v:getWeeklyPts(currentUser.id),l:'Week',c:'text-emerald-400',i:<TrendingUp size={16} className="text-emerald-400 mx-auto mb-1"/>}].map((s,i)=><div key={i} className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">{s.i}<div className={'text-xl font-black '+s.c}>{s.v}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">{s.l}</div></div>)}</div>
        <div className="grid grid-cols-2 gap-3 mb-4"><div className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]"><div className="text-lg font-black text-purple-400">{streakData.activeDays||0}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Active Days</div></div><div className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]"><div className="text-lg font-black text-cyan-400">{streakData.totalCompletions||0}</div><div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">Completions</div></div></div>
        <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]"><div className="text-[9px] text-gray-600 tracking-wider uppercase mb-2">Crystals</div><div className="flex justify-center gap-4">{['Mind','Body','Spirit'].map(c=><div key={c} className="text-center"><div className={'w-6 h-6 rounded-full mx-auto mb-1 transition-all '+(myCr[c]?CT[c].bg+' shadow-md '+CT[c].glow:'bg-white/[0.06]')}/><span className="text-[9px] text-gray-600">{c}</span></div>)}</div></div>
      </Modal>

      {/* Help */}
      <Modal show={showHelp} onClose={()=>setShowHelp(false)}>
        <ModalHeader title="How TRAX Works" onClose={()=>setShowHelp(false)}/>
        <div className="space-y-3 text-sm text-gray-400">
          {[{i:'&#x1F3AF;',t:'Track & Earn',d:'Use + and \u2212 to track habits. Max them out for neon glow.'},{i:'&#x1F525;',t:'Streaks',d:'Complete at least one habit daily to keep your streak.'},{i:'&#x1F3C6;',t:'Compete',d:'Invite friends and dominate the leaderboard.'},{i:'&#x26A1;',t:'Stakes',d:'Set real consequences for the weekly loser.'},{i:'&#x1F465;',t:'Solo Mode',d:'No friends yet? Compete against your own yesterday.'}].map((s,i)=>(
            <div key={i} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]"><p className="font-bold text-white mb-1" dangerouslySetInnerHTML={{__html:s.i+' '+s.t}}/><p>{s.d}</p></div>
          ))}
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]"><p className="font-bold text-white mb-2">Categories</p><div className="space-y-1.5">{['Mind','Body','Spirit'].map(c=><div key={c} className="flex items-center gap-2"><div className={'w-3 h-3 rounded-full '+CT[c].bg+' shadow-sm '+CT[c].glow}/><span><strong className={CT[c].txt}>{c}</strong> &mdash; {c==='Mind'?'Learning, reading, studying':c==='Body'?'Exercise, nutrition, sleep':'Mindfulness, discipline, growth'}</span></div>)}</div></div>
        </div>
      </Modal>

      {/* Invite */}
      <Modal show={showInviteModal} onClose={()=>setShowInviteModal(false)}>
        <div className="text-center"><h2 className="text-xl font-bold mb-2">Invite Friends</h2><p className="text-xs text-gray-600 mb-6 tracking-wider uppercase">Share this room code</p><div className="mb-6 relative inline-block"><code className="inline-block px-8 py-4 bg-gradient-to-b from-white/[0.08] to-white/[0.03] border border-white/[0.1] text-3xl font-mono rounded-xl tracking-[0.4em] shadow-2xl">{currentRoom?.code}</code><div className="absolute -inset-3 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 blur-xl rounded-xl -z-10"/></div><button onClick={copyCode} className="w-full mb-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 text-sm font-bold active:scale-[0.98]">{copied?<Check size={16}/>:<Copy size={16}/>}{copied?'Copied!':'Copy Code'}</button><button onClick={()=>setShowInviteModal(false)} className="w-full text-gray-600 py-2 hover:text-white text-sm transition-colors">Close</button></div>
      </Modal>

      {/* Competitor */}
      <Modal show={!!showCompetitor} onClose={()=>setShowCompetitor(null)}>
        {showCompetitor&&<><ModalHeader title={showCompetitor.username} onClose={()=>setShowCompetitor(null)}/>
        <div className="space-y-3"><div className="grid grid-cols-3 gap-3">{['Mind','Body','Spirit'].map(c=><div key={c} className={'text-center p-4 rounded-xl border '+CT[c].bgS+' '+CT[c].bdr}><div className={'text-2xl font-black '+CT[c].txt}>{getCatPts(showCompetitor.id,c)}</div><div className="text-[9px] text-gray-600 mt-1 tracking-wider uppercase">{c}</div></div>)}</div><div className="text-center p-5 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-xl border border-blue-500/20"><div className="text-3xl font-black">{getTodayPts(showCompetitor.id)}</div><div className="text-[10px] text-gray-500 mt-1 tracking-wider uppercase">Total Today</div></div></div></>}
      </Modal>
    </div>
  );
}
