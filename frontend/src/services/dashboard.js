import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

export async function getTickerStats() {
  const [studentsRes, sessionsRes, attRes] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('sessions').select('id, date').order('date', { ascending: false }),
    supabase.from('attendance').select('present'),
  ]);

  const totalAtt = attRes.data || [];
  const presentCount = totalAtt.filter((a) => a.present).length;
  const overall = totalAtt.length > 0 ? (presentCount / totalAtt.length) * 100 : 0;

  return {
    totalSessions: sessionsRes.data?.length || 0,
    overallAttendance: overall,
    activeStudents: studentsRes.count || 0,
    lastSessionDate: sessionsRes.data?.[0]?.date || null,
  };
}

export async function getTodaySession() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('date', todayStr)
    .maybeSingle();

  if (!session) return { session: null, attendance: [], presentCount: 0 };

  const { data: attendance } = await supabase
    .from('attendance')
    .select('id, present, students(name)')
    .eq('session_id', session.id);

  const records = attendance || [];
  const presentCount = records.filter((a) => a.present).length;
  return { session, attendance: records, presentCount };
}

export async function getProgramOverview() {
  const [{ data: sessions }, { data: attendance }] = await Promise.all([
    supabase.from('sessions').select('id'),
    supabase.from('attendance').select('student_id, present, students(name, is_active)'),
  ]);

  const totalSessions = sessions?.length || 0;
  const records = (attendance || []).filter((r) => r.students?.is_active);

  const totalRecords = records.length;
  const totalPresent = records.filter((r) => r.present).length;
  const avgAttendancePct = totalRecords > 0 ? (totalPresent / totalRecords) * 100 : 0;

  const byStudent = {};
  records.forEach((r) => {
    if (!byStudent[r.student_id]) byStudent[r.student_id] = { name: r.students.name, present: 0, total: 0 };
    byStudent[r.student_id].total += 1;
    if (r.present) byStudent[r.student_id].present += 1;
  });

  const sorted = Object.values(byStudent)
    .map((s) => ({ name: s.name, pct: (s.present / s.total) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  return {
    totalSessions,
    avgAttendancePct,
    highest: sorted[0] || null,
    lowest: sorted[sorted.length - 1] || null,
  };
}

export async function getRecentActivity(limit = 5) {
  const [{ data: attendance }, { data: imports }] = await Promise.all([
    supabase
      .from('attendance')
      .select('marked_at, sessions(topic)')
      .order('marked_at', { ascending: false })
      .limit(limit * 4),
    supabase
      .from('import_log')
      .select('filename, uploaded_at, imported_rows')
      .order('uploaded_at', { ascending: false })
      .limit(limit),
  ]);

  const events = [];
  const seenTopics = new Set();
  (attendance || []).forEach((row) => {
    const topic = row.sessions?.topic;
    if (!topic || seenTopics.has(topic)) return;
    seenTopics.add(topic);
    events.push({
      kind: 'attendance',
      desc: `Marked attendance for ${topic}`,
      time: row.marked_at,
    });
  });

  (imports || []).forEach((row) => {
    events.push({
      kind: 'import',
      desc: `Imported ${row.filename} — ${row.imported_rows} records`,
      time: row.uploaded_at,
    });
  });

  return events
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, limit);
}
