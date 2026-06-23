import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { User, Lock, Save, Key, ChevronDown, ChevronRight } from 'lucide-react';

const PASSWORD_RULE_MESSAGE = 'Password must include uppercase, lowercase, number, and symbol';
const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{6,}$/;

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  const [profileForm, setProfileForm] = useState({
    username: '',
    full_name: '',
    user_code: '',
    email: '',
    phone: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [loading, setLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => {
    setProfileForm({
      username: user?.username || '',
      full_name: user?.full_name || '',
      user_code: user?.user_code || '',
      email: user?.email || '',
      phone: user?.phone || ''
    });
  }, [user]);

  const updateProfileField = (field) => (e) => {
    setProfileForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const updatePasswordField = (field) => (e) => {
    setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();

    if (!profileForm.username.trim()) {
      showError('Username is required');
      return;
    }
    if (!profileForm.full_name.trim()) {
      showError('Full name is required');
      return;
    }

    const confirmed = await showConfirm(
      'Confirm Profile Update',
      'Are you sure you want to update your profile details?'
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      await api.put('/auth/update_profile', {
        username: profileForm.username,
        full_name: profileForm.full_name,
        user_code: profileForm.user_code || null,
        email: profileForm.email || null,
        phone: profileForm.phone || null
      });
      showSuccess('Profile details updated successfully. Please login again to apply changes.');
      logout();
      navigate('/login', { replace: true });
    } catch (error) {
      showError(error.response?.data?.detail || 'Failed to update profile details');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (!passwordForm.current_password) {
      showError('Current password is required');
      return;
    }
    if (!passwordForm.new_password) {
      showError('New password is required');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showError('Passwords do not match');
      return;
    }
    if (!passwordRule.test(passwordForm.new_password)) {
      showError(PASSWORD_RULE_MESSAGE);
      return;
    }

    const confirmed = await showConfirm(
      'Confirm Password Change',
      'Are you sure you want to change your password? You will be logged out.'
    );

    if (!confirmed) return;

    setPwdLoading(true);
    try {
      await api.post('/auth/change_password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      showSuccess('Password updated successfully. Please login with your new password.');
      logout();
      navigate('/login', { replace: true });
    } catch (error) {
      showError(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="page-title">Account Settings</h2>
      </div>

      <div className="space-y-8">
        {/* Profile Information Card */}
        <Card className="border-border-temple overflow-hidden shadow-md">
          <CardHeader className="bg-bg-temple/30 border-b border-border-temple/40">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-secondary" />
              <CardTitle className="text-lg text-text-main font-bold">Profile Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-white">
            <form
              onSubmit={handleProfileUpdate}
              className="space-y-6"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                  e.preventDefault();
                }
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-text-main font-bold">Username *</Label>
                  <Input value={profileForm.username} onChange={updateProfileField('username')} className="text-text-main" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-text-main font-bold">Full Name *</Label>
                  <Input value={profileForm.full_name} onChange={updateProfileField('full_name')} className="text-text-main" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-text-main font-bold">User Code</Label>
                  <Input value={profileForm.user_code} onChange={updateProfileField('user_code')} className="text-text-main" placeholder="e.g. CM" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-text-main font-bold">Role</Label>
                  <Input value={user?.role_name || ''} disabled className="bg-bg-temple/40 text-text-main font-bold" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-text-main font-bold">Email Address</Label>
                  <Input type="email" value={profileForm.email} onChange={updateProfileField('email')} className="text-text-main" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-text-main font-bold">Phone Number</Label>
                  <Input value={profileForm.phone} onChange={updateProfileField('phone')} className="text-text-main" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="flex items-center gap-1.5 text-sm text-secondary hover:text-secondary/80 font-semibold transition-colors">
                  {showPasswordSection ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Lock className="w-4 h-4" />
                  Change Password
                </button>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-40 bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-lg">
                  {loading ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Save Profile</span>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Expandable Password Section */}
        {showPasswordSection && (
          <Card className="border-border-temple overflow-hidden shadow-md animate-in slide-in-from-top-2 fade-in duration-200">
            <CardHeader className="bg-bg-temple/30 border-b border-border-temple/40">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-secondary" />
                <CardTitle className="text-lg text-text-main font-bold">Update Password</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              <form
                onSubmit={handlePasswordChange}
                className="space-y-6"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                    e.preventDefault();
                  }
                }}
              >
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Current Password</Label>
                    <Input
                      type="password"
                      value={passwordForm.current_password}
                      onChange={updatePasswordField('current_password')}
                      className="text-text-main"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-text-main font-bold">New Password</Label>
                      <span className="text-[10px] text-gray-400 font-medium">Aa + 1 + @</span>
                    </div>
                    <Input
                      type="password"
                      value={passwordForm.new_password}
                      onChange={updatePasswordField('new_password')}
                      className="text-text-main"
                      placeholder="Enter new password"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-text-main font-bold">Confirm New Password</Label>
                    <Input
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={updatePasswordField('confirm_password')}
                      className="text-text-main"
                      placeholder="Re-enter new password"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <p className="text-[11px] text-text-main/60 italic">
                    Changing your password will require you to log in again on all devices.
                  </p>
                  <Button
                    type="submit"
                    disabled={pwdLoading}
                    className="w-full sm:w-48 bg-secondary hover:bg-secondary/90 text-white font-bold border-none shadow-lg">
                    {pwdLoading ? (
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span className="flex items-center gap-2"><Key className="w-4 h-4" /> Update Password</span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
      
      <div className="pt-8 border-t border-border-temple/40">
        <p className="text-xs text-text-main/50 text-center font-bold">
          Copyright © {new Date().getFullYear()} Anegudde Temple. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ProfilePage;
