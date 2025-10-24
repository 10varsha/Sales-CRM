import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { format, startOfDay, subDays, parseISO, startOfWeek, subWeeks, startOfMonth, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataService } from '@/hooks/useDataService';

const FETCH_PAGE_SIZE = 100;
const DAY_POINTS = 14;
const WEEK_POINTS = 12;
const MONTH_POINTS = 12;
const WEEK_STARTS_ON: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1;

type Timeframe = 'day' | 'week' | 'month';

interface ChartDatum {
  label: string;
  total: number;
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-[350px] bg-gradient-to-br from-purple-100/50 to-indigo-100/50 dark:from-purple-950/20 dark:to-indigo-950/20 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gradient-to-br from-purple-100/50 to-indigo-100/50 dark:from-purple-950/20 dark:to-indigo-950/20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// Custom Tooltip with gradient design
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-950 border-2 border-purple-200/50 dark:border-purple-800/50 rounded-xl shadow-2xl p-4 backdrop-blur-md">
        <p className="font-bold text-gray-900 dark:text-gray-100 mb-2 text-sm">{label}</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Leads:</span>
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
            {payload[0]?.value || 0}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export function LeadsTrendChart() {
  const { fetchWithAuth } = useAuth();
  const { fetchAllLeads } = useDataService();
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState<Timeframe>('month');
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'line' | 'area'>('area');
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  // Fetch all leads
  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const allLeads = await fetchAllLeads();

        // <=======================uncomment for dynamic data=======================>
        
        // const allLeads: any[] = [];
        // let cursor: number | null = null;
        // let pages = 0;

        // const firstRes = await fetchWithAuth(`${API_BASE_URL}/crm-leads?take=${FETCH_PAGE_SIZE}`);
        // if (!firstRes.ok) throw new Error('Failed to load leads');

        // const firstData = await firstRes.json();
        // const firstItems = Array.isArray(firstData) ? firstData : firstData.items || [];
        // allLeads.push(...firstItems);

        // cursor = Array.isArray(firstData) ? null : firstData.nextCursor;

        // while (cursor !== null && pages < 200) {
        //   const res = await fetchWithAuth(`${API_BASE_URL}/crm-leads?take=${FETCH_PAGE_SIZE}&cursor=${cursor}`);
        //   if (!res.ok) break;

        //   const data = await res.json();
        //   const items = data.items || [];
        //   allLeads.push(...items);

        //   cursor = data.nextCursor;
        //   pages += 1;
        // }

        if (!cancelled) {
          setLeads(allLeads);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            variant: 'destructive',
            title: 'Failed to load lead trend data',
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
    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth, toast]);

