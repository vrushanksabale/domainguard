import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';

export const ForgotPassword: React.FC = () => {
  const { resetPassword, error, clearError } = useAuth();
  const { showToast } = useWeb3();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await resetPassword(email);
      setSent(true);
      showToast('Password reset instructions sent to your email.', 'success');
    } catch {
      // Handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#0B1F3A]">Reset Password</h2>
          <p className="mt-1 text-xs text-slate-500">
            Enter your email to receive recovery instructions
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start justify-between">
            <span>{error}</span>
            <button onClick={clearError} className="text-rose-500 hover:text-rose-700">✕</button>
          </div>
        )}

        {sent ? (
          <div className="mt-6 text-center">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              Password reset link sent to <strong>{email}</strong>. Check your inbox and follow the link to reset your credentials.
            </div>
            <Link
              to="/login"
              className="mt-6 inline-block text-xs font-semibold text-teal-600 hover:text-teal-700"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                placeholder="user@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-md text-sm font-semibold text-white bg-[#0EA5A4] hover:bg-[#0c8a89] transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Sending link...' : 'Send Recovery Email'}
            </button>

            <p className="text-center text-xs text-slate-600">
              Remembered your credentials?{' '}
              <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-700">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
