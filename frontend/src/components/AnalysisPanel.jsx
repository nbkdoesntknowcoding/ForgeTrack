import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';

export default function AnalysisPanel({ analysis }) {
  if (!analysis) {
    return (
      <div className="text-body-sm text-tertiary border border-dashed border-border-subtle rounded-lg p-6 text-center">
        Not analyzed yet.
      </div>
    );
  }

  if (analysis.status === 'running' || analysis.status === 'pending') {
    return (
      <div className="flex items-center gap-3 text-body-sm text-secondary p-6">
        <Loader2 size={18} className="animate-spin" />
        Analyzing repository...
      </div>
    );
  }

  if (analysis.status === 'error') {
    return (
      <div className="flex items-start gap-3 p-4 border border-danger-fg/40 bg-danger-fg/10 rounded-lg">
        <AlertCircle className="text-danger-fg shrink-0 mt-0.5" size={18} />
        <div>
          <p className="text-body-sm font-medium text-primary">Analysis failed</p>
          <p className="text-caption text-secondary mt-1">{analysis.error_message || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const score = analysis.overall_score ?? 0;
  const scoreColor = score >= 80 ? 'text-success-fg' : score >= 50 ? 'text-warning-fg' : 'text-danger-fg';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-surface-inset border border-border-subtle flex items-center justify-center">
          <span className={`text-h2 font-semibold ${scoreColor}`}>{score}</span>
        </div>
        <div>
          <p className="text-label text-tertiary">OVERALL SCORE</p>
          <p className="text-body text-secondary">out of 100</p>
        </div>
      </div>

      {analysis.summary && (
        <div>
          <p className="text-label text-tertiary mb-2 inline-flex items-center gap-2">
            <Sparkles size={12} /> SUMMARY
          </p>
          <p className="text-body text-primary leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {analysis.raw_response?.frontend_verdict && analysis.raw_response.frontend_verdict !== 'n/a' && (
        <div className="card p-3 border-info-fg/40 bg-info-fg/5">
          <p className="text-label text-info-fg mb-1">FRONTEND VERIFICATION</p>
          <p className="text-body-sm text-primary">{analysis.raw_response.frontend_verdict}</p>
        </div>
      )}

      {Array.isArray(analysis.rubric_scores) && analysis.rubric_scores.length > 0 && (
        <div>
          <p className="text-label text-tertiary mb-3">RUBRIC</p>
          <div className="space-y-3">
            {analysis.rubric_scores.map((r, i) => {
              const pct = r.max ? Math.round((r.score / r.max) * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-body-sm text-primary">{r.criterion}</span>
                    <span className="text-caption text-secondary">{r.score}/{r.max}</span>
                  </div>
                  <div className="h-2 bg-surface-inset rounded-full overflow-hidden">
                    <div className="h-full bg-accent-glow transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {r.comment && <p className="text-caption text-tertiary mt-1">{r.comment}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {Array.isArray(analysis.strengths) && analysis.strengths.length > 0 && (
          <div>
            <p className="text-label text-tertiary mb-2 inline-flex items-center gap-2">
              <CheckCircle2 size={12} className="text-success-fg" /> STRENGTHS
            </p>
            <ul className="space-y-1">
              {analysis.strengths.map((s, i) => (
                <li key={i} className="text-body-sm text-secondary">• {s}</li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(analysis.weaknesses) && analysis.weaknesses.length > 0 && (
          <div>
            <p className="text-label text-tertiary mb-2 inline-flex items-center gap-2">
              <AlertCircle size={12} className="text-warning-fg" /> WEAKNESSES
            </p>
            <ul className="space-y-1">
              {analysis.weaknesses.map((s, i) => (
                <li key={i} className="text-body-sm text-secondary">• {s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
