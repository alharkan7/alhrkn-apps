'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { AppsHeader } from '@/components/apps-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { User as UserIcon, Loader2, ArrowLeft, Save, LogOut } from 'lucide-react';
import { getInitials, getAvatarColor } from '@/lib/utils';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  const [fullName, setFullName] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState({ type: '', text: '' });

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      setFullName(user.user_metadata?.full_name || '');
      setLoading(false);
    });
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName }
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully' });
      // Refresh user state
      const { data } = await supabase.auth.getUser();
      if (data.user) setUser(data.user);
    }
    
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppsHeader title="Profile" />
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 className="animate-spin text-primary w-8 h-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppsHeader 
        title="Profile" 
        leftButton={
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft size={18} />
          </Button>
        }
      />
      
      <main className="max-w-2xl mx-auto p-4 md:p-8 pt-8 md:pt-12">
        <Card className="border-border shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
          <div className="h-24 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent w-full"></div>
          <CardHeader className="relative pt-0 -mt-12">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 mb-4">
              <div className="w-24 h-24 rounded-full bg-background flex items-center justify-center overflow-hidden shrink-0 border-4 border-background shadow-sm">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center text-3xl font-semibold text-white" 
                    style={{ backgroundColor: getAvatarColor(user?.email) }}
                  >
                    {getInitials(user?.user_metadata?.full_name, user?.email)}
                  </div>
                )}
              </div>
              <div className="text-center sm:text-left mb-2">
                <CardTitle className="text-2xl font-semibold tracking-tight">{user?.user_metadata?.full_name || 'Your Profile'}</CardTitle>
                <CardDescription className="text-sm">Manage your personal information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6 mt-2">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={user?.email || ''} 
                  disabled 
                  className="bg-muted/30 text-muted-foreground cursor-not-allowed"
                />
                <p className="text-[11px] text-muted-foreground ml-1">Your email cannot be changed at this time.</p>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                <Input 
                  id="fullName" 
                  type="text" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  placeholder="Enter your full name"
                  className="bg-background/50 focus-visible:ring-primary/20"
                />
              </div>

              {message.text && (
                <div className={`p-3 text-sm rounded-lg border ${message.type === 'error' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'}`}>
                  {message.text}
                </div>
              )}

              <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => window.location.href = '/logout'}
                  className="w-full sm:w-auto text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                >
                  <LogOut size={16} className="mr-2" />
                  Logout
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSaving || !fullName.trim() || fullName === user?.user_metadata?.full_name} 
                  className="w-full sm:w-auto shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
