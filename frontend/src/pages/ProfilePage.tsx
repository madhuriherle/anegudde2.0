import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  User,
  Lock,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Label } from '../components/ui/Label';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showConfirm } = useNotification();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showError('New passwords do not match');
      return;
    }

    const confirmed = await showConfirm(
      'Confirm Password Change',
      'Are you sure you want to update your password?'
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      showSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showError(error.response?.data?.detail || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-text-main text-2xl font-semibold font-temple">Account Settings</h2>
      </div>

      <Card className="border-border-temple overflow-hidden shadow-md">
        <div className="bg-primary-main p-4 flex items-center gap-3">
          <ShieldCheck className="text-white h-5 w-5" />
          <h3 className="text-white font-bold text-lg">Change Password</h3>
        </div>

        <CardContent className="p-6 sm:p-8 bg-bg-temple/20">
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="space-y-1.5">
              <Label className="text-text-main font-bold">Account Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-main/40" />
                <Input
                  value={user?.username || ''}
                  disabled
                  className="pl-10 bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-text-main font-bold">
                Current Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-main/40" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 bg-white"
                  placeholder="Enter your current password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-main/40 hover:text-text-main"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">
                  New Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="bg-white"
                  placeholder="New password"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">
                  Re-type New Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-white"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                className="px-8 flex items-center gap-2"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Update Password
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <div className="pt-8 border-t border-border-temple/40">
        <p className="text-xs text-text-main/50 text-center font-bold">
          Copyright © {new Date().getFullYear()} Anegudde Temple. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ProfilePage;

