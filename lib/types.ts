export const PART_IDS = [
  "site",
  "standard",
  "conformance",
  "assessment",
  "limitations",
  "reporting",
  "contact",
  "date",
  "alternativeFormat",
] as const;

export type PartId = (typeof PART_IDS)[number];

export type ConformanceStatus =
  | "fully_conformant"
  | "partially_conformant"
  | "not_conformant"
  | "not_assessed";

export type SiteScope = "whole_site" | "subset" | "unconfirmed";

export type Barrier = {
  id: string;
  summary: string;
  reason: string;
  alternative: string;
  criterion?: string;
  plan: string;
};

export type AccessibilityReport = {
  present: boolean;
  source: "none" | "json" | "url" | "token" | "unreadable";
  rawToken?: string;
  sourceUrl?: string;
  standard?: string;
  method?: string;
  assessedAt?: string;
  claimedConformance?: ConformanceStatus;
  passed?: boolean;
  failed?: boolean;
  score?: number;
  barriers: Barrier[];
};

export type SiteFacts = {
  inputUrl: string;
  normalizedUrl: string | null;
  normalizeNote?: string;
  fetchOk: boolean;
  fetchError?: string;
  siteName: string | null;
  pageTitle: string | null;
  contactUrl: string | null;
  feedbackUrl: string | null;
  emails: string[];
  phones: string[];
  accessibilityPageUrl: string | null;
  fetchedAt?: string;
};

export type BuyerAnswers = {
  scope?: SiteScope;
  subsetDescription?: string;
  standardConfirm?: string;
  assessmentMethod?: string;
  assessmentDate?: string;
  lastReviewed?: string;
  reportingPath?: string;
  contactDetails?: string;
  alternativeFormatHow?: string;
  limitationPlans?: Record<string, string>;
};

export type PartResult = {
  id: PartId;
  number: number;
  title: string;
  filled: boolean;
  source: "auto" | "buyer" | "report" | "default" | "missing";
  summary: string;
  stillNeeds?: string;
};

export type ReadinessResult = {
  score: number;
  total: 9;
  parts: PartResult[];
  missing: PartResult[];
  conformance: ConformanceStatus;
  conformanceReason: string;
  standard: string;
  standardChecked: string;
  generatedOn: string;
};

export type StatementModel = {
  siteLabel: string;
  siteUrl: string;
  scopeLine: string;
  standard: string;
  conformance: ConformanceStatus;
  conformanceSentence: string;
  assessmentLine: string;
  barriers: Barrier[];
  reportingLine: string;
  contactLine: string;
  dateLine: string;
  lastReviewed: string;
  alternativeFormatLine: string;
  disclaimer: string;
};

export const PART_META: Record<
  PartId,
  { number: number; title: string; publishNeed: string }
> = {
  site: {
    number: 1,
    title: "What site it covers",
    publishNeed: "The website address and name, and whether the statement covers the whole site.",
  },
  standard: {
    number: 2,
    title: "Standard aimed at",
    publishNeed: "The accessibility standard the site is aiming at, with the date that default was last checked.",
  },
  conformance: {
    number: 3,
    title: "Honest conformance status",
    publishNeed: "Fully, partly, not conformant, or not assessed — matching any linked report. Never upgraded.",
  },
  assessment: {
    number: 4,
    title: "How it was assessed",
    publishNeed: "The method and date of the last assessment.",
  },
  limitations: {
    number: 5,
    title: "Known limitations, reasons, and alternatives",
    publishNeed: "Real barriers from an assessment, each with a reason and what a person can do instead.",
  },
  reporting: {
    number: 6,
    title: "How to report a problem",
    publishNeed: "An explicit path to report an accessibility problem.",
  },
  contact: {
    number: 7,
    title: "Contact details",
    publishNeed: "A working email, phone, or contact page.",
  },
  date: {
    number: 8,
    title: "Date",
    publishNeed: "The date this statement was generated or last reviewed.",
  },
  alternativeFormat: {
    number: 9,
    title: "Content in another format",
    publishNeed: "How to ask for content in another format.",
  },
};
