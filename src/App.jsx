import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Circle, CheckCircle, Plus, X, LogOut, Copy, Check, UserPlus, HelpCircle, Users, Trophy, ChevronDown, Minus } from 'lucide-react';
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
  getDocs,
  orderBy
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
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  // Helper: get start of current week (Monday)
  const getWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  };

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
        await setDoc(doc(db, 'habits', `${currentRoom.id}-${Date.now()}-${Math.random()}`), {
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

  // Auth listener
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
              } else {
                setShowRoomModal(true);
              }
            } else {
              setShowRoomModal(true);
            }
          }
        } catch (err) {
          console.error('Auth error:', err);
          setError(err.message);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Real-time listeners for room data
  useEffect(() => {
    if (!currentUser || !currentRoom) return;

    const habitsQuery = query(collection(db, 'habits'), where('roomId', '==', currentRoom.id));
    const habitsUnsub = onSnapshot(habitsQuery, (snapshot) => {
      setHabits(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Today's completions
    const today = new Date().toISOString().split('T')[0];
    const completionsQuery = query(
      collection(db, 'completions'),
      where('roomId', '==', currentRoom.id),
      where('date', '>=', today)
    );
    const completionsUnsub = onSnapshot(completionsQuery, (snapshot) => {
      setCompletions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // All completions for weekly/all-time leaderboard
    const weekStart = getWeekStart();
    const allCompletionsQuery = query(
      collection(db, 'completions'),
      where('roomId', '==', currentRoom.id),
      where('date', '>=', weekStart)
    );
    const allCompletionsUnsub = onSnapshot(allCompletionsQuery, (snapshot) => {
      setAllCompletions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const membersQuery = query(collection(db, 'users'), where('roomId', '==', currentRoom.id));
    const membersUnsub = onSnapshot(membersQuery, (snapshot) => {
      setRoomMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      habitsUnsub();
      completionsUnsub();
      allCompletionsUnsub();
      membersUnsub();
    };
  }, [currentUser, currentRoom]);

  // Countdown timer
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeDisplay(`${hours}h ${minutes}m`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!username.trim()) {
      setError('Username required');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username: username.trim(),
        email: email,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error('Login error:', err);
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    setError('');
    setLoading(true);
    
    try {
      const code = generateRoomCode();
      await setDoc(doc(db, 'rooms', code), {
        code: code,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString()
      });
      
      await updateDoc(doc(db, 'users', currentUser.id), { roomId: code });
      
      setCurrentRoom({ id: code, code: code });
      setShowRoomModal(false);
      setShowInviteModal(true);
      setView('dashboard');
    } catch (err) {
      console.error('Create room error:', err);
      setError('Failed to create room: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    setError('');
    setLoading(true);
    
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError('Enter room code');
      setLoading(false);
      return;
    }
    
    try {
      const roomDoc = await getDoc(doc(db, 'rooms', code));
      if (!roomDoc.exists()) {
        setError('Room not found');
        setLoading(false);
        return;
      }
      
      await updateDoc(doc(db, 'users', currentUser.id), { roomId: code });
      
      setCurrentRoom({ id: code, ...roomDoc.data() });
      setShowRoomModal(false);
      setView('dashboard');
    } catch (err) {
      console.error('Join room error:', err);
      setError('Failed to join room: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(currentRoom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addHabit = async () => {
    if (!newHabit.name.trim()) return;
    
    try {
      await setDoc(doc(db, 'habits', Date.now().toString()), {
        name: newHabit.name.trim(),
        category: newHabit.category,
        points: parseInt(newHabit.points) || 10,
        isRepeatable: newHabit.isRepeatable,
        maxCompletions: parseInt(newHabit.maxCompletions) || 1,
        roomId: currentRoom.id,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString()
      });
      
      setNewHabit({ name: '', category: 'Mind', points: 10, isRepeatable: false, maxCompletions: 1 });
      setShowAddHabit(false);
    } catch (err) {
      console.error('Add habit error:', err);
      setError('Failed to add habit');
    }
  };

  const deleteHabit = async (habitId) => {
    if (!window.confirm('Delete this habit?')) return;
    try {
      await deleteDoc(doc(db, 'habits', habitId));
    } catch (err) {
      console.error('Delete habit error:', err);
    }
  };

  // FIXED: Increment creates or adds to a completion
  const incrementCompletion = async (habitId) => {
    const today = new Date().toISOString().split('T')[0];
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const existing = completions.find(
      c => c.userId === currentUser.id && c.habitId === habitId && c.date === today
    );

    try {
      if (existing) {
        const max = habit.isRepeatable ? habit.maxCompletions : 1;
        if (existing.count < max) {
          await updateDoc(doc(db, 'completions', existing.id), { count: existing.count + 1 });
        }
      } else {
        await setDoc(doc(db, 'completions', `${currentUser.id}-${habitId}-${today}-${Date.now()}`), {
          userId: currentUser.id,
          habitId: habitId,
          roomId: currentRoom.id,
          date: today,
          count: 1
        });
      }
    } catch (err) {
      console.error('Increment error:', err);
    }
  };

  // FIXED: Decrement reduces or removes a completion
  const decrementCompletion = async (habitId) => {
    const today = new Date().toISOString().split('T')[0];

    const existing = completions.find(
      c => c.userId === currentUser.id && c.habitId === habitId && c.date === today
    );

    try {
      if (existing && existing.count > 1) {
        await updateDoc(doc(db, 'completions', existing.id), { count: existing.count - 1 });
      } else if (existing) {
        await deleteDoc(doc(db, 'completions', existing.id));
      }
    } catch (err) {
      console.error('Decrement error:', err);
    }
  };

  // Toggle for non-repeatable habits (checkbox style)
  const toggleCompletion = async (habitId) => {
    const today = new Date().toISOString().split('T')[0];

    const existing = completions.find(
      c => c.userId === currentUser.id && c.habitId === habitId && c.date === today
    );

    try {
      if (existing) {
        await deleteDoc(doc(db, 'completions', existing.id));
      } else {
        await setDoc(doc(db, 'completions', `${currentUser.id}-${habitId}-${today}-${Date.now()}`), {
          userId: currentUser.id,
          habitId: habitId,
          roomId: currentRoom.id,
          date: today,
          count: 1
        });
      }
    } catch (err) {
      console.error('Toggle completion error:', err);
    }
  };

  const getCategoryPoints = (userId, category, source = completions) => {
    const today = new Date().toISOString().split('T')[0];
    return source
      .filter(c => c.userId === userId && c.date === today)
      .reduce((sum, c) => {
        const habit = habits.find(h => h.id === c.habitId);
        if (habit && habit.category === category) {
          return sum + (habit.points * (c.count || 1));
        }
        return sum;
      }, 0);
  };

  const getTodayCrystals = (userId) => {
    const crystals = { Mind: false, Body: false, Spirit: false };
    if (roomMembers.length < 2) return crystals;

    ['Mind', 'Body', 'Spirit'].forEach(category => {
      let maxPoints = -1;
      let winner = null;

      roomMembers.forEach(member => {
        const points = getCategoryPoints(member.id, category);
        if (points > maxPoints) {
          maxPoints = points;
          winner = member;
        } else if (points === maxPoints && points > 0) {
          winner = null;
        }
      });

      if (winner && winner.id === userId) crystals[category] = true;
    });

    return crystals;
  };

  const getTodayPoints = (userId) => {
    const today = new Date().toISOString().split('T')[0];
    return completions
      .filter(c => c.userId === userId && c.date === today)
      .reduce((sum, c) => {
        const habit = habits.find(h => h.id === c.habitId);
        return sum + ((habit?.points || 0) * (c.count || 1));
      }, 0);
  };

  const getWeeklyPoints = (userId) => {
    const weekStart = getWeekStart();
    return allCompletions
      .filter(c => c.userId === userId && c.date >= weekStart)
      .reduce((sum, c) => {
        const habit = habits.find(h => h.id === c.habitId);
        return sum + ((habit?.points || 0) * (c.count || 1));
      }, 0);
  };

  // Count how many days this week the user earned a crystal in a category
  const getWeeklyCrystals = (userId) => {
    let total = 0;
    const weekStart = getWeekStart();
    const today = new Date().toISOString().split('T')[0];
    
    // Get unique dates this week
    const dates = [...new Set(allCompletions.filter(c => c.date >= weekStart && c.date <= today).map(c => c.date))];
    
    dates.forEach(date => {
      ['Mind', 'Body', 'Spirit'].forEach(category => {
        let maxPoints = -1;
        let winner = null;

        roomMembers.forEach(member => {
          const points = allCompletions
            .filter(c => c.userId === member.id && c.date === date)
            .reduce((sum, c) => {
              const habit = habits.find(h => h.id === c.habitId);
              if (habit && habit.category === category) {
                return sum + (habit.points * (c.count || 1));
              }
              return sum;
            }, 0);

          if (points > maxPoints) {
            maxPoints = points;
            winner = member;
          } else if (points === maxPoints && points > 0) {
            winner = null;
          }
        });

        if (winner && winner.id === userId) total++;
      });
    });

    return total;
  };

  const getCompletionCount = (habitId) => {
    const today = new Date().toISOString().split('T')[0];
    const completion = completions.find(
      c => c.userId === currentUser.id && c.habitId === habitId && c.date === today
    );
    return completion?.count || 0;
  };

  const getLeaderboardData = () => {
    return roomMembers
      .map(member => {
        const todayPts = getTodayPoints(member.id);
        const weeklyPts = getWeeklyPoints(member.id);
        const crystals = getTodayCrystals(member.id);
        const weeklyCrystals = getWeeklyCrystals(member.id);
        return { member, todayPts, weeklyPts, crystals, weeklyCrystals };
      })
      .sort((a, b) => {
        if (leaderboardTab === 'today') return b.todayPts - a.todayPts;
        return b.weeklyPts - a.weeklyPts;
      });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm tracking-widest uppercase animate-pulse">Loading...</div>
      </div>
    );
  }

  const myCrystals = currentUser && currentRoom ? getTodayCrystals(currentUser.id) : {};
  const myPoints = currentUser && currentRoom ? getTodayPoints(currentUser.id) : 0;
  const isPerfect = myCrystals.Mind && myCrystals.Body && myCrystals.Spirit;

  // --- AUTH SCREENS ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-extralight tracking-[0.3em] text-stone-900 mb-3">TRAX</h1>
            <p className="text-stone-400 text-xs tracking-[0.2em] uppercase">Compete · Track · Win</p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/60 p-8 shadow-sm">
            {view === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 focus:bg-white transition-all text-sm"
                  required
                  disabled={loading}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 focus:bg-white transition-all text-sm"
                  required
                  disabled={loading}
                />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button 
                  type="submit" 
                  className="w-full bg-stone-900 text-white py-3.5 rounded-xl hover:bg-stone-800 disabled:opacity-50 transition-colors text-sm font-medium tracking-wide"
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => { setView('signup'); setError(''); }}
                  className="w-full text-stone-500 py-2 hover:text-stone-900 text-sm transition-colors"
                  disabled={loading}
                >
                  Create Account
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 focus:bg-white transition-all text-sm"
                  required
                  disabled={loading}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 focus:bg-white transition-all text-sm"
                  required
                  disabled={loading}
                />
                <input
                  type="password"
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 focus:bg-white transition-all text-sm"
                  required
                  minLength={6}
                  disabled={loading}
                />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button 
                  type="submit" 
                  className="w-full bg-stone-900 text-white py-3.5 rounded-xl hover:bg-stone-800 disabled:opacity-50 transition-colors text-sm font-medium tracking-wide"
                  disabled={loading}
                >
                  {loading ? 'Creating account...' : 'Sign Up'}
                </button>
                <button
                  type="button"
                  onClick={() => { setView('login'); setError(''); }}
                  className="w-full text-stone-500 py-2 hover:text-stone-900 text-sm transition-colors"
                  disabled={loading}
                >
                  Back to Login
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- ROOM SELECTION ---
  if (showRoomModal) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extralight tracking-wider text-stone-900 mb-2">Welcome, {currentUser.username}</h1>
            <p className="text-stone-400 text-xs tracking-wider uppercase">Create or join a room</p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/60 p-6 shadow-sm">
            <h2 className="text-sm font-medium text-stone-900 mb-4 tracking-wide">Create Room</h2>
            <button
              onClick={createRoom}
              className="w-full bg-stone-900 text-white py-3.5 rounded-xl hover:bg-stone-800 disabled:opacity-50 transition-colors text-sm font-medium"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create New Room'}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/60 p-6 shadow-sm">
            <h2 className="text-sm font-medium text-stone-900 mb-4 tracking-wide">Join Room</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ROOM CODE"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 text-sm font-mono tracking-widest text-center"
                maxLength={6}
                disabled={loading}
              />
              <button
                onClick={joinRoom}
                className="px-6 py-3.5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 disabled:opacity-50 transition-colors text-sm font-medium"
                disabled={loading}
              >
                {loading ? '...' : 'Join'}
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-3 text-center">{error}</p>}
          </div>

          <button
            onClick={() => signOut(auth)}
            className="w-full text-stone-400 py-2 hover:text-stone-600 text-xs transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // --- MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-stone-200/60 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extralight tracking-[0.2em] text-stone-900">TRAX</h1>
            <div className="flex items-center gap-2">
              {roomMembers.length > 1 && (
                <button
                  onClick={() => setShowLeaderboard(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors text-xs font-medium"
                >
                  <Trophy size={14} />
                  <span className="hidden sm:inline">Leaderboard</span>
                </button>
              )}
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition-colors text-xs"
              >
                <UserPlus size={14} />
                <span className="hidden sm:inline">Invite</span>
              </button>
              <button onClick={() => setShowHelp(true)} className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors">
                <HelpCircle size={16} />
              </button>
              <button onClick={() => signOut(auth)} className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-stone-200/60 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-stone-400 text-[10px] tracking-wider uppercase mb-1">
              <Clock size={10} />
              <span>Resets in</span>
            </div>
            <div className="text-lg font-light text-stone-900 tabular-nums">{timeDisplay}</div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200/60 p-4 shadow-sm">
            <div className="text-stone-400 text-[10px] tracking-wider uppercase mb-1">Points</div>
            <div className="text-lg font-light text-stone-900">{myPoints}</div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200/60 p-4 shadow-sm">
            <div className="text-stone-400 text-[10px] tracking-wider uppercase mb-1">
              Crystals {isPerfect && <span className="text-amber-500 ml-1">✦</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-3.5 h-3.5 rounded-full ${myCrystals.Mind ? 'bg-blue-500' : 'bg-stone-200'} transition-colors`} />
              <div className={`w-3.5 h-3.5 rounded-full ${myCrystals.Body ? 'bg-red-500' : 'bg-stone-200'} transition-colors`} />
              <div className={`w-3.5 h-3.5 rounded-full ${myCrystals.Spirit ? 'bg-amber-500' : 'bg-stone-200'} transition-colors`} />
            </div>
          </div>
        </div>

        {/* Habits by Category */}
        <div className="space-y-6">
          {['Mind', 'Body', 'Spirit'].map(category => {
            const categoryHabits = habits.filter(h => h.category === category);
            if (categoryHabits.length === 0) return null;

            const catColors = {
              Mind: { dot: 'bg-blue-500', activeBg: 'bg-blue-50', activeBorder: 'border-blue-200', activeText: 'text-blue-600', btnActive: 'bg-blue-500 text-white border-blue-500', btnMaxed: 'bg-emerald-500 text-white border-emerald-500' },
              Body: { dot: 'bg-red-500', activeBg: 'bg-red-50', activeBorder: 'border-red-200', activeText: 'text-red-600', btnActive: 'bg-red-500 text-white border-red-500', btnMaxed: 'bg-emerald-500 text-white border-emerald-500' },
              Spirit: { dot: 'bg-amber-500', activeBg: 'bg-amber-50', activeBorder: 'border-amber-200', activeText: 'text-amber-600', btnActive: 'bg-amber-500 text-white border-amber-500', btnMaxed: 'bg-emerald-500 text-white border-emerald-500' }
            };
            const cc = catColors[category];

            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${cc.dot}`} />
                  <h2 className="text-[11px] font-medium text-stone-400 tracking-[0.15em] uppercase">{category}</h2>
                </div>
                <div className="space-y-2">
                  {categoryHabits.map(habit => {
                    const count = getCompletionCount(habit.id);
                    const isComplete = count > 0;
                    const isMaxed = habit.isRepeatable && count >= habit.maxCompletions;

                    return (
                      <div
                        key={habit.id}
                        className={`bg-white border rounded-xl p-3.5 flex items-center justify-between transition-all ${
                          isComplete ? `${cc.activeBorder} ${cc.activeBg}` : 'border-stone-200/60'
                        } ${isMaxed ? 'border-emerald-200 bg-emerald-50/50' : ''}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {habit.isRepeatable ? (
                            /* FIXED +/- CONTROLS for repeatable habits */
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => decrementCompletion(habit.id)}
                                disabled={count === 0}
                                className="w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center hover:border-stone-400 hover:bg-stone-50 transition-all text-stone-500 disabled:opacity-30 disabled:hover:border-stone-200 disabled:hover:bg-transparent text-sm"
                              >
                                −
                              </button>
                              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-all ${
                                isMaxed
                                  ? cc.btnMaxed
                                  : isComplete
                                    ? cc.btnActive
                                    : 'border-stone-200 text-stone-400'
                              }`}>
                                {count}
                              </div>
                              <button
                                onClick={() => incrementCompletion(habit.id)}
                                disabled={isMaxed}
                                className="w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center hover:border-stone-400 hover:bg-stone-50 transition-all text-stone-500 disabled:opacity-30 disabled:hover:border-stone-200 disabled:hover:bg-transparent text-sm"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            /* Non-repeatable: simple checkbox toggle */
                            <button
                              onClick={() => toggleCompletion(habit.id)}
                              className="shrink-0"
                            >
                              {isComplete ? (
                                <CheckCircle size={22} className={cc.activeText} />
                              ) : (
                                <Circle size={22} className="text-stone-300" />
                              )}
                            </button>
                          )}
                          <div className="min-w-0">
                            <div className={`text-sm ${isComplete ? 'text-stone-900' : 'text-stone-600'} truncate`}>{habit.name}</div>
                            <div className="text-[11px] text-stone-400">
                              {habit.points} pts{habit.isRepeatable && ` · ${count}/${habit.maxCompletions}`}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => deleteHabit(habit.id)} className="p-1.5 text-stone-300 hover:text-red-400 transition-colors shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {habits.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-stone-400 text-sm mb-5">No habits yet</p>
              <button
                onClick={() => setShowAddHabit(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors text-sm"
              >
                <Plus size={18} />
                Add Your First Habit
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddHabit(true)}
              className="w-full border-2 border-dashed border-stone-200 rounded-xl p-4 text-stone-400 hover:border-stone-300 hover:text-stone-600 flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={15} />
              <span className="text-xs tracking-wide">Add Habit</span>
            </button>
          )}
        </div>
      </div>

      {/* ====== MODALS ====== */}

      {/* Add Habit Modal */}
      {showAddHabit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-light text-stone-900">Add Habit</h2>
              <button onClick={() => setShowAddHabit(false)} className="text-stone-400 hover:text-stone-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            {habits.length === 0 && (
              <button
                onClick={loadDefaultHabits}
                className="w-full mb-5 px-4 py-3 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors text-sm font-medium"
              >
                Load Default Habits
              </button>
            )}
            
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Habit name"
                value={newHabit.name}
                onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 focus:bg-white transition-all text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newHabit.category}
                  onChange={(e) => setNewHabit({ ...newHabit, category: e.target.value })}
                  className="px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 text-sm"
                >
                  <option value="Mind">Mind</option>
                  <option value="Body">Body</option>
                  <option value="Spirit">Spirit</option>
                </select>
                <input
                  type="number"
                  placeholder="Points"
                  value={newHabit.points}
                  onChange={(e) => setNewHabit({ ...newHabit, points: e.target.value })}
                  className="px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 text-sm"
                />
              </div>
              <label className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  checked={newHabit.isRepeatable}
                  onChange={(e) => setNewHabit({ ...newHabit, isRepeatable: e.target.checked, maxCompletions: e.target.checked ? 5 : 1 })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-stone-600">Repeatable habit</span>
              </label>
              {newHabit.isRepeatable && (
                <input
                  type="number"
                  placeholder="Max completions per day"
                  value={newHabit.maxCompletions}
                  onChange={(e) => setNewHabit({ ...newHabit, maxCompletions: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 text-sm"
                />
              )}
              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddHabit(false)}
                  className="flex-1 px-4 py-3 border border-stone-200 rounded-xl hover:bg-stone-50 text-sm text-stone-600 transition-colors"
                >
                  Cancel
                </button>
                <button onClick={addHabit} className="flex-1 px-4 py-3 bg-stone-900 text-white rounded-xl hover:bg-stone-800 text-sm font-medium transition-colors">
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FUNCTIONAL LEADERBOARD MODAL */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                <h2 className="text-lg font-light text-stone-900">Leaderboard</h2>
              </div>
              <button onClick={() => setShowLeaderboard(false)} className="text-stone-400 hover:text-stone-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-1 mb-5 bg-stone-100 rounded-lg p-1">
              {['today', 'week'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setLeaderboardTab(tab)}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all tracking-wide uppercase ${
                    leaderboardTab === tab
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-400 hover:text-stone-600'
                  }`}
                >
                  {tab === 'today' ? 'Today' : 'This Week'}
                </button>
              ))}
            </div>

            {/* Rankings */}
            <div className="space-y-2">
              {getLeaderboardData().map((item, index) => {
                const pts = leaderboardTab === 'today' ? item.todayPts : item.weeklyPts;
                const isMe = item.member.id === currentUser.id;
                const rankEmojis = ['🥇', '🥈', '🥉'];

                return (
                  <div
                    key={item.member.id}
                    className={`rounded-xl p-4 transition-all ${
                      isMe 
                        ? 'bg-stone-900 text-white' 
                        : 'bg-stone-50 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-lg w-8 text-center">
                          {index < 3 ? rankEmojis[index] : <span className={`text-sm font-light ${isMe ? 'text-stone-400' : 'text-stone-400'}`}>{index + 1}</span>}
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${isMe ? 'text-white' : 'text-stone-900'}`}>
                            {item.member.username}
                            {isMe && <span className="text-[10px] ml-1.5 opacity-50">(you)</span>}
                          </div>
                          <div className={`text-xs ${isMe ? 'text-stone-400' : 'text-stone-400'}`}>
                            {pts} points
                            {leaderboardTab === 'week' && ` · ${item.weeklyCrystals} crystals`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {leaderboardTab === 'today' && (
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${item.crystals.Mind ? 'bg-blue-400' : isMe ? 'bg-stone-700' : 'bg-stone-200'}`} />
                            <div className={`w-2.5 h-2.5 rounded-full ${item.crystals.Body ? 'bg-red-400' : isMe ? 'bg-stone-700' : 'bg-stone-200'}`} />
                            <div className={`w-2.5 h-2.5 rounded-full ${item.crystals.Spirit ? 'bg-amber-400' : isMe ? 'bg-stone-700' : 'bg-stone-200'}`} />
                          </div>
                        )}
                        {!isMe && (
                          <button
                            onClick={() => { setShowLeaderboard(false); setShowCompetitor(item.member); }}
                            className="text-[10px] text-stone-400 hover:text-stone-600 tracking-wider uppercase"
                          >
                            View
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {roomMembers.length < 2 && (
              <div className="text-center py-8 text-stone-400 text-sm">
                Invite friends to see the leaderboard in action
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-light text-stone-900">How TRAX Works</h2>
              <button onClick={() => setShowHelp(false)} className="text-stone-400 hover:text-stone-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 text-sm text-stone-500">
              <div>
                <p className="font-medium text-stone-900 mb-1">Complete habits, earn points</p>
                <p>Use + and − to track repeatable habits, or tap the circle for one-time habits. Win each category daily to earn a crystal.</p>
              </div>
              <div>
                <p className="font-medium text-stone-900 mb-1">Compete with friends</p>
                <p>Share your room code to invite others. Check the leaderboard to see who's winning today and this week.</p>
              </div>
              <div>
                <p className="font-medium text-stone-900 mb-1">Categories</p>
                <div className="flex items-center gap-2 mt-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span>Mind — Learning, reading, studying</span></div>
                <div className="flex items-center gap-2 mt-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><span>Body — Exercise, nutrition, sleep</span></div>
                <div className="flex items-center gap-2 mt-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span>Spirit — Meditation, journaling, mindfulness</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-xl">
            <div className="text-center">
              <h2 className="text-xl font-light text-stone-900 mb-2">Invite Friends</h2>
              <p className="text-xs text-stone-400 mb-6 tracking-wider uppercase">Share this room code</p>
              
              <div className="mb-6">
                <code className="inline-block px-8 py-4 bg-stone-900 text-white text-3xl font-mono rounded-xl tracking-[0.3em]">
                  {currentRoom?.code}
                </code>
              </div>

              <button
                onClick={copyCode}
                className="w-full mb-3 px-6 py-3 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>

              <button
                onClick={() => setShowInviteModal(false)}
                className="w-full text-stone-500 py-2 hover:text-stone-900 text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Competitor Detail Modal */}
      {showCompetitor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-light text-stone-900">{showCompetitor.username}</h2>
              <button onClick={() => setShowCompetitor(null)} className="text-stone-400 hover:text-stone-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <div className="text-2xl font-light text-blue-600">{getCategoryPoints(showCompetitor.id, 'Mind')}</div>
                  <div className="text-[10px] text-stone-400 mt-1 tracking-wider uppercase">Mind</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-xl">
                  <div className="text-2xl font-light text-red-600">{getCategoryPoints(showCompetitor.id, 'Body')}</div>
                  <div className="text-[10px] text-stone-400 mt-1 tracking-wider uppercase">Body</div>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-xl">
                  <div className="text-2xl font-light text-amber-600">{getCategoryPoints(showCompetitor.id, 'Spirit')}</div>
                  <div className="text-[10px] text-stone-400 mt-1 tracking-wider uppercase">Spirit</div>
                </div>
              </div>
              <div className="text-center p-4 bg-stone-50 rounded-xl">
                <div className="text-3xl font-light text-stone-900">{getTodayPoints(showCompetitor.id)}</div>
                <div className="text-[10px] text-stone-400 mt-1 tracking-wider uppercase">Total Today</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
