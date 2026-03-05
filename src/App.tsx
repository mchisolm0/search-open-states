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

function App() {
  const lookupByZip = useAction(api.representatives.lookupByZip);
  const [zip, setZip] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await lookupByZip({ zip });
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
    <main className="page">
      <section className="panel">
        <header className="hero">
          <p className="eyebrow">OpenStates + Convex</p>
          <h1>Find Your Representatives</h1>
          <p className="intro">
            Enter a US ZIP code to find legislators and their contact channels.
          </p>
        </header>

        <form className="searchForm" onSubmit={onSubmit}>
          <label htmlFor="zip">ZIP code</label>
          <div className="searchRow">
            <input
              id="zip"
              name="zip"
              type="text"
              inputMode="numeric"
              placeholder="60612"
              value={zip}
              onChange={(event) => setZip(event.target.value)}
              maxLength={10}
              required
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        {error ? <p className="status error">{error}</p> : null}

        {!error && result ? (
          <section className="results">
            <div className="resultMeta">
              <p>
                ZIP {result.zip5}
                {result.city ? ` (${result.city})` : ""}
              </p>
              <p>
                Source: {result.source} | Updated{" "}
                {new Date(result.fetchedAt).toLocaleString()}
              </p>
            </div>

            {result.representatives.length === 0 ? (
              <p className="status">No representatives found for this ZIP.</p>
            ) : (
              <ul className="repGrid">
                {result.representatives.map((rep) => (
                  <li key={rep.id} className="repCard">
                    <div className="repHeader">
                      {rep.imageUrl ? (
                        <img src={rep.imageUrl} alt={`Portrait of ${rep.name}`} />
                      ) : (
                        <div className="imageFallback" aria-hidden="true">
                          {rep.name[0] ?? "?"}
                        </div>
                      )}
                      <div>
                        <h2>{rep.name}</h2>
                        <p>
                          {rep.roleTitle ?? "Representative"}
                          {rep.district ? `, ${rep.district}` : ""}
                        </p>
                        <p>{rep.party ?? "Unknown party"}</p>
                        {rep.jurisdiction ? <p>{rep.jurisdiction}</p> : null}
                      </div>
                    </div>

                    <div className="contactBlock">
                      <h3>Contact</h3>
                      {rep.primaryEmailOrContactUrl ? (
                        <a
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
                        <p>No direct email available.</p>
                      )}
                      {rep.openstatesUrl ? (
                        <a href={rep.openstatesUrl} target="_blank" rel="noreferrer">
                          OpenStates profile
                        </a>
                      ) : null}
                    </div>

                    <div className="officeBlock">
                      <h3>Offices</h3>
                      {rep.offices.length === 0 ? (
                        <p>No office records available.</p>
                      ) : (
                        <ul className="offices">
                          {rep.offices.map((office, idx) => {
                            const tel = office.voice ? formatPhone(office.voice) : null;
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
                                    {tel ? <a href={tel}>{office.voice}</a> : office.voice}
                                  </p>
                                ) : null}
                                {office.fax ? <p>Fax: {office.fax}</p> : null}
                                {office.address ? <p>{office.address}</p> : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <p className="status">
            Search by ZIP to load representatives and office contact details.
          </p>
        )}
      </section>
    </main>
  );
}

export default App;
