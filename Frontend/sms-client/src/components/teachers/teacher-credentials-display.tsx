'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Copy, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TeacherCredentialsDisplayProps {
  email: string;
  generatedPassword: string;
  whatsappNumber?: string;
  onDone: () => void;
}

export function TeacherCredentialsDisplay({ 
  email, 
  generatedPassword, 
  whatsappNumber, 
  onDone 
}: TeacherCredentialsDisplayProps) {
  const [showPassword, setShowPassword] = useState(false);
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Alert className="border-green-200 bg-green-50">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription>
        <div className="space-y-4">
          <div>
            <p className="text-green-800 font-medium mb-2">
              Teacher created successfully! 
              {whatsappNumber 
                ? ' Credentials have been sent via WhatsApp.' 
                : ' Please share these credentials securely.'}
            </p>
          </div>
          
          <div className="bg-white border border-green-200 rounded p-3 space-y-3">
            <div>
              <Label className="text-sm font-medium">Email</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input value={email} readOnly className="bg-gray-50 text-sm" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(email)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Generated Password</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input 
                  type={showPassword ? 'text' : 'password'}
                  value={generatedPassword}
                  readOnly 
                  className="bg-gray-50 text-sm font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generatedPassword)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-600">
              ⚠️ This will auto-hide in 3 minutes for security
            </p>
            <Button onClick={onDone} className="bg-green-600 hover:bg-green-700">
              Done
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}