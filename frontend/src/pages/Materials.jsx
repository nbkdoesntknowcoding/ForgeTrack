import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { FileText, Video, Link as LinkIcon, Plus, X, Search } from 'lucide-react';
import { format } from 'date-fns';

export default function Materials() {
  const [materials, setMaterials] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('document');
  const [newUrl, setNewUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMaterials();
    fetchSessions();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('materials')
        .select('*, sessions(date, topic)')
        .order('created_at', { ascending: false });
      setMaterials(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await supabase
        .from('sessions')
        .select('id, date, topic')
        .order('date', { ascending: false });
      setSessions(data || []);
      if (data && data.length > 0) {
        setSelectedSessionId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data, error } = await supabase.from('materials').insert({
        session_id: selectedSessionId,
        title: newTitle,
        type: newType,
        url: newUrl,
        description: newDesc
      }).select('*, sessions(date, topic)').single();

      if (error) throw error;
      
      setMaterials([data, ...materials]);
      setShowModal(false);
      
      // Reset form
      setNewTitle('');
      setNewUrl('');
      setNewDesc('');
      setNewType('document');
      
    } catch (err) {
      alert("Failed to add material: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'slide':
      case 'slides': return <FileText className="text-info-fg" size={20} />;
      case 'recording':
      case 'video': return <Video className="text-danger-fg" size={20} />;
      default: return <LinkIcon className="text-accent-glow" size={20} />;
    }
  };

  const filteredMaterials = materials.filter(m => {
    const s = search.toLowerCase();
    return m.title.toLowerCase().includes(s) || m.sessions?.topic.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-display-lg text-primary tracking-tight">Materials</h1>
        </div>
        <button 
          className="btn-primary inline-flex gap-2 items-center" 
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} /> Add Material
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" />
        <input
          type="text"
          className="input w-full pl-12 h-12 text-body"
          placeholder="Search materials or sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[1,2,3].map(i => <div key={i} className="h-40 animate-pulse bg-surface-inset rounded-2xl w-full"></div>)}
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map(m => (
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
                  <p className="text-body-sm text-tertiary mb-auto line-clamp-2">{m.description || "No description provided."}</p>
                  
                  <div className="mt-6 pt-4 border-t border-border-subtle flex justify-between items-center text-caption text-secondary">
                    <span className="pill uppercase tracking-wider">{m.type}</span>
                    <span>{format(new Date(m.created_at), 'MMM d, yyyy')}</span>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
          
          {filteredMaterials.length === 0 && (
            <div className="col-span-full py-12 text-center text-secondary border border-dashed border-border-default rounded-2xl">
              No materials found.
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form className="card bg-surface-raised border border-border-default rounded-[24px] shadow-raised p-8 max-w-md w-full" onSubmit={handleCreate}>
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-h2 text-primary">Add Material</h2>
               <button type="button" onClick={() => setShowModal(false)} className="text-secondary hover:text-primary transition-colors">
                 <X size={24} />
               </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-label text-tertiary block mb-1">SESSION</label>
                <select 
                  required 
                  className="input w-full" 
                  value={selectedSessionId} 
                  onChange={e => setSelectedSessionId(e.target.value)}
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{format(new Date(s.date), 'MMM d')} - {s.topic}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-label text-tertiary block mb-1">TITLE</label>
                <input required type="text" className="input w-full" placeholder="e.g. Intro Slides" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              </div>

              <div>
                <label className="text-label text-tertiary block mb-1">TYPE</label>
                <select className="input w-full" value={newType} onChange={e => setNewType(e.target.value)}>
                  <option value="document">Document / Link</option>
                  <option value="slides">Slides</option>
                  <option value="recording">Recording</option>
                </select>
              </div>

              <div>
                <label className="text-label text-tertiary block mb-1">URL / LINK</label>
                <input required type="url" className="input w-full" placeholder="https://..." value={newUrl} onChange={e => setNewUrl(e.target.value)} />
              </div>

              <div>
                <label className="text-label text-tertiary block mb-1">DESCRIPTION (OPTIONAL)</label>
                <textarea className="input w-full min-h-[80px]" placeholder="Brief notes about this material..." value={newDesc} onChange={e => setNewDesc(e.target.value)}></textarea>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full mt-8" disabled={isSaving}>
              {isSaving ? 'Uploading...' : 'Save Material'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
