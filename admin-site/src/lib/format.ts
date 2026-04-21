export function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}
