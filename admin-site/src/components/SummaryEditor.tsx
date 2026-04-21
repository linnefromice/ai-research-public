import { useState } from 'react';
import { updateReport } from '../api/client';

export function SummaryEditor({ reportId, initialSummary }: { reportId: string; initialSummary: string | null }) {
  const [summary, setSummary] = useState(initialSummary ?? '');
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await updateReport(reportId, { summary }); setSaved(true); }
    catch (e) { alert(`Error: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <textarea
        value={summary}
        onChange={e => { setSummary(e.target.value); setSaved(false); }}
        rows={6}
        className="form-input"
        style={{ lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div className="flex justify-end gap-sm" style={{ marginTop: '0.5rem' }}>
        {!saved && <span className="text-xs" style={{ color: 'var(--admin-warning)', alignSelf: 'center' }}>Unsaved changes</span>}
        <button onClick={handleSave} disabled={saving || saved} className={`btn ${saved ? 'btn-ghost' : 'btn-primary'}`}>
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}
