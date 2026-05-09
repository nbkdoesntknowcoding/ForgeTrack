import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FileText, Video, Link as LinkIcon, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';

function getIcon(type) {
  switch (type) {
    case 'slide':
    case 'slides': return <FileText className="text-info-fg" size={20} />;
    case 'recording':
    case 'video': return <Video className="text-danger-fg" size={20} />;
    default: return <LinkIcon className="text-accent-glow" size={20} />;
  }
}

export default function StudentMaterials() {
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('materials')
        .select('*, sessions(date, topic)')
        .order('created_at', { ascending: false });
      if (!cancelled) {
        setMaterials(data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return materials;
    return materials.filter((m) =>
      m.title.toLowerCase().includes(s)
      || m.sessions?.topic?.toLowerCase().includes(s)
      || (m.description || '').toLowerCase().includes(s),
    );
  }, [materials, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-lg text-primary tracking-tight">Class Materials</h1>
        <p className="text-body-sm text-secondary mt-1">Slides, recordings, and links shared by your mentor.</p>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" />
        <input
          type="text"
          className="input w-full pl-12 h-12 text-body"
          placeholder="Search materials or sessions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse bg-surface-inset rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((m) => (
            <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block outline-none group focus:ring-2 focus:ring-accent-glow rounded-[24px]">
              <Card className="h-full rounded-[24px] hover:-translate-y-1 transition-transform duration-300">
                <CardContent className="pt-6 pb-6 flex flex-col h-full">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-surface-inset flex items-center justify-center shrink-0 border border-border-subtle group-hover:border-accent-glow transition-colors">
                      {getIcon(m.type)}
                    </div>
                    <div>
                      <h3 className="text-body font-semibold text-primary line-clamp-2">{m.title}</h3>
                      <p className="text-caption text-secondary mt-1">{m.sessions?.topic}</p>
                    </div>
                  </div>
                  <p className="text-body-sm text-tertiary mb-auto line-clamp-2">{m.description || 'No description provided.'}</p>
                  <div className="mt-6 pt-4 border-t border-border-subtle flex justify-between items-center text-caption text-secondary">
                    <span className="pill uppercase tracking-wider">{m.type}</span>
                    {m.sessions?.date && <span>{format(parseISO(m.sessions.date), 'MMM d, yyyy')}</span>}
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-secondary border border-dashed border-border-default rounded-2xl">
              {materials.length === 0 ? 'No materials posted yet.' : 'No materials match the search.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
