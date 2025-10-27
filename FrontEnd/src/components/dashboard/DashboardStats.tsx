import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView, Variants } from 'framer-motion';
import { 
  ArrowUp, ArrowDown, Users, UserPlus, DollarSign, Ticket, 
  Calendar as CalendarIcon, X, GitPullRequest, CheckCircle, 
  Clock, MessageCircle, XCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { differenceInDays, format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { 
  startOfWeek, 
  endOfWeek, 
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  getYear,
  getMonth,
  addDays,
  subMonths,
  isSameMonth,
  getWeek
} from 'date-fns';

const NEW_LEADS_DAYS_WINDOW = 7;

type TimeframeMode = 'day' | 'week' | 'month' | 'custom';

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

// Generate weeks for a given month/year
function getMonthWeeks(year: number, month: number) {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(new Date(year, month));
  
  const weeks = eachWeekOfInterval(
    { start, end },
    { weekStartsOn: 0 } // Sunday
  );
  
  return weeks.map((weekStart, index) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
    const displayEnd = weekEnd > end ? end : weekEnd;
    
    return {
      label: `Week ${index + 1} (${format(weekStart, 'MMM d')} - ${format(displayEnd, 'MMM d')})`,
      start: weekStart,
      end: displayEnd,
      weekNumber: index + 1
    };
  });
}

// Years array (last 5 years + current + next year)
const YEARS = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i);

const MONTHS = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' },
];

// Status card configuration with icons
const STATUS_CONFIGS = {
  pipeline: { icon: GitPullRequest, color: '#6366F1', label: 'Pipeline' },
  'quality check': { icon: CheckCircle, color: '#8B5CF6', label: 'Quality Check' },
  'info pending': { icon: Clock, color: '#F59E0B', label: 'Info Pending' },
  'follow-up': { icon: MessageCircle, color: '#3B82F6', label: 'Follow-Up' },
  'not interested': { icon: XCircle, color: '#EF4444', label: 'Not Interested' },
};

// [Keep all the helper components: AnimatedCounter, AnimatedCurrency, SkeletonCard, Sparkline, StatCard - UNCHANGED]
// ... (I'm keeping these the same as in your original code)

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

function SkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-muted rounded-lg" />
            <div className="w-12 h-5 bg-muted rounded" />
          </div>
          <div className="space-y-2">
            <div className="w-20 h-3 bg-muted rounded" />
            <div className="w-24 h-6 bg-muted rounded" />
          </div>
          <div className="mt-3 h-8 bg-muted rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

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
    <svg viewBox="0 0 100 40" className="w-full h-8" preserveAspectRatio="none">
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