  // Process chart data
  const chartData = useMemo<{ data: ChartDatum[]; change: number; average: number; peak: number }>(() => {
    const today = startOfDay(new Date());
    const dateCountMap = new Map<string, number>();

    leads.forEach(lead => {
      if (!lead.createdat) return;
      
      const createdAt = lead.createdat instanceof Date ? lead.createdat : new Date(lead.createdat);
      if (isNaN(createdAt.getTime())) return;

      let dateKey: string;
      if (timeframe === 'day') {
        dateKey = format(createdAt, 'yyyy-MM-dd');
      } else if (timeframe === 'week') {
        dateKey = format(startOfWeek(createdAt, { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd');
      } else {
        dateKey = format(startOfMonth(createdAt), 'yyyy-MM');
      }

      dateCountMap.set(dateKey, (dateCountMap.get(dateKey) || 0) + 1);
    });

    const points = timeframe === 'day' ? DAY_POINTS : timeframe === 'week' ? WEEK_POINTS : MONTH_POINTS;
    const series: ChartDatum[] = [];

    for (let i = points - 1; i >= 0; i -= 1) {
      let date: Date;
      let dateKey: string;
      let label: string;

      if (timeframe === 'day') {
        date = subDays(today, i);
        dateKey = format(date, 'yyyy-MM-dd');
        label = format(date, 'MMM d');
      } else if (timeframe === 'week') {
        const startWeek = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
        date = subWeeks(startWeek, i);
        dateKey = format(date, 'yyyy-MM-dd');
        label = format(date, 'MMM d');
      } else {
        const startMonth = startOfMonth(today);
        date = subMonths(startMonth, i);
        dateKey = format(date, 'yyyy-MM');
        label = format(date, 'MMM yyyy');
      }

      series.push({
        label,
        total: dateCountMap.get(dateKey) || 0,
      });
    }

    const lastPoint = series[series.length - 1];
    const prevPoint = series[series.length - 2];
    const change = prevPoint?.total
      ? ((lastPoint.total - prevPoint.total) / prevPoint.total) * 100
      : 0;

    const average = series.reduce((sum, d) => sum + d.total, 0) / series.length;
    const peak = Math.max(...series.map(d => d.total));

    return { data: series, change, average, peak };
  }, [leads, timeframe]);

  const isPositive = chartData.change >= 0;
  const totalLeads = chartData.data.reduce((sum, d) => sum + d.total, 0);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full flex flex-col relative overflow-hidden border shadow-xl bg-gradient-to-br from-purple-50/30 via-white to-indigo-50/30 dark:from-purple-950/10 dark:via-gray-950 dark:to-indigo-950/10">
        {/* Subtle animated background */}
        <div className="absolute inset-0 opacity-20 dark:opacity-10">
          <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-br from-purple-300/20 to-indigo-300/20 dark:from-purple-800/10 dark:to-indigo-800/10 rounded-full filter blur-3xl animate-blob" />
          <div className="absolute bottom-0 right-0 w-72 h-72 bg-gradient-to-br from-indigo-300/20 to-purple-300/20 dark:from-indigo-800/10 dark:to-purple-800/10 rounded-full filter blur-3xl animate-blob animation-delay-2000" />
        </div>

        <CardHeader className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 shadow-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  Lead Volume Trend
                </CardTitle>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <Badge 
                  variant={isPositive ? "default" : "destructive"}
                  className={cn(
                    "font-semibold px-3 py-1",
                    isPositive 
                      ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" 
                      : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                  )}
                >
                  {isPositive ? <TrendingUp className="h-3.5 w-3.5 mr-1" /> : <TrendingDown className="h-3.5 w-3.5 mr-1" />}
                  {isPositive ? '+' : ''}{chartData.change.toFixed(1)}%
                </Badge>
                <span className="text-sm text-muted-foreground font-medium">
                  vs previous period
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup 
                type="single" 
                value={chartType} 
                onValueChange={(value) => value && setChartType(value as 'line' | 'area')}
                className="border rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
              >
                <ToggleGroupItem 
                  value="area" 
                  aria-label="Area Chart"
                  className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-purple-500 data-[state=on]:to-indigo-500 data-[state=on]:text-white font-semibold"
                >
                  <Activity className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="line" 
                  aria-label="Line Chart"
                  className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-purple-500 data-[state=on]:to-indigo-500 data-[state=on]:text-white font-semibold"
                >
                  <BarChart3 className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>

              <ToggleGroup 
                type="single" 
                value={timeframe} 
                onValueChange={(value) => value && setTimeframe(value as Timeframe)}
                className="border rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
              >
                <ToggleGroupItem 
                  value="day" 
                  aria-label="Day"
                  className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-purple-500 data-[state=on]:to-indigo-500 data-[state=on]:text-white font-semibold"
                >
                  Day
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="week" 
                  aria-label="Week"
                  className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-purple-500 data-[state=on]:to-indigo-500 data-[state=on]:text-white font-semibold"
                >
                  Week
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="month" 
                  aria-label="Month"
                  className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-purple-500 data-[state=on]:to-indigo-500 data-[state=on]:text-white font-semibold"
                >
                  Month
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 relative z-10">
          {loading ? (
            <SkeletonLoader />
          ) : chartData.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
                <Activity className="h-8 w-8 text-purple-400 dark:text-purple-600" />
              </div>
              <p className="text-muted-foreground text-lg font-medium">No lead data available yet</p>
              <p className="text-sm text-muted-foreground mt-1">Start creating leads to see trends</p>
            </div>
          ) : (
            <>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart data={chartData.data}>
                      <defs>
                        <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                          <stop offset="50%" stopColor="#6366F1" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-purple-200/40 dark:stroke-purple-800/40" />
                      <XAxis 
                        dataKey="label" 
                        className="text-xs"
                        stroke="currentColor"
                      />
                      <YAxis className="text-xs" stroke="currentColor" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="total" 
                        stroke="#8B5CF6"
                        strokeWidth={3}
                        fill="url(#colorGradient)"
                        name="Total Leads"
                      />
                    </AreaChart>
                  ) : (
                    <LineChart data={chartData.data}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-purple-200/40 dark:stroke-purple-800/40" />
                      <XAxis 
                        dataKey="label" 
                        className="text-xs"
                        stroke="currentColor"
                      />
                      <YAxis className="text-xs" stroke="currentColor" />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="total" 
                        stroke="#8B5CF6"
                        strokeWidth={3}
                        dot={{ fill: '#8B5CF6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 7, fill: '#6366F1' }}
                        name="Total Leads"
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Enhanced Stats Summary */}
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div 
                  className="p-4 rounded-xl backdrop-blur-sm bg-white/70 dark:bg-gray-900/70 border border-purple-200/50 dark:border-purple-800/50 shadow-md hover:shadow-xl transition-all duration-300"
                  whileHover={{ scale: 1.03, y: -2 }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500">
                      <Activity className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      Total Leads
                    </p>
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                    {totalLeads.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    In selected period
                  </p>
                </motion.div>

                <motion.div 
                  className="p-4 rounded-xl backdrop-blur-sm bg-white/70 dark:bg-gray-900/70 border border-indigo-200/50 dark:border-indigo-800/50 shadow-md hover:shadow-xl transition-all duration-300"
                  whileHover={{ scale: 1.03, y: -2 }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
                      <TrendingUp className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Average
                    </p>
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                    {Math.round(chartData.average).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per {timeframe === 'day' ? 'day' : timeframe === 'week' ? 'week' : 'month'}
                  </p>
                </motion.div>

                <motion.div 
                  className="p-4 rounded-xl backdrop-blur-sm bg-white/70 dark:bg-gray-900/70 border border-purple-200/50 dark:border-purple-800/50 shadow-md hover:shadow-xl transition-all duration-300"
                  whileHover={{ scale: 1.03, y: -2 }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                      <BarChart3 className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      Peak Period
                    </p>
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                    {chartData.peak.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Highest volume recorded
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
