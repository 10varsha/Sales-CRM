import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, Target, Zap } from 'lucide-react';

const STAGE_COLORS: Record<string, string> = {
  'New': '#fb923c',
  'Qualified': '#fbbf24',
  'Proposal': '#f59e0b',
  'Negotiation': '#f97316',
  'Closing': '#ea580c',
  'Closed': '#dc2626',
};

export function SalesPipeline() {
  const { fetchWithAuth } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

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

        if (!cancelled) {
          setLeads(allLeads);
        }
      } catch {
        // Silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [fetchWithAuth]);

  const pipelineData = useMemo(() => {
    const stageMap = new Map<string, number>();

    leads.forEach(lead => {
      const stage = lead.stage || lead.status || 'New';
      stageMap.set(stage, (stageMap.get(stage) || 0) + 1);
    });

    const stages = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Closing', 'Closed'];
    return stages.map(stage => ({
      name: stage,
      value: stageMap.get(stage) || 0,
      fill: STAGE_COLORS[stage] || '#gray-400',
    }));
  }, [leads]);

  const conversionRate = (index: number) => {
    if (index === 0 || pipelineData[index - 1].value === 0) return 100;
    return ((pipelineData[index].value / pipelineData[index - 1].value) * 100).toFixed(1);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
      className="h-full"
    >
      <Card className="h-full flex flex-col relative overflow-hidden border-0 shadow-2xl backdrop-blur-xl bg-gradient-to-br from-orange-50/80 via-amber-50/60 to-yellow-50/80 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-yellow-950/40">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-10 right-10 w-64 h-64 bg-gradient-to-br from-orange-300/30 to-amber-400/30 rounded-full blur-3xl"
            animate={{
              x: [0, 20, 0],
              y: [0, 30, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        <CardHeader className="relative z-10">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={isInView ? { x: 0, opacity: 1 } : { x: -20, opacity: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </motion.div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent">
                  Sales Pipeline
                </CardTitle>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Track deal progression through stages</p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/30 border-0"
              >
                <Zap className="h-4 w-4 mr-2" />
                Optimize
              </Button>
            </motion.div>
          </motion.div>
        </CardHeader>
        <CardContent className="flex-1 relative z-10">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full"
              />
            </div>
          ) : (
            <>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-orange-200/30" />
                    <XAxis 
                      dataKey="name" 
                      className="text-xs"
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: '1px solid #f97316',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)'
                      }}
                    />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {pipelineData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Conversion Rates */}
              <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {pipelineData.map((stage, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, x: 5 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-orange-100/60 to-amber-100/60 dark:from-orange-900/30 dark:to-amber-900/30 backdrop-blur-sm border border-orange-200/50 dark:border-orange-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <motion.div 
                        className="w-3 h-3 rounded-full shadow-lg" 
                        style={{ backgroundColor: stage.fill }}
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                      />
                      <span className="font-semibold">{stage.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold">{stage.value}</span>
                      {index > 0 && stage.value > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/60 dark:bg-gray-900/60 text-xs font-medium">
                          <ArrowRight className="h-3 w-3" />
                          <span>{conversionRate(index)}%</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
