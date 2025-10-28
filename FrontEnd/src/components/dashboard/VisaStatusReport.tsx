import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Card, CardContent, CardHeader, CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Download, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const VISA_STATUSES = [
  'F-1 Visa', 'F-1 OPT', 'STEM OPT', 'H-1B Visa', 'Green Card', 'Other', 'Unknown'
];

const VISA_COLORS = {
  'F-1 Visa': '#3B82F6',
  'F-1 OPT': '#10B981',
  'STEM OPT': '#8B5CF6',
  'H-1B Visa': '#F59E0B',
  'Green Card': '#EF4444',
  'Other': '#6B7280',
  'Unknown': '#9CA3AF'
};

const VISA_STATUS_MAP = {
  1: 'F-1 Visa',
  2: 'F-1 OPT',
  3: 'STEM OPT',
  4: 'H-1B Visa',
  5: 'Green Card',
  6: 'Other'
};

function getVisaTypeName(visaStatusId) {
  return VISA_STATUS_MAP[visaStatusId] || 'Unknown';
}

function normalizeVisaType(visaType) {
  if (!visaType) return 'Unknown';
  const normalized = visaType.toLowerCase().trim();
  if (normalized.includes('f-1') || normalized.includes('f1')) {
    if (normalized.includes('stem')) return 'STEM OPT';
    else if (normalized.includes('opt')) return 'F-1 OPT';
    return 'F-1 Visa';
  }
  if (normalized.includes('stem')) return 'STEM OPT';
  if (normalized.includes('opt')) return 'F-1 OPT';
  if (normalized.includes('h-1b') || normalized.includes('h1b') || normalized.includes('h-1') || normalized.includes('h1')) return 'H-1B Visa';
  if (normalized.includes('green card') || normalized.includes('greencard') || normalized.includes('permanent resident') ||
    normalized.includes('pr') || normalized.includes('eb-') || normalized.includes('eb')) return 'Green Card';
  if (normalized.includes('l-1') || normalized.includes('l1') || normalized.includes('o-1') || normalized.includes('o1') ||
    normalized.includes('e-2') || normalized.includes('e2') || normalized.includes('tn') || normalized.includes('j-1') || normalized.includes('j1')) return 'Other';
  return 'Unknown';
}

const TIME_FILTERS = [
  { value: 'all', label: 'All Time' },
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' }
];

