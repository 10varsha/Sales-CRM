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
  amountpaid: number;
  target: number;
  rank?: number;
  salesHead?: string;
}
interface User {
  userid: number | string;
  name: string;
  roleid?: number;
  managerid?: number | string;
  [key: string]: any;
}
interface Lead {
  id: number;
  assignedto?: string | number;
  createdby?: string | number;
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

    const fetchAllLeads = async () => {
      const allLeads: Lead[] = [];
      let cursor: string | null = null;
      do {
        const url = cursor
          ? `${API_BASE_URL}/crm-leads?take=100&cursor=${cursor}`
          : `${API_BASE_URL}/crm-leads?take=100`;
        const res = await fetchWithAuth(url);
        if (!res.ok) throw new Error('Failed to load leads');
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items || [];
        allLeads.push(...items);
        cursor = data.nextCursor || null;
      } while (cursor && allLeads.length < 1000);
      return allLeads;
    };

    const load = async () => {
      setLoading(true);
      try {
        const usersRes = await fetchWithAuth('https://saleshub.silverspace.tech/users');
        let allUsers: User[] = [];
        if (usersRes.ok) {
          const apiUsers = await usersRes.json();
          allUsers = Array.isArray(apiUsers.items) ? apiUsers.items : (Array.isArray(apiUsers) ? apiUsers : []);
        }
        const userIdMap = new Map<string, User>();
        allUsers.forEach(user => userIdMap.set(String(user.userid), user));

        const allLeads = await fetchAllLeads();

        if (!cancelled) {
          const filteredLeads = filterLeadsByDate(allLeads);
          const teamLeads = allUsers.filter(user => Number(user.roleid) === 4 || Number(user.roleid) === 5);

          const agentMap = new Map<string, {
            deals: number;
            amountpaid: number;
            name: string;
            initials: string;
            salesHead?: string;
          }>();

          teamLeads.forEach(user => {
            const userId = String(user.userid);
            const userName = user.name || `User ${userId}`;
            const nameParts = userName.split(' ');
            const initials = nameParts.length > 1
              ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
              : userName.slice(0, 2).toUpperCase();
            let salesHead = '';
            if (Number(user.roleid) === 5 && user.managerid) {
              const mgr = userIdMap.get(String(user.managerid));
              if (mgr && Number(mgr.roleid) === 4) salesHead = mgr.name;
            } else if (Number(user.roleid) === 4) {
              salesHead = user.name;
            }
            const userLeads = filteredLeads.filter(lead =>
              String(lead.assignedto) === userId || String(lead.createdby) === userId
            );
            const deals = userLeads.length;
            const amountpaid = userLeads.reduce((sum, lead) => {
              const val = lead.amountpaid != null && !isNaN(Number(lead.amountpaid)) ? Number(lead.amountpaid) : 0;
              return sum + val;
            }, 0);

            agentMap.set(userId, {
              deals,
              amountpaid,
              name: userName,
              initials,
              salesHead
            });
          });

          let agentsArray: Agent[] = Array.from(agentMap.entries()).map(
            ([userId, data]) => ({
              id: userId,
              name: data.name,
              initials: data.initials,
              deals: data.deals,
              amountpaid: data.amountpaid,
              target: 10,
              salesHead: data.salesHead,
              rank: 0,
            })
          );

          agentsArray = agentsArray
            .sort((a, b) => b.amountpaid - a.amountpaid || b.deals - a.deals)
            .map((agent, idx) => ({ ...agent, rank: idx + 1 }));

          setAgents(agentsArray);
        }
      } catch {
        setAgents([]);
      } finally {
        if (!cancelled) setTimeout(() => setLoading(false), 300);
      }
    };

    load();
    return () => { cancelled = true; };
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
                  Top Performing Team Leads
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ranked by Amount Paid • {agents.length} team leads
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
              <p className="text-muted-foreground text-sm font-medium">No team lead data available</p>
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
                    <div className="flex-shrink-0 w-8 text-center">{getRankLogo(agent.rank ?? index + 1)}</div>
                    <motion.div whileHover={{ scale: 1.1, rotate: 5 }} transition={{ duration: 0.2 }}>
                      <Avatar className="h-11 w-11 border-2 border-emerald-200 dark:border-emerald-800 shadow">
                        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-bold">
                          {agent.initials}
                        </AvatarFallback>
                      </Avatar>
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col items-start mb-1.5 w-full">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-all">{agent.name}</p>
                        <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400 whitespace-nowrap block">
                          {formatCurrency(agent.amountpaid)}
                        </span>
                        {agent.salesHead && (
                          <p className="text-xs text-emerald-800 dark:text-emerald-300 break-all">
                            Sales Head: {agent.salesHead}
                          </p>
                        )}
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