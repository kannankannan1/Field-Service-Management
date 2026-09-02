import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../api/client';
import { Button, Input } from '../components/ui';
import { useQueryClient } from '@tanstack/react-query';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(username, password);
      qc.clear();
      if (user.role === 'TECHNICIAN') navigate('/my-jobs');
      else if (user.role === 'CUSTOMER') navigate('/portal');
      else navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600 text-2xl font-bold text-white">
            K
          </div>
          <h1 className="text-2xl font-bold text-white">Keystone</h1>
          <p className="mt-1 text-sm text-slate-400">Field Service Management</p>
        </div>
        <form
          onSubmit={submit}
          className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl"
        >
          {error && (
            <div className="mb-4 rounded-md border border-red-700 bg-red-900/40 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="border-slate-600 bg-slate-700 text-white placeholder-slate-400"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="border-slate-600 bg-slate-700 text-white placeholder-slate-400"
            />
          </div>
          <Button type="submit" loading={loading} className="mt-6 w-full">
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          Demo users: manager1 · dispatcher1 · tech1 · tech2 · customer1
        </p>
        <p className="mt-3 text-center text-sm text-slate-400">
          New here?{' '}
          <Link to="/signup" className="font-medium text-brand-400 hover:text-brand-300">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
