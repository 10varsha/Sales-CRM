import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView, Variants } from 'framer-motion';
import { ArrowUp, ArrowDown, Users, UserPlus, DollarSign, Ticket, Calendar as CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { differenceInDays, format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { useDataService } from '@/hooks/useDataService';

const NEW_LEADS_DAYS_WINDOW = 7;

interface StatCardData {
  title: string;
  value: number;
  change: number;
  changeLabel: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  trend: number[];
}

// Animated Counter Component
function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    const start = 0;
    const end = value;
    const increment = end / (duration * 60);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 1000 / 60);

    return () => clearInterval(timer);
  }, [value, duration, isInView]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

// Animated Currency Component
function AnimatedCurrency({ value, duration = 2 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    const start = 0;
    const end = value;
    const increment = end / (duration * 60);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 1000 / 60);

    return () => clearInterval(timer);
  }, [value, duration, isInView]);

  return <span ref={ref}>${count.toLocaleString()}</span>;
}

// Skeleton Loading Card
function SkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-muted rounded-lg" />
            <div className="w-16 h-6 bg-muted rounded" />
          </div>
          <div className="space-y-2">
            <div className="w-24 h-4 bg-muted rounded" />
            <div className="w-32 h-8 bg-muted rounded" />
          </div>
          <div className="mt-4 h-12 bg-muted rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// Sparkline Component
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg 
      viewBox="0 0 100 40" 
      className="w-full h-12" 
      preserveAspectRatio="none"
    >
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polygon
        points={`0,100 ${points} 100,100`}
        fill={`url(#gradient-${color})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut", delay: 0.3 }}
      />
    </svg>
  );
}

// Main StatCard Component
function StatCard({ data, index }: { data: StatCardData; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const cardVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.9
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: index * 0.1,
        ease: "easeInOut"
      }
    }
  };

  const iconVariants: Variants = {
    hidden: { scale: 0, rotate: -180 },
    visible: { 
      scale: 1, 
      rotate: 0,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay: index * 0.1 + 0.2
      }
    }
  };

  const changeVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: { 
      x: 0, 
      opacity: 1,
      transition: {
        delay: index * 0.1 + 0.4
      }
    }
  };

  return (
    <motion.div
      ref={ref}
      variants={cardVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      <motion.div
        whileHover={{ 
          scale: 1.03,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Card className="overflow-hidden relative group cursor-pointer">
          {/* Animated gradient background on hover */}
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: `linear-gradient(135deg, ${data.bgColor}15 0%, ${data.bgColor}05 100%)`
            }}
          />

          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <motion.div 
                variants={iconVariants}
                className={cn(
                  "p-3 rounded-xl shadow-sm",
                  "group-hover:shadow-md transition-shadow duration-300"
                )}
                style={{ backgroundColor: `${data.bgColor}20` }}
              >
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  style={{ color: data.color }}
                >
                  {data.icon}
                </motion.div>
              </motion.div>

              <motion.div 
                variants={changeVariants}
                className={cn(
                  "flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full",
                  data.change >= 0 
                    ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" 
                    : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                )}
              >
                {data.change >= 0 ? (
                  <motion.div
                    initial={{ y: 5 }}
                    animate={{ y: [-2, 2, -2] }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 1.5,
                      ease: "easeInOut"
                    }}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ y: -5 }}
                    animate={{ y: [2, -2, 2] }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 1.5,
                      ease: "easeInOut"
                    }}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </motion.div>
                )}
                <span>{Math.abs(data.change)}%</span>
              </motion.div>
            </div>

            <motion.div 
              className="space-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 + 0.5 }}
            >
              <p className="text-sm text-muted-foreground font-medium">
                {data.title}
              </p>
              <p className="text-3xl font-bold tracking-tight">
                {data.title.toLowerCase().includes('revenue') || data.title.toLowerCase().includes('value') ? (
                  <AnimatedCurrency value={data.value} duration={2} />
                ) : (
                  <AnimatedCounter value={data.value} duration={2} />
                )}
              </p>
              <p className="text-xs text-muted-foreground">{data.changeLabel}</p>
            </motion.div>

            {/* Sparkline */}
            <motion.div 
              className="mt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.7 }}
            >
              <Sparkline data={data.trend} color={data.color} />
            </motion.div>
          </CardContent>

          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ["100%", "-100%"] }}
            transition={{
              repeat: Infinity,
              duration: 3,
              ease: "linear",
              repeatDelay: 5
            }}
          />
        </Card>
      </motion.div>
    </motion.div>
  );
}

export function DashboardStats() {
  const { fetchWithAuth } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCardData[]>([]);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { fetchAllLeads } = useDataService();

  // Format date range for display
  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return 'Custom';
    if (!range.to) return format(range.from, 'MMM dd, yyyy');
    return `${format(range.from, 'MMM dd')} - ${format(range.to, 'MMM dd, yyyy')}`;
  };

  // Clear date range
  const clearDateRange = () => {
    setDateRange(undefined);
    setTimeframe('week');
  };

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
          const totalLeads = allLeads.length;
          const newLeads = allLeads.filter(l => {
            const created = new Date(l.createdat || l.created_at);
            const daysAgo = differenceInDays(new Date(), created);
            return daysAgo <= NEW_LEADS_DAYS_WINDOW;
          }).length;

          const closedDeals = allLeads.filter(l => 
            l.status === 'Closed Won' || l.stage === 'Closed'
          ).length;

          const totalRevenue = allLeads.reduce((sum, l) => {
            const amount = parseFloat(l.signedamount || l.amount || '0');
            return sum + amount;
          }, 0);

          const generateTrend = () => Array.from({ length: 7 }, () => Math.random() * 100 + 50);

          const statsData: StatCardData[] = [
            {
              title: 'Total Leads',
              value: totalLeads,
              change: 12.5,
              changeLabel: 'vs last period',
              icon: <Users className="h-5 w-5" />,
              color: '#3b82f6',
              bgColor: '#3b82f6',
              trend: generateTrend()
            },
            {
              title: 'New Leads',
              value: newLeads,
              change: 8.2,
              changeLabel: `Last ${NEW_LEADS_DAYS_WINDOW} days`,
              icon: <UserPlus className="h-5 w-5" />,
              color: '#22c55e',
              bgColor: '#22c55e',
              trend: generateTrend()
            },
            {
              title: 'Closed Deals',
              value: closedDeals,
              change: -3.1,
              changeLabel: 'vs last period',
              icon: <Ticket className="h-5 w-5" />,
              color: '#f59e0b',
              bgColor: '#f59e0b',
              trend: generateTrend()
            },
            {
              title: 'Total Revenue',
              value: Math.floor(totalRevenue),
              change: 15.8,
              changeLabel: 'vs last period',
              icon: <DollarSign className="h-5 w-5" />,
              color: '#8b5cf6',
              bgColor: '#8b5cf6',
              trend: generateTrend()
            }
          ];

          setStats(statsData);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            variant: 'destructive',
            title: 'Failed to load stats',
            description: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      } finally {
        if (!cancelled) {
          setTimeout(() => setLoading(false), 500);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [fetchWithAuth, timeframe, dateRange, toast]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <motion.div 
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Key Metrics</h2>
          <p className="text-muted-foreground text-sm">
            Track your sales performance
            {dateRange?.from && (
              <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                • {formatDateRange(dateRange)}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!dateRange?.from && (
            <ToggleGroup 
              type="single" 
              value={timeframe} 
              onValueChange={(v) => v && setTimeframe(v as any)}
              className="border rounded-lg bg-white dark:bg-gray-900"
            >
              <ToggleGroupItem 
                value="day" 
                aria-label="Day"
                className="data-[state=on]:bg-blue-500 data-[state=on]:text-white"
              >
                Day
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="week" 
                aria-label="Week"
                className="data-[state=on]:bg-blue-500 data-[state=on]:text-white"
              >
                Week
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="month" 
                aria-label="Month"
                className="data-[state=on]:bg-blue-500 data-[state=on]:text-white"
              >
                Month
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={dateRange?.from ? "default" : "outline"}
                size="sm"
                className={cn(
                  "min-w-[200px] justify-start text-left font-medium transition-all duration-300",
                  dateRange?.from 
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg hover:shadow-xl" 
                    : "hover:border-blue-400 dark:hover:border-blue-600"
                )}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {formatDateRange(dateRange)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 border-b">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Select Date Range</p>
                  {dateRange?.from && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearDateRange}
                      className="h-8 px-2 text-xs hover:bg-red-100 dark:hover:bg-red-950/30 hover:text-red-600"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
                {dateRange?.from && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateRange(dateRange)}
                  </p>
                )}
              </div>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                className="rounded-md"
              />
              <div className="p-3 border-t bg-muted/50">
                <p className="text-xs text-muted-foreground text-center">
                  Select start and end dates to filter data
                </p>
              </div>
            </PopoverContent>
          </Popover>

          {dateRange?.from && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={clearDateRange}
                className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-400 dark:hover:border-red-600"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filter
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <StatCard key={index} data={stat} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
