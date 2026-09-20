"use client";

import {
  allowLocalUnlock,
  nextToolCheck,
  nextToolFix,
  publicBasePath,
  shopOrigin,
} from "@/lib/config";
import { selectedPrice, shopPrices } from "@/lib/prices";
import { scoreReadiness } from "@/lib/readiness";
import { emptyReport } from "@/lib/report";
import { loadDraft, saveDraft, type DraftState } from "@/lib/storage";
import { buildStatement, DISCLAIMER, renderHtml, renderPlainText } from "@/lib/statement";
import type {
  AccessibilityReport,
  BuyerAnswers,
  ReadinessResult,
  SiteFacts,
  StatementModel,
} from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

type PaidView = "text" | "html" | "print";

const DEFAULT_STANDARD = process.env.NEXT_PUBLIC_STANDARD?.trim() || "WCAG 2.2 Level AA";
const STANDARD_CHECKED = process.env.NEXT_PUBLIC_STANDARD_CHECKED?.trim() || "2026-09-19";

export function ToolApp() {
  const urlRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [reportText, setReportText] = useState("");
  const [answers, setAnswers] = useState<BuyerAnswers>({});
  const [working, setWorking] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [facts, setFacts] = useState<SiteFacts | null>(null);
  const [report, setReport] = useState<AccessibilityReport>(emptyReport());
  const [paid, setPaid] = useState(false);
  const [paidNote, setPaidNote] = useState("");
  const [view, setView] = useState<PaidView>("text");
  const [copied, setCopied] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    urlRef.current?.focus();
    const draft = loadDraft();
    if (draft) {
      setUrl(draft.url);
      setReportText(draft.reportText);
      setAnswers(draft.answers ?? {});
    }
    setHydrated(true);
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id") ?? params.get("sessionId");
    if (sessionId) {
      void confirmSale(sessionId, draft);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({
      url,
      reportText,
      answers,
      savedAt: new Date().toISOString(),
    });
  }, [hydrated, url, reportText, answers]);

  const readiness: ReadinessResult | null = useMemo(() => {
    if (!facts) return null;
    return scoreReadiness({
      facts,
      report,
      answers,
      defaultStandard: DEFAULT_STANDARD,
      standardChecked: STANDARD_CHECKED,
    });
  }, [facts, report, answers]);

  const withReport = report.present && report.source !== "none";
  const price = selectedPrice(shopPrices(), withReport);
  const shop = shopOrigin();
  const localOk = allowLocalUnlock();

  async function runInspect(nextUrl: string, nextReport: string, keepPaid: boolean) {
    setError("");
    setWorking(true);
    if (!keepPaid) setPaid(false);
    try {
      const res = await fetch(`${publicBasePath()}/api/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: nextUrl, reportText: nextReport }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        facts?: SiteFacts;
        report?: AccessibilityReport;
      };
      if (!res.ok || !data.ok || !data.facts || !data.report) {
        throw new Error(data.message || "Check failed. Confirm the address and try again.");
      }
      setFacts(data.facts);
      setReport(data.report);
      if (data.report.barriers.length) {
        setAnswers((current) => {
          const plans = { ...(current.limitationPlans ?? {}) };
          for (const barrier of data.report!.barriers) {
            if (plans[barrier.id] == null) plans[barrier.id] = barrier.plan;
          }
          return { ...current, limitationPlans: plans };
        });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed. Confirm the address and try again.");
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function onInspect(event: React.FormEvent) {
    event.preventDefault();
    await runInspect(url, reportText, paid);
  }

  async function onBuy() {
    if (!facts?.normalizedUrl) {
      setError("Run the free score first so the shop knows which site this sale is for.");
      return;
    }
    setError("");
    setBuying(true);
    try {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.delete("session_id");
      returnUrl.searchParams.delete("sessionId");
      const res = await fetch(`${publicBasePath()}/api/sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: facts.normalizedUrl,
          withReport,
          returnUrl: returnUrl.toString(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; message?: string };
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.message || "The shop could not start checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "The shop could not start checkout.");
      setBuying(false);
    }
  }

  async function confirmSale(sessionId: string, draft: DraftState | null) {
    try {
      const res = await fetch(
        `${publicBasePath()}/api/verify?session_id=${encodeURIComponent(sessionId)}`,
      );
      const data = (await res.json()) as { paid?: boolean; message?: string };
      if (data.paid) {
        setPaid(true);
        if (draft?.url) {
          setUrl(draft.url);
          setReportText(draft.reportText);
          setAnswers(draft.answers ?? {});
          const rebuilt = await runInspect(draft.url, draft.reportText, true);
          setPaidNote(
            rebuilt
              ? "Payment confirmed by the shop desk. The finished statement is below."
              : "Payment confirmed. The address is still in this browser; run the score again to rebuild the statement.",
          );
          return;
        }
        setPaidNote(
          "Payment confirmed. Paste the website address again and run the score to rebuild the statement. Nothing was stored on a server.",
        );
        return;
      }
      setPaidNote(data.message || "The shop has not confirmed this sale yet.");
    } catch {
      setPaidNote("Could not reach the shop to confirm this sale. Keep this page and try again.");
    }
  }

  const statement =
    facts && readiness
      ? buildStatement({ facts, report, answers, readiness })
      : null;
  const text = statement ? renderPlainText(statement) : "";
  const html = statement ? renderHtml(statement) : "";

  return (
    <main className="ggt-root">
      <div className="ggt-wrap">
        <header className="ggt-hero ggt-no-print">
          <p className="ggt-eyebrow">Golden Goose Tools · Accessibility Statement</p>
          <h1>A statement that is true about your site.</h1>
          <p className="ggt-lede">
            Free readiness score across the nine parts a statement needs. Pay once for text, HTML, and print — built from
            measured barriers, not a full-conformance template.
          </p>
        </header>

        <form className="ggt-no-print" onSubmit={onInspect}>
          <div className="ggt-input-row">
            <input
              ref={urlRef}
              id="site-url"
              className="ggt-input"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="yourbusiness.com"
              aria-label="Website address"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
            <button className="ggt-btn" type="submit" disabled={working}>
              {working ? "Checking…" : "Score my statement — free"}
            </button>
          </div>
          <div className="ggt-field">
            <label className="ggt-label" htmlFor="report-input">
              Optional accessibility report
            </label>
            <textarea
              id="report-input"
              className="ggt-input"
              rows={5}
              placeholder="Paste report JSON, a report link, or a report token"
              value={reportText}
              onChange={(event) => setReportText(event.target.value)}
            />
            <p className="ggt-help">
              If you already bought the $49 accessibility report, paste it here. This tool will not invent barriers or
              raise the conformance the report supports.
            </p>
          </div>
        </form>

        {error ? (
          <p className="ggt-error ggt-no-print" role="alert">
            {error}
          </p>
        ) : null}
        {facts?.normalizeNote ? <p className="ggt-note ggt-no-print">{facts.normalizeNote}</p> : null}
        {facts && !facts.fetchOk && facts.fetchError ? (
          <p className="ggt-note ggt-no-print" role="status">
            {facts.fetchError}
            {facts.normalizedUrl
              ? " The score still uses the address you typed; missing page facts stay blank."
              : ""}
          </p>
        ) : null}
        {paidNote ? <p className="ggt-note ggt-no-print">{paidNote}</p> : null}

        {readiness && facts ? (
          <section className="ggt-result ggt-no-print" aria-live="polite">
            <div className="ggt-score">
              <strong>
                {readiness.score}/{readiness.total}
              </strong>
              <span>parts ready to publish honestly</span>
            </div>
            <p>
              Conformance status: <strong>{labelStatus(readiness.conformance)}</strong>. {readiness.conformanceReason}
            </p>
            <ul className="ggt-list">
              {readiness.parts.map((part) => (
                <li key={part.id}>
                  <div className="ggt-part-head">
                    <span className="ggt-pill">{part.filled ? "Filled" : "Needs an answer"}</span>
                    <strong>
                      {part.number}. {part.title}
                    </strong>
                  </div>
                  <p>{part.summary}</p>
                  {part.stillNeeds ? <p className="ggt-help">{part.stillNeeds}</p> : null}
                </li>
              ))}
            </ul>

            <div className="ggt-answers">
              <label className="ggt-label" htmlFor="scope">
                Confirm scope
              </label>
              <select
                id="scope"
                className="ggt-input"
                value={answers.scope ?? "unconfirmed"}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    scope: event.target.value as BuyerAnswers["scope"],
                  }))
                }
              >
                <option value="unconfirmed">Whole website (default until you say otherwise)</option>
                <option value="whole_site">Whole website — confirmed</option>
                <option value="subset">Only some pages</option>
              </select>
              {answers.scope === "subset" ? (
                <div className="ggt-field">
                  <label className="ggt-label" htmlFor="subset-description">
                    Which pages this statement covers
                  </label>
                  <input
                    id="subset-description"
                    className="ggt-input"
                    placeholder="Which pages does this cover?"
                    value={answers.subsetDescription ?? ""}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, subsetDescription: event.target.value }))
                    }
                  />
                </div>
              ) : null}

              <label className="ggt-label" htmlFor="method">
                How it was assessed
              </label>
              <input
                id="method"
                className="ggt-input"
                placeholder="Method, e.g. Golden Goose Tools Accessibility Check"
                value={answers.assessmentMethod ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, assessmentMethod: event.target.value }))
                }
              />
              <label className="ggt-label" htmlFor="assessment-date">
                Assessment date
              </label>
              <input
                id="assessment-date"
                className="ggt-input"
                placeholder="Assessment date YYYY-MM-DD"
                value={answers.assessmentDate ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, assessmentDate: event.target.value }))
                }
              />

              <label className="ggt-label" htmlFor="reporting">
                How to report a problem
              </label>
              <input
                id="reporting"
                className="ggt-input"
                placeholder="Email or page for accessibility problems"
                value={answers.reportingPath ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, reportingPath: event.target.value }))
                }
              />

              <label className="ggt-label" htmlFor="contact">
                Contact details
              </label>
              <input
                id="contact"
                className="ggt-input"
                placeholder="Email, phone, or contact page"
                value={answers.contactDetails ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, contactDetails: event.target.value }))
                }
              />

              <label className="ggt-label" htmlFor="alt-format">
                How to ask for content in another format
              </label>
              <input
                id="alt-format"
                className="ggt-input"
                placeholder="This is the ninth part. The tool will not invent it."
                value={answers.alternativeFormatHow ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, alternativeFormatHow: event.target.value }))
                }
              />

              {report.barriers.length ? (
                <fieldset>
                  <legend className="ggt-label">Being fixed by</legend>
                  {report.barriers.map((barrier) => (
                    <label key={barrier.id} className="ggt-field">
                      <span>{barrier.summary}</span>
                      <input
                        className="ggt-input"
                        placeholder="Date or owner"
                        value={answers.limitationPlans?.[barrier.id] ?? ""}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            limitationPlans: {
                              ...(current.limitationPlans ?? {}),
                              [barrier.id]: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                </fieldset>
              ) : null}
            </div>
            <p className="ggt-disclaimer">{DISCLAIMER}</p>
          </section>
        ) : null}

        {readiness ? (
          <aside className={`ggt-tally ggt-no-print${paid ? "" : " ggt-tally--locked"}`}>
            <h2>What the paid statement includes</h2>
            <ul>
              <li>Plain text you can paste into a CMS or policy page</li>
              <li>HTML with a correct heading structure</li>
              <li>A print view with clean print CSS</li>
              <li>Known limitations from a real report only, each with a reason, an alternative, and an editable plan line</li>
            </ul>
          </aside>
        ) : null}

        {readiness && !paid ? (
          <section className="ggt-paywall ggt-no-print">
            <h2>Unlock the finished statement</h2>
            {price ? (
              <p className="ggt-price">{price.label}</p>
            ) : (
              <p>
                Price is set by the shop. Mirror{" "}
                {withReport ? "NEXT_PUBLIC_PRICE_WITH_REPORT_CENTS" : "NEXT_PUBLIC_PRICE_CENTS"} from
                shop config.
              </p>
            )}
            <p>
              {withReport
                ? "Report attached — the shop should charge the with-report price."
                : "Bought on its own. Attach a real accessibility report to use the with-report price when the shop has that key."}
            </p>
            <p>
              {shop
                ? `Checkout runs on the shop desk at ${shop}. This app never holds a Stripe secret.`
                : localOk
                  ? "Shop origin is not set. Local unlock is on for development only."
                  : "Set NEXT_PUBLIC_SHOP_ORIGIN so this page can start a shop sale."}
            </p>
            <button className="ggt-btn" type="button" onClick={onBuy} disabled={buying}>
              {buying ? "Opening checkout…" : "Unlock with shop checkout"}
            </button>
          </section>
        ) : null}

        {paid && statement ? (
          <section className="ggt-result">
            <div className="ggt-tabs ggt-no-print" aria-label="Statement formats">
              <button
                type="button"
                className="ggt-tab"
                aria-pressed={view === "text"}
                onClick={() => setView("text")}
              >
                Plain text
              </button>
              <button
                type="button"
                className="ggt-tab"
                aria-pressed={view === "html"}
                onClick={() => setView("html")}
              >
                HTML
              </button>
              <button
                type="button"
                className="ggt-tab"
                aria-pressed={view === "print"}
                onClick={() => setView("print")}
              >
                Print view
              </button>
            </div>

            {view === "text" ? (
              <>
                <pre className="ggt-pre">{text}</pre>
                <div className="ggt-actions ggt-no-print">
                  <button className="ggt-btn" type="button" onClick={() => copy(text, "text")}>
                    {copied === "text" ? "Copied" : "Copy text"}
                  </button>
                </div>
              </>
            ) : null}

            {view === "html" ? (
              <>
                <pre className="ggt-pre">{html}</pre>
                <div className="ggt-actions ggt-no-print">
                  <button className="ggt-btn" type="button" onClick={() => copy(html, "html")}>
                    {copied === "html" ? "Copied" : "Copy HTML"}
                  </button>
                </div>
              </>
            ) : null}

            {view === "print" ? (
              <StatementPrintView statement={statement} />
            ) : null}

            {view === "print" ? (
              <div className="ggt-actions ggt-no-print">
                <button className="ggt-btn" type="button" onClick={() => window.print()}>
                  Print
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <p className="ggt-trust ggt-no-print">
          Paid once. Yours to keep. No account required for the free pass. The address and report stay in this browser.
          After you pay, this page asks the shop whether the sale completed, then builds the statement here.
        </p>

        <nav className="ggt-next ggt-no-print" aria-label="Next tool">
          <p className="ggt-label">Next</p>
          <p>
            Need the barriers measured first? Use{" "}
            <a href={nextToolCheck()}>Accessibility Check</a>.
            {nextToolFix() ? (
              <>
                {" "}
                Want the fixes applied?{" "}
                <a href={nextToolFix()!}>Fix It For Me</a>.
              </>
            ) : (
              <> Fix It For Me is the follow-on tool once the shop lists it.</>
            )}
          </p>
        </nav>
      </div>
    </main>
  );

  async function copy(value: string, which: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
    } catch {
      setCopied("");
      setError("Could not copy. Select the text and copy it yourself.");
    }
  }
}

function StatementPrintView({ statement }: { statement: StatementModel }) {
  return (
    <article className="ggt-statement">
      <h1>Accessibility statement for {statement.siteLabel}</h1>
      <h2>About this website</h2>
      <p>{statement.scopeLine}</p>
      <h2>Standard aimed at</h2>
      <p>{statement.standard}</p>
      <h2>Conformance status</h2>
      <p>{statement.conformanceSentence}</p>
      <h2>How this website was assessed</h2>
      <p>{statement.assessmentLine}</p>
      <h2>Known limitations</h2>
      {statement.barriers.length ? (
        statement.barriers.map((barrier) => (
          <section key={barrier.id}>
            <h3>{barrier.summary}</h3>
            <p>Reason: {barrier.reason || "[add why this barrier exists]"}</p>
            <p>What you can do instead: {barrier.alternative || "[describe an alternative]"}</p>
            <p>Being fixed by: {barrier.plan || "[add a date or owner]"}</p>
            {barrier.criterion ? <p>Related criterion: {barrier.criterion}</p> : null}
          </section>
        ))
      ) : (
        <p>No measured barriers were supplied with this statement. None have been invented.</p>
      )}
      <h2>Reporting a problem</h2>
      <p>{statement.reportingLine}</p>
      <h2>Contact</h2>
      <p>{statement.contactLine}</p>
      <h2>Requesting content in another format</h2>
      <p>{statement.alternativeFormatLine}</p>
      <h2>Date</h2>
      <p>
        {statement.dateLine} {statement.lastReviewed}
      </p>
      <p>
        <em>{statement.disclaimer}</em>
      </p>
    </article>
  );
}

function labelStatus(status: ReadinessResult["conformance"]): string {
  if (status === "fully_conformant") return "fully conformant";
  if (status === "partially_conformant") return "partially conformant";
  if (status === "not_conformant") return "not conformant";
  return "not assessed";
}
