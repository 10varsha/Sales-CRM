import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, TrendingUp } from 'lucide-react';
import { useDateFilter } from '@/context/DateFilterContext';

type Lead = {
  [key: string]: any;
  assignedto?: string | number;
  id?: string | number;
  ownername?: string;
  firstname?: string;
  lastname?: string;
  team?: string;
  assignedteam?: string;
  company?: string;
  companyid?: string;
  stage?: string;
  status?: string;
  signedamount?: number | string;
  amountpaid?: number | string;
  amount?: number | string;
  createdat?: string;
  created_at?: string;
};

type RevenueData = { name: string, team?: string, revenue: number, deals: number };

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-[320px] bg-gradient-to-br from-purple-100/50 to-blue-100/50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-xl" />
    </div>
  );
}

const DEAL_STATUS = [
  'closed won', 'closed', 'signed', 'deal', 'pipeline'
];

function isDeal(lead: Lead) {
  const status = String(lead.status || '').toLowerCase();
  const stage = String(lead.stage || '').toLowerCase();
  return DEAL_STATUS.some(s =>
    status.includes(s) || stage.includes(s)
  );
}

function getRevenue(lead: Lead) {
  return (
    parseFloat(lead.amountpaid as any) ||
    parseFloat(lead.signedamount as any) ||
    parseFloat(lead.amount as any) ||
    0
  );
}

