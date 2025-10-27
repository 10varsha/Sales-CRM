import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, DollarSign, Target, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface Agent {
  id: string;
  name: string;
  initials: string;
  deals: number;
  revenue: number;
  target: number;
  rank?: number;
}

interface Lead {
  id: number;
  firstname?: string;
  lastname?: string;
  assignedto?: string;
  createdby?: string | number;
  status?: string;
  expectedrevenue?: number | null;
  amountpaid?: number;
  company?: string;
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
  const [displayCount, setDisplayCount] = useState(5);
  const [showAll, setShowAll] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const { fetchWithAuth } = useAuth();

  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const leadsRes = await fetchWithAuth(`${API_BASE_URL}/crm-leads?take=1000`);
        if (!leadsRes.ok) throw new Error('Failed to load leads');
        const result = await leadsRes.json();

        const allLeads: Lead[] = Array.isArray(result)
          ? result
          : Array.isArray(result.items)
          ? result.items
          : [];
        if (!cancelled && Array.isArray(allLeads)) {
          const agentMap = new Map<
            string,
            { deals: number; revenue: number; name: string; initials: string }
          >();

          allLeads.forEach((lead) => {
            let agentId = String(lead.assignedto || lead.createdby || '').trim();
            if (!agentId || agentId === 'unassigned') return;

            const first = (lead.firstname || '').trim();
            const last = (lead.lastname || '').trim();
            const agentName =
              [first, last].filter(Boolean).join(' ').replace(/\s+/g, ' ') ||
              `Agent ${agentId}`;
            const initials =
              ((first && first[0] ? first[0] : '') +
                (last && last[0] ? last[0] : '') ||
                agentId.slice(0, 2)
              ).toUpperCase();

            let revenue = 0;
            if (lead.expectedrevenue != null && !isNaN(Number(lead.expectedrevenue)))
              revenue = Number(lead.expectedrevenue);
            else if (lead.amountpaid != null && !isNaN(Number(lead.amountpaid)))
              revenue = Number(lead.amountpaid);

            const prev = agentMap.get(agentId) || {
              deals: 0,
              revenue: 0,
              name: agentName,
              initials: initials,
            };
            agentMap.set(agentId, {
              deals: prev.deals + 1,
              revenue: prev.revenue + revenue,
              name: prev.name,
              initials: prev.initials,
            });
          });

          let agentsArray: Agent[] = Array.from(agentMap.entries()).map(
            ([agentId, data], idx) => ({
              id: agentId,
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
        setAgents([]);
      } finally {
        if (!cancelled) setTimeout(() => setLoading(false), 300);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

  const displayedAgents = showAll ? agents : agents.slice(0, displayCount);
  const hasMore = agents.length > displayCount;

  // Only top 5 have trophy icon, everyone else shows their rank as #number
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
                  Top Performing Agents
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ranked by leads • {agents.length} total agents
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
              <p className="text-muted-foreground text-sm font-medium">No agent data available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Assign leads to agents to see rankings
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-300 dark:scrollbar-thumb-emerald-700">
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
                            {agent.deals}/{agent.target}
                          </Badge>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
