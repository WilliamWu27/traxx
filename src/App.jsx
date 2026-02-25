import React, { useState, useEffect } from 'react';
import { Clock, Circle, CheckCircle, Plus, X, LogOut, Copy, Check, UserPlus, HelpCircle, Users, Minus } from 'lucide-react';
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
  const [roomMembers, setRoomMembers] = useState([]);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showCompetitor, setShowCompetitor] = useState(null);
  const [loading, setLoading] = useState(false);
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

  const loadDefaultHabits = async () => {
    const defaultHabits = [
      // Mind
      { name: 'Study/homework (per hour)', category: 'Mind', points: 15, isRepeatable: true, maxCompletions: 10 },
      { name: 'Learn something new', category: 'Mind', points: 20, isRepeatable: false, maxCompletions: 1 },
      { name: 'Side project', category: 'Mind', points: 20, isRepeatable: false, maxCompletions: 1 },
      { name: 'Reading (per 30 mins)', category: 'Mind', points: 10, isRepeatable: true, maxCompletions: 10 },
      // Body
      { name: 'Exercise (per 30 mins)', category: 'Body', points: 10, isRepeatable: true, maxCompletions: 10 },
      { name: 'Water (per glass)', category: 'Body', points: 1, isRepeatable: true, maxCompletions: 8 },
      { name: 'Eating healthy all day', category: 'Body', points: 15, isRepeatable: false, maxCompletions: 1 },
      { name: 'Sleeping well and early', category: 'Body', points: 15, isRepeatable: false, maxCompletions: 1 },
      { name: 'Stretching (5 mins)', category: 'Body', points: 10, isRepeatable: false, maxCompletions: 1 },
      // Spirit
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

  useEffect(() => {
    if (!currentUser || !currentRoom) return;

    const habitsQuery = query(collection(db, 'habits'), where('roomId', '==', currentRoom.id));
    const habitsUnsub = onSnapshot(habitsQuery, (snapshot) => {
      setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const today = new Date().toISOString().split('T')[0];
    const completionsQuery = query(
      collection(db, 'completions'),
      where('roomId', '==', currentRoom.id),
      where('date', '>=', today)
    );
    const completionsUnsub = onSnapshot(completionsQuery, (snapshot) => {
      setCompletions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const membersQuery = query(collection(db, 'users'), where('roomId', '==', currentRoom.id));
    const membersUnsub = onSnapshot(membersQuery, (snapshot) => {
      setRoomMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      habitsUnsub();
      completionsUnsub();
      membersUnsub();
    };
  }, [currentUser, currentRoom]);

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
    if (!window.confirm('Delete?')) return;
    try {
      await deleteDoc(doc(db, 'habits', habitId));
    } catch (err) {
      console.error('Delete habit error:', err);
    }
  };

  const incrementCompletion = async (habitId) => {
    const today = new Date().toISOString().split('T')[0];
    const habit = habits.find(h => h.id === habitId);
    if (!habit || !habit.isRepeatable) return;

    const existing = completions.find(
      c => c.userId === currentUser.id && c.habitId === habitId && c.date === today
    );

    try {
      if (existing && existing.count < habit.maxCompletions) {
        await updateDoc(doc(db, 'completions', existing.id), { count: existing.count + 1 });
      } else if (!existing) {
        await setDoc(doc(db, 'completions', Date.now().toString()), {
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

  const decrementCompletion = async (habitId) => {
    const today = new Date().toISOString().split('T')[0];
    const habit = habits.find(h => h.id === habitId);
    if (!habit || !habit.isRepeatable) return;

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

  const toggleCompletion = async (habitId) => {
    const today = new Date().toISOString().split('T')[0];
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const existing = completions.find(
      c => c.userId === currentUser.id && c.habitId === habitId && c.date === today
    );

    try {
      if (existing) {
        await deleteDoc(doc(db, 'completions', existing.id));
      } else {
        await setDoc(doc(db, 'completions', Date.now().toString()), {
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

  const getCategoryPoints = (userId, category) => {
    const today = new Date().toISOString().split('T')[0];
    return completions
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

  const getCompletionCount = (habitId) => {
    const today = new Date().toISOString().split('T')[0];
    const completion = completions.find(
      c => c.userId === currentUser.id && c.habitId === habitId && c.date === today
    );
    return completion?.count || 0;
  };

  const getTimeUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const myCrystals = currentUser && currentRoom ? getTodayCrystals(currentUser.id) : {};
  const myPoints = currentUser && currentRoom ? getTodayPoints(currentUser.id) : 0;
  const isPerfect = myCrystals.Mind && myCrystals.Body && myCrystals.Spirit;

  return (
    <>
      {!currentUser ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-light text-gray-900 mb-2">TRAX</h1>
              <p className="text-gray-400 text-sm">Compete. Track. Win.</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-8">
              {view === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    required
                    disabled={loading}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    required
                    disabled={loading}
                  />
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button 
                    type="submit" 
                    className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Log In'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setView('signup'); setError(''); }}
                    className="w-full text-gray-600 py-3 hover:text-gray-900"
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    required
                    disabled={loading}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    required
                    disabled={loading}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    required
                    minLength={6}
                    disabled={loading}
                  />
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button 
                    type="submit" 
                    className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Sign Up'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setView('login'); setError(''); }}
                    className="w-full text-gray-600 py-3 hover:text-gray-900"
                    disabled={loading}
                  >
                    Back
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : showRoomModal ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-4">
            <div className="text-center mb-4">
              <h1 className="text-2xl font-light text-gray-900 mb-2">Welcome, {currentUser.username}</h1>
              <p className="text-gray-500 text-sm">Create or join a competition room</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-medium text-gray-900 mb-4">Create Room</h2>
              <button
                onClick={createRoom}
                className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-medium text-gray-900 mb-4">Join Room</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="CODE"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                  maxLength={6}
                  disabled={loading}
                />
                <button
                  onClick={joinRoom}
                  className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? '...' : 'Join'}
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-light text-gray-900">TRAX</h1>
                <div className="flex items-center gap-3">
                  {roomMembers.length > 1 && (
                    <button
                      onClick={() => setShowLeaderboard(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <Users size={18} />
                      <span className="hidden sm:inline">Leaderboard</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <UserPlus size={18} />
                    <span className="hidden sm:inline">Invite</span>
                  </button>
                  <button
                    onClick={() => setShowHelp(true)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <HelpCircle size={20} />
                  </button>
                  <button onClick={() => signOut(auth)} className="p-2 text-gray-400 hover:text-gray-600">
                    <LogOut size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Clock size={12} />
                  <span>Resets</span>
                </div>
                <div className="text-xl font-light text-gray-900">{getTimeUntilMidnight()}</div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-gray-400 text-xs mb-1">Points</div>
                <div className="text-xl font-light text-gray-900">{myPoints}</div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4 md:col-span-2">
                <div className="text-gray-400 text-xs mb-2">Crystals {isPerfect && <span className="text-yellow-600 ml-2">Perfect Day!</span>}</div>
                <div className="flex items-center gap-3">
                  <Circle size={16} fill="currentColor" className={myCrystals.Mind ? 'text-blue-600' : 'text-gray-300'} />
                  <Circle size={16} fill="currentColor" className={myCrystals.Body ? 'text-red-600' : 'text-gray-300'} />
                  <Circle size={16} fill="currentColor" className={myCrystals.Spirit ? 'text-amber-600' : 'text-gray-300'} />
                </div>
              </div>
            </div>

            {/* Habits */}
            <div className="space-y-6">
              {['Mind', 'Body', 'Spirit'].map(category => {
                const categoryHabits = habits.filter(h => h.category === category);
                if (categoryHabits.length === 0) return null;

                const colors = {
                  Mind: { border: 'border-blue-300', bg: 'bg-blue-50', text: 'text-blue-600' },
                  Body: { border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-600' },
                  Spirit: { border: 'border-amber-300', bg: 'bg-amber-50', text: 'text-amber-600' }
                };

                return (
                  <div key={category}>
                    <h2 className="text-xs font-medium text-gray-400 mb-3">{category.toUpperCase()}</h2>
                    <div className="space-y-2">
                      {categoryHabits.map(habit => {
                        const count = getCompletionCount(habit.id);
                        const isComplete = count > 0;
                        const isMaxed = habit.isRepeatable && count >= habit.maxCompletions;

                        return (
                          <div
                            key={habit.id}
                            className={`bg-white border rounded-lg p-4 flex items-center justify-between ${
                              isComplete ? `${colors[category].border} ${colors[category].bg}` : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              {habit.isRepeatable ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => decrementCompletion(habit.id)}
                                    className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-gray-400 transition text-gray-600 font-bold"
                                    disabled={count === 0}
                                  >
                                    −
                                  </button>
                                  <button
                                    onClick={() => toggleCompletion(habit.id)}
                                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition font-bold text-xl ${
                                      isComplete
                                        ? isMaxed
                                          ? 'bg-green-600 border-green-600 text-white'
                                          : `${colors[category].text} border-current`
                                        : 'border-gray-300 text-gray-400'
                                    }`}
                                  >
                                    {isComplete ? count : '+'}
                                  </button>
                                  <button
                                    onClick={() => incrementCompletion(habit.id)}
                                    className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-gray-400 transition text-gray-600 font-bold"
                                    disabled={isMaxed}
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => toggleCompletion(habit.id)}
                                  className="flex items-center gap-3"
                                >
                                  {isComplete ? (
                                    <CheckCircle size={20} className={colors[category].text} />
                                  ) : (
                                    <Circle size={20} className="text-gray-300" />
                                  )}
                                </button>
                              )}
                              <div className="text-left">
                                <div className="text-gray-900 text-sm">{habit.name}</div>
                                <div className="text-xs text-gray-400">
                                  {habit.points}
                                  {habit.isRepeatable && ` • ${count}/${habit.maxCompletions}`}
                                </div>
                              </div>
                            </div>
                            <button onClick={() => deleteHabit(habit.id)} className="p-2 text-gray-300 hover:text-red-600">
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {habits.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm mb-4">No habits yet</p>
                  <button
                    onClick={() => setShowAddHabit(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                  >
                    <Plus size={20} />
                    Add Habit
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddHabit(true)}
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg p-4 text-gray-400 hover:border-gray-300 hover:text-gray-600 flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  <span className="text-sm">Add Habit</span>
                </button>
              )}
            </div>
          </div>

          {/* Modals continue... */}

          {/* Add Habit Modal */}
          {showAddHabit && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h2 className="text-xl font-light text-gray-900 mb-4">Add Habit</h2>
                
                {habits.length === 0 && (
                  <button
                    onClick={loadDefaultHabits}
                    className="w-full mb-4 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 text-sm font-medium"
                  >
                    Load Default Habits
                  </button>
                )}
                
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Habit name"
                    value={newHabit.name}
                    onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={newHabit.category}
                      onChange={(e) => setNewHabit({ ...newHabit, category: e.target.value })}
                      className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
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
                      className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    />
                  </div>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={newHabit.isRepeatable}
                      onChange={(e) => setNewHabit({ ...newHabit, isRepeatable: e.target.checked, maxCompletions: e.target.checked ? 5 : 1 })}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-gray-600">Repeatable</span>
                  </label>
                  {newHabit.isRepeatable && (
                    <input
                      type="number"
                      placeholder="Max per day"
                      value={newHabit.maxCompletions}
                      onChange={(e) => setNewHabit({ ...newHabit, maxCompletions: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    />
                  )}
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setShowAddHabit(false)}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button onClick={addHabit} className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Modal */}
          {showLeaderboard && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-light text-gray-900">Leaderboard</h2>
                  <button onClick={() => setShowLeaderboard(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>
                <div className="space-y-2">
                  {roomMembers
                    .map(member => ({ member, points: getTodayPoints(member.id), crystals: getTodayCrystals(member.id) }))
                    .sort((a, b) => b.points - a.points)
                    .map((item, index) => (
                      <div
                        key={item.member.id}
                        className={`p-4 rounded-lg ${
                          item.member.id === currentUser.id ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-purple-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              index === 0 ? 'bg-yellow-400 text-white' :
                              index === 1 ? 'bg-gray-400 text-white' :
                              index === 2 ? 'bg-orange-400 text-white' :
                              'bg-gray-200 text-gray-600'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{item.member.username}</div>
                              <div className="text-xs text-gray-500">{item.points} points</div>
                            </div>
                          </div>
                          <button
                            onClick={() => { setShowLeaderboard(false); setShowCompetitor(item.member); }}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            View
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Circle size={12} fill="currentColor" className={item.crystals.Mind ? 'text-blue-600' : 'text-gray-300'} />
                          <Circle size={12} fill="currentColor" className={item.crystals.Body ? 'text-red-600' : 'text-gray-300'} />
                          <Circle size={12} fill="currentColor" className={item.crystals.Spirit ? 'text-amber-600' : 'text-gray-300'} />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Help Modal */}
          {showHelp && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-light text-gray-900">How TRAX Works</h2>
                  <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>
                <div className="space-y-4 text-sm text-gray-600">
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Complete habits, earn points</p>
                    <p>Win each category (Mind/Body/Spirit) daily to earn a crystal</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Compete with friends</p>
                    <p>Share your room code to invite others. Most crystals wins the week</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Categories</p>
                    <p><strong>Mind:</strong> Learning, reading, studying</p>
                    <p><strong>Body:</strong> Exercise, nutrition, sleep</p>
                    <p><strong>Spirit:</strong> Meditation, journaling, mindfulness</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-8">
                <div className="text-center">
                  <h2 className="text-2xl font-light text-gray-900 mb-2">Invite Friends</h2>
                  <p className="text-sm text-gray-500 mb-6">Share this code</p>
                  
                  <div className="mb-6">
                    <code className="inline-block px-6 py-4 bg-gray-900 text-white text-3xl font-mono rounded-lg tracking-widest">
                      {currentRoom?.code}
                    </code>
                  </div>

                  <button
                    onClick={copyCode}
                    className="w-full mb-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>

                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="w-full text-gray-600 py-2 hover:text-gray-900"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Competitor Modal */}
          {showCompetitor && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-light text-gray-900">{showCompetitor.username}</h2>
                  <button onClick={() => setShowCompetitor(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-light text-blue-600">{getCategoryPoints(showCompetitor.id, 'Mind')}</div>
                      <div className="text-xs text-gray-400 mt-1">Mind</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-light text-red-600">{getCategoryPoints(showCompetitor.id, 'Body')}</div>
                      <div className="text-xs text-gray-400 mt-1">Body</div>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-light text-amber-600">{getCategoryPoints(showCompetitor.id, 'Spirit')}</div>
                      <div className="text-xs text-gray-400 mt-1">Spirit</div>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-3xl font-light text-gray-900">{getTodayPoints(showCompetitor.id)}</div>
                    <div className="text-sm text-gray-400 mt-1">Total</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