export function RevenueAttribution({ leads: externalLeads }: { leads?: Lead[] }) {
  const { fetchWithAuth } = useAuth ? useAuth() : { fetchWithAuth: null };
  const { toast } = useToast ? useToast() : { toast: () => {} };
  const { getDateRangeFilter } = useDateFilter(); // Import date filter context
  const [groupBy, setGroupBy] = useState('team');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  // Filter leads by date from context
  const filterLeadsByDate = (leads: Lead[]) => {
    const range = getDateRangeFilter();
    if (!range) return leads;

    return leads.filter(lead => {
      const leadDate = new Date(lead.createdat || lead.created_at || '');
      return leadDate >= range.start && leadDate <= range.end;
    });
  };

  // --- Build assignedToIdToName map from all available leads/users ---
  const assignedToIdToName = useMemo<{ [key: string]: string }>(() => {
    const map: { [key: string]: string } = {};
    leads.forEach(lead => {
      const idRaw = lead && lead.assignedto !== undefined ? String(lead.assignedto) : undefined;
      if (!idRaw) return;
      const fname = lead.firstname ? String(lead.firstname).trim() : '';
      const lname = lead.lastname ? String(lead.lastname).trim() : '';
      const fullName = (fname + ' ' + lname).trim();
      if (fullName && (!map[idRaw] || !map[idRaw].includes('Unassigned'))) {
        map[idRaw] = fullName;
      }
    });
    return map;
  }, [leads]);

  useEffect(() => {
    if (externalLeads) {
      setLeads(externalLeads);
      return;
    }
    if (!fetchWithAuth) return;
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const allLeads: Lead[] = [];
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
        if (!cancelled) setTimeout(() => setLoading(false), 300);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [externalLeads, fetchWithAuth, toast]);

  function getGroupVal(lead: Lead, groupBy: string): string {
    if (groupBy === 'team') return lead.team || lead.assignedteam || 'Unassigned';
    if (groupBy === 'user') {
      if (lead.ownername && typeof lead.ownername === 'string') return lead.ownername;
      const assignedId = lead && lead.assignedto !== undefined ? String(lead.assignedto) : undefined;
      if (assignedId && assignedToIdToName[assignedId]) return assignedToIdToName[assignedId];
      return 'Unassigned';
    }
    if (groupBy === 'company') return lead.company || lead.companyid || 'Unassigned';
    if (groupBy === 'stage') return lead.stage || lead.status || 'Unassigned';
    return 'Unassigned';
  }

  // Compute main (grouped) chart data with date filtering
  const chartData = useMemo<RevenueData[]>(() => {
    const counts: { [key: string]: RevenueData } = {};
    const dateFilteredLeads = filterLeadsByDate(leads);
    
    dateFilteredLeads.forEach(lead => {
      const key = getGroupVal(lead, groupBy);
      const revenue = getRevenue(lead);
      if (isDeal(lead)) {
        if (!counts[key]) counts[key] = { revenue: 0, deals: 0, name: key };
        counts[key].revenue += revenue;
        counts[key].deals += 1;
      }
    });
    return Object.values(counts)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);
  }, [leads, groupBy, assignedToIdToName, getDateRangeFilter]);

  const userRevenueData = useMemo<RevenueData[]>(() => {
    const ucounts: { [key: string]: RevenueData } = {};
    const dateFilteredLeads = filterLeadsByDate(leads);
    
    dateFilteredLeads.forEach(lead => {
      let key = '';
      if (lead.ownername && typeof lead.ownername === 'string') key = lead.ownername;
      else if (lead && lead.assignedto !== undefined && assignedToIdToName[String(lead.assignedto)]) key = assignedToIdToName[String(lead.assignedto)];
      else key = 'Unassigned';
      const team = lead.team || lead.assignedteam || 'Unassigned';
      const revenue = getRevenue(lead);
      if (isDeal(lead)) {
        if (!ucounts[key]) ucounts[key] = { team, revenue: 0, deals: 0, name: key };
        ucounts[key].revenue += revenue;
        ucounts[key].deals += 1;
      }
    });
    // Only filter by name - accept users even if their team is Unassigned
    return Object.values(ucounts)
      .filter(user => user.name !== 'Unassigned' && !!user.name && user.name.trim() !== '')
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);
  }, [leads, assignedToIdToName, getDateRangeFilter]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

  const totalRevenue = chartData.reduce((sum, t) => sum + t.revenue, 0);
  const totalDeals = chartData.reduce((sum, t) => sum + t.deals, 0);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full flex flex-col relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/30 dark:via-blue-950/30 dark:to-indigo-950/30">
        <CardHeader className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                Revenue Attribution
              </CardTitle>
              <p className="text-sm text-muted-foreground">Track team and user performance</p>
            </div>
            <div className="flex flex-wrap gap-2">
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
                <TabsTrigger value="team" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-white font-semibold">Team View</TabsTrigger>
                <TabsTrigger value="user" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-white font-semibold">User View</TabsTrigger>
              </TabsList>
              <TabsContent value="team" className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 16, right: 48, left: 0, bottom: 16 }}
                    barCategoryGap={18}
                    barGap={8}
                  >
                    <CartesianGrid strokeDasharray="4 4" stroke="#2b247c" strokeOpacity={0.13} vertical={false} />
                    <XAxis
                      type="number"
                      className="text-xs"
                      stroke="currentColor"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      className="text-sm"
                      width={140}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontWeight: 700, fill: '#8b5cf6' }}
                    />
                    <defs>
                      <linearGradient id="VividTeamBar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="50%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      formatter={value => formatCurrency(Number(value))}
                      cursor={{ fill: 'rgba(56,189,248,0.08)' }}
                      contentStyle={{
                        background: 'rgba(30,27,75,0.97)',
                        border: '1.5px solid #60a5fa',
                        borderRadius: 14,
                        color: '#facc15',
                        fontWeight: 600,
                        boxShadow: '0 6px 28px rgba(43, 37, 124, 0.13)'
                      }}
                      labelStyle={{ color: '#a78bfa', fontWeight: 700 }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="url(#VividTeamBar)"
                      barSize={20}
                      radius={12}
                      isAnimationActive={true}
                      style={{
                        filter: 'drop-shadow(0 0 8px #0ea5e9CC)'
                      }}
                      label={({ x, y, width, height, value }) => (
                        <text
                          x={x + width + 14}
                          y={y + height / 2 + 6}
                          fontSize={16}
                          fontWeight={900}
                          fill="#0ea5e9"
                          textAnchor="start"
                          style={{
                            textShadow: '0 2px 10px #a5b4fc44, 0 0px 2px #06b6d433'
                          }}
                        >
                          {formatCurrency(value)}
                        </text>
                      )}
                    />
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
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </motion.div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{user.name}</p>
                        {user.team && user.team !== "Unassigned" && (
                          <p className="text-sm text-purple-600 dark:text-purple-400">{user.team}</p>
                        )}
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
