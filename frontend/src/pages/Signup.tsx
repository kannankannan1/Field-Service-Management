import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../api/client';
import { authApi } from '../api';
import { Button, Input, Select } from '../components/ui';
import { useQueryClient } from '@tanstack/react-query';

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'CUSTOMER' as 'CUSTOMER' | 'TECHNICIAN',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await authApi.register({
        username: form.username,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role,
      });
      await login(form.username, form.password);
      qc.clear();
      navigate(form.role === 'TECHNICIAN' ? '/my-jobs' : '/portal');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'border-slate-600 bg-slate-700 text-white placeholder-slate-400';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600 text-2xl font-bold text-white">
            K
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="mt-1 text-sm text-slate-400">Keystone Field Service Management</p>
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
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                value={form.firstName}
                onChange={set('firstName')}
                required
                className={inputCls}
              />
              <Input
                label="Last name"
                value={form.lastName}
                onChange={set('lastName')}
                required
                className={inputCls}
              />
            </div>
            <Input
              label="Username"
              value={form.username}
              onChange={set('username')}
              autoComplete="username"
              required
              minLength={3}
              className={inputCls}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
              className={inputCls}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={set('phone')}
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Password"
                type="password"
                value={form.password}
                onChange={set('password')}
                autoComplete="new-password"
                required
                minLength={8}
                className={inputCls}
              />
              <Input
                label="Confirm password"
                type="password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                autoComplete="new-password"
                required
                className={inputCls}
              />
            </div>
            <Select
              label="I am a"
              value={form.role}
              onChange={set('role')}
              className="border-slate-600 bg-slate-700 text-white"
            >
              <option value="CUSTOMER">Customer</option>
              <option value="TECHNICIAN">Technician</option>
            </Select>
          </div>
          <Button type="submit" loading={loading} className="mt-6 w-full">
            Create account
          </Button>
          <p className="mt-4 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand-400 hover:text-brand-300">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
