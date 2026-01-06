import { NextResponse } from "next/server";

type RebrickableSet = {
  set_num: string; // "75313-1"
  name: string;
  year: number;
  theme_id: number;
  num_parts: number;
  set_img_url: string | null;
  set_url: string | null;
  last_modified_dt: string;
};

type RebrickableTheme = {
  id: number;
  name: string;
  parent_id: number | null;
};

type RebrickableMinifigsResp = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Array<{
    set_num: string;
    quantity: number;
    minifig: {
      set_num: string;
      name: string;
      num_parts: number;
      minifig_img_url: string | null;
    };
  }>;
};

type LegoEnrichResponse = {
  provider: "rebrickable";
  set: {
    setNumber: string;     // "75313-1"
    setId: string;         // "75313"
    name: string;
    year: number | null;
    pieces: number | null;
    theme: { id: number | null; name: string | null };
    imageUrl: string | null;
    sourceUrl: string | null;
  };
  minifigs: Array<{
    setNum: string;        // minifig id
    name: string;
    quantity: number;
    imageUrl: string | null;
  }>;
  raw: {
    set: RebrickableSet;
    theme: RebrickableTheme | null;
    minifigsCount: number;
  };
};

function normaliseSetNumber(input: string) {
  const s = (input || "").trim();
  if (!s) return null;

  // Accept "75313" or "75313-1"
  if (/^\d{4,6}-\d+$/.test(s)) {
    const [setId] = s.split("-");
    return { set_num: s, setId };
  }
  if (/^\d{4,6}$/.test(s)) {
    return { set_num: `${s}-1`, setId: s };
  }
  return null;
}

async function rbFetch<T>(url: string, apiKey: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `key ${apiKey}`,
      Accept: "application/json",
    },
    signal,
    // Cache on the platform where possible; we don't want hammering the API on every keystroke.
    next: { revalidate: 60 * 60 * 24 }, // 24h
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Rebrickable error ${res.status}: ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function GET(req: Request) {
  const apiKey = process.env.REBRICKABLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing REBRICKABLE_API_KEY on server" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const setNumber = searchParams.get("setNumber") || "";

  const normalised = normaliseSetNumber(setNumber);
  if (!normalised) {
    return NextResponse.json(
      { error: "Invalid setNumber. Use like '75313' or '75313-1'." },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const setUrl = `https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(
      normalised.set_num
    )}/`;

    const set = await rbFetch<RebrickableSet>(setUrl, apiKey, controller.signal);

    // Theme lookup (nice-to-have, but you said suggestions need theme info)
    let theme: RebrickableTheme | null = null;
    try {
      const themeUrl = `https://rebrickable.com/api/v3/lego/themes/${set.theme_id}/`;
      theme = await rbFetch<RebrickableTheme>(themeUrl, apiKey, controller.signal);
    } catch {
      // don't fail the whole request if theme lookup fails
      theme = null;
    }

    // Minifigs (first page only; usually enough)
    let minifigsResp: RebrickableMinifigsResp | null = null;
    try {
      const minifigsUrl = `https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(
        normalised.set_num
      )}/minifigs/?page_size=100`;
      minifigsResp = await rbFetch<RebrickableMinifigsResp>(
        minifigsUrl,
        apiKey,
        controller.signal
      );
    } catch {
      minifigsResp = null;
    }

    const payload: LegoEnrichResponse = {
      provider: "rebrickable",
      set: {
        setNumber: set.set_num,
        setId: normalised.setId,
        name: set.name,
        year: Number.isFinite(set.year) ? set.year : null,
        pieces: Number.isFinite(set.num_parts) ? set.num_parts : null,
        theme: {
          id: theme?.id ?? null,
          name: theme?.name ?? null,
        },
        imageUrl: set.set_img_url ?? null,
        sourceUrl: set.set_url ?? null,
      },
      minifigs:
        minifigsResp?.results?.map((r) => ({
          setNum: r.minifig.set_num,
          name: r.minifig.name,
          quantity: r.quantity,
          imageUrl: r.minifig.minifig_img_url ?? null,
        })) ?? [],
      raw: {
        set,
        theme,
        minifigsCount: minifigsResp?.count ?? 0,
      },
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "Upstream timeout (Rebrickable)"
        : err?.message || "Unknown error";

    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
