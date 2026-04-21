import { useState, useEffect } from 'react';
import { getReportTags, addTag, addTagsBatch, removeTag, type ReportTag } from '../api/client';

export function TagEditor({ reportId }: { reportId: string }) {
  const [tags, setTags] = useState<ReportTag[]>([]);
  const [newTags, setNewTags] = useState('');
  const [tagType, setTagType] = useState('keyword');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const res = await getReportTags(reportId); setTags(res.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [reportId]);

  const handleAdd = async () => {
    const tagList = newTags.split(',').map(t => t.trim()).filter(Boolean);
    if (tagList.length === 0) return;
    try {
      if (tagList.length === 1) await addTag(reportId, tagList[0], tagType);
      else await addTagsBatch(reportId, tagList.map(tag => ({ tag, tag_type: tagType })));
      setNewTags('');
      load();
    } catch (e) { alert(`Error: ${(e as Error).message}`); }
  };

  const handleRemove = async (tag: string) => {
    try { await removeTag(reportId, tag); load(); }
    catch (e) { alert(`Error: ${(e as Error).message}`); }
  };

  if (loading) return <p className="text-muted">Loading tags...</p>;

  const themes = tags.filter(t => t.tag_type === 'theme');
  const keywords = tags.filter(t => t.tag_type === 'keyword');

  return (
    <div>
      <div className="mb-md">
        {themes.length > 0 && (
          <div className="mb-sm">
            <span className="text-xxs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Themes ({themes.length})</span>
            <div className="flex flex-wrap gap-xs" style={{ marginTop: '0.25rem' }}>
              {themes.map(t => (
                <span key={t.id} className="tag tag-theme">
                  {t.tag}
                  <button onClick={() => handleRemove(t.tag)} className="tag-remove">×</button>
                </span>
              ))}
            </div>
          </div>
        )}
        {keywords.length > 0 && (
          <div>
            <span className="text-xxs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Keywords ({keywords.length})</span>
            <div className="flex flex-wrap gap-xs" style={{ marginTop: '0.25rem' }}>
              {keywords.map(t => (
                <span key={t.id} className="tag tag-keyword">
                  {t.tag}
                  <button onClick={() => handleRemove(t.tag)} className="tag-remove">×</button>
                </span>
              ))}
            </div>
          </div>
        )}
        {themes.length === 0 && keywords.length === 0 && <p className="text-sm text-dim">No tags</p>}
      </div>

      <div className="flex gap-sm items-center flex-wrap">
        <input value={newTags} onChange={e => setNewTags(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="Add tags (comma separated)..." className="form-input" style={{ flex: '1 1 200px' }} />
        <select value={tagType} onChange={e => setTagType(e.target.value)} className="form-select">
          <option value="keyword">keyword</option>
          <option value="theme">theme</option>
        </select>
        <button onClick={handleAdd} className="btn btn-primary">Add</button>
      </div>
      <p className="text-xxs text-dim" style={{ marginTop: '0.25rem' }}>Tip: Use commas to add multiple tags at once</p>
    </div>
  );
}
