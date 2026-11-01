'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function SystemSettingsPage() {
  const [generalSettings, setGeneralSettings] = useState({
    systemName: 'School Management System',
    supportEmail: 'support@example.com',
    maxFileUploadSize: 10,
    defaultLanguage: 'English',
  });
  
  const [securitySettings, setSecuritySettings] = useState({
    requireStrongPasswords: true,
    passwordExpiryDays: 90,
    maxLoginAttempts: 5,
    sessionTimeoutMinutes: 30,
    twoFactorAuth: false,
  });
  
  const [emailSettings, setEmailSettings] = useState({
    smtpServer: 'smtp.example.com',
    smtpPort: 587,
    smtpUsername: 'notifications@example.com',
    smtpPassword: '********',
    senderName: 'SMS Notifications',
    senderEmail: 'notifications@example.com',
  });
  
  const handleGeneralSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGeneralSettings(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSecuritySettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSecuritySettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleEmailSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmailSettings(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSwitchChange = (checked: boolean, name: string) => {
    setSecuritySettings(prev => ({ ...prev, [name]: checked }));
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">System Settings</h1>
      
      <div className="grid grid-cols-1 gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="systemName">System Name</Label>
                <Input
                  id="systemName"
                  name="systemName"
                  value={generalSettings.systemName}
                  onChange={handleGeneralSettingsChange}
                />
              </div>
              <div>
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  name="supportEmail"
                  type="email"
                  value={generalSettings.supportEmail}
                  onChange={handleGeneralSettingsChange}
                />
              </div>
              <div>
                <Label htmlFor="maxFileUploadSize">Max File Upload Size (MB)</Label>
                <Input
                  id="maxFileUploadSize"
                  name="maxFileUploadSize"
                  type="number"
                  value={generalSettings.maxFileUploadSize}
                  onChange={handleGeneralSettingsChange}
                />
              </div>
              <div>
                <Label htmlFor="defaultLanguage">Default Language</Label>
                <Input
                  id="defaultLanguage"
                  name="defaultLanguage"
                  value={generalSettings.defaultLanguage}
                  onChange={handleGeneralSettingsChange}
                />
              </div>
            </div>
            <Button className="mt-4">Save General Settings</Button>
          </CardContent>
        </Card>
        
        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="requireStrongPasswords">Require Strong Passwords</Label>
                <Switch
                  id="requireStrongPasswords"
                  checked={securitySettings.requireStrongPasswords}
                  onCheckedChange={(checked) => handleSwitchChange(checked, 'requireStrongPasswords')}
                />
              </div>
              <div>
                <Label htmlFor="passwordExpiryDays">Password Expiry (Days)</Label>
                <Input
                  id="passwordExpiryDays"
                  name="passwordExpiryDays"
                  type="number"
                  value={securitySettings.passwordExpiryDays}
                  onChange={handleSecuritySettingsChange}
                />
              </div>
              <div>
                <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                <Input
                  id="maxLoginAttempts"
                  name="maxLoginAttempts"
                  type="number"
                  value={securitySettings.maxLoginAttempts}
                  onChange={handleSecuritySettingsChange}
                />
              </div>
              <div>
                <Label htmlFor="sessionTimeoutMinutes">Session Timeout (Minutes)</Label>
                <Input
                  id="sessionTimeoutMinutes"
                  name="sessionTimeoutMinutes"
                  type="number"
                  value={securitySettings.sessionTimeoutMinutes}
                  onChange={handleSecuritySettingsChange}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="twoFactorAuth">Two-Factor Authentication</Label>
                <Switch
                  id="twoFactorAuth"
                  checked={securitySettings.twoFactorAuth}
                  onCheckedChange={(checked) => handleSwitchChange(checked, 'twoFactorAuth')}
                />
              </div>
            </div>
            <Button className="mt-4">Save Security Settings</Button>
          </CardContent>
        </Card>
        
        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Email Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtpServer">SMTP Server</Label>
                <Input
                  id="smtpServer"
                  name="smtpServer"
                  value={emailSettings.smtpServer}
                  onChange={handleEmailSettingsChange}
                />
              </div>
              <div>
                <Label htmlFor="smtpPort">SMTP Port</Label>
                <Input
                  id="smtpPort"
                  name="smtpPort"
                  type="number"
                  value={emailSettings.smtpPort}
                  onChange={handleEmailSettingsChange}
                />
              </div>
              <div>
                <Label htmlFor="smtpUsername">SMTP Username</Label>
                <Input
                  id="smtpUsername"
                  name="smtpUsername"
                  value={emailSettings.smtpUsername}
                  onChange={handleEmailSettingsChange}
                />
              </div>
              <div>
                <Label htmlFor="smtpPassword">SMTP Password</Label>
                <Input
                  id="smtpPassword"
                  name="smtpPassword"
                  type="password"
                  value={emailSettings.smtpPassword}
                  onChange={handleEmailSettingsChange}
                />
              </div>
              <div>
                <Label htmlFor="senderName">Sender Name</Label>
                <Input
                  id="senderName"
                  name="senderName"
                  value={emailSettings.senderName}
                  onChange={handleEmailSettingsChange}
                />
              </div>
              <div>
                <Label htmlFor="senderEmail">Sender Email</Label>
                <Input
                  id="senderEmail"
                  name="senderEmail"
                  type="email"
                  value={emailSettings.senderEmail}
                  onChange={handleEmailSettingsChange}
                />
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <Button>Save Email Settings</Button>
              <Button variant="outline">Test Email Connection</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}