export const PRODUCT_FEATURES = [
  "Reviews",
  "Webchat",
  "Messaging",
  "Payments",
  "Phones",
  "AI",
] as const;

export const PRODUCT_CATALOG = {
  Reviews: {
    feature: "Reviews",
    summary: "Review generation and reputation growth through invites and conversion.",
    pitchTemplate:
      "Position Reviews as the fastest path to more social proof by increasing invite coverage and conversion.",
  },
  Webchat: {
    feature: "Webchat",
    summary: "Lead capture from website traffic with faster inbound response workflows.",
    pitchTemplate:
      "Position Webchat as the missing lead-capture layer that converts existing site traffic into conversations.",
  },
  Messaging: {
    feature: "Messaging",
    summary: "Centralized customer communication to improve response times and close loops.",
    pitchTemplate:
      "Position Messaging as the operational backbone for keeping customer response times tight and visible.",
  },
  Payments: {
    feature: "Payments",
    summary: "Invoice collection and payment processing embedded into customer communication.",
    pitchTemplate:
      "Position Payments where the account needs a shorter path from conversation to cash collection.",
  },
  Phones: {
    feature: "Phones",
    summary: "Call routing, porting, and missed-call recovery for inbound phone demand.",
    pitchTemplate:
      "Position Phones when missed calls, routing friction, or porting blockers are limiting conversion.",
  },
  AI: {
    feature: "AI",
    summary: "AI-assisted lead qualification and automated first-response workflows.",
    pitchTemplate:
      "Position AI when the team wants faster qualification or after-hours coverage without adding headcount.",
  },
} as const;

export type ProductFeature = keyof typeof PRODUCT_CATALOG;

export function isCatalogFeature(value: string): value is ProductFeature {
  return PRODUCT_FEATURES.includes(value as ProductFeature);
}

export function getCatalogContext() {
  return PRODUCT_FEATURES.map((feature) => {
    const entry = PRODUCT_CATALOG[feature];
    return `${entry.feature}: ${entry.summary}\nPitch template: ${entry.pitchTemplate}`;
  }).join("\n\n");
}
