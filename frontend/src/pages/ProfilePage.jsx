import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Label } from '../components/ui/Label';

const ProfilePage = () => {
  const { user, fetchUser } = useAuth();
  const { showSuccess, showError, showConfirm } = useNotification();
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm({
      username: user?.username || '',
      password: '',
      full_name: user?.full_name || '',
      email: user?.email || '',
      phone: user?.phone || ''
    });
  }, [user]);

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!form.username.trim()) {
      showError('Username is required');
      return;
    }
    if (!form.full_name.trim()) {
      showError('Full name is required');
      return;
    }

    const confirmed = await showConfirm(
      'Confirm Profile Update',
      'Are you sure you want to update your account details?'
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      await api.put('/auth/update_profile', {
        username: form.username,
        password: form.password || null,
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null
      });
      await fetchUser();
      setForm((prev) => ({ ...prev, password: '' }));
      showSuccess('Account details updated successfully');
    } catch (error) {
      showError(error.response?.data?.detail || 'Failed to update account details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="page-title">Account Settings</h2>
      </div>

      <Card className="border-border-temple overflow-hidden shadow-md">
        <CardContent className="p-6 sm:p-8 bg-white">
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Username *</Label>
                <Input value={form.username} onChange={updateField('username')} className="text-text-main" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={updateField('password')}
                  className="text-text-main"
                  placeholder="Leave blank to keep current password"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-text-main font-bold">Full Name *</Label>
                <Input value={form.full_name} onChange={updateField('full_name')} className="text-text-main" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Email Address</Label>
                <Input type="email" value={form.email} onChange={updateField('email')} className="text-text-main" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Phone Number</Label>
                <Input value={form.phone} onChange={updateField('phone')} className="text-text-main" />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-lg">
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Save'
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
    </div>);
};

export default ProfilePage;
