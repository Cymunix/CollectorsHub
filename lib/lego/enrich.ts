export async function enrichLegoSet(setNumber: string) {
  const res = await fetch(`/api/lego/enrich?setNumber=${encodeURIComponent(setNumber)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Enrich failed (${res.status})`);
  }
  return res.json();
}
