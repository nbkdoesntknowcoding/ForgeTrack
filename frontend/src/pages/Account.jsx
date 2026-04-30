import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader } from '../components/ui/card';

export default function Account() {
  const { userData } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md text-primary tracking-tight">Account</h1>
        <p className="text-body-sm text-tertiary mt-2">View your profile details. Editing is coming soon.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <p className="text-label text-tertiary uppercase">Profile</p>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border-subtle">
            <Row label="Display name" value={userData?.display_name || '—'} />
            <Row label="Email" value={userData?.email || '—'} />
            <Row label="Role" value={userData?.role || '—'} capitalize />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, capitalize }) {
  return (
    <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
      <p className="text-body text-secondary">{label}</p>
      <p className={`text-body text-primary font-medium ${capitalize ? 'capitalize' : ''}`}>{value}</p>
    </div>
  );
}
