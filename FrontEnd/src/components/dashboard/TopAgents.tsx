import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useDateFilter } from '@/context/DateFilterContext';

interface Agent {
  id: string;
  name: string;
  initials: string;
  deals: number;
  revenue: number;
  target: number;
  rank?: number;
}

interface User {
  userid: number | string;
  name: string;
  email?: string;
  roleid?: number;
  [key: string]: any;
}

interface Lead {
  id: number;
  firstname?: string;
  lastname?: string;
  assignedto?: string | number;
  createdby?: string | number;
  status?: string;
  expectedrevenue?: number | null;
  amountpaid?: number;
  createdat?: string;
  created_at?: string;
}

function SkeletonLoader() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-2 bg-muted rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const { fetchWithAuth } = useAuth();
  const { getDateRangeFilter } = useDateFilter();

  // Filter leads by date from context
  const filterLeadsByDate = (leads: Lead[]) => {
    const range = getDateRangeFilter();
    if (!range) return leads;

    return leads.filter(lead => {
      const leadDate = new Date(lead.createdat || lead.created_at || '');
      return leadDate >= range.start && leadDate <= range.end;
    });
  };

  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        // Fetch users with roleid = 4 (sales leads)
        const usersRes = await fetchWithAuth('https://saleshub.silverspace.tech/users');
        let salesLeads: User[] = [];
        if (usersRes.ok) {
          const apiUsers = await usersRes.json();
          const allUsers = Array.isArray(apiUsers.items) ? apiUsers.items : (Array.isArray(apiUsers) ? apiUsers : []);
          salesLeads = allUsers.filter((user: User) =>
            Number(user.roleid) === 4 || Number(user.roleid) === 5
          );
        }

        // Fetch all leads
        const leadsRes = await fetchWithAuth(`${API_BASE_URL}/crm-leads?take=1000`);
        if (!leadsRes.ok) throw new Error('Failed to load leads');
        const result = await leadsRes.json();

        const allLeads: Lead[] = Array.isArray(result)
          ? result
          : Array.isArray(result.items)
          ? result.items
          : [];

        if (!cancelled && Array.isArray(allLeads)) {
          // Apply date filter
          const filteredLeads = filterLeadsByDate(allLeads);

          // Map sales leads to their performance
          const agentMap = new Map<string, { deals: number; revenue: number; name: string; initials: string }>();

          salesLeads.forEach((user) => {
            const userId = String(user.userid);
            const userName = user.name || `User ${userId}`;
            const nameParts = userName.split(' ');
            const initials = nameParts.length > 1 
              ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
              : userName.slice(0, 2).toUpperCase();

            // Count leads assigned to this user
            const userLeads = filteredLeads.filter(lead => 
              String(lead.assignedto) === userId || String(lead.createdby) === userId
            );

            const deals = userLeads.length;
            const revenue = userLeads.reduce((sum, lead) => {
              const amount = lead.expectedrevenue != null && !isNaN(Number(lead.expectedrevenue))
                ? Number(lead.expectedrevenue)
                : lead.amountpaid != null && !isNaN(Number(lead.amountpaid))
                ? Number(lead.amountpaid)
                : 0;
              return sum + amount;
            }, 0);

            agentMap.set(userId, {
              deals,
              revenue,
              name: userName,
              initials
            });
          });

          // Convert to array and sort by deals, then revenue
          let agentsArray: Agent[] = Array.from(agentMap.entries()).map(
            ([userId, data]) => ({
              id: userId,
              name: data.name,
              initials: data.initials,
              deals: data.deals,
              revenue: data.revenue,
              target: 10,
              rank: 0,
            })
          );

          agentsArray = agentsArray
            .sort((a, b) => b.deals - a.deals || b.revenue - a.revenue)
            .map((agent, idx) => ({ ...agent, rank: idx + 1 }));

          setAgents(agentsArray);
        }
      } catch (err) {
        console.error('Error loading agents:', err);
        setAgents([]);
      } finally {
        if (!cancelled) setTimeout(() => setLoading(false), 300);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth, getDateRangeFilter]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

  const getRankLogo = (rank: number) => {
    if (rank >= 1 && rank <= 5) {
      return (
        <div className="p-1.5 rounded-full bg-yellow-100 dark:bg-yellow-950/30 flex items-center justify-center">
          <Trophy className="h-5 w-5 text-yellow-500" />
        </div>
      );
    }
    return (
      <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
    );
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full flex flex-col relative overflow-hidden border shadow-lg bg-gradient-to-br from-emerald-50/30 via-white to-teal-50/30 dark:from-emerald-950/10 dark:via-gray-950 dark:to-teal-950/10">
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                  Top Performing Sales Leads
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ranked by performance • {agents.length} sales leads
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 relative z-10 px-6">
          {loading ? (
            <SkeletonLoader />
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                <Trophy className="h-8 w-8 text-emerald-400 dark:text-emerald-600" />
              </div>
              <p className="text-muted-foreground text-sm font-medium">No sales lead data available</p>
              <p className="text-xs text-muted-foreground mt-1">
                No users with roleid = 4 found
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[650px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-300 dark:scrollbar-thumb-emerald-700">
              {agents.map((agent, index) => {
                const progressPercentage = Math.min(
                  (agent.deals / agent.target) * 100,
                  100
                );
                return (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className={cn(
                      'flex items-center gap-4 p-3 rounded-xl transition-all duration-300',
                      'hover:shadow-md',
                      agent.rank && agent.rank <= 5
                        ? 'bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/50 dark:border-emerald-800/50'
                        : 'bg-white/50 dark:bg-gray-900/50 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800'
                    )}
                  >
                    <div className="flex-shrink-0 w-8 text-center">
                      {getRankLogo(agent.rank ?? index + 1)}
                    </div>
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Avatar className="h-11 w-11 border-2 border-emerald-200 dark:border-emerald-800">
                        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-bold">
                          {agent.initials}
                        </AvatarFallback>
                      </Avatar>
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">
                            {agent.name}
                          </p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(agent.revenue)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <div className="h-2 w-full bg-emerald-100 dark:bg-emerald-950/30 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercentage}%` }}
                              transition={{
                                duration: 0.8,
                                delay: index * 0.05,
                                ease: 'easeOut',
                              }}
                            />
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
                        >
                          {agent.deals}
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
