import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Download, Filter, Search, X } from 'lucide-react';

interface User {
  userid: number | string;
  name: string;
  email?: string;
  roleid?: number;
  managerid?: number | string;
  [key: string]: any;
}
interface Lead {
  id: number;
  firstname?: string;
  lastname?: string;
  assignedto?: string | number;
  createdby?: string | number;
  status?: string;
  visastatusid?: number;
  createdat?: string;
}

const VISA_STATUSES = [
  'F-1 Visa', 'F-1 OPT', 'STEM OPT', 'H-1B Visa', 'Green Card', 'Other', 'Unknown'
];
const VISA_COLORS: Record<string, string> = {
  'F-1 Visa': '#3B82F6',
  'F-1 OPT': '#10B981',
  'STEM OPT': '#8B5CF6',
  'H-1B Visa': '#F59E0B',
  'Green Card': '#EF4444',
  'Other': '#6B7280',
  'Unknown': '#9CA3AF'
};
const VISA_STATUS_MAP: Record<number, string> = {
  1: 'F-1 Visa',
  2: 'F-1 OPT',
  3: 'STEM OPT',
  4: 'H-1B Visa',
  5: 'Green Card',
  6: 'Other'
};

const getVisaTypeName = (visaStatusId?: number): string =>
  visaStatusId ? (VISA_STATUS_MAP[visaStatusId] || 'Unknown') : 'Unknown';

const normalizeVisaType = (visaType?: string): string => {
  if (!visaType) return 'Unknown';
  const normalized = visaType.toLowerCase().trim();
  if (normalized.includes('f-1') || normalized.includes('f1')) {
    if (normalized.includes('stem') || normalized.includes('stem opt')) return 'STEM OPT';
    else if (normalized.includes('opt') && !normalized.includes('stem')) return 'F-1 OPT';
    return 'F-1 Visa';
  }
  if (normalized.includes('stem opt') || normalized.includes('stem-opt')) return 'STEM OPT';
  if (normalized.includes('opt')) return 'F-1 OPT';
  if (normalized.includes('h-1b') || normalized.includes('h1b') || normalized.includes('h-1') || normalized.includes('h1')) return 'H-1B Visa';
  if (normalized.includes('green card') || normalized.includes('greencard') || normalized.includes('permanent resident') || normalized.includes('pr') ||
      normalized.includes('eb-1') || normalized.includes('eb-2') || normalized.includes('eb-3') || normalized.includes('eb1') || normalized.includes('eb2') || normalized.includes('eb3')) return 'Green Card';
  if (normalized.includes('l-1') || normalized.includes('l1') || normalized.includes('o-1') || normalized.includes('o1') ||
      normalized.includes('e-2') || normalized.includes('e2') || normalized.includes('tn') || normalized.includes('j-1') || normalized.includes('j1')) return 'Other';
  return 'Unknown';
};

const TIME_FILTERS = [
  { value: 'all', label: 'All Time' },
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' }
];

function filterLeadsByTime(leads: Lead[], filter: string): Lead[] {
  if (filter === 'all') return leads;
  const now = new Date();
  return leads.filter((lead) => {
    if (!lead.createdat) return false;
    const date = new Date(lead.createdat);
    if (filter === 'day') {
      return date.toDateString() === now.toDateString();
    }
    if (filter === 'week') {
      const d = new Date(now);
      d.setDate(now.getDate() - 7);
      return date >= d;
    }
    if (filter === 'month') {
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }
    return true;
  });
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-[320px] bg-muted/50 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-950 border-2 border-orange-200/50 dark:border-orange-800/50 rounded-lg shadow-xl p-3 backdrop-blur-md">
        <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-700 dark:text-gray-300">{entry.name}:</span>
            <span className="font-bold text-gray-900 dark:text-gray-100">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function VisaStatusReport() {
  const { fetchWithAuth } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [timeFilter, setTimeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    let cancelled = false;
    let interval: NodeJS.Timeout;
    const load = async () => {
      setLoading(true);
      try {
        const usersRes = await fetchWithAuth("https://saleshub.silverspace.tech/users");
        let allUsers: User[] = [];
        if (usersRes.ok) {
          const apiUsers = await usersRes.json();
          allUsers = Array.isArray(apiUsers.items) ? apiUsers.items : (Array.isArray(apiUsers) ? apiUsers : []);
        }
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
        const leadsRes = await fetchWithAuth(`${API_BASE_URL}/crm-leads?take=1000`);
        let allLeads: Lead[] = [];
        if (leadsRes.ok) {
          const result = await leadsRes.json();
          allLeads = Array.isArray(result) ? result : result.items || [];
        }
        if (!cancelled) {
          setUsers(allUsers);
          setLeads(allLeads);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            variant: 'destructive',
            title: 'Failed to load data',
            description: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      } finally {
        if (!cancelled) setTimeout(() => setLoading(false), 300);
      }
    };
    load();
    interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [fetchWithAuth, toast]);

  // Leaders only
  const leaders = useMemo(() =>
    users.filter(u => u.roleid === 4), [users]
  );
  const filteredLeaders = useMemo(() => {
    if (!searchQuery) return leaders;
    const q = searchQuery.toLowerCase();
    return leaders.filter(user => (user.name ?? '').toLowerCase().includes(q) || (user.email ?? '').toLowerCase().includes(q));
  }, [leaders, searchQuery]);

  // Build visa summary for each leader's team
  const chartData = useMemo(() => {
    return leaders.map(leader => {
      // Members directly under this leader
      const teamMembers = users.filter(u => String(u.managerid) === String(leader.userid));
      // All leads for these members (assignedto/memberIds)
      const memberIds = new Set(teamMembers.map(m => String(m.userid)));
      const memberLeads = filterLeadsByTime(
        leads.filter(l => l.assignedto !== undefined && memberIds.has(String(l.assignedto))),
        timeFilter
      );
      const visaCounts: Record<string, number> = {};
      for (const visaStatus of VISA_STATUSES) visaCounts[visaStatus] = 0;
      memberLeads.forEach(lead => {
        const vType = normalizeVisaType(getVisaTypeName(lead.visastatusid));
        visaCounts[vType] = (visaCounts[vType] ?? 0) + 1;
      });
      return {
        leader: leader.name,
        ...visaCounts
      };
    });
  }, [leaders, users, leads, timeFilter]);

  const totalLeads = chartData.reduce((sum, m) =>
    VISA_STATUSES.reduce((s, v) => s + (m[v] ?? 0), sum)
  , 0);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full flex flex-col relative overflow-hidden border shadow-lg bg-gradient-to-br from-orange-50/30 via-white to-pink-50/30 dark:from-orange-950/10 dark:via-gray-950 dark:to-pink-950/10">
        <CardHeader className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 dark:from-orange-400 dark:to-pink-400 bg-clip-text text-transparent">
                Visa Status Report
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Team-wise Visa Contributions
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:bg-orange-50 dark:hover:bg-orange-950/30 border-orange-300/50 dark:border-orange-800/50 text-orange-700 dark:text-orange-400 font-semibold shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 whitespace-nowrap"
                onClick={() => {
                  toast({
                    title: "Export feature",
                    description: "CSV export will be available soon",
                  });
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-[120px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-orange-300/50 dark:border-orange-800/50 font-semibold shadow-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_FILTERS.map(f => (
                    <SelectItem value={f.value as string} key={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value="">
                <SelectTrigger className="w-[225px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-orange-300/50 dark:border-orange-800/50 font-semibold shadow-md">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Leaders" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search leaders..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-9"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {filteredLeaders.length > 0 ? (
                    filteredLeaders.map((user) => {
                      // For reference: Could use to auto-highlight a leader in future.
                      const memberCount = users.filter(u => String(u.managerid) === String(user.userid)).length;
                      return (
                        <SelectItem key={user.userid} value={String(user.userid)}>
                          <div className="flex items-center justify-between w-full">
                            <span>{user.name}</span>
                            <Badge variant="outline" className="ml-2">{memberCount}</Badge>
                          </div>
                        </SelectItem>
                      );
                    })
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      {searchQuery ? 'No matching leaders' : 'No leaders found'}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 relative z-10">
          {loading ? (
            <SkeletonLoader />
          ) : (
            <>
              <Tabs defaultValue="bar" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-1 mb-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold text-lg rounded-lg">
                  <TabsTrigger value="bar" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
                    Member-wise Visa Status
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="bar" className="h-[400px]">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={chartData} style={{ backgroundColor: 'transparent' }}
      margin={{ top: 5, right: 46, left: 18, bottom: 70 }}
    >
      <defs>
        {VISA_STATUSES.map(status => (
          <linearGradient id={`vert-grad-${status}`} x1="0" y1="0" x2="0" y2="1" key={status}>
            <stop offset="0%" stopColor={VISA_COLORS[status]} stopOpacity={0.84}/>
            <stop offset="85%" stopColor={VISA_COLORS[status]} stopOpacity={1}/>
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid strokeDasharray="3 3" opacity={0.14} />
      <XAxis dataKey="leader" className="text-xs" stroke="currentColor" interval={0} angle={-18} textAnchor="end" height={64} />
      <YAxis className="text-xs" stroke="currentColor" allowDecimals={false} />
      <Tooltip content={<CustomTooltip />} cursor={{ fill: "none" }} wrapperStyle={{ outline: 'none' }} />
      <Legend verticalAlign="bottom" wrapperStyle={{ marginTop: 34 }} />
      {VISA_STATUSES.map((status) => (
        <Bar
          key={status}
          dataKey={status}
          stackId="a"
          name={status}
          fill={`url(#vert-grad-${status})`}
          barSize={44}
          radius={[18, 18, 0, 0]}
          style={{
            filter: 'drop-shadow(0 3px 19px rgba(0,0,0,0.10))'
          }}
          isAnimationActive={true}
        />
      ))}
    </BarChart>
  </ResponsiveContainer>
</TabsContent>


              </Tabs>
              <motion.div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <motion.div className="p-4 rounded-xl backdrop-blur-sm bg-white/70 dark:bg-gray-900/70 border border-orange-200/50 dark:border-orange-800/50 shadow-md hover:shadow-xl transition-all duration-300" whileHover={{ scale: 1.03, y: -2 }}>
                  <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Total Leads</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 dark:from-orange-400 dark:to-pink-400 bg-clip-text text-transparent">{totalLeads}</p>
                </motion.div>
              </motion.div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
