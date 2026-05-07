import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Lock, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import api from '../api/axios';
import { cn } from '../utils/cn';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await api.post('/auth/login', data);
      await login(response.data.access_token);
      showSuccess('Login successful! Welcome back.');
      navigate(from, { replace: true });
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Invalid username or password';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat relative p-4" style={{ backgroundImage: 'url("/login-bg.jpg")' }}>
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-secondary-dark/40 backdrop-blur-[2px]"></div>

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center px-3 py-2 rounded-2xl bg-white border border-border-temple mb-4 shadow-sm">
             <img 
              src="/temple-logo-banner.webp" 
              alt="Logo" 
              className="h-20 w-auto object-contain"
            />
          </div>
        </div>

        <Card className="border-border-temple shadow-2xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl font-bold text-center text-secondary font-serif">Login to your account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm font-medium animate-in slide-in-from-top-2">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Username</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    {...register('username')}
                    placeholder="Enter username"
                    className={cn(
                      "pl-10",
                      errors.username && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                </div>
                {errors.username && (
                  <p className="text-[11px] font-bold text-red-500 ml-1">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    {...register('password')}
                    type="password"
                    placeholder="Enter password"
                    className={cn(
                      "pl-10",
                      errors.password && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                </div>
                {errors.password && (
                  <p className="text-[11px] font-bold text-red-500 ml-1">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-bold mt-6"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Logging in...
                  </span>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-center text-gray-400 text-[10px] mt-8 uppercase tracking-widest font-bold">
          © {new Date().getFullYear()} Anegudde Shree Vinayaka Devasthana
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