function StatCard({ data, index }: { data: StatCardData; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: { 
      opacity: 1, y: 0, scale: 1,
      transition: { duration: 0.5, delay: index * 0.1, ease: "easeInOut" }
    }
  };

  const iconVariants: Variants = {
    hidden: { scale: 0, rotate: -180 },
    visible: { 
      scale: 1, rotate: 0,
      transition: { type: "spring", stiffness: 260, damping: 20, delay: index * 0.1 + 0.2 }
    }
  };

  const changeVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { delay: index * 0.1 + 0.4 } }
  };

  return (
    <motion.div
      ref={ref}
      variants={cardVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      <motion.div
        whileHover={{ scale: 1.03, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Card className="overflow-hidden relative group cursor-pointer h-full">
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: `linear-gradient(135deg, ${data.bgColor}15 0%, ${data.bgColor}05 100%)` }}
          />
          <CardContent className="p-4 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <motion.div 
                variants={iconVariants}
                className="p-2 rounded-xl shadow-sm group-hover:shadow-md transition-shadow duration-300"
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
                  "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                  data.change >= 0 
                    ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" 
                    : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                )}
              >
                {data.change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                <span>{Math.abs(data.change)}%</span>
              </motion.div>
            </div>
            <motion.div 
              className="space-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 + 0.5 }}
            >
              <p className="text-xs text-muted-foreground font-medium">{data.title}</p>
              <p className="text-2xl font-bold tracking-tight">
                {data.title.toLowerCase().includes('revenue') ? (
                  <AnimatedCurrency value={data.value} duration={2} />
                ) : (
                  <AnimatedCounter value={data.value} duration={2} />
                )}
              </p>
              <p className="text-xs text-muted-foreground">{data.changeLabel}</p>
            </motion.div>
            <motion.div 
              className="mt-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.7 }}
            >
              <Sparkline data={data.trend} color={data.color} />
            </motion.div>
          </CardContent>
          <motion.div
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ["100%", "-100%"] }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear", repeatDelay: 5 }}
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
  const [timeframeMode, setTimeframeMode] = useState<TimeframeMode>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  
  // For weekly selection
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>();
  
  // For monthly selection
  const [monthYear, setMonthYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const weeks = useMemo(() => getMonthWeeks(selectedYear, selectedMonth), [selectedYear, selectedMonth]);

  const formatDisplayLabel = () => {
    if (timeframeMode === 'day' && selectedDate) {
      return format(selectedDate, 'MMM dd, yyyy');
    }
    if (timeframeMode === 'week' && selectedWeek !== undefined) {
      const week = weeks[selectedWeek];
      return week ? `${MONTHS[selectedMonth].label} ${week.label}` : 'Select Week';
    }
    if (timeframeMode === 'month') {
      return `${MONTHS[month].label} ${monthYear}`;
    }
    if (timeframeMode === 'custom' && dateRange?.from) {
      if (!dateRange.to) return format(dateRange.from, 'MMM dd, yyyy');
      return `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}`;
    }
    return timeframeMode.charAt(0).toUpperCase() + timeframeMode.slice(1);
  };

  const clearFilters = () => {
    setDateRange(undefined);
    setSelectedDate(undefined);
    setSelectedWeek(undefined);
    setTimeframeMode('month');
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
            l.status?.toLowerCase().includes('closed') || l.stage?.toLowerCase().includes('closed')
          ).length;

          const totalRevenue = allLeads.reduce((sum, l) => {
            const amount = parseFloat(l.expectedrevenue || l.amountpaid || l.signedamount || l.amount || '0');
            return sum + amount;
          }, 0);

          // Count leads by status
          const statusCounts = {
            pipeline: allLeads.filter(l => l.status?.toLowerCase() === 'pipeline').length,
            qualityCheck: allLeads.filter(l => l.status?.toLowerCase() === 'quality check').length,
            infoPending: allLeads.filter(l => l.status?.toLowerCase() === 'info pending').length,
            followUp: allLeads.filter(l => l.status?.toLowerCase().includes('follow')).length,
            notInterested: allLeads.filter(l => l.status?.toLowerCase().includes('not interested')).length,
          };

          const generateTrend = () => Array.from({ length: 7 }, () => Math.random() * 100 + 50);

          const statsData: StatCardData[] = [
            // First Row - Main Metrics
            {
              title: 'Total Leads',
              value: totalLeads,
              change: 12.5,
              changeLabel: 'vs last period',
              icon: <Users className="h-4 w-4" />,
              color: '#3b82f6',
              bgColor: '#3b82f6',
              trend: generateTrend()
            },
            {
              title: 'New Leads',
              value: newLeads,
              change: 8.2,
              changeLabel: `Last ${NEW_LEADS_DAYS_WINDOW} days`,
              icon: <UserPlus className="h-4 w-4" />,
              color: '#22c55e',
              bgColor: '#22c55e',
              trend: generateTrend()
            },
            {
              title: 'Closed Deals',
              value: closedDeals,
              change: -3.1,
              changeLabel: 'vs last period',
              icon: <Ticket className="h-4 w-4" />,
              color: '#f59e0b',
              bgColor: '#f59e0b',
              trend: generateTrend()
            },
            {
              title: 'Total Revenue',
              value: Math.floor(totalRevenue),
              change: 15.8,
              changeLabel: 'vs last period',
              icon: <DollarSign className="h-4 w-4" />,
              color: '#8b5cf6',
              bgColor: '#8b5cf6',
              trend: generateTrend()
            },
            // Second Row - Status Metrics
            {
              title: 'Pipeline',
              value: statusCounts.pipeline,
              change: 5.3,
              changeLabel: 'In pipeline',
              icon: <GitPullRequest className="h-4 w-4" />,
              color: STATUS_CONFIGS.pipeline.color,
              bgColor: STATUS_CONFIGS.pipeline.color,
              trend: generateTrend()
            },
            {
              title: 'Quality Check',
              value: statusCounts.qualityCheck,
              change: 3.7,
              changeLabel: 'Under review',
              icon: <CheckCircle className="h-4 w-4" />,
              color: STATUS_CONFIGS['quality check'].color,
              bgColor: STATUS_CONFIGS['quality check'].color,
              trend: generateTrend()
            },
            {
              title: 'Info Pending',
              value: statusCounts.infoPending,
              change: -2.1,
              changeLabel: 'Awaiting info',
              icon: <Clock className="h-4 w-4" />,
              color: STATUS_CONFIGS['info pending'].color,
              bgColor: STATUS_CONFIGS['info pending'].color,
              trend: generateTrend()
            },
            {
              title: 'Follow-Up',
              value: statusCounts.followUp,
              change: 7.9,
              changeLabel: 'Need follow-up',
              icon: <MessageCircle className="h-4 w-4" />,
              color: STATUS_CONFIGS['follow-up'].color,
              bgColor: STATUS_CONFIGS['follow-up'].color,
              trend: generateTrend()
            },
            {
              title: 'Not Interested',
              value: statusCounts.notInterested,
              change: -1.5,
              changeLabel: 'Declined',
              icon: <XCircle className="h-4 w-4" />,
              color: STATUS_CONFIGS['not interested'].color,
              bgColor: STATUS_CONFIGS['not interested'].color,
              trend: generateTrend()
            },
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
  }, [fetchWithAuth, toast, timeframeMode, selectedDate, selectedWeek, month, monthYear, dateRange]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <motion.div 
        className="space-y-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Key Metrics</h2>
            <p className="text-muted-foreground text-sm">
              {formatDisplayLabel()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup 
              type="single" 
              value={timeframeMode} 
              onValueChange={(v) => v && setTimeframeMode(v as TimeframeMode)}
              className="border rounded-lg bg-white dark:bg-gray-900"
            >
              <ToggleGroupItem 
                value="day" 
                aria-label="Day"
                className="data-[state=on]:bg-blue-500 data-[state=on]:text-white text-sm"
              >
                Day
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="week" 
                aria-label="Week"
                className="data-[state=on]:bg-blue-500 data-[state=on]:text-white text-sm"
              >
                Week
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="month" 
                aria-label="Month"
                className="data-[state=on]:bg-blue-500 data-[state=on]:text-white text-sm"
              >
                Month
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="custom" 
                aria-label="Custom"
                className="data-[state=on]:bg-blue-500 data-[state=on]:text-white text-sm"
              >
                Custom
              </ToggleGroupItem>
            </ToggleGroup>
            {(selectedDate || selectedWeek !== undefined || dateRange?.from) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Date Selection Row */}
        {timeframeMode === 'week' && (
          <motion.div 
            className="flex flex-wrap items-center gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedWeek !== undefined ? String(selectedWeek) : ''} onValueChange={(v) => setSelectedWeek(Number(v))}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select Week" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((week, idx) => (
                  <SelectItem key={idx} value={String(idx)}>{week.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
        )}

        {timeframeMode === 'month' && (
          <motion.div 
            className="flex items-center gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Select value={String(monthYear)} onValueChange={(v) => setMonthYear(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
        )}

        {(timeframeMode === 'day' || timeframeMode === 'custom') && (
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline"
                className="w-[240px] justify-start text-left font-normal"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {timeframeMode === 'day' && selectedDate ? format(selectedDate, 'PPP') : 
                 timeframeMode === 'custom' && dateRange?.from ? formatDisplayLabel() :
                 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              {timeframeMode === 'day' ? (
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  numberOfMonths={1}
                />
              ) : (
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={timeframeMode === 'custom' ? 2 : 1}
                />
              )}
            </PopoverContent>
          </Popover>
        )}
      </motion.div>

      {/* Stats Cards - 2 Rows */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(9)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat, index) => (
            <StatCard key={index} data={stat} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
