import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, subMonths } from 'date-fns';
import { DollarSign, TrendingUp, Users } from 'lucide-react';

interface TeamRevenue {
  name: string;
  revenue: number;
  deals: number;
}

interface UserRevenue {
  name: string;
  team: string;
  revenue: number;
  deals: number;
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-[320px] bg-gradient-to-br from-purple-100/50 to-blue-100/50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-xl" />
    </div>
  );
}

export function RevenueAttribution() {
  const { fetchWithAuth } = useAuth();
  const { toast } = useToast();
  const [timeFilter, setTimeFilter] = useState('month');
  const [groupBy, setGroupBy] = useState('team');
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const allLeads: any[] = [];
        let cursor: number | null = null;

        const firstRes = await fetchWithAuth(`${API_BASE_URL}/crm-leads?take=100`);
        if (!firstRes.ok) throw new Error('Failed to load leads');
        
        const firstData = await firstRes.json();
        const firstItems = Array.isArray(firstData) ? firstData : firstData.items || [];
        allLeads.push(...firstItems);
        
        cursor = Array.isArray(firstData) ? null : firstData.nextCursor;

        while (cursor !== null && allLeads.length < 1000) {
          const res = await fetchWithAuth(`${API_BASE_URL}/crm-leads?take=100&cursor=${cursor}`);
          if (!res.ok) break;
          
          const data = await res.json();
          allLeads.push(...(data.items || []));
          cursor = data.nextCursor;
        }

        if (!cancelled) {
          setLeads(allLeads);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            variant: 'destructive',
            title: 'Failed to load revenue data',
            description: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      } finally {
        if (!cancelled) {
          setTimeout(() => setLoading(false), 300);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [fetchWithAuth, toast]);

  const teamRevenueData = useMemo<TeamRevenue[]>(() => {
    const teamMap = new Map<string, { revenue: number; deals: number }>();

    leads.forEach(lead => {
      const teamName = lead.team || lead.assignedteam || 'Unassigned';
      const revenue = parseFloat(lead.signedamount || lead.amount || '0');
      const isDeal = lead.status === 'Closed Won' || lead.stage === 'Closed';

      if (isDeal && revenue > 0) {
        const current = teamMap.get(teamName) || { revenue: 0, deals: 0 };
        teamMap.set(teamName, {
          revenue: current.revenue + revenue,
          deals: current.deals + 1,
        });
      }
    });

    return Array.from(teamMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [leads]);

  const userRevenueData = useMemo<UserRevenue[]>(() => {
    const userMap = new Map<string, { team: string; revenue: number; deals: number }>();

    leads.forEach(lead => {
      const userName = lead.assignedto || lead.ownername || 'Unassigned';
      const teamName = lead.team || 'Team A';
      const revenue = parseFloat(lead.signedamount || lead.amount || '0');
      const isDeal = lead.status === 'Closed Won' || lead.stage === 'Closed';

      if (isDeal && revenue > 0) {
        const current = userMap.get(userName) || { team: teamName, revenue: 0, deals: 0 };
        userMap.set(userName, {
          team: current.team,
          revenue: current.revenue + revenue,
          deals: current.deals + 1,
        });
      }
    });

    return Array.from(userMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [leads]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalRevenue = teamRevenueData.reduce((sum, t) => sum + t.revenue, 0);
  const totalDeals = teamRevenueData.reduce((sum, t) => sum + t.deals, 0);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full flex flex-col relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/30 dark:via-blue-950/30 dark:to-indigo-950/30">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full filter blur-3xl animate-blob" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full filter blur-3xl animate-blob animation-delay-2000" />
        </div>

        <CardHeader className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                Revenue Attribution
              </CardTitle>
              <p className="text-sm text-muted-foreground">Track team and user performance</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-[140px] bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-purple-200 dark:border-purple-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-[140px] bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-purple-200 dark:border-purple-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">By Team</SelectItem>
                  <SelectItem value="user">By User</SelectItem>
                  <SelectItem value="company">By Company</SelectItem>
                  <SelectItem value="stage">By Stage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Stats */}
          <motion.div 
            className="grid grid-cols-2 gap-4 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="p-3 rounded-lg backdrop-blur-md bg-white/60 dark:bg-gray-900/60 border border-purple-200/50 dark:border-purple-800/50">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg backdrop-blur-md bg-white/60 dark:bg-gray-900/60 border border-blue-200/50 dark:border-blue-800/50">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Deals</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{totalDeals}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </CardHeader>

        <CardContent className="flex-1 relative z-10">
          {loading ? (
            <SkeletonLoader />
          ) : (
            <Tabs defaultValue="team" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
                <TabsTrigger value="team" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-white font-semibold">
                  Team View
                </TabsTrigger>
                <TabsTrigger value="user" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-white font-semibold">
                  User View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="team" className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamRevenueData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-purple-200 dark:stroke-purple-800" opacity={0.3} />
                    <XAxis type="number" className="text-xs" stroke="currentColor" />
                    <YAxis dataKey="name" type="category" className="text-xs" width={100} stroke="currentColor" />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(10px)',
                        border: '2px solid rgba(108, 92, 231, 0.3)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Bar dataKey="revenue" fill="url(#colorRevenue)" radius={[0, 8, 8, 0]} />
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="user" className="space-y-2 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-300 dark:scrollbar-thumb-purple-700">
                {userRevenueData.map((user, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02, x: 5 }}
                    className="flex items-center justify-between p-4 rounded-xl backdrop-blur-md bg-white/60 dark:bg-gray-900/60 border border-purple-200/50 dark:border-purple-800/50 hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300 shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      <motion.div 
                        className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-lg"
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.6 }}
                      >
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </motion.div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{user.name}</p>
                        <p className="text-sm text-purple-600 dark:text-purple-400">{user.team}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                        {formatCurrency(user.revenue)}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.deals} deals</p>
                    </div>
                  </motion.div>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
