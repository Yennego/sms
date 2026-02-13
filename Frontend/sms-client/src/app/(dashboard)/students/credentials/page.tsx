'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Download, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

interface StudentCredentials {
  first_name: string;
  last_name: string;
  email: string;
  admission_number: string;
  generated_password?: string;
  generated_admission_number?: string;
}

export default function StudentCredentialsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [credentials, setCredentials] = useState<StudentCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    // Get credentials from URL params (base64 encoded for security)
    const encodedData = searchParams.get('data');
    if (encodedData) {
      try {
        const decodedData = JSON.parse(atob(encodedData));
        setCredentials(decodedData);
      } catch (error) {
        console.error('Failed to decode credentials data:', error);
        router.push('/students');
      }
    } else {
      router.push('/students');
    }
  }, [searchParams, router]);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const downloadCredentials = () => {
    if (!credentials) return;
    
    const content = `Student Account Credentials

Name: ${credentials.first_name} ${credentials.last_name}
Email: ${credentials.email}
Admission Number: ${credentials.admission_number}
${credentials.generated_password ? `Password: ${credentials.generated_password}` : ''}

IMPORTANT: Please save these credentials securely. The password will not be shown again.

Generated on: ${new Date().toLocaleString()}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-credentials-${credentials.admission_number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!credentials) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          <p className="text-gray-600">Retrieving student credentials</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/students" className="inline-flex items-center text-blue-600 hover:text-blue-800">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Students
        </Link>
      </div>

      <Card className="border-green-200 bg-green-50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-green-800 flex items-center justify-center">
            <span className="mr-2">🎉</span>
            Student Created Successfully!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-amber-800">
              <strong>⚠️ Important:</strong> Please save these credentials securely. The password will not be shown again after you leave this page.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Student Name</label>
                <div className="p-3 bg-white border rounded-lg">
                  {credentials.first_name} {credentials.last_name}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <div className="p-3 bg-white border rounded-lg flex items-center justify-between">
                  <span>{credentials.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(credentials.email, 'email')}
                    className="ml-2"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                {copied === 'email' && (
                  <p className="text-xs text-green-600">✓ Email copied to clipboard</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Admission Number</label>
              <div className="p-3 bg-white border rounded-lg flex items-center justify-between">
                <span className="font-mono text-lg">{credentials.admission_number}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(credentials.admission_number, 'admission')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              {copied === 'admission' && (
                <p className="text-xs text-green-600">✓ Admission number copied to clipboard</p>
              )}
            </div>

            {credentials.generated_password && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Generated Password</label>
                <div className="p-3 bg-white border rounded-lg flex items-center justify-between">
                  <span className="font-mono text-lg">
                    {showPassword ? credentials.generated_password : '••••••••••••'}
                  </span>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(credentials.generated_password!, 'password')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {copied === 'password' && (
                  <p className="text-xs text-green-600">✓ Password copied to clipboard</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={downloadCredentials} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download Credentials
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <Link href="/students">Continue to Students List</Link>
            </Button>
          </div>

          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-800 text-sm">
              <strong>Next Steps:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Share these credentials with the student securely</li>
                <li>Advise the student to change their password on first login</li>
                <li>Keep a secure record of the admission number for future reference</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}