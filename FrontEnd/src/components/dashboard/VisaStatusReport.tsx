import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Download, Filter, Search, X } from 'lucide-react';

// --- User and Lead Types ---
interface User {
  userid: number | string;
  name: string;
  email?: string;
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

// --- Recharts colors and mapping ---
const VISA_COLORS: Record<string, string> = {
  'F-1 Visa': '#3B82F6',
  'F-1 OPT': '#10B981',
  'STEM OPT': '#8B5CF6',
  'H-1B Visa': '#F59E0B',
  'Green Card': '#EF4444',
  'Other': '#6B7280',
  'Unknown': '#9CA3AF'
};
const COLORS = Object.values(VISA_COLORS);
const VISA_STATUS_MAP: Record<number, string> = {
  1: 'F-1 Visa',
  2: 'F-1 OPT',
  3: 'STEM OPT',
  4: 'H-1B Visa',
  5: 'Green Card',
  6: 'Other'
};

const getVisaTypeName = (visaStatusId: number): string =>
  VISA_STATUS_MAP[visaStatusId] || 'Unknown';

const normalizeVisaType = (visaType: string): string => {
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
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all');
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    let cancelled = false;
    let interval: NodeJS.Timeout;

    const load = async () => {
      setLoading(true);
      try {
        // USERS: fetch all from correct API w/ structure
        const usersRes = await fetchWithAuth("https://saleshub.silverspace.tech/users");
        let allUsers: User[] = [];
        if (usersRes.ok) {
          const apiUsers = await usersRes.json();
          allUsers = Array.isArray(apiUsers) ? apiUsers : (apiUsers.items ?? []);
        }
        // LEADS: as before
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

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user => {
      const name = (user.name ?? '').toLowerCase();
      const email = (user.email ?? '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [users, searchQuery]);

  const selectedUserName = useMemo(() => {
    if (selectedUserId === 'all') return 'All Users';
    const user = users.find(u => String(u.userid) === selectedUserId);
    return user ? user.name : 'Unknown';
  }, [selectedUserId, users]);

  // Filters for user and time:
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (selectedUserId !== 'all') {
      result = result.filter(lead => String(lead.assignedto ?? lead.createdby) === selectedUserId);
    }
    result = filterLeadsByTime(result, timeFilter);
    return result;
  }, [leads, selectedUserId, timeFilter]);

  const visaData = useMemo(() => {
    const visaMap = new Map<string, { leads: number; converted: number }>();
    filteredLeads.forEach(lead => {
      const visaTypeName = getVisaTypeName(lead.visastatusid ?? 0);
      const visaType = normalizeVisaType(visaTypeName);
      const status = (lead.status ?? '').toLowerCase();
      const isConverted = status.includes('closed won') || status.includes('closed') || status.includes('won');
      const current = visaMap.get(visaType) || { leads: 0, converted: 0 };
      visaMap.set(visaType, {
        leads: current.leads + 1,
        converted: current.converted + (isConverted ? 1 : 0),
      });
    });
    const visaOrder = ['F-1 Visa', 'F-1 OPT', 'STEM OPT', 'H-1B Visa', 'Green Card', 'Other', 'Unknown'];
    return visaOrder
      .map(visaType => {
        const stats = visaMap.get(visaType) || { leads: 0, converted: 0 };
        return { visaType, ...stats };
      })
      .filter(item => item.leads > 0);
  }, [filteredLeads]);

  const totalLeads = visaData.reduce((sum, v) => sum + v.leads, 0);
  const totalConverted = visaData.reduce((sum, v) => sum + v.converted, 0);
  const conversionRate = totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : '0.0';

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
                Track visa applications • {totalLeads} leads
                {selectedUserId !== 'all' && (
                  <span className="ml-2 text-orange-600 dark:text-orange-400 font-semibold">
                    • {selectedUserName}
                  </span>
                )}
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
              {/* User Filter */}
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-[225px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-orange-300/50 dark:border-orange-800/50 font-semibold shadow-md">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="By User" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-9"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <SelectItem value="all">
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold">All Users</span>
                      <Badge variant="secondary" className="ml-2">{leads.length}</Badge>
                    </div>
                  </SelectItem>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => {
                      const userLeads = leads.filter(
                        l => String(l.assignedto ?? l.createdby) === String(user.userid)
                      ).length;
                      return (
                        <SelectItem key={user.userid} value={String(user.userid)}>
                          <div className="flex items-center justify-between w-full">
                            <span>{user.name}</span>
                            <Badge variant="outline" className="ml-2">{userLeads}</Badge>
                          </div>
                        </SelectItem>
                      );
                    })
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      {searchQuery ? 'No matching users' : 'No users found'}
                    </div>
                  )}
                </SelectContent>
              </Select>
              {selectedUserId !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUserId('all')}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 relative z-10">
          {loading ? (
            <SkeletonLoader />
          ) : visaData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center">
                <Filter className="h-8 w-8 text-orange-400 dark:text-orange-600" />
              </div>
              <p className="text-muted-foreground text-lg font-medium">No visa data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedUserId !== 'all'
                  ? 'This user has no assigned leads'
                  : 'No leads found'}
              </p>
            </div>
          ) : (
            <>
              <Tabs defaultValue="bar" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-orange-200/30 dark:border-orange-800/30">
                  <TabsTrigger value="bar" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-pink-500 data-[state=active]:text-white font-semibold transition-all duration-300">
                    Bar Chart
                  </TabsTrigger>
                  <TabsTrigger value="pie" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-pink-500 data-[state=active]:text-white font-semibold transition-all duration-300">
                    Distribution
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="bar" className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visaData} style={{ backgroundColor: 'transparent' }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-orange-200/40 dark:stroke-orange-800/40" opacity={0.3} />
                      <XAxis dataKey="visaType" className="text-xs" angle={-45} textAnchor="end" height={80} stroke="currentColor" />
                      <YAxis className="text-xs" stroke="currentColor" />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(37, 21, 9, 0.03)' }} wrapperStyle={{ outline: 'none' }} />
                      <Legend />
                      <Bar dataKey="leads" fill="url(#colorLeads)" name="Total Leads" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="converted" fill="url(#colorConverted)" name="Converted" radius={[8, 8, 0, 0]} />
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FB923C" stopOpacity={0.9}/>
                          <stop offset="95%" stopColor="#F97316" stopOpacity={0.7}/>
                        </linearGradient>
                        <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.9}/>
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0.7}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </TabsContent>
                <TabsContent value="pie" className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={visaData} cx="50%" cy="50%" labelLine={false} label={({ visaType, percent }) => `${visaType}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="leads">
                        {visaData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={VISA_COLORS[entry.visaType] || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </TabsContent>
              </Tabs>
              <motion.div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <motion.div className="p-4 rounded-xl backdrop-blur-sm bg-white/70 dark:bg-gray-900/70 border border-orange-200/50 dark:border-orange-800/50 shadow-md hover:shadow-xl transition-all duration-300" whileHover={{ scale: 1.03, y: -2 }}>
                  <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Total Leads</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 dark:from-orange-400 dark:to-pink-400 bg-clip-text text-transparent">{totalLeads}</p>
                </motion.div>
                <motion.div className="p-4 rounded-xl backdrop-blur-sm bg-white/70 dark:bg-gray-900/70 border border-teal-200/50 dark:border-teal-800/50 shadow-md hover:shadow-xl transition-all duration-300" whileHover={{ scale: 1.03, y: -2 }}>
                  <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Converted</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">{totalConverted}</p>
                </motion.div>
                <motion.div className="p-4 rounded-xl backdrop-blur-sm bg-white/70 dark:bg-gray-900/70 border border-purple-200/50 dark:border-purple-800/50 shadow-md hover:shadow-xl transition-all duration-300 col-span-2 lg:col-span-1" whileHover={{ scale: 1.03, y: -2 }}>
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Conversion Rate</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">{conversionRate}%</p>
                </motion.div>
              </motion.div>
              <motion.div className="mt-4 p-3 rounded-lg bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Visa Categories</p>
                <div className="flex flex-wrap gap-3">
                  {visaData.map((visa, index) => (
                    <Badge key={index} variant="outline" className="text-xs" style={{ borderColor: VISA_COLORS[visa.visaType], color: VISA_COLORS[visa.visaType] }}>
                      <div className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: VISA_COLORS[visa.visaType] }} />
                      {visa.visaType} ({visa.leads})
                    </Badge>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
