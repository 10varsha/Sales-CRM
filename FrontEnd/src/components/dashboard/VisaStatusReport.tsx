import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Card, CardContent, CardHeader, CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
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
import { useDateFilter } from '@/context/DateFilterContext';

// Code 1 - Simple visa status map
const VISA_STATUS_MAP: Record<number, string> = {
  1: "H1B",
  2: "F1",
  3: "OPT",
  4: "STEM",
  5: "Green Card",
  6: "USC",
  7: "H4"
};

const VISA_STATUS_ORDER = [1, 2, 3, 4, 5, 6, 7];

const VISA_COLORS: Record<string, string> = {
  'H1B': '#3B82F6',
  'F1': '#10B981',
  'OPT': '#8B5CF6',
  'STEM': '#F59E0B',
  'Green Card': '#EF4444',
  'USC': '#6B7280',
  'H4': '#EC4899'
};

// Same logic as DashboardStats.tsx for closedDeals
function isClosedDeal(lead: any): boolean {
  const status = (lead.status || '').toLowerCase();
  const stage = (lead.stage || '').toLowerCase();
  return status.includes('signed') || stage.includes('signed');
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

// Code 2 - Custom Tooltip for basic view
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-950 border-2 border-orange-200/50 dark:border-orange-800/50 rounded-lg shadow-xl p-3 backdrop-blur-md">
        <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
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

// Code 2 - Custom Tooltip with team breakdown
const VisaCustomTooltip = ({ active = false, payload = [], label = "" }: any) => {
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
          {visaData.teamBreakdown.map((team: any, idx: number) => (
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

export function VisaStatusReport() {
  const { fetchWithAuth } = useAuth();
  const { toast } = useToast();
  const { getDateRangeFilter } = useDateFilter(); // Import date filter context
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHeadId, setSelectedHeadId] = useState<string | null>(null);
  const [chartType, setChartType] = useState('bar');
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  // Filter leads by date from context
  const filterLeadsByDate = (leads: any[]) => {
    const range = getDateRangeFilter();
    if (!range) return leads;

    return leads.filter(lead => {
      const leadDate = new Date(lead.createdat || lead.created_at || '');
      return leadDate >= range.start && leadDate <= range.end;
    });
  };

  // Code 2 - Cursor-based pagination for data fetching
  useEffect(() => {
    let cancelled = false;
    let interval: NodeJS.Timeout;
    
    const load = async () => {
      setLoading(true);
      try {
        // Fetch users
        const usersRes = await fetchWithAuth("https://saleshub.silverspace.tech/users");
        let allUsers: any[] = [];
        if (usersRes.ok) {
          const apiUsers = await usersRes.json();
          allUsers = Array.isArray(apiUsers.items) ? apiUsers.items : (Array.isArray(apiUsers) ? apiUsers : []);
        }

        // Code 2 - Fetch leads with cursor-based pagination
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
        const allLeads: any[] = [];
        let cursor: number | null = null;

        // First request
        const firstRes = await fetchWithAuth(`${API_BASE_URL}/crm-leads?take=100`);
        if (!firstRes.ok) throw new Error('Failed to load leads');
        
        const firstData = await firstRes.json();
        const firstItems = Array.isArray(firstData) ? firstData : firstData.items || [];
        allLeads.push(...firstItems);
        
        // Get cursor from response
        cursor = Array.isArray(firstData) ? null : firstData.nextCursor;

        // Continue fetching with cursor until no more data or limit reached
        while (cursor !== null && allLeads.length < 1000) {
          const res = await fetchWithAuth(`${API_BASE_URL}/crm-leads?take=100&cursor=${cursor}`);
          if (!res.ok) break;
          
          const data = await res.json();
          allLeads.push(...(data.items || []));
          cursor = data.nextCursor;
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

  // Code 1 - Simple visa status name getter
  const getVisaStatusName = (visaStatusId: number): string => {
    return VISA_STATUS_MAP[visaStatusId] || 'Other';
  };

  // Code 2 - Two different modes for chart data with date filtering
  const visaChartData = useMemo(() => {
    // Apply date filter from context
    const dateFilteredLeads = filterLeadsByDate(leads);

    if (!selectedHeadId) {
      // Mode 1: All heads combined - aggregated data by visa type
      return VISA_STATUS_ORDER.map(id => {
        const visaName = VISA_STATUS_MAP[id];
        const visaLeads = dateFilteredLeads.filter(lead => 
          String(lead.visastatusid) === String(id)
        );

        // Use same logic as DashboardStats.tsx closedDeals
        const converted = visaLeads.filter(lead => isClosedDeal(lead)).length;

        return {
          visaType: visaName,
          totalLeads: visaLeads.length,
          converted: converted
        };
      }).filter(item => item.totalLeads > 0);
    } else {
      // Mode 2: Selected head - show visa types with team breakdown
      const teamLeads = users.filter(u => u.roleid === 5 && String(u.managerid) === String(selectedHeadId));
      
      return VISA_STATUS_ORDER.map(id => {
        const visaName = VISA_STATUS_MAP[id];
        
        const teamBreakdown = teamLeads.map(teamLead => {
          const teamLeadLeads = dateFilteredLeads.filter(l => 
            String(l.assignedto) === String(teamLead.userid)
          );

          const visaLeads = teamLeadLeads.filter(lead => 
            String(lead.visastatusid) === String(id)
          );

          // Use same logic as DashboardStats.tsx closedDeals
          const converted = visaLeads.filter(lead => isClosedDeal(lead)).length;

          return {
            teamName: teamLead.name,
            count: visaLeads.length,
            converted: converted
          };
        });

        const totalLeads = teamBreakdown.reduce((sum, t) => sum + t.count, 0);
        const totalConverted = teamBreakdown.reduce((sum, t) => sum + t.converted, 0);

        return {
          visaType: visaName,
          totalLeads,
          converted: totalConverted,
          teamBreakdown
        };
      }).filter(item => item.totalLeads > 0);
    }
  }, [selectedHeadId, leads, users, getDateRangeFilter]);

  // Pie data for selected head with date filtering
  const pieData = useMemo(() => {
    if (!selectedHeadId) return [];
    
    const dateFilteredLeads = filterLeadsByDate(leads);
    const teamLeads = users.filter(u => u.roleid === 5 && String(u.managerid) === String(selectedHeadId));
    const teamLeadIds = new Set(teamLeads.map(u => String(u.userid)));
    const allLeadsByTeam = dateFilteredLeads.filter(l => 
      l.assignedto !== undefined && teamLeadIds.has(String(l.assignedto))
    );

    const visaCounts: Record<string, number> = {};
    VISA_STATUS_ORDER.forEach(id => {
      visaCounts[VISA_STATUS_MAP[id]] = 0;
    });
    
    for (const lead of allLeadsByTeam) {
      const visaType = getVisaStatusName(lead.visastatusid);
      visaCounts[visaType] = (visaCounts[visaType] || 0) + 1;
    }

    return VISA_STATUS_ORDER.map(id => ({
      name: VISA_STATUS_MAP[id],
      value: visaCounts[VISA_STATUS_MAP[id]] || 0,
    })).filter(v => v.value > 0);
  }, [selectedHeadId, users, leads, getDateRangeFilter]);

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
              {selectedHeadId && (
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
                        content={(props: any) => selectedHeadId ? <VisaCustomTooltip {...props} /> : <CustomTooltip {...props} />}
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
                        name="Closed Deals"
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
                        label={({ name, percent }: any) => `${name} (${(percent*100).toFixed(1)}%)`}
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
