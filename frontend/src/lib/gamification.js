// Pure functions for streak / XP / level / achievements.
// All operate over already-fetched data — no DB calls.
import { parseISO, differenceInCalendarDays, isAfter } from 'date-fns';

// ─── Streak ─────────────────────────────────────────────────────────────────
// "Streak" = consecutive class sessions (most recent first) that the student
// was present for. Resets at the first absence walking backwards from today.
// Returns { days, lastBroken: ISO|null }.
export function computeStreak(attendanceRows) {
  const sorted = [...(attendanceRows || [])]
    .filter((a) => a.sessions?.date && (a.present === true || a.present === false))
    .sort((a, b) => b.sessions.date.localeCompare(a.sessions.date));
  let days = 0;
  let lastBroken = null;
  for (const r of sorted) {
    if (r.present) {
      days += 1;
    } else {
      lastBroken = r.sessions.date;
      break;
    }
  }
  return { days, lastBroken };
}

// ─── XP & Level ─────────────────────────────────────────────────────────────
// XP weights:
//   - Present session:        +10
//   - Submitted assignment:   +50
//   - AI score (per submission with status=done): +1 per point above 50
//
// Level uses sqrt scaling: level = floor(sqrt(xp / 50)) → starts slow, scales.
// For a target XP for level L: 50 * L^2.
export function computeXP({ presentCount = 0, submittedCount = 0, aiScores = [] } = {}) {
  const xpPresent = presentCount * 10;
  const xpSubs = submittedCount * 50;
  const xpScores = aiScores
    .filter((s) => typeof s === 'number')
    .reduce((acc, s) => acc + Math.max(0, s - 50), 0);
  return xpPresent + xpSubs + xpScores;
}

export function computeLevel(xp) {
  const safe = Math.max(0, Math.floor(xp || 0));
  const level = Math.floor(Math.sqrt(safe / 50));
  const currentLevelXP = 50 * level * level;
  const nextLevelXP = 50 * (level + 1) * (level + 1);
  const progressPct = nextLevelXP === currentLevelXP
    ? 0
    : Math.min(100, ((safe - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100);
  return {
    level,
    currentXP: safe,
    currentLevelXP,
    nextLevelXP,
    xpInLevel: safe - currentLevelXP,
    xpNeeded: nextLevelXP - currentLevelXP,
    progressPct,
  };
}

// ─── Achievements ────────────────────────────────────────────────────────────
// Each achievement has an `id`, display fields, and a `test(ctx)` predicate.
// The context provided to test() is precomputed once per evaluation.

export const ACHIEVEMENTS = [
  {
    id: 'first_blood',
    name: 'First Blood',
    icon: '🎯',
    desc: 'Submit your first assignment',
    hint: 'Submit any assignment',
    test: (c) => c.submittedCount >= 1,
  },
  {
    id: 'perfect_week',
    name: 'Perfect Week',
    icon: '⚡',
    desc: '5 consecutive present sessions',
    hint: 'Be present for 5 sessions in a row',
    test: (c) => c.streakDays >= 5,
  },
  {
    id: 'iron_streak',
    name: 'Iron Streak',
    icon: '🔥',
    desc: '10 consecutive present sessions',
    hint: 'Be present 10 sessions running',
    test: (c) => c.streakDays >= 10,
  },
  {
    id: 'high_score',
    name: 'High Score',
    icon: '👑',
    desc: 'Score 95+ on any AI analysis',
    hint: 'Submit a near-perfect codebase',
    test: (c) => (c.aiScores || []).some((s) => s >= 95),
  },
  {
    id: 'code_monk',
    name: 'Code Monk',
    icon: '🥋',
    desc: '3 AI scores at 90+',
    hint: 'Maintain 90+ across multiple submissions',
    test: (c) => (c.aiScores || []).filter((s) => s >= 90).length >= 3,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    icon: '🐦',
    desc: 'Submit at least 24h before due date',
    hint: 'Beat a deadline by a day',
    test: (c) => (c.earlySubmissions || 0) >= 1,
  },
  {
    id: 'centurion',
    name: 'Centurion',
    icon: '💯',
    desc: 'Reach 1,000 XP',
    hint: 'Keep grinding',
    test: (c) => c.xp >= 1000,
  },
  {
    id: 'comeback_kid',
    name: 'Comeback Kid',
    icon: '🚀',
    desc: '3 present after a previous absence',
    hint: 'Bounce back from missed classes',
    test: (c) => c.comebackCount >= 1,
  },
];

// Build the context map once for the achievement tests.
export function evaluateAchievements({
  attendanceRows = [],
  submissions = [],
  analyses = [],
  assignments = [],
} = {}) {
  const presentCount = attendanceRows.filter((a) => a.present).length;
  const submittedCount = submissions.length;
  const aiScores = analyses
    .filter((a) => a.status === 'done' && typeof a.overall_score === 'number')
    .map((a) => a.overall_score);
  const xp = computeXP({ presentCount, submittedCount, aiScores });
  const { days: streakDays } = computeStreak(attendanceRows);

  // Early submissions: any submission whose submitted_at < due_date - 1 day.
  const dueByAssignment = new Map(assignments.map((a) => [a.id, a.due_date]));
  const earlySubmissions = submissions.filter((s) => {
    const due = dueByAssignment.get(s.assignment_id);
    if (!due || !s.submitted_at) return false;
    const submitted = parseISO(s.submitted_at);
    const dueDate = parseISO(due);
    return differenceInCalendarDays(dueDate, submitted) >= 1;
  }).length;

  // Comeback: walking attendance forward, count "absent then 3 consecutive present" sequences.
  const sortedAtt = [...attendanceRows]
    .filter((a) => a.sessions?.date)
    .sort((a, b) => a.sessions.date.localeCompare(b.sessions.date));
  let comebackCount = 0;
  let presentRun = 0;
  let hadPriorAbsence = false;
  for (const r of sortedAtt) {
    if (r.present === false) { hadPriorAbsence = true; presentRun = 0; }
    else if (r.present === true) {
      presentRun += 1;
      if (hadPriorAbsence && presentRun === 3) { comebackCount += 1; hadPriorAbsence = false; presentRun = 0; }
    }
  }

  const ctx = { presentCount, submittedCount, aiScores, xp, streakDays, earlySubmissions, comebackCount };

  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: !!a.test(ctx),
  }));
}
