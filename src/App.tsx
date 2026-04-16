import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { AlertCircle, LogOut, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './lib/firebase';
import { UserProfile } from './types';

import PublicDashboard from './components/PublicDashboard';
import LandingPage from './components/LandingPage';
import TeacherDashboard from './components/TeacherDashboard';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import Login from './components/Login';
import foundationLogo from './assets/foundation-logo.png';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authIssue, setAuthIssue] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribeUserDoc?.();
      unsubscribeUserDoc = undefined;
      setAuthIssue(null);

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const isSuperAdminEmail = firebaseUser.email === 'omobolajiokediji@gmail.com';

      if (isSuperAdminEmail) {
        const defaultSuperAdmin: UserProfile = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Super Admin',
          email: firebaseUser.email || '',
          phone: '',
          role: 'super-admin',
          state: 'Lagos State',
          approvedForCertificate: true,
          totalScore: 0,
          attendance: {},
          assignmentCompletion: {},
        };

        await setDoc(userDocRef, defaultSuperAdmin, { merge: true });
      }

      unsubscribeUserDoc = onSnapshot(
        userDocRef,
        (userDoc) => {
          if (!userDoc.exists()) {
            setUser(null);
            setAuthIssue(
              'Your authentication account exists, but your portal profile has not been provisioned yet. Please contact your coordinator.',
            );
            setLoading(false);
            return;
          }

          const userData = userDoc.data() as UserProfile;
          setUser(
            isSuperAdminEmail
              ? { ...userData, role: 'super-admin', approvedForCertificate: true }
              : userData,
          );
          setAuthIssue(null);
          setLoading(false);
        },
        () => {
          setUser(null);
          setAuthIssue('We could not load your portal profile right now. Please try again.');
          setLoading(false);
        },
      );
    });

    return () => {
      unsubscribeUserDoc?.();
      unsubscribeAuth();
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dltt-green"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-xl overflow-hidden shadow-sm border border-slate-100 bg-white">
                  <img src={foundationLogo} alt="Foundation logo placeholder" className="w-full h-full object-cover" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-dltt-green">DEFINED Project</p>
                  <span className="text-xl font-bold text-gray-900">DLTT Portal</span>
                </div>
              </Link>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <Link to="/" className="text-gray-600 hover:text-dltt-green font-medium transition-colors">
                Home
              </Link>
              <Link to="/stats" className="text-gray-600 hover:text-dltt-green font-medium transition-colors">
                Stats
              </Link>
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-gray-600 hover:text-dltt-green font-medium transition-colors"
                  >
                    Dashboard
                  </Link>
                  <div className="flex items-center space-x-4 ml-4 pl-4 border-l border-gray-200">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 leading-none">{user.name}</p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">{user.role}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <LogOut size={20} />
                    </button>
                  </div>
                </>
              ) : (
                <Link
                  to="/login"
                  className="bg-dltt-green text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Login
                </Link>
              )}
            </div>

            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-600 p-2">
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-2">
                <Link
                  to="/"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                >
                  Home
                </Link>
                <Link
                  to="/stats"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                >
                  Stats
                </Link>
                {user ? (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-dltt-green hover:bg-green-50"
                  >
                    Login
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="flex-grow">
        {authIssue ? (
          <div className="max-w-xl mx-auto px-4 py-16">
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Profile Not Ready</h1>
                <p className="text-gray-600 mt-2">{authIssue}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-dltt-green text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/stats" element={<PublicDashboard />} />
            <Route
              path="/login"
              element={
                user ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center p-4">
                    <Login onSuccess={() => navigate('/dashboard')} />
                  </div>
                )
              }
            />
            <Route
              path="/dashboard"
              element={
                user ? (
                  user.role === 'super-admin' ? (
                    <SuperAdminDashboard />
                  ) : user.role === 'admin' ? (
                    <AdminDashboard />
                  ) : (
                    <TeacherDashboard user={user} />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
          </Routes>
        )}
      </main>

      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            (c) {new Date().getFullYear()} Odu&apos;a Investment Foundation. DEFINED Project.
          </p>
        </div>
      </footer>
    </div>
  );
}
