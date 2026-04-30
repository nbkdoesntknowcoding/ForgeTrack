import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams, useOutletContext } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import Dialog from './Dialog';

export default function CreateSessionDialog() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const ctx = useOutletContext() || {};

  const initialDate = params.get('date') || format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(initialDate);
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('2.0');
  const [type, setType] = useState('offline');
  const [saving, setSaving] = useState(false);

  const close = () => navigate('/attendance' + (location.state?.from?.split('?')[1] ? '?' + location.state.from.split('?')[1] : ''));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const monthNum = new Date(date).getMonth() + 1;
      const { error } = await supabase.from('sessions').insert({
        date,
        topic,
        duration_hours: parseFloat(duration),
        session_type: type,
        month_number: monthNum,
      });
      if (error) throw error;
      ctx.refreshSessions?.();
      navigate(`/attendance/${date}`, {
        replace: true,
        state: { from: '/attendance' + (location.state?.from?.split('?')[1] ? '?' + location.state.from.split('?')[1] : '') },
      });
    } catch (err) {
      alert('Failed to create session: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={close}
      title="New Session"
      subtitle="Add a session to the calendar."
      maxWidth="max-w-lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" form="new-session-form" className="btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create & mark'}
          </button>
        </>
      }
    >
      <form id="new-session-form" className="space-y-4" onSubmit={submit}>
        <div>
          <label className="text-label text-tertiary block mb-1">DATE</label>
          <input
            required type="date" className="input w-full"
            min="2025-08-04" value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-label text-tertiary block mb-1">TOPIC</label>
          <input
            required type="text" className="input w-full"
            placeholder="e.g. ReAct Pattern Implementation"
            value={topic} onChange={(e) => setTopic(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-label text-tertiary block mb-1">DURATION (HRS)</label>
            <input
              required type="number" step="0.5" min="0.5" className="input w-full"
              value={duration} onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div>
            <label className="text-label text-tertiary block mb-1">TYPE</label>
            <select className="input w-full" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
            </select>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
