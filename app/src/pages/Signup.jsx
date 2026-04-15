import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, KeyRound } from 'lucide-react';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    if (password.length < 6) {
      return setError('Passkey must be at least 6 characters');
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || 'Signup failed');

      login(data);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md glass-card p-10 rounded-3xl animate-in fade-in zoom-in duration-500">

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-success/20 text-success flex items-center justify-center mb-4">
            <KeyRound size={24} />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Request Access</h2>
          <p className="text-sm text-zinc-500 mt-2 font-medium tracking-wide">Register a new operator node</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm font-bold text-center mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-success/50 transition-all font-medium"
                placeholder="Enter identifier"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Passkey</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-success/50 transition-all font-medium tracking-widest"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-success/50 transition-all font-medium tracking-widest"
                placeholder="Confirm passkey"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-success hover:bg-emerald-600 focus:ring-4 focus:ring-success/30 text-white font-bold tracking-widest transition-all mt-6 disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            {loading ? 'REGISTERING...' : 'REGISTER NODE'}
          </button>
        </form>

        <p className="text-center text-xs font-semibold text-zinc-500 mt-8">
          Already authorized? <Link to="/login" className="text-success hover:underline">SIGN IN</Link>
        </p>
      </div>
    </div>
  );
}
