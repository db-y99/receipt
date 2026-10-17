import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../navigation';

const logo = new URL('../logo.png', import.meta.url).href;

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!isEmail(trimmedEmail)) {
      setError('Email không hợp lệ.');
      return;
    }
    if (!password) {
      setError('Mật khẩu là bắt buộc.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      let data: { success?: boolean; error?: unknown; data?: { id?: unknown; username?: unknown; fullname?: unknown; display_name?: unknown } } = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok || !data.success || data.data?.id == null) {
        if (typeof data.error === 'string' && data.error) {
          setError(data.error);
        } else if (response.status >= 500) {
          setError('Không đăng nhập được. Thử lại sau.');
        } else {
          setError('Email hoặc mật khẩu không đúng.');
        }
        return;
      }

      const fullname =
        typeof data.data.fullname === 'string' && data.data.fullname.trim()
          ? data.data.fullname
          : typeof data.data.display_name === 'string'
            ? data.data.display_name
            : undefined;

      signIn({
        id: String(data.data.id),
        username: typeof data.data.username === 'string' ? data.data.username : undefined,
        fullname,
      });
      navigate('/');
    } catch (submitError) {
      console.error('Login Error:', submitError);
      setError('Không kết nối được máy chủ. Thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <img src={logo} alt="Y99 Logo" className="w-14 h-14 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Đăng nhập</h1>
            <p className="text-sm text-gray-500">Nhập email và mật khẩu để dùng hệ thống phiếu thu.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Mật khẩu</span>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-800"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
