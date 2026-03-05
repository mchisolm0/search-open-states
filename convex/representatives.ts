"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type OpenWeatherZipResponse = {
  zip: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
};

type OpenStatesOffice = {
  name?: string;
  classification?: string;
  voice?: string;
  fax?: string;
  address?: string;
};

type OpenStatesPerson = {
  id: string;
  name: string;
  party?: string;
  image?: string;
  email?: string;
  openstates_url?: string;
  current_role?: {
    title?: string;
    district?: string;
  };
  jurisdiction?: {
    name?: string;
  };
  offices?: OpenStatesOffice[];
};

type RepresentativeOffice = {
  name: string | null;
  classification: string | null;
  voice: string | null;
  fax: string | null;
  address: string | null;
};

type Representative = {
  id: string;
  name: string;
  party: string | null;
  roleTitle: string | null;
  district: string | null;
  jurisdiction: string | null;
  imageUrl: string | null;
  openstatesUrl: string | null;
  primaryEmailOrContactUrl: string | null;
  offices: RepresentativeOffice[];
};

type LookupData = {
  zip5: string;
  countryCode: string;
  city: string | null;
  lat: number;
  lng: number;
  representatives: Representative[];
  fetchedAt: number;
};

type LookupResponse = LookupData & {
  source: "cache" | "live";
};

function getEnv(name: string) {
  const processEnv = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env;
  return processEnv?.[name];
}

function normalizeZip(rawZip: string) {
  const match = rawZip.trim().match(/^(\d{5})(?:-\d{4})?$/);
  if (!match) {
    throw new Error("Please enter a valid US ZIP code (e.g. 60612).");
  }
  return match[1];
}

async function parseErrorMessage(response: Response) {
  const text = await response.text();
  if (!text) return `Upstream request failed (${response.status}).`;
  try {
    const parsed = JSON.parse(text) as { message?: string };
    return parsed.message ?? `Upstream request failed (${response.status}).`;
  } catch {
    return `Upstream request failed (${response.status}).`;
  }
}

async function resolveZipToLatLng(zip5: string, countryCode: string) {
  const apiKey = getEnv("OPENWEATHER_API_KEY");
  if (!apiKey) {
    throw new Error("Missing OPENWEATHER_API_KEY in Convex environment.");
  }

  const url = new URL("https://api.openweathermap.org/geo/1.0/zip");
  url.searchParams.set("zip", `${zip5},${countryCode}`);
  url.searchParams.set("appid", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("That ZIP code could not be found.");
    }
    if (response.status === 401) {
      throw new Error("OpenWeather API key is invalid.");
    }
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as Partial<OpenWeatherZipResponse>;
  if (typeof payload.lat !== "number" || typeof payload.lon !== "number") {
    throw new Error("OpenWeather response did not include valid coordinates.");
  }

  return {
    lat: payload.lat,
    lng: payload.lon,
    city: typeof payload.name === "string" ? payload.name : null,
    countryCode:
      typeof payload.country === "string"
        ? payload.country.toUpperCase()
        : countryCode,
  };
}

async function fetchOpenStatesPeople(lat: number, lng: number) {
  const apiKey = getEnv("OPENSTATES_API_KEY");
  if (!apiKey) {
    throw new Error("Missing OPENSTATES_API_KEY in Convex environment.");
  }

  const url = new URL("https://v3.openstates.org/people.geo");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));
  url.searchParams.set("include", "offices");

  const response = await fetch(url, {
    headers: { "X-API-KEY": apiKey },
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as { results?: OpenStatesPerson[] };
  return Array.isArray(payload.results) ? payload.results : [];
}

function mapOffice(office: OpenStatesOffice): RepresentativeOffice {
  return {
    name: typeof office.name === "string" ? office.name : null,
    classification:
      typeof office.classification === "string" ? office.classification : null,
    voice: typeof office.voice === "string" ? office.voice : null,
    fax: typeof office.fax === "string" ? office.fax : null,
    address: typeof office.address === "string" ? office.address : null,
  };
}

function mapRepresentative(person: OpenStatesPerson): Representative {
  return {
    id: person.id,
    name: person.name,
    party: typeof person.party === "string" ? person.party : null,
    roleTitle:
      typeof person.current_role?.title === "string"
        ? person.current_role.title
        : null,
    district:
      typeof person.current_role?.district === "string"
        ? person.current_role.district
        : null,
    jurisdiction:
      typeof person.jurisdiction?.name === "string"
        ? person.jurisdiction.name
        : null,
    imageUrl: typeof person.image === "string" ? person.image : null,
    openstatesUrl:
      typeof person.openstates_url === "string" ? person.openstates_url : null,
    primaryEmailOrContactUrl:
      typeof person.email === "string" ? person.email : null,
    offices: Array.isArray(person.offices) ? person.offices.map(mapOffice) : [],
  };
}

export const lookupByZip = action({
  args: {
    zip: v.string(),
    countryCode: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<LookupResponse> => {
    const zip5 = normalizeZip(args.zip);
    const countryCode = (args.countryCode ?? "US").toUpperCase();

    if (countryCode !== "US") {
      throw new Error("Only US ZIP code lookup is supported right now.");
    }

    const now = Date.now();

    const cached = (await ctx.runQuery(internal.cache.getFreshByZip, {
      zip5,
      countryCode,
      now,
    })) as LookupData | null;
    if (cached) {
      return {
        ...cached,
        source: "cache" as const,
      };
    }

    const geo = await resolveZipToLatLng(zip5, countryCode);
    const openStatesPeople = await fetchOpenStatesPeople(geo.lat, geo.lng);

    const data: LookupData = {
      zip5,
      countryCode,
      city: geo.city,
      lat: geo.lat,
      lng: geo.lng,
      representatives: openStatesPeople.map(mapRepresentative),
      fetchedAt: now,
    };

    await ctx.runMutation(internal.cache.upsertByZip, {
      zip5,
      countryCode,
      data,
      fetchedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    });

    return {
      ...data,
      source: "live" as const,
    };
  },
});
