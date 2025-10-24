import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Download, Filter } from 'lucide-react';

// Softer, more accessible color palette
const COLORS = ['#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA', '#FFD3E1', '#FFAAA5'];

interface VisaData {
  visaType: string;
  leads: number;
  converted: number;
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

// Custom Tooltip Component with proper dark mode support
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

export function VisaStatusReport() {
  const { fetchWithAuth } = useAuth();
  const { toast } = useToast();
  const [timeFilter, setTimeFilter] = useState('all');
  const [groupBy, setGroupBy] = useState('visa');
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

        // Fetch all pages
        while (cursor !== null && allLeads.length < 2000) {
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
            title: 'Failed to load visa data',
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
  }, [fetchWithAuth, toast, timeFilter]); // Re-fetch when timeFilter changes

  const visaData = useMemo(() => {
    const visaMap = new Map<string, { leads: number; converted: number }>();

    leads.forEach(lead => {
      // Handle multiple possible field names for visa type
      const visaType = lead.visatype || lead.visa_type || lead.visaType || lead.category || 'Unknown';
      
      // Check if lead is converted based on multiple possible status fields
      const status = lead.status || lead.stage || '';
      const isConverted = 
        status.toLowerCase().includes('closed won') || 
        status.toLowerCase().includes('closed') ||
        status.toLowerCase().includes('won') ||
        lead.isclosed === true ||
        lead.iswon === true;

      const current = visaMap.get(visaType) || { leads: 0, converted: 0 };
      visaMap.set(visaType, {
        leads: current.leads + 1,
        converted: current.converted + (isConverted ? 1 : 0),
      });
    });

    return Array.from(visaMap.entries())
      .map(([visaType, stats]) => ({
        visaType,
        ...stats,
      }))
      .sort((a, b) => b.leads - a.leads);
  }, [leads]);

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
        {/* Subtle animated background - much more toned down */}
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
            
            {/* Fixed button container - keeps buttons on same line */}
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
                <SelectTrigger className="w-[120px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-orange-300/50 dark:border-orange-800/50 font-semibold shadow-md hover:shadow-lg transition-all duration-300 hover:border-orange-400 dark:hover:border-orange-600">
                <SelectValue />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
            </Select>
            
            <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-[120px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-orange-300/50 dark:border-orange-800/50 font-semibold shadow-md hover:shadow-lg transition-all duration-300 hover:border-orange-400 dark:hover:border-orange-600">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="visa">By Visa</SelectItem>
                <SelectItem value="stage">By Stage</SelectItem>
                <SelectItem value="team">By Team</SelectItem>
                </SelectContent>
            </Select>
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
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or date range</p>
            </div>
          ) : (
            <>
              <Tabs defaultValue="bar" className="w-full">
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
                  >
                    Distribution
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="bar" className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visaData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-orange-200/40 dark:stroke-orange-800/40" />
                      <XAxis 
                        dataKey="visaType" 
                        className="text-xs"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        stroke="currentColor"
                      />
                      <YAxis className="text-xs" stroke="currentColor" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar 
                        dataKey="leads" 
                        fill="url(#colorLeads)" 
                        name="Total Leads" 
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar 
                        dataKey="converted" 
                        fill="url(#colorConverted)" 
                        name="Converted" 
                        radius={[8, 8, 0, 0]}
                      />
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
                      <Pie
                        data={visaData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ visaType, percent }) => `${visaType}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="leads"
                      >
                        {visaData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </TabsContent>
              </Tabs>

              {/* Summary Stats with refined glassmorphism */}
              <motion.div 
                className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div 
                  className="p-4 rounded-xl backdrop-blur-sm bg-white/70 dark:bg-gray-900/70 border border-orange-200/50 dark:border-orange-800/50 shadow-md hover:shadow-xl transition-all duration-300"
                  whileHover={{ scale: 1.03, y: -2 }}
                >
                  <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">
                    Total Leads
                  </p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 dark:from-orange-400 dark:to-pink-400 bg-clip-text text-transparent">
                    {totalLeads}
                  </p>
                </motion.div>

                <motion.div 
                  className="p-4 rounded-xl backdrop-blur-sm bg-white/70 dark:bg-gray-900/70 border border-teal-200/50 dark:border-teal-800/50 shadow-md hover:shadow-xl transition-all duration-300"
                  whileHover={{ scale: 1.03, y: -2 }}
                >
                  <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">
                    Converted
                  </p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                    {totalConverted}
                  </p>
                </motion.div>

                <motion.div 
                  className="p-4 rounded-xl backdrop-blur-sm bg-white/70 dark:bg-gray-900/70 border border-purple-200/50 dark:border-purple-800/50 shadow-md hover:shadow-xl transition-all duration-300 col-span-2 lg:col-span-1"
                  whileHover={{ scale: 1.03, y: -2 }}
                >
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
                    Conversion Rate
                  </p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                    {conversionRate}%
                  </p>
                </motion.div>
              </motion.div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
