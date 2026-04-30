import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Search, History as HistoryIcon, GraduationCap } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function History() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  
  const [studentRecord, setStudentRecord] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedStudentId) fetchHistory(selectedStudentId);
  }, [selectedStudentId]);

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('id, name, usn').order('name');
    setStudents(data || []);
  };

  const fetchHistory = async (id) => {
    setLoading(true);
    try {
      const { data: std } = await supabase.from('students').select('*').eq('id', id).single();
      setStudentRecord(std);

      const { data: att } = await supabase
        .from('attendance')
        .select('*, sessions(date, topic, duration_hours)')
        .eq('student_id', id)
        .order('sessions(date)', { ascending: true });
        
      setAttendanceData(att || []);
    } catch (e) {
      console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!search) return [];
    const lower = search.toLowerCase();
    return students.filter(s => s.name.toLowerCase().includes(lower) || s.usn.toLowerCase().includes(lower)).slice(0, 5);
  }, [search, students]);

  const selectStudent = (id) => {
    setSelectedStudentId(id);
    setSearch('');
  };

  // Derive stats
  const totalClasses = attendanceData.length;
  const presentClasses = attendanceData.filter(a => a.present).length;
  const attPct = totalClasses === 0 ? 0 : (presentClasses / totalClasses) * 100;

  // Derive charts data - cumulative attendance over time
  const chartData = useMemo(() => {
    let cumulative = 0;
    return attendanceData.map((record, index) => {
      if (record.present) cumulative += 1;
      return {
        date: format(new Date(record.sessions.date), 'MMM d'),
        cumulativePct: ((cumulative / (index + 1)) * 100).toFixed(1)
      }
    });
  }, [attendanceData]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-lg text-primary tracking-tight">Student History</h1>
      </div>

      {/* Search Combobox Component simulation */}
      <div className="relative z-20 max-w-lg">
        <label className="text-label text-tertiary block mb-2">SEARCH STUDENT</label>
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary" />
          <input
            type="text"
            className="input w-full pl-12 h-12 text-body"
            placeholder="Type name or USN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && filteredStudents.length > 0 && (
          <div className="card absolute mt-2 w-full max-h-64 overflow-y-auto rounded-xl p-2 shadow-raised border border-border-default bg-surface-raised">
            {filteredStudents.map(s => (
              <button
                key={s.id}
                className="w-full text-left p-3 rounded-lg hover:bg-surface flex justify-between items-center group"
                onClick={() => selectStudent(s.id)}
              >
                <span className="text-body text-primary">{s.name}</span>
                <span className="text-caption text-secondary font-mono">{s.usn}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedStudentId && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
           <div className="w-16 h-16 rounded-full bg-surface-inset flex items-center justify-center mb-4">
              <HistoryIcon size={32} className="text-tertiary" />
           </div>
           <p className="text-display-sm text-secondary">Search for a student</p>
           <p className="text-body text-tertiary mt-2">Find a student to view their attendance history and heatmap.</p>
        </div>
      )}

      {selectedStudentId && loading && (
         <div className="h-64 animate-pulse bg-surface-inset rounded-2xl w-full"></div>
      )}

      {selectedStudentId && !loading && studentRecord && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 rounded-[24px]">
              <CardContent className="pt-6 flex flex-col items-center text-center">
                 <div className="w-20 h-20 rounded-full bg-surface-raised border border-border-default flex items-center justify-center mb-4 text-h2 text-primary">
                    {studentRecord.name.charAt(0)}
                 </div>
                 <h3 className="text-h3 text-primary">{studentRecord.name}</h3>
                 <p className="text-body text-secondary font-mono mt-1 mb-6">{studentRecord.usn}</p>

                 <div className="w-full bg-surface-inset p-4 rounded-xl border border-border-subtle">
                   <p className="text-caption text-tertiary uppercase mb-1">Overall Attendance</p>
                   <p className={`text-display-lg tabular-nums ${attPct >= 85 ? 'text-success-fg' : attPct >= 75 ? 'text-warning-fg' : 'text-danger-fg'}`}>
                     {attPct.toFixed(1)}%
                   </p>
                 </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 rounded-[24px]">
              <CardHeader>
                <CardTitle>Attendance Trajectory</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] w-full">
                 {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-glow)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--accent-glow)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--bg-surface-raised)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', borderRadius: '8px' }}
                          itemStyle={{ color: 'var(--accent-glow)' }}
                        />
                        <Area type="monotone" dataKey="cumulativePct" stroke="var(--accent-glow)" fillOpacity={1} fill="url(#colorPct)" />
                      </AreaChart>
                    </ResponsiveContainer>
                 ) : (
                    <div className="h-full flex items-center justify-center text-secondary">No data available</div>
                 )}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[24px]">
            <CardHeader>
              <CardTitle>Session Record</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-default text-label text-tertiary uppercase">
                      <th className="py-3 font-normal font-sans">Date</th>
                      <th className="py-3 font-normal font-sans">Topic</th>
                      <th className="py-3 font-normal font-sans">Duration</th>
                      <th className="py-3 font-normal font-sans text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map(a => (
                      <tr key={a.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-inset transition-colors">
                        <td className="py-4 text-body text-secondary whitespace-nowrap">
                          {format(new Date(a.sessions.date), 'MMM d, yyyy')}
                        </td>
                        <td className="py-4 text-body font-medium text-primary">
                          {a.sessions.topic}
                        </td>
                        <td className="py-4 text-body text-secondary">
                          {a.sessions.duration_hours}h
                        </td>
                        <td className="py-4 text-right">
                          <span className={`pill ${a.present ? 'pill-success' : 'pill-danger'}`}>
                            {a.present ? 'Present' : 'Absent'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {attendanceData.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-secondary text-body">No attendance records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
