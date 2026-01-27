'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', { email: email.trim(), password });
      
      if (response.data.success) {
        setAuth(response.data.user, response.data.token);
        toast.success('Login successful! Welcome to the Admin Console.');
        router.push('/');
      }
    } catch (error: unknown) {
      let message = 'Login failed. Please check your credentials.';
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.message || message;
      }
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#013644] flex items-center justify-center p-4">
      <Toaster position="top-center" richColors />
      
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative h-16 w-48">
              <Image 
                src="/logo.png" 
                alt="Pickfoo Logo" 
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
          <p className="text-[#98E32F] text-xs font-black uppercase tracking-[0.4em] translate-y-[-8px]">Admin Console</p>
        </div>

        <Card className="border-white/5 bg-[#002833] text-white overflow-hidden shadow-2xl">
          <div className="h-2 bg-gradient-to-r from-[#98E32F] to-[#7dbb26]" />
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
            <CardDescription className="text-white/40">
              Enter your admin credentials to access the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="Enter your email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#013644]/50 border-white/10 focus-visible:ring-[#98E32F] text-white"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder='Enter your password'
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-[#013644]/50 border-white/10 focus-visible:ring-[#98E32F] text-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#98E32F] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-[#98E32F] hover:bg-[#86c926] text-[#013644] font-bold py-6 rounded-xl transition-all active:scale-[0.98]"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  'Access Console'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 text-center">
            <div className="text-[10px] text-white/20 uppercase tracking-widest font-black">
              Pickfoo © 2026 Admin Panel
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
