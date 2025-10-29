import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';


interface ActivityItem {
  id: string | number;
  actorName?: string;
  summary: string;
  changedAt: string;
}


export function ActivityFeed() {
  const { fetchWithAuth } = useAuth();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    let cancelled = false;
    let interval: NodeJS.Timeout;


    async function loadFeed() {
      try {
        setLoading(true);
        const res = await fetchWithAuth('https://saleshub.silverspace.tech/activity-feed?scope=team&take=50');
        if (!res.ok) throw new Error('Failed to load activity feed');
        const result = await res.json();
        let list: ActivityItem[] = Array.isArray(result.items) ? result.items : [];
        list = list.filter((n) => n && n.id && n.summary);
        if (!cancelled) setActivity(list);
      } catch {
        if (!cancelled) setActivity([]);
      } finally {
        if (!cancelled) setTimeout(() => setLoading(false), 200);
      }
    }


    loadFeed();
    interval = setInterval(loadFeed, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchWithAuth]);


  return (
    <Card className="h-full flex flex-col relative overflow-hidden border shadow-lg bg-gradient-to-br from-white via-yellow-50/40 to-amber-100/30 dark:from-gray-950 dark:via-yellow-950/20 dark:to-amber-950/20">
      <CardHeader className="relative z-10 pb-2">
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 dark:from-yellow-400 dark:to-amber-400 bg-clip-text text-transparent">
          Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-[300px] px-0 pt-0">
        <div className="space-y-3 pr-2">
          {loading ? (
            <div className="flex items-center justify-center h-36">
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : activity.length ? (
            activity.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 bg-gradient-to-r from-white to-yellow-50/70 dark:from-gray-900/80 dark:to-yellow-950/30 border border-yellow-200/60 dark:border-yellow-800/40 rounded-xl shadow p-3 hover:shadow-lg transition-all duration-200"
              >
                <Avatar className="h-10 w-10 border-2 border-yellow-300 dark:border-yellow-700 shadow">
                  <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-amber-500 text-white font-bold">
                    {n.actorName
                      ? n.actorName
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      : 'NT'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-yellow-100 text-sm truncate">
                    {n.summary}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      {formatDistanceToNow(new Date(n.changedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-28">
              <span className="text-muted-foreground text-sm">No recent activity</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
