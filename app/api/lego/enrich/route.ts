import { NextResponse } from "next/server";

const ENDPOINT = "https://brickset.com/api/v3.asmx";

function normaliseSetNumber(input: string) {
  const s = String(input || "").trim();
  if (!s) return null;

  // Accept "75313" or "75313-1"
  if (/^\d{4,6}-\d+$/.test(s)) return s;
  if (/^\d{4,6}$/.test(s)) return `${s}-1`;

  return null;
}

async function bricksetGetSets(apiKey: string, params: Record<string, any>) {
  // Brickset expects params as a JSON string. :contentReference[oaicite:2]{index=2}
  const qs = new URLSearchParams({
    apiKey,
    userHash: "", // optional unless owned/wanted
    params: JSON.stringify(params),
  });

  const res = await fetch(`${ENDPOINT}/getSets?${qs.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    // cache a day; change if you want fresher
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brickset getSets failed (${res.status}): ${text || res.statusText}`);
  }

  const json = await res.json();
  if (json?.status !== "success") {
    throw new Error(json?.message || "Brickset error");
  }

  return json as {
    status: "success";
    matches: number;
    sets: any[];
  };
}

export async function GET(req: Request) {
  const apiKey = process.env.BRICKSET_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing BRICKSET_API_KEY" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const setNumberRaw = searchParams.get("setNumber") || "";

  const setNumber = normaliseSetNumber(setNumberRaw);
  if (!setNumber) {
    return NextResponse.json(
      { error: "Invalid setNumber. Use '75313' or '75313-1'." },
      { status: 400 }
    );
  }

  try {
    const result = await bricksetGetSets(apiKey, {
      setNumber,       // full number incl variant :contentReference[oaicite:3]{index=3}
      extendedData: 1, // gets description/tags/notes :contentReference[oaicite:4]{index=4}
      pageSize: 1,
      pageNumber: 1,
    });

    const set = result.sets?.[0];
    if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });

    const retailCAD = set?.LEGOCom?.CA?.retailPrice ?? null;
    const retailUSD = set?.LEGOCom?.US?.retailPrice ?? null;

    return NextResponse.json(
      {
        provider: "brickset",
        set: {
          setID: set.setID ?? null,
          number: set.number ?? null,
          numberVariant: set.numberVariant ?? null,
          setNumber: set.number && set.numberVariant != null ? `${set.number}-${set.numberVariant}` : setNumber,

          name: set.name ?? null,
          year: set.year ?? null,
          pieces: set.pieces ?? null,
          minifigs: set.minifigs ?? null,

          theme: set.theme ?? null,
          subtheme: set.subtheme ?? null,
          category: set.category ?? null,
          availability: set.availability ?? null,

          imageUrl: set?.image?.imageURL ?? null,
          thumbnailUrl: set?.image?.thumbnailURL ?? null,
          bricksetURL: set?.bricksetURL ?? null,

          retailCAD,
          retailUSD,
        },
        raw: set,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Brickset error" }, { status: 502 });
  }
}
