import { NextResponse } from "next/server";

const BRICKSET_ENDPOINT = "https://brickset.com/api/v3.asmx";

function normaliseSetNumber(input: string) {
  const s = input.trim();
  if (!s) return null;

  if (/^\d+-\d+$/.test(s)) {
    const [id] = s.split("-");
    return { setNumber: s, setId: id };
  }

  if (/^\d+$/.test(s)) {
    return { setNumber: `${s}-1`, setId: s };
  }

  return null;
}

async function bricksetCall(
  method: string,
  params: Record<string, string | number | boolean>
) {
  const qs = new URLSearchParams({
    apiKey: process.env.BRICKSET_API_KEY!,
    userHash: "",
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ),
  });

  const loginParams = new URLSearchParams({
    apiKey: process.env.BRICKSET_API_KEY!,
    username: process.env.BRICKSET_USERNAME!,
    password: process.env.BRICKSET_PASSWORD_HASH!,
  });

  // Brickset requires login to get a userHash
  const loginRes = await fetch(
    `${BRICKSET_ENDPOINT}/login?${loginParams.toString()}`
  );

  const loginJson = await loginRes.json();
  if (!loginJson?.hash) {
    throw new Error("Brickset login failed");
  }

  qs.set("userHash", loginJson.hash);

  const res = await fetch(
    `${BRICKSET_ENDPOINT}/${method}?${qs.toString()}`
  );

  if (!res.ok) {
    throw new Error(`Brickset ${method} failed`);
  }

  const json = await res.json();
  if (json.status !== "success") {
    throw new Error(json.message || "Brickset API error");
  }

  return json;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const setNumberRaw = searchParams.get("setNumber") || "";

  if (
    !process.env.BRICKSET_API_KEY ||
    !process.env.BRICKSET_USERNAME ||
    !process.env.BRICKSET_PASSWORD_HASH
  ) {
    return NextResponse.json(
      { error: "Brickset credentials missing" },
      { status: 500 }
    );
  }

  const normalised = normaliseSetNumber(setNumberRaw);
  if (!normalised) {
    return NextResponse.json(
      { error: "Invalid set number format" },
      { status: 400 }
    );
  }

  try {
    const result = await bricksetCall("getSets", {
      setNumber: normalised.setId,
      extendedData: true,
    });

    const set = result.sets?.[0];
    if (!set) {
      return NextResponse.json(
        { error: "Set not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      provider: "brickset",
      set: {
        setNumber: set.number,
        name: set.name,
        year: set.year ?? null,
        pieces: set.pieces ?? null,
        theme: set.theme ?? null,
        subtheme: set.subtheme ?? null,
        category: set.category ?? null,
        releaseStatus: set.availability ?? null,
        imageUrl: set.image?.imageURL ?? null,
        bricksetUrl: set.bricksetURL ?? null,
      },
      minifigs: set.minifigs
        ? [
            {
              count: set.minifigs,
            },
          ]
        : [],
      raw: set,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Brickset error" },
      { status: 502 }
    );
  }
}
