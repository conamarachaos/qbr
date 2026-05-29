export const PRODUCT_FEATURES = [
  "Reviews",
  "Webchat",
  "Messaging",
  "Payments",
  "Phones",
  "AI",
] as const;

export const ORGANIZATION_VERTICALS = ["Home Services", "Retail"] as const;

export type ProductFeature = (typeof PRODUCT_FEATURES)[number];
export type OrganizationVertical = (typeof ORGANIZATION_VERTICALS)[number];

export interface ProductPlaybookObjection {
  objection: string;
  response: string;
}

export interface ProductPlaybook {
  valueProps: string[];
  discoveryQuestions: string[];
  commonObjections: ProductPlaybookObjection[];
  idealSignals: string[];
}

type ProductPlaybookTuning = Partial<ProductPlaybook>;

export interface ProductCatalogEntry {
  feature: ProductFeature;
  summary: string;
  pitchTemplate: string;
  playbook: ProductPlaybook;
  verticalTuning?: Partial<Record<OrganizationVertical, ProductPlaybookTuning>>;
}

export const PRODUCT_CATALOG = {
  Reviews: {
    feature: "Reviews",
    summary: "Review generation and reputation growth through invites and conversion.",
    pitchTemplate:
      "Position Reviews as the fastest path to more social proof by increasing invite coverage and conversion.",
    playbook: {
      valueProps: [
        "Turn more completed jobs into fresh public proof without adding manual follow-up.",
        "Lift Google visibility with a steadier review velocity instead of one-off bursts.",
        "Give location teams an easy reputation motion they can measure every month.",
      ],
      discoveryQuestions: [
        "How consistently are invites going out after completed jobs today?",
        "Which locations or teams are winning reviews, and which ones are falling behind?",
        "When reviews do not come in, is the blocker invite volume, timing, or ownership?",
      ],
      commonObjections: [
        {
          objection: "We already ask customers for reviews manually.",
          response:
            "Manual asks usually depend on individual reps. Reviews adds repeatable invite coverage and conversion tracking across the whole team.",
        },
        {
          objection: "Our rating is already strong enough.",
          response:
            "A strong rating helps, but fresh review velocity still matters for local trust, ranking, and sales conversations.",
        },
      ],
      idealSignals: [
        "High job volume but low review invite coverage.",
        "Strong star rating with modest recent review growth.",
        "Leadership wants more proof points for inbound conversion.",
      ],
    },
    verticalTuning: {
      "Home Services": {
        valueProps: [
          "Capture more reviews right after a completed service visit while the technician is top of mind.",
        ],
        discoveryQuestions: [
          "How often are field techs wrapping jobs without a review invite going out?",
        ],
        idealSignals: [
          "Dispatch-heavy business with frequent completed jobs but inconsistent invite follow-up.",
        ],
      },
      Retail: {
        valueProps: [
          "Turn showroom traffic and completed deliveries into a more visible reputation moat.",
        ],
        discoveryQuestions: [
          "Which stores or product lines have the biggest gap between foot traffic and review volume?",
        ],
        commonObjections: [
          {
            objection: "In-store teams are too busy to remember review asks.",
            response:
              "That is exactly where automated invites help: they create consistency without asking the floor team to remember every time.",
          },
        ],
      },
    },
  },
  Webchat: {
    feature: "Webchat",
    summary: "Lead capture from website traffic with faster inbound response workflows.",
    pitchTemplate:
      "Position Webchat as the missing lead-capture layer that converts existing site traffic into conversations.",
    playbook: {
      valueProps: [
        "Convert existing site traffic into owned leads instead of bounced visitors.",
        "Shorten the time between a website question and the first two-way conversation.",
        "Give teams better visibility into what visitors are asking before they call or leave.",
      ],
      discoveryQuestions: [
        "What happens today when a prospect lands on the site after hours?",
        "How many high-intent questions are staying anonymous because there is no instant chat option?",
        "If someone is comparing vendors on mobile, what is the fastest path into a conversation?",
      ],
      commonObjections: [
        {
          objection: "Our contact form already handles website leads.",
          response:
            "Forms capture intent eventually, but Webchat meets buyers in-session while they are still deciding whether to reach out.",
        },
        {
          objection: "We do not have staff to watch another inbox.",
          response:
            "Webchat works best with routing and AI coverage so the team is not relying on constant manual monitoring.",
        },
      ],
      idealSignals: [
        "Healthy website traffic but modest lead capture.",
        "After-hours browsing or mobile-first buyer behavior.",
        "Sales team wants more immediate first-touch conversations.",
      ],
    },
    verticalTuning: {
      "Home Services": {
        valueProps: [
          "Catch emergency or quote-request traffic before those homeowners jump to the next contractor.",
        ],
        discoveryQuestions: [
          "How many service requests are likely hitting the site when the phones are tied up or the office is closed?",
        ],
        idealSignals: [
          "Seasonal spikes where phone queues and missed calls rise together.",
        ],
      },
      Retail: {
        valueProps: [
          "Help shoppers ask product, delivery, and availability questions without leaving the site.",
        ],
        discoveryQuestions: [
          "Which product or delivery questions are forcing shoppers to leave the checkout journey?",
        ],
        commonObjections: [
          {
            objection: "Most shoppers just want to browse quietly.",
            response:
              "That is fine. Webchat is there for high-intent buyers who need one answer to keep moving toward a purchase.",
          },
        ],
      },
    },
  },
  Messaging: {
    feature: "Messaging",
    summary: "Centralized customer communication to improve response times and close loops.",
    pitchTemplate:
      "Position Messaging as the operational backbone for keeping customer response times tight and visible.",
    playbook: {
      valueProps: [
        "Bring text conversations into one shared workflow instead of scattered personal devices.",
        "Make follow-up status visible so quotes, appointments, and service issues do not disappear.",
        "Create a cleaner handoff between front-line staff, sales, and customer success.",
      ],
      discoveryQuestions: [
        "Where do follow-ups currently get lost between the first inquiry and the next action?",
        "How often are customers waiting because ownership of the conversation is unclear?",
        "Which message types are easiest to miss or hardest to monitor today?",
      ],
      commonObjections: [
        {
          objection: "The team already texts customers from their phones.",
          response:
            "That works for one-to-one communication, but Messaging adds visibility, routing, and accountability across the full account team.",
        },
        {
          objection: "We do not want to disrupt current workflows.",
          response:
            "The goal is not disruption. It is to centralize the conversations that are already happening so response times and handoffs are easier to manage.",
        },
      ],
      idealSignals: [
        "Manual texting from multiple devices.",
        "Missed follow-ups or unclear ownership.",
        "Growing volume of inbound questions across the day.",
      ],
    },
    verticalTuning: {
      "Home Services": {
        valueProps: [
          "Keep office staff and technicians aligned on quote follow-up, appointment changes, and missed-call recovery.",
        ],
        discoveryQuestions: [
          "How are dispatch, office staff, and field techs coordinating customer follow-up today?",
        ],
        idealSignals: [
          "Appointment-driven workflow with frequent schedule changes or missed-call callbacks.",
        ],
      },
      Retail: {
        valueProps: [
          "Centralize quote, delivery, and product-availability follow-up so showroom conversations do not stall.",
        ],
        discoveryQuestions: [
          "Which customer journeys need multiple follow-ups before a sale or delivery is confirmed?",
        ],
        commonObjections: [
          {
            objection: "Our team already handles updates through email and phone.",
            response:
              "Messaging adds a faster channel for the moments where a quick answer keeps a sale or delivery moving.",
          },
        ],
      },
    },
  },
  Payments: {
    feature: "Payments",
    summary: "Invoice collection and payment processing embedded into customer communication.",
    pitchTemplate:
      "Position Payments where the account needs a shorter path from conversation to cash collection.",
    playbook: {
      valueProps: [
        "Shrink the gap between customer approval and getting paid.",
        "Reduce manual chasing by letting teams send payment requests in the conversation flow.",
        "Give account leaders a cleaner handoff from service completion or quote approval to cash collection.",
      ],
      discoveryQuestions: [
        "How many payment steps still happen outside the customer conversation today?",
        "Where does cash collection slow down after a quote is accepted or work is finished?",
        "How often is the team following up manually for deposits or final payment?",
      ],
      commonObjections: [
        {
          objection: "We already have an accounting system.",
          response:
            "Payments is not replacing accounting. It compresses the front-end collection step so approved work gets paid faster.",
        },
        {
          objection: "Our team can already send invoices manually.",
          response:
            "They can, but embedding requests into the communication flow reduces delay and makes follow-up easier to track.",
        },
      ],
      idealSignals: [
        "Manual invoice or deposit collection.",
        "A noticeable lag between quote approval and payment.",
        "Customer communication already happening in Podium but payment still disconnected.",
      ],
    },
    verticalTuning: {
      "Home Services": {
        valueProps: [
          "Make it easier to collect deposits, same-day invoices, and post-job balances while the customer is still engaged.",
        ],
        discoveryQuestions: [
          "How often are completed jobs waiting on an invoice or card collection step after the work is done?",
        ],
        idealSignals: [
          "Field teams finishing jobs before payment is fully collected.",
        ],
      },
      Retail: {
        valueProps: [
          "Keep custom-order, deposit, and delivery payments moving without long back-and-forth.",
        ],
        discoveryQuestions: [
          "Which orders need a deposit or final payment before delivery, and where does that process stall?",
        ],
        commonObjections: [
          {
            objection: "Customers usually pay in store anyway.",
            response:
              "For custom orders and deliveries, remote payment collection removes friction and reduces the need for extra follow-up.",
          },
        ],
      },
    },
  },
  Phones: {
    feature: "Phones",
    summary: "Call routing, porting, and missed-call recovery for inbound phone demand.",
    pitchTemplate:
      "Position Phones when missed calls, routing friction, or porting blockers are limiting conversion.",
    playbook: {
      valueProps: [
        "Recover more phone demand by tightening routing and missed-call handling.",
        "Reduce the handoff friction between inbound calls, staff coverage, and follow-up.",
        "Give the team a more accountable phone workflow than ad hoc forwarding or personal devices.",
      ],
      discoveryQuestions: [
        "When calls are missed today, what is the follow-up path and how visible is it?",
        "Are there routing or porting blockers that are delaying the full rollout?",
        "What does peak call coverage look like after hours or during busy service windows?",
      ],
      commonObjections: [
        {
          objection: "We already have phone numbers that work.",
          response:
            "The question is less about having numbers and more about whether routing, missed-call recovery, and reporting are good enough to protect conversion.",
        },
        {
          objection: "Porting sounds like too much work.",
          response:
            "Porting needs coordination, but the payoff is a cleaner inbound workflow with fewer calls slipping through the cracks.",
        },
      ],
      idealSignals: [
        "Missed calls remain meaningful.",
        "Routing ownership is unclear across the team.",
        "Porting or configuration work is still unfinished.",
      ],
    },
    verticalTuning: {
      "Home Services": {
        valueProps: [
          "Protect high-intent service calls during dispatch peaks, after-hours periods, and emergency windows.",
        ],
        discoveryQuestions: [
          "How often do urgent calls arrive when the office team is busy or offline?",
        ],
        idealSignals: [
          "Missed-call recovery is directly tied to booked jobs.",
        ],
      },
      Retail: {
        valueProps: [
          "Make showroom, delivery, and support calls easier to route without losing the customer context.",
        ],
        discoveryQuestions: [
          "Which call types need to reach the showroom versus delivery or support, and where is that routing breaking down?",
        ],
        commonObjections: [
          {
            objection: "Calls are only one part of our sales motion.",
            response:
              "That is exactly why routing matters. Even a smaller phone channel can create outsized friction when it is the path for urgent availability or delivery questions.",
          },
        ],
      },
    },
  },
  AI: {
    feature: "AI",
    summary: "AI-assisted lead qualification and automated first-response workflows.",
    pitchTemplate:
      "Position AI when the team wants faster qualification or after-hours coverage without adding headcount.",
    playbook: {
      valueProps: [
        "Extend response coverage without relying on more headcount for first touch.",
        "Qualify inbound demand faster so reps spend time on the best opportunities.",
        "Handle repetitive questions and after-hours intake while keeping humans in control of escalation.",
      ],
      discoveryQuestions: [
        "Where does response time break down today: after hours, during peaks, or during handoff?",
        "Which inbound conversations are repetitive enough to automate safely?",
        "How quickly does the team need to qualify and route leads once they arrive?",
      ],
      commonObjections: [
        {
          objection: "We are worried AI responses will feel off-brand.",
          response:
            "That risk is manageable when rollout starts with narrow, high-volume use cases and clear takeover rules.",
        },
        {
          objection: "The team wants to stay hands-on with leads.",
          response:
            "AI is not removing the team. It is covering first response and qualification so humans can step in sooner on the right conversations.",
        },
      ],
      idealSignals: [
        "Slow first response times.",
        "After-hours demand or repeated inbound questions.",
        "Lead qualification volume is stretching the team.",
      ],
    },
    verticalTuning: {
      "Home Services": {
        valueProps: [
          "Give homeowners a fast first answer for service requests even when the office is closed.",
        ],
        discoveryQuestions: [
          "Which job types or emergency inquiries need a fast response even outside office hours?",
        ],
        idealSignals: [
          "Missed calls or after-hours demand still create lost bookings.",
        ],
      },
      Retail: {
        valueProps: [
          "Handle common product, stock, and delivery questions without making shoppers wait for a rep.",
        ],
        discoveryQuestions: [
          "Which buyer questions repeat often enough that AI could safely handle the first pass?",
        ],
        commonObjections: [
          {
            objection: "Furniture and product conversations are too nuanced for AI.",
            response:
              "Keep AI on the first-pass qualification and FAQ layer, then route nuanced product consults to the showroom team.",
          },
        ],
      },
    },
  },
} satisfies Record<ProductFeature, ProductCatalogEntry>;

