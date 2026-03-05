import { useAction } from "convex/react";
import { type FormEvent, useState } from "react";

import { api } from "../convex/_generated/api";
import "./App.css";

type Office = {
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
  offices: Office[];
};

type LookupResult = {
  zip5: string;
  city: string | null;
  lat: number;
  lng: number;
  fetchedAt: number | string;
  source: "cache" | "live";
  representatives: Representative[];
};

type PartyTone = "dem" | "rep" | "ind" | "other";

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isOffice(value: unknown): value is Office {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    isNullableString(record.name) &&
    isNullableString(record.classification) &&
    isNullableString(record.voice) &&
    isNullableString(record.fax) &&
    isNullableString(record.address)
  );
}

function isRepresentative(value: unknown): value is Representative {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    isNullableString(record.party) &&
    isNullableString(record.roleTitle) &&
    isNullableString(record.district) &&
    isNullableString(record.jurisdiction) &&
    isNullableString(record.imageUrl) &&
    isNullableString(record.openstatesUrl) &&
    isNullableString(record.primaryEmailOrContactUrl) &&
    Array.isArray(record.offices) &&
    record.offices.every(isOffice)
  );
}

function isFetchedAt(value: unknown): value is number | string {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    return Number.isFinite(Date.parse(value));
  }
  return false;
}

function isLookupResult(value: unknown): value is LookupResult {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.zip5 === "string" &&
    isNullableString(record.city) &&
    typeof record.lat === "number" &&
    typeof record.lng === "number" &&
    (record.source === "cache" || record.source === "live") &&
    isFetchedAt(record.fetchedAt) &&
    Array.isArray(record.representatives) &&
    record.representatives.every(isRepresentative)
  );
}

function contactLink(contact: string) {
  if (contact.startsWith("http://") || contact.startsWith("https://")) {
    return contact;
  }
  return `mailto:${contact}`;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length > 0 ? `tel:${digits}` : null;
}

function formatUpdatedAt(value: number | string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function partyTone(party: string | null): PartyTone {
  if (!party) return "other";
  const normalized = party.toLowerCase();
  if (normalized.includes("dem")) return "dem";
  if (normalized.includes("rep")) return "rep";
  if (normalized.includes("ind")) return "ind";
  return "other";
}

function partyLabel(party: string | null) {
  return party ?? "Unknown affiliation";
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2) {
    return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function App() {
  const lookupByZip = useAction(api.representatives.lookupByZip);
  const [zip, setZip] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const lawmakerCount = result?.representatives.length ?? 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await lookupByZip({ zip: zip.trim() });
      if (!isLookupResult(response)) {
        throw new Error("Received unexpected data shape from the server.");
      }
      setResult(response);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="civicPage">
      <section className="civicShell">
        <header className="hero">
          <div className="heroTop">
            <div className="titleBlock">
              <p className="eyebrow">OpenStates + Convex</p>
              <h1>ZIP Lawmaker Lookup</h1>
              <p className="heroNote">
                Quickly identify who represents a ZIP code and where to reach
                each office.
              </p>
            </div>

            <form
              className="lookupForm"
              onSubmit={onSubmit}
              aria-busy={isLoading}
            >
              <label htmlFor="zip">US ZIP code</label>
              <div className="lookupRow">
                <input
                  id="zip"
                  name="zip"
                  type="text"
                  inputMode="numeric"
                  placeholder="60612"
                  value={zip}
                  onChange={(event) => setZip(event.target.value)}
                  autoComplete="postal-code"
                  maxLength={10}
                  required
                />
                <button type="submit" disabled={isLoading}>
                  {isLoading ? "Scanning districts..." : "Search lawmakers"}
                </button>
              </div>
              <p className="helperText">5-digit ZIP or ZIP+4.</p>
            </form>
          </div>
        </header>

        {error ? (
          <p className="statusCard statusError" role="alert">
            {error}
          </p>
        ) : null}

        {!error && !result ? (
          <p className="statusCard statusIdle">
            Enter a ZIP to load lawmaker cards and office contact details.
          </p>
        ) : null}

        {!error && result ? (
          <section className="results" aria-live="polite">
            <header className="resultsHeader">
              <div className="resultsTitle">
                <p className="resultsKicker">Lookup result</p>
                <h2>
                  {result.city ? `${result.city}, ` : "ZIP "}
                  {result.zip5}
                </h2>
              </div>
              <div className="metaTokens">
                <span className="token token-count">
                  {lawmakerCount} lawmakers
                </span>
                <span className="token">
                  Updated {formatUpdatedAt(result.fetchedAt)}
                </span>
                <span className={`token token-${result.source}`}>
                  Source: {result.source === "cache" ? "Cached" : "Live"}
                </span>
              </div>
            </header>

            {result.representatives.length === 0 ? (
              <p className="statusCard statusEmpty">
                No lawmaker records were returned for this ZIP.
              </p>
            ) : (
              <ul className="repGrid">
                {result.representatives.map((rep) => (
                  <li key={rep.id} className="repCard">
                    <header className="repHeader">
                      {rep.imageUrl ? (
                        <img
                          src={rep.imageUrl}
                          alt={`Portrait of ${rep.name}`}
                        />
                      ) : (
                        <div className="imageFallback" aria-hidden="true">
                          {initials(rep.name)}
                        </div>
                      )}

                      <div className="identityBlock">
                        <h3>{rep.name}</h3>
                        <p>
                          {rep.roleTitle ?? "Lawmaker"}
                          {rep.district ? ` · ${rep.district}` : ""}
                        </p>
                        {rep.jurisdiction ? <p>{rep.jurisdiction}</p> : null}
                        <span
                          className={`partyBadge party-${partyTone(rep.party)}`}
                        >
                          {partyLabel(rep.party)}
                        </span>
                      </div>
                    </header>

                    <section className="contactBlock">
                      <h4>Contact</h4>
                      <div className="contactLinks">
                        {rep.primaryEmailOrContactUrl ? (
                          <a
                            className="primaryAction"
                            href={contactLink(rep.primaryEmailOrContactUrl)}
                            target={
                              rep.primaryEmailOrContactUrl.startsWith("http")
                                ? "_blank"
                                : undefined
                            }
                            rel={
                              rep.primaryEmailOrContactUrl.startsWith("http")
                                ? "noreferrer"
                                : undefined
                            }
                          >
                            {rep.primaryEmailOrContactUrl}
                          </a>
                        ) : (
                          <p className="contactEmpty">
                            No direct contact available.
                          </p>
                        )}

                        {rep.openstatesUrl ? (
                          <a
                            className="secondaryAction"
                            href={rep.openstatesUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            OpenStates profile
                          </a>
                        ) : null}
                      </div>
                    </section>

                    <section className="officeBlock">
                      <h4>Offices</h4>
                      {rep.offices.length === 0 ? (
                        <p>No office records available.</p>
                      ) : (
                        <ul className="offices">
                          {rep.offices.map((office, idx) => {
                            const tel = office.voice
                              ? formatPhone(office.voice)
                              : null;
                            return (
                              <li key={`${rep.id}-office-${idx}`}>
                                <p>
                                  <strong>{office.name ?? "Office"}</strong>
                                  {office.classification
                                    ? ` (${office.classification})`
                                    : ""}
                                </p>
                                {office.voice ? (
                                  <p>
                                    Phone:{" "}
                                    {tel ? (
                                      <a href={tel}>{office.voice}</a>
                                    ) : (
                                      office.voice
                                    )}
                                  </p>
                                ) : null}
                                {office.fax ? <p>Fax: {office.fax}</p> : null}
                                {office.address ? (
                                  <p>{office.address}</p>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default App;
