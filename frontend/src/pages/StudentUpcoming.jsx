import React, { useEffect, useState } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { Calendar, Clock, Wifi, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';

export default function StudentUpcoming() {
  const [sessions, setSessions] = useState([]);
  const [materialCounts, setMaterialCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: sess } = await supabase
        .from('sessions').select('*').gte('date', today).order('date');
      if (cancelled) return;
      setSessions(sess || []);

      // Material counts per session
      const ids = (sess || []).map((s) => s.id);
      if (ids.length > 0) {
        const { data: mats } = await supabase.from('materials').select('session_id').in('session_id', ids);
        const counts = {};
        (mats || []).forEach((m) => { counts[m.session_id] = (counts[m.session_id] || 0) + 1; });
        if (!cancelled) setMaterialCounts(counts);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-lg text-primary tracking-tight">Upcoming Sessions</h1>
        <p className="text-body-sm text-secondary mt-1">Your schedule going forward.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="h-28 animate-pulse bg-surface-inset rounded-2xl" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-16 text-center text-secondary border border-dashed border-border-default rounded-2xl">
          No upcoming sessions scheduled.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((s) => {
            const today = isToday(parseISO(s.date));
            return (
              <Card key={s.id} className={`rounded-[24px] ${today ? 'ring-1 ring-accent-glow' : ''}`}>
                <CardContent className="pt-5 pb-5 flex gap-4">
                  <div className="w-12 h-12 rounded-lg bg-surface-inset border border-border-subtle flex items-center justify-center shrink-0">
                    <Calendar className="text-accent-glow" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <p className="text-body font-semibold text-primary truncate">{s.topic}</p>
                      {today && <span className="pill text-caption text-accent-glow border-accent-glow/40">Today</span>}
                    </div>
                    <p className="text-caption text-tertiary mt-1">
                      {format(parseISO(s.date), 'EEE, MMM d, yyyy')}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-2 text-caption text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} /> {s.duration_hours}h
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {s.session_type === 'online' ? <Wifi size={12} /> : <MapPin size={12} />}
                        {s.session_type}
                      </span>
                      {materialCounts[s.id] > 0 && (
                        <span className="text-accent-glow">
                          · {materialCounts[s.id]} material{materialCounts[s.id] > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
