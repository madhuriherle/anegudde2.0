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
import Footer from '../components/Footer';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

const LoginPage = () => {
  const { login } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await api.post('/auth/login', data);
      await login(response.data.access_token);
      showSuccess('Login successful! Welcome back.');
      navigate('/', { replace: true });
    } catch (err) {
      const errorMsg =
      err.response?.data?.detail || 'Invalid username or password';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-hidden relative flex flex-col">
      {/* Background Image */}
      <img
        src="/login-bg.jpg"
        alt="Temple Background"
        className="absolute inset-0 h-full w-full object-cover object-center blur-sm scale-105" />
      

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/35"></div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
          <Card className="border border-[#E7C58A] shadow-2xl bg-white">
            <CardHeader className="space-y-2 pb-6">
              <CardTitle className="text-2xl font-bold text-center text-[#4A2E1F] font-serif">
                Login to your account
              </CardTitle>

              <p className="text-sm text-[#7A5C3E] text-center">
                Welcome to Anegudde Inventory Management System (AIMS)
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {error &&
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm font-medium animate-in slide-in-from-top-2">
                    {error}
                  </div>
                }

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#6B4B35] ml-1">
                    Username
                  </label>

                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />

                    <Input
                      {...register('username')}

                      className={cn(
                        'pl-10 h-11 bg-white/90 border-[#E5D3B3] focus-visible:ring-[#C96A2B]/20 focus-visible:border-[#C96A2B]',
                        errors.username &&
                        'border-red-500 focus-visible:ring-red-500'
                      )} />
                    
                  </div>

                  {errors.username &&
                  <p className="text-[11px] font-bold text-red-500 ml-1">
                      {errors.username.message}
                    </p>
                  }
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#6B4B35] ml-1">
                    Password
                  </label>

                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />

                    <Input
                      {...register('password')}
                      type="password"

                      className={cn(
                        'pl-10 h-11 bg-white/90 border-[#E5D3B3] focus-visible:ring-[#C96A2B]/20 focus-visible:border-[#C96A2B]',
                        errors.password &&
                        'border-red-500 focus-visible:ring-red-500'
                      )} />
                    
                  </div>

                  {errors.password &&
                  <p className="text-[11px] font-bold text-red-500 ml-1">
                      {errors.password.message}
                    </p>
                  }
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-bold mt-6 bg-[#C96A2B] hover:bg-[#B85C22] text-white shadow-lg transition-all duration-300"
                  disabled={isSubmitting}>
                  
                  {isSubmitting ?
                  <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Logging in...
                    </span> :

                  'Login'
                  }
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
};

export default LoginPage;
