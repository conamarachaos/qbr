"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, FileText } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createEditableBrief, type EditableBrief } from "@/lib/brief-export";
import { getProductPlaybook } from "@/lib/catalog";
import { buildIntegrationBriefPayload } from "@/lib/integrations/shared";
import { formatEstimatedUsd, estimateStageCostsUsd } from "@/lib/pricing";
import { Brief, Gap, Goal, Opportunity, UsageItem } from "@/lib/schemas";

interface BriefViewProps {
  brief: Brief;
  goals: Goal[];
  usage: UsageItem[];
  gaps: Gap[];
  opportunities: Opportunity[];
  sourceMap: Record<string, { label: string; content: string; type: string }>;
  accountVertical?: string;
  usageTotals: { totalTokens: number; inputTokens: number; outputTokens: number };
  stages: Array<{
    id: string;
    label: string;
    attempts: number;
    modelId: string;
    usage: { totalTokens: number; inputTokens: number; outputTokens: number };
  }>;
  onDownload: (format: "pptx" | "pdf", editedBrief: EditableBrief) => Promise<void>;
  downloadFormat: "pptx" | "pdf" | null;
}

type ClaimEvidence = Array<{ sourceId: string; sourceType: string; quote: string }>;

function confidenceVariant(confidence: number) {
  if (confidence >= 0.8) {
    return "default" as const;
  }
  if (confidence >= 0.6) {
    return "secondary" as const;
  }
  return "destructive" as const;
}

function isLowConfidence(confidence: number) {
  return confidence < 0.5;
}

function ConfidenceBadges({ confidence }: { confidence: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={confidenceVariant(confidence)}>
        {Math.round(confidence * 100)}% confidence
      </Badge>
      {isLowConfidence(confidence) ? (
        <Badge variant="destructive">low confidence</Badge>
      ) : null}
    </div>
  );
}