function filterLeadsByTime(leads, filter) {
  if (filter === 'all') return leads;
  const now = new Date();
  return leads.filter((lead) => {
    if (!lead.createdat) return false;
    const date = new Date(lead.createdat);
    if (filter === 'day') return date.toDateString() === now.toDateString();
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

// Updated tooltip to show team breakdown by visa type
const VisaCustomTooltip = ({ active = false, payload = [], label = "" }) => {
  if (active && payload && payload.length) {
    const visaData = payload[0]?.payload;
    if (!visaData?.teamBreakdown?.length) return null;
    return (
      <div
        className="bg-white dark:bg-gray-950 border-2 border-orange-200/50 dark:border-orange-800/50 rounded-lg shadow-xl p-3 backdrop-blur-md min-w-[270px] max-w-[360px]"
        style={{ maxHeight: 260, overflowY: 'auto' }}
      >
        <div className="font-bold mb-2 text-base">{label}</div>
        <div className="space-y-2">
          {visaData.teamBreakdown.map((team, idx) => (
            team.count > 0 && (
              <div key={idx} className="pl-2 border-l-2" style={{ borderColor: VISA_COLORS[label] }}>
                <div className="font-semibold text-sm">{team.teamName}</div>
                <div className="text-xs text-muted-foreground">
                  Total: {team.count} | Converted: {team.converted}
                </div>
              </div>
            )
          ))}
        </div>
        <div className="mt-2 pt-2 border-t">
          <div className="flex justify-between text-sm font-semibold">
            <span>Total Leads:</span>
            <span>{visaData.totalLeads}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-green-600 dark:text-green-400">
            <span>Converted:</span>
            <span>{visaData.converted}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-950 border-2 border-orange-200/50 dark:border-orange-800/50 rounded-lg shadow-xl p-3 backdrop-blur-md">
        <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
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
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [timeFilter, setTimeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [selectedHeadId, setSelectedHeadId] = useState(null);
  const [chartType, setChartType] = useState('bar');
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    let cancelled = false;
    let interval;
    const load = async () => {
      setLoading(true);
      try {
        const usersRes = await fetchWithAuth("https://saleshub.silverspace.tech/users");
        let allUsers = [];
        if (usersRes.ok) {
          const apiUsers = await usersRes.json();
          allUsers = Array.isArray(apiUsers.items) ? apiUsers.items : (Array.isArray(apiUsers) ? apiUsers : []);
        }
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
        const leadsRes = await fetchWithAuth(`${API_BASE_URL}/crm-leads?take=1000`);
        let allLeads = [];
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

  const salesHeads = useMemo(() => users.filter(u => u.roleid === 4), [users]);

  // Chart data with visa types on X-axis
  const visaChartData = useMemo(() => {
    if (!selectedHeadId) {
      // All heads combined - group by visa type
      const filteredLeads = filterLeadsByTime(leads, timeFilter);
      
      return VISA_STATUSES.map(visaType => {
        const visaLeads = filteredLeads.filter(lead => {
          const normalized = normalizeVisaType(getVisaTypeName(lead.visastatusid));
          return normalized === visaType;
        });

        const converted = visaLeads.filter(lead => {
          const status = lead.status || lead.stage || '';
          return status.toLowerCase().includes('closed won') ||
                 status.toLowerCase().includes('won') ||
                 lead.isclosed === true ||
                 lead.iswon === true;
        }).length;

        return {
          visaType,
          totalLeads: visaLeads.length,
          converted: converted
        };
      }).filter(item => item.totalLeads > 0);
    } else {
      // Selected head - show visa types with team breakdown
      const teamLeads = users.filter(u => u.roleid === 5 && String(u.managerid) === String(selectedHeadId));
      const teamLeadIds = new Set(teamLeads.map(u => String(u.userid)));
      
      return VISA_STATUSES.map(visaType => {
        const teamBreakdown = teamLeads.map(teamLead => {
          const teamLeadLeads = filterLeadsByTime(
            leads.filter(l => String(l.assignedto) === String(teamLead.userid)),
            timeFilter
          );

          const visaLeads = teamLeadLeads.filter(lead => {
            const normalized = normalizeVisaType(getVisaTypeName(lead.visastatusid));
            return normalized === visaType;
          });

          const converted = visaLeads.filter(lead => {
            const status = lead.status || lead.stage || '';
            return status.toLowerCase().includes('closed won') ||
                   status.toLowerCase().includes('won') ||
                   lead.isclosed === true ||
                   lead.iswon === true;
          }).length;

          return {
            teamName: teamLead.name,
            count: visaLeads.length,
            converted: converted
          };
        });

        const totalLeads = teamBreakdown.reduce((sum, t) => sum + t.count, 0);
        const totalConverted = teamBreakdown.reduce((sum, t) => sum + t.converted, 0);

        return {
          visaType,
          totalLeads,
          converted: totalConverted,
          teamBreakdown
        };
      }).filter(item => item.totalLeads > 0);
    }
  }, [selectedHeadId, leads, users, timeFilter]);

  // Pie data for selected head
  const pieData = useMemo(() => {
    if (!selectedHeadId) return [];
    
    const teamLeads = users.filter(u => u.roleid === 5 && String(u.managerid) === String(selectedHeadId));
    const teamLeadIds = new Set(teamLeads.map(u => String(u.userid)));
    const allLeadsByTeam = filterLeadsByTime(
      leads.filter(l => l.assignedto !== undefined && teamLeadIds.has(String(l.assignedto))),
      timeFilter
    );

    const visaCounts = {};
    for(const visa of VISA_STATUSES) visaCounts[visa] = 0;
    
    for(const lead of allLeadsByTeam) {
      const visaType = normalizeVisaType(getVisaTypeName(lead.visastatusid));
      visaCounts[visaType] = (visaCounts[visaType] || 0) + 1;
    }

    return VISA_STATUSES.map(status => ({
      name: status,
      value: visaCounts[status] || 0,
    })).filter(v => v.value > 0);
  }, [selectedHeadId, users, leads, timeFilter]);

  const totalLeads = visaChartData.reduce((sum, v) => sum + v.totalLeads, 0);
  const totalConverted = visaChartData.reduce((sum, v) => sum + v.converted, 0);
  const conversionRate = totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : '0.0';

  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}>
      <Card className="h-full flex flex-col relative overflow-hidden border shadow-lg bg-gradient-to-br from-orange-50/30 via-white to-pink-50/30 dark:from-orange-950/10 dark:via-gray-950 dark:to-pink-950/10">
        <div className="absolute inset-0 opacity-20 dark:opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-orange-200/20 to-pink-200/20 dark:from-orange-800/10 dark:to-pink-800/10 rounded-full filter blur-3xl animate-blob" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-rose-200/20 to-orange-200/20 dark:from-rose-800/10 dark:to-orange-800/10 rounded-full filter blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-gradient-to-br from-pink-200/20 to-rose-200/20 dark:from-pink-800/10 dark:to-rose-800/10 rounded-full filter blur-3xl animate-blob animation-delay-4000" />
        </div>

        <CardHeader className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 dark:from-orange-400 dark:to-pink-400 bg-clip-text text-transparent">
                Visa Status Report
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Track visa applications by type • {totalLeads} total leads
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
                  {TIME_FILTERS.map(filter => (
                    <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedHeadId || ''} onValueChange={val => setSelectedHeadId(val)}>
                <SelectTrigger className="w-[225px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-orange-300/50 dark:border-orange-800/50 font-semibold shadow-md">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Sales Head" />
                </SelectTrigger>
                <SelectContent>
                  {salesHeads.map(head => (
                    <SelectItem key={head.userid} value={String(head.userid)}>{head.name}</SelectItem>
                  ))}
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
              {selectedHeadId && chartType === 'bar' && (
                <Button size="sm" variant="outline" onClick={() => setSelectedHeadId(null)} className="mb-4">
                  ← Back to All Heads
                </Button>
              )}
              {selectedHeadId && chartType === 'pie' && (
                <Button size="sm" variant="outline" onClick={() => setSelectedHeadId(null)} className="mb-4">
                  ← Back to All Heads
                </Button>
              )}

              <Tabs value={chartType} onValueChange={setChartType} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-orange-200/30 dark:border-orange-800/30">
                  <TabsTrigger
                    value="bar"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-pink-500 data-[state=active]:text-white font-semibold transition-all duration-300"
                  >
                    Bar Chart
                  </TabsTrigger>
                  <TabsTrigger
                    value="pie"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-pink-500 data-[state=active]:text-white font-semibold transition-all duration-300"
                    disabled={!selectedHeadId}
                  >
                    Distribution
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="bar" className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visaChartData} style={{ backgroundColor: 'transparent' }} margin={{ top: 5, right: 46, left: 18, bottom: 70 }}>
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
                      <CartesianGrid strokeDasharray="3 3" className="stroke-orange-200/40 dark:stroke-orange-800/40" opacity={0.3} />
                      <XAxis 
                        dataKey="visaType" 
                        className="text-xs" 
                        stroke="currentColor" 
                        interval={0} 
                        angle={-45}
                        textAnchor="end" 
                        height={80} 
                      />
                      <YAxis className="text-xs" stroke="currentColor" allowDecimals={false} />
                      <Tooltip 
                        content={(props: any) => selectedHeadId ? <VisaCustomTooltip {...(props as any)} /> : <CustomTooltip {...(props as any)} />}
                        cursor={{ fill: 'rgba(251, 146, 60, 0.05)' }}
                        wrapperStyle={{ outline: 'none' }} 
                      />
                      <Legend verticalAlign="bottom" wrapperStyle={{ marginTop: 34 }} />
                      <Bar
                        dataKey="totalLeads"
                        fill="url(#colorLeads)"
                        name="Total Leads"
                        barSize={36}
                        radius={[8, 8, 0, 0]}
                        style={{ filter: 'drop-shadow(0 3px 19px rgba(0,0,0,0.10))' }}
                        isAnimationActive={true}
                      />
                      <Bar
                        dataKey="converted"
                        fill="url(#colorConverted)"
                        name="Converted"
                        barSize={36}
                        radius={[8, 8, 0, 0]}
                        style={{ filter: 'drop-shadow(0 3px 19px rgba(0,0,0,0.10))' }}
                        isAnimationActive={true}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </TabsContent>

                <TabsContent value="pie" className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        dataKey="value"
                        isAnimationActive
                        data={pieData}
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ name, percent }) => `${name} (${(percent*100).toFixed(1)}%)`}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={`cell${i}`} fill={VISA_COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(_, name) => name} />
                      <Legend verticalAlign="bottom" />
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

              {/* Visa Category Legend */}
              <motion.div
                className="mt-4 p-3 rounded-lg bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-xs font-semibold text-muted-foreground mb-2">Visa Categories</p>
                <div className="flex flex-wrap gap-3">
                  {visaChartData.map((visa, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: VISA_COLORS[visa.visaType],
                        color: VISA_COLORS[visa.visaType]
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full mr-1.5"
                        style={{ backgroundColor: VISA_COLORS[visa.visaType] }}
                      />
                      {visa.visaType} ({visa.totalLeads})
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