export function isCatalogFeature(value: string): value is ProductFeature {
  return PRODUCT_FEATURES.includes(value as ProductFeature);
}

export function resolveOrganizationVertical(
  value?: string | null,
): OrganizationVertical | undefined {
  return ORGANIZATION_VERTICALS.find((vertical) => vertical === value);
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupeObjections(values: ProductPlaybookObjection[]) {
  const seen = new Set<string>();

  return values.filter((item) => {
    if (seen.has(item.objection)) {
      return false;
    }

    seen.add(item.objection);
    return true;
  });
}

export function getProductPlaybook(
  feature: ProductFeature,
  vertical?: string | null,
): ProductPlaybook {
  const entry = PRODUCT_CATALOG[feature];
  const resolvedVertical = resolveOrganizationVertical(vertical);
  const tuning: ProductPlaybookTuning | undefined = resolvedVertical
    ? entry.verticalTuning?.[resolvedVertical]
    : undefined;

  if (!tuning) {
    return entry.playbook;
  }

  return {
    valueProps: dedupeStrings([
      ...entry.playbook.valueProps,
      ...(tuning.valueProps ?? []),
    ]),
    discoveryQuestions: dedupeStrings([
      ...entry.playbook.discoveryQuestions,
      ...(tuning.discoveryQuestions ?? []),
    ]),
    commonObjections: dedupeObjections([
      ...entry.playbook.commonObjections,
      ...(tuning.commonObjections ?? []),
    ]),
    idealSignals: dedupeStrings([
      ...entry.playbook.idealSignals,
      ...(tuning.idealSignals ?? []),
    ]),
  };
}

export function getCatalogContext(
  features: ProductFeature[] = [...PRODUCT_FEATURES],
  options?: { vertical?: string | null; includePlaybooks?: boolean },
) {
  const resolvedVertical = resolveOrganizationVertical(options?.vertical);

  return features
    .map((feature) => {
      const entry = PRODUCT_CATALOG[feature];
      const lines = [
        `${entry.feature}: ${entry.summary}`,
        `Pitch template: ${entry.pitchTemplate}`,
      ];

      if (options?.includePlaybooks) {
        const playbook = getProductPlaybook(feature, resolvedVertical);
        lines.push(`Value props: ${playbook.valueProps.join("; ")}`);
        lines.push(
          `Discovery questions: ${playbook.discoveryQuestions.join("; ")}`,
        );
        lines.push(
          `Common objections: ${playbook.commonObjections
            .map(
              (item) => `${item.objection} -> ${item.response}`,
            )
            .join("; ")}`,
        );
        lines.push(`Ideal signals: ${playbook.idealSignals.join("; ")}`);

        if (resolvedVertical) {
          lines.push(`Vertical tuning applied: ${resolvedVertical}`);
        }
      }

      return lines.join("\n");
    })
    .join("\n\n");
}