function OpportunityPlaybook({
  feature,
  vertical,
}: {
  feature: Opportunity["feature"];
  vertical?: string;
}) {
  const playbook = getProductPlaybook(feature, vertical);
  const topObjection = playbook.commonObjections[0];

  return (
    <Accordion type="single" collapsible className="mt-3 w-full">
      <AccordionItem value={`${feature}-playbook`} className="rounded-2xl border border-border/60 px-4">
        <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
          Playbook
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pb-4">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Value props
            </div>
            <ul className="space-y-2 text-sm leading-6 text-foreground/85">
              {playbook.valueProps.map((valueProp) => (
                <li key={valueProp}>- {valueProp}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Discovery questions
            </div>
            <ul className="space-y-2 text-sm leading-6 text-foreground/85">
              {playbook.discoveryQuestions.slice(0, 3).map((question) => (
                <li key={question}>- {question}</li>
              ))}
            </ul>
          </div>

          {topObjection ? (
            <div className="rounded-2xl bg-background/80 p-3 text-sm leading-6">
              <div className="font-medium">Top objection</div>
              <p className="mt-1 text-foreground/85">{topObjection.objection}</p>
              <div className="mt-3 font-medium">Response</div>
              <p className="mt-1 text-foreground/85">{topObjection.response}</p>
            </div>
          ) : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function EvidenceList({
  evidence,
  sourceMap,
}: {
  evidence: ClaimEvidence;
  sourceMap: Record<string, { label: string; content: string; type: string }>;
}) {
  return (
    <div className="space-y-3">
      {evidence.map((item, index) => {
        const source = sourceMap[item.sourceId];
        return (
          <div key={`${item.sourceId}-${index}`} className="rounded-3xl bg-muted/60 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{item.sourceType}</Badge>
              <span className="text-xs font-medium text-muted-foreground">
                {source?.label || item.sourceId}
              </span>
            </div>
            <p className="text-sm leading-6 text-foreground/90">{item.quote}</p>
          </div>
        );
      })}
    </div>
  );
}

function ClaimSection<
  T extends {
    id: string;
    evidence: ClaimEvidence;
    confidence: number;
  },
>({
  title,
  description,
  items,
  renderHeader,
  sourceMap,
}: {
  title: string;
  description: string;
  items: T[];
  renderHeader: (item: T) => ReactNode;
  sourceMap: Record<string, { label: string; content: string; type: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {items.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-center justify-between gap-4 pr-4">
                  {renderHeader(item)}
                  <div className="shrink-0">
                    <ConfidenceBadges confidence={item.confidence} />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <EvidenceList evidence={item.evidence} sourceMap={sourceMap} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function CitationExpander({
  value,
  evidence,
  sourceMap,
}: {
  value: string;
  evidence: ClaimEvidence;
  sourceMap: Record<string, { label: string; content: string; type: string }>;
}) {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={value} className="border-b-0">
        <AccordionTrigger className="py-2 text-xs font-medium text-primary hover:no-underline">
          View citations
        </AccordionTrigger>
        <AccordionContent className="pt-2">
          <EvidenceList evidence={evidence} sourceMap={sourceMap} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function BriefView(props: BriefViewProps) {
  const baseEditableBrief = useMemo(
    () => createEditableBrief(props.brief, props.gaps, props.opportunities),
    [props.brief, props.gaps, props.opportunities],
  );
  const [editedBrief, setEditedBrief] = useState<EditableBrief>(baseEditableBrief);
  const [crmStatus, setCrmStatus] = useState<{
    state: "idle" | "loading" | "success" | "error";
    id?: string;
    url?: string;
    message?: string;
  }>({ state: "idle" });
  const [slackStatus, setSlackStatus] = useState<{
    state: "idle" | "loading" | "success" | "error";
    preview?: string;
    message?: string;
    ts?: string;
  }>({ state: "idle" });

  useEffect(() => {
    setEditedBrief(baseEditableBrief);
  }, [baseEditableBrief]);

  useEffect(() => {
    setCrmStatus({ state: "idle" });
    setSlackStatus({ state: "idle" });
  }, [props.brief.accountName]);

  const edited = JSON.stringify(editedBrief) !== JSON.stringify(baseEditableBrief);
  const stageCosts = useMemo(() => estimateStageCostsUsd(props.stages), [props.stages]);

  const topGaps = useMemo(
    () =>
      editedBrief.topGaps.map((item) => ({
        ...item,
        gap: props.gaps.find((gap) => gap.id === item.id),
      })),
    [editedBrief.topGaps, props.gaps],
  );

  const topOpportunities = useMemo(
    () =>
      editedBrief.topOpportunities.map((item) => ({
        ...item,
        opportunity: props.opportunities.find((opportunity) => opportunity.id === item.id),
      })),
    [editedBrief.topOpportunities, props.opportunities],
  );

  const integrationPayload = useMemo(
    () =>
      buildIntegrationBriefPayload({
        brief: props.brief,
        editedBrief,
        gaps: props.gaps,
        opportunities: props.opportunities,
        vertical: props.accountVertical,
      }),
    [editedBrief, props.accountVertical, props.brief, props.gaps, props.opportunities],
  );

  async function pushToCrm() {
    setCrmStatus({ state: "loading" });

    try {
      const response = await fetch("/api/integrations/crm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(integrationPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to push brief to CRM.");
      }

      setCrmStatus({
        state: "success",
        id: data.id,
        url: data.url,
      });
    } catch (error) {
      setCrmStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Failed to push brief to CRM.",
      });
    }
  }

  async function sendToSlack() {
    setSlackStatus({ state: "loading" });

    try {
      const response = await fetch("/api/integrations/slack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(integrationPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to send brief to Slack.");
      }

      setSlackStatus({
        state: "success",
        preview: data.preview,
        ts: data.ts,
      });
    } catch (error) {
      setSlackStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Failed to send brief to Slack.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-card/95 backdrop-blur">
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between md:space-y-0">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={confidenceVariant(props.brief.overallConfidence)}>
                overall confidence {Math.round(props.brief.overallConfidence * 100)}%
              </Badge>
              {edited ? (
                <Badge variant="outline" className="text-muted-foreground">
                  edited
                </Badge>
              ) : null}
            </div>
            <CardTitle className="text-2xl">{props.brief.accountName}</CardTitle>
            <Textarea
              value={editedBrief.summary}
              onChange={(event) =>
                setEditedBrief((current) => ({ ...current, summary: event.target.value }))
              }
              className="min-h-[120px] max-w-3xl text-base leading-7"
            />
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="text-right text-sm text-muted-foreground">
              <div>{props.usageTotals.totalTokens.toLocaleString()} total tokens</div>
              <div>{formatEstimatedUsd(stageCosts.totalUsd)} estimated cost</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={pushToCrm}
                disabled={crmStatus.state === "loading" || slackStatus.state === "loading"}
              >
                {crmStatus.state === "loading" ? "Pushing to CRM..." : "Push to CRM (mock)"}
              </Button>
              <Button
                variant="outline"
                onClick={sendToSlack}
                disabled={crmStatus.state === "loading" || slackStatus.state === "loading"}
              >
                {slackStatus.state === "loading"
                  ? "Sending to Slack..."
                  : "Send to Slack (mock)"}
              </Button>
              <Button
                variant="outline"
                onClick={() => props.onDownload("pdf", editedBrief)}
                disabled={props.downloadFormat !== null}
              >
                <FileText className="h-4 w-4" />
                {props.downloadFormat === "pdf" ? "Preparing PDF..." : "Download PDF"}
              </Button>
              <Button
                onClick={() => props.onDownload("pptx", editedBrief)}
                disabled={props.downloadFormat !== null}
              >
                <Download className="h-4 w-4" />
                {props.downloadFormat === "pptx" ? "Preparing deck..." : "Download PPTX"}
              </Button>
            </div>
            {crmStatus.state === "success" ? (
              <div className="max-w-sm rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
                Mock CRM saved as <span className="font-medium">{crmStatus.id}</span>.
                {" "}
                <a
                  href={crmStatus.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Open record
                </a>
              </div>
            ) : null}
            {crmStatus.state === "error" ? (
              <div className="max-w-sm rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {crmStatus.message}
              </div>
            ) : null}
            {slackStatus.state === "success" ? (
              <div className="max-w-sm rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-left text-sm">
                <div className="font-medium">Slack preview</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  ts {slackStatus.ts}
                </div>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-foreground/85">
                  {slackStatus.preview}
                </pre>
              </div>
            ) : null}
            {slackStatus.state === "error" ? (
              <div className="max-w-sm rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {slackStatus.message}
              </div>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-lg">Run usage</CardTitle>
          <CardDescription>
            Estimated from per-stage model ids and token counts returned by the pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl bg-muted/60 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Input
              </div>
              <div className="mt-2 text-lg font-semibold">
                {props.usageTotals.inputTokens.toLocaleString()}
              </div>
            </div>
            <div className="rounded-3xl bg-muted/60 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Output
              </div>
              <div className="mt-2 text-lg font-semibold">
                {props.usageTotals.outputTokens.toLocaleString()}
              </div>
            </div>
            <div className="rounded-3xl bg-muted/60 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Estimated USD
              </div>
              <div className="mt-2 text-lg font-semibold">
                {formatEstimatedUsd(stageCosts.totalUsd)}
              </div>
            </div>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="stage-costs">
              <AccordionTrigger className="hover:no-underline">
                Per-stage breakdown
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {stageCosts.breakdown.map((stage) => (
                    <div
                      key={stage.id}
                      className="rounded-3xl border border-border/70 bg-background/80 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{stage.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {stage.modelId} · {stage.usage.totalTokens.toLocaleString()} tokens
                          </div>
                        </div>
                        <Badge variant="outline">{formatEstimatedUsd(stage.estimatedUsd)}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                        <div>Input: {stage.usage.inputTokens.toLocaleString()} tokens</div>
                        <div>Output: {stage.usage.outputTokens.toLocaleString()} tokens</div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 3 adoption gaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topGaps.map(({ id, title, description, gap }, index) =>
              gap ? (
                <div key={id} className="rounded-3xl bg-muted/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{gap.feature}</Badge>
                    <ConfidenceBadges confidence={gap.confidence} />
                  </div>
                  <Input
                    value={title}
                    onChange={(event) =>
                      setEditedBrief((current) => ({
                        ...current,
                        topGaps: current.topGaps.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <Textarea
                    value={description}
                    onChange={(event) =>
                      setEditedBrief((current) => ({
                        ...current,
                        topGaps: current.topGaps.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, description: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    className="mt-3 min-h-[104px]"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    severity {gap.severity}/5
                  </p>
                  <CitationExpander
                    value={`gap-${id}`}
                    evidence={gap.evidence}
                    sourceMap={props.sourceMap}
                  />
                </div>
              ) : null,
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 3 upsell opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topOpportunities.map(({ id, title, description, opportunity }, index) =>
              opportunity ? (
                <div key={id} className="rounded-3xl bg-muted/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{opportunity.feature}</Badge>
                    <ConfidenceBadges confidence={opportunity.confidence} />
                  </div>
                  <Input
                    value={title}
                    onChange={(event) =>
                      setEditedBrief((current) => ({
                        ...current,
                        topOpportunities: current.topOpportunities.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <Textarea
                    value={description}
                    onChange={(event) =>
                      setEditedBrief((current) => ({
                        ...current,
                        topOpportunities: current.topOpportunities.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, description: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    className="mt-3 min-h-[104px]"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    score {opportunity.score.toFixed(2)}
                  </p>
                  <OpportunityPlaybook
                    feature={opportunity.feature}
                    vertical={props.accountVertical}
                  />
                  <CitationExpander
                    value={`opportunity-${id}`}
                    evidence={opportunity.evidence}
                    sourceMap={props.sourceMap}
                  />
                </div>
              ) : null,
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>QBR outline</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Object.entries(editedBrief.qbrOutline).map(([section, bullets]) => (
            <div key={section} className="rounded-3xl bg-muted/60 p-4">
              <h3 className="font-semibold capitalize">{section}</h3>
              <div className="mt-3 space-y-2">
                {section === "asks"
                  ? bullets.map((bullet, index) => (
                      <Input
                        key={`${section}-${index}`}
                        value={bullet}
                        onChange={(event) =>
                          setEditedBrief((current) => ({
                            ...current,
                            qbrOutline: {
                              ...current.qbrOutline,
                              asks: current.qbrOutline.asks.map((item, itemIndex) =>
                                itemIndex === index ? event.target.value : item,
                              ),
                            },
                          }))
                        }
                      />
                    ))
                  : bullets.map((bullet, index) => (
                      <div
                        key={`${section}-${index}`}
                        className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm leading-6 text-foreground/85"
                      >
                        {bullet}
                      </div>
                    ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="goals">
        <TabsList>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="gaps">Gaps</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="goals">
          <ClaimSection
            title="Grounded goals"
            description="Click a goal to inspect the exact supporting quote."
            items={props.goals}
            sourceMap={props.sourceMap}
            renderHeader={(goal) => (
              <div className="space-y-1 text-left">
                <div className="font-medium">{goal.title}</div>
                <div className="text-xs text-muted-foreground">{goal.description}</div>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="usage">
          <ClaimSection
            title="Usage vs goals"
            description="Working, partial, and lagging signals tied to each goal."
            items={props.usage.map((item) => ({ ...item, id: item.goalId }))}
            sourceMap={props.sourceMap}
            renderHeader={(item) => (
              <div className="space-y-1 text-left">
                <div className="font-medium">{item.goalId}</div>
                <div className="text-xs text-muted-foreground">
                  {item.status} · {item.notes}
                </div>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="gaps">
          <ClaimSection
            title="Top gaps"
            description="Click any gap to open the supporting citations."
            items={props.gaps}
            sourceMap={props.sourceMap}
            renderHeader={(gap) => (
              <div className="space-y-1 text-left">
                <div className="font-medium">
                  {gap.feature} · {gap.reason}
                </div>
                <div className="text-xs text-muted-foreground">
                  goal {gap.goalId} · severity {gap.severity}/5
                </div>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="opportunities">
          <ClaimSection
            title="Expansion opportunities"
            description="Click any opportunity to inspect the evidence trail."
            items={props.opportunities}
            sourceMap={props.sourceMap}
            renderHeader={(opportunity) => (
              <div className="space-y-1 text-left">
                <div className="font-medium">{opportunity.pitch}</div>
                <div className="text-xs text-muted-foreground">
                  {opportunity.feature} · gap {opportunity.gapId} · impact{" "}
                  {opportunity.expectedImpact}
                </div>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle>Source snippets</CardTitle>
              <CardDescription>
                The pipeline cites these source ids directly. Use them to trace every claim.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(props.sourceMap).map(([sourceId, source]) => (
                <div key={sourceId} className="rounded-3xl border border-border/80 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{source.type}</Badge>
                    <span className="text-sm font-medium">{source.label}</span>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{source.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
