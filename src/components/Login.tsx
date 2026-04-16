import React, { useState } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { motion } from 'motion/react';
import { AlertCircle, Lock, Mail } from 'lucide-react';
import { auth } from '../lib/firebase';

interface LoginProps {
  onSuccess?: () => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      onSuccess?.();
    } catch (err: any) {
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Invalid email or password.');
      } else {
        setError('Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError('Enter your email address first, then request a password reset.');
      setMessage('');
      return;
    }

    setError('');
    setMessage('');
    setResettingPassword(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('Password reset email sent. Check your inbox and spam folder.');
    } catch {
      setError('We could not send a reset email for that address. Please confirm it and try again.');
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-dltt-green p-8 text-center">
        <div className="w-16 h-16 bg-dltt-yellow rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-dltt-green font-bold text-3xl">D</span>
        </div>
        <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
        <p className="text-green-100 mt-2">Login to your DLTT portal</p>
      </div>

      <div className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-dltt-green focus:border-dltt-green"
                placeholder="teacher@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-dltt-green focus:border-dltt-green"
                placeholder="Enter your password"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <p className="text-xs text-gray-500">
                If your account was created by an admin, your initial password is your phone number.
              </p>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resettingPassword}
                className="text-xs font-semibold text-dltt-green hover:underline disabled:opacity-50"
              >
                {resettingPassword ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg"
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </motion.div>
          )}

          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm bg-green-50 text-green-700 p-3 rounded-lg"
            >
              {message}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dltt-green text-white py-3 rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-500 text-xs italic">
            Access is restricted to authorized personnel. Please contact your coordinator for credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
