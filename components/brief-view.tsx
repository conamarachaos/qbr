"use client";

import { useMemo } from "react";
import { Download, ExternalLink } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brief, Gap, Goal, Opportunity, UsageItem } from "@/lib/schemas";

interface BriefViewProps {
  brief: Brief;
  goals: Goal[];
  usage: UsageItem[];
  gaps: Gap[];
  opportunities: Opportunity[];
  sourceMap: Record<string, { label: string; content: string; type: string }>;
  usageTotals: { totalTokens: number; inputTokens: number; outputTokens: number };
  onDownload: () => Promise<void>;
  downloadPending: boolean;
}

function confidenceVariant(confidence: number) {
  if (confidence >= 0.8) {
    return "default" as const;
  }
  if (confidence >= 0.6) {
    return "secondary" as const;
  }
  return "destructive" as const;
}

function EvidenceList({
  evidence,
  sourceMap,
}: {
  evidence: Array<{ sourceId: string; sourceType: string; quote: string }>;
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

function ClaimSection<T extends { id: string; evidence: Array<{ sourceId: string; sourceType: string; quote: string }> }>(
  props: {
    title: string;
    description: string;
    items: T[];
    renderHeader: (item: T) => React.ReactNode;
    sourceMap: Record<string, { label: string; content: string; type: string }>;
  },
) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {props.items.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger>{props.renderHeader(item)}</AccordionTrigger>
              <AccordionContent>
                <EvidenceList evidence={item.evidence} sourceMap={props.sourceMap} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export function BriefView(props: BriefViewProps) {
  const topGaps = useMemo(
    () =>
      props.brief.topGaps
        .map((gapId) => props.gaps.find((gap) => gap.id === gapId))
        .filter(Boolean) as Gap[],
    [props.brief.topGaps, props.gaps],
  );

  const topOpportunities = useMemo(
    () =>
      props.brief.topOpportunities
        .map((id) => props.opportunities.find((opportunity) => opportunity.id === id))
        .filter(Boolean) as Opportunity[],
    [props.brief.topOpportunities, props.opportunities],
  );

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-card/95 backdrop-blur">
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between md:space-y-0">
          <div className="space-y-3">
            <Badge variant={confidenceVariant(props.brief.overallConfidence)}>
              overall confidence {Math.round(props.brief.overallConfidence * 100)}%
            </Badge>
            <CardTitle className="text-2xl">{props.brief.accountName}</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7 text-foreground/80">
              {props.brief.summary}
            </CardDescription>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="text-sm text-muted-foreground">
              {props.usageTotals.totalTokens.toLocaleString()} total tokens
            </div>
            <Button onClick={props.onDownload} disabled={props.downloadPending}>
              <Download className="h-4 w-4" />
              {props.downloadPending ? "Preparing deck..." : "Download PPTX"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 3 adoption gaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topGaps.map((gap) => (
              <div key={gap.id} className="rounded-3xl bg-muted/60 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{gap.feature}</Badge>
                  <Badge variant={confidenceVariant(gap.confidence)}>
                    {Math.round(gap.confidence * 100)}% confidence
                  </Badge>
                </div>
                <p className="text-sm font-medium">{gap.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  severity {gap.severity}/5
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 3 upsell opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topOpportunities.map((opportunity) => (
              <div key={opportunity.id} className="rounded-3xl bg-muted/60 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{opportunity.feature}</Badge>
                  <Badge variant={confidenceVariant(opportunity.confidence)}>
                    {Math.round(opportunity.confidence * 100)}% confidence
                  </Badge>
                </div>
                <p className="text-sm font-medium">{opportunity.pitch}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {opportunity.expectedImpact} · score {opportunity.score.toFixed(2)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>QBR outline</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Object.entries(props.brief.qbrOutline).map(([section, bullets]) => (
            <div key={section} className="rounded-3xl bg-muted/60 p-4">
              <h3 className="font-semibold capitalize">{section}</h3>
              <ul className="mt-3 space-y-2 text-sm text-foreground/85">
                {bullets.map((bullet) => (
                  <li key={bullet} className="leading-6">
                    {bullet}
                  </li>
                ))}
              </ul>
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
            description="Each goal is backed by an exact source quote."
            items={props.goals}
            sourceMap={props.sourceMap}
            renderHeader={(goal) => (
              <div className="flex w-full items-center justify-between gap-4">
                <div className="space-y-1 text-left">
                  <div className="font-medium">{goal.title}</div>
                  <div className="text-xs text-muted-foreground">{goal.description}</div>
                </div>
                <Badge variant={confidenceVariant(goal.confidence)}>
                  {Math.round(goal.confidence * 100)}%
                </Badge>
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
              <div className="flex w-full items-center justify-between gap-4">
                <div className="space-y-1 text-left">
                  <div className="font-medium">{item.goalId}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.status} · {item.notes}
                  </div>
                </div>
                <Badge variant={confidenceVariant(item.confidence)}>
                  {Math.round(item.confidence * 100)}%
                </Badge>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="gaps">
          <ClaimSection
            title="Top gaps"
            description="Every gap references a specific goal and catalog feature."
            items={props.gaps}
            sourceMap={props.sourceMap}
            renderHeader={(gap) => (
              <div className="flex w-full items-center justify-between gap-4">
                <div className="space-y-1 text-left">
                  <div className="font-medium">
                    {gap.feature} · {gap.reason}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    goal {gap.goalId} · severity {gap.severity}/5
                  </div>
                </div>
                <Badge variant={confidenceVariant(gap.confidence)}>
                  {Math.round(gap.confidence * 100)}%
                </Badge>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="opportunities">
          <ClaimSection
            title="Expansion opportunities"
            description="Each opportunity is grounded in a detected gap and catalog feature."
            items={props.opportunities}
            sourceMap={props.sourceMap}
            renderHeader={(opportunity) => (
              <div className="flex w-full items-center justify-between gap-4">
                <div className="space-y-1 text-left">
                  <div className="font-medium">{opportunity.pitch}</div>
                  <div className="text-xs text-muted-foreground">
                    {opportunity.feature} · gap {opportunity.gapId} · impact {opportunity.expectedImpact}
                  </div>
                </div>
                <Badge variant={confidenceVariant(opportunity.confidence)}>
                  {Math.round(opportunity.confidence * 100)}%
                </Badge>
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
                    <a
                      href={`#${sourceId}`}
                      className="inline-flex items-center gap-1 text-xs text-primary"
                    >
                      ref {sourceId}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <pre
                    id={sourceId}
                    className="whitespace-pre-wrap break-words rounded-3xl bg-muted/60 p-4 text-xs leading-6 text-foreground/85"
                  >
                    {source.content.slice(0, 1800)}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
