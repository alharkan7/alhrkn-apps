'use client';

import { useState } from 'react';
import { loginAdmin } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, ArrowRight, Hexagon } from 'lucide-react';
import { motion } from 'framer-motion';

export function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const result = await loginAdmin(password);
    
    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/20 blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[400px] p-6"
      >
        <div className="flex flex-col items-center justify-center space-y-6 mb-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/20">
            <Hexagon className="h-8 w-8 text-white fill-white/20" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Admin Portal
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Enter your credentials to access application analytics
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/60 p-8 shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Master Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  className="h-12 border-slate-200 bg-white/50 px-4 text-slate-900 transition-all focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100"
                />
              </div>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2 text-sm font-medium text-rose-500"
                >
                  <ShieldAlert className="h-4 w-4" />
                  {error}
                </motion.p>
              )}
            </div>

            <Button 
              className="group relative h-12 w-full overflow-hidden rounded-xl bg-slate-900 text-white transition-all hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200" 
              type="submit" 
              disabled={isLoading}
            >
              <span className="relative z-10 flex items-center justify-center gap-2 font-semibold">
                {isLoading ? 'Authenticating...' : 'Sign In'}
                {!isLoading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
              </span>
              <div className="absolute inset-0 z-0 bg-gradient-to-r from-indigo-500 to-violet-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
