"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task, Project } from "@/lib/types";

// ─── Pipeline Definitions ──────────────────────────────────────────────────────

interface PipelineStepDef {
  step: number;
  label: string;
  agent: string;
  description: string;
  tool?: string;
}

const PIPELINE_TYP_A: PipelineStepDef[] = [
  {
    step: 1,
    label: "ICP definieren",
    agent: "pm-agent",
    description: "Ideal Customer Profile und Hook-Strategie definieren. 8 Dimensionen, Scoring-Modell.",
    tool: "icp-builder",
  },
  {
    step: 2,
    label: "Lead Sourcing",
    agent: "research-agent",
    description: "Firmen recherchieren, Lead-Liste aufbauen (50–200 Unternehmen aus Zielsegment).",
    tool: "Web-Recherche",
  },
  {
    step: 3,
    label: "Dossiers & Hooks",
    agent: "dossier-agent",
    description: "Company Dossiers erstellen, individuelle Hooks recherchieren. PDF-Export.",
    tool: "shop_audit.py + generate_dossier_pdf.py",
  },
  {
    step: 4,
    label: "Kontakte finden",
    agent: "contact-agent",
    description: "Ansprechpartner identifizieren und LinkedIn-URLs anreichern (Ziel: 45–55% Trefferquote).",
    tool: "linkedin-enrichment",
  },
  {
    step: 5,
    label: "Outreach schreiben",
    agent: "outreach-agent",
    description: "Personalisierte LinkedIn-Nachrichten nach Renes Schreibstil. Connection Request + 2 Follow-ups.",
    tool: "rene-writing-style",
  },
  {
    step: 6,
    label: "Lemlist Kampagne",
    agent: "campaign-agent",
    description: "CSV-Import, Kampagnen-Setup in Lemlist. Freigabe durch Rene, dann Versand starten.",
    tool: "dossier_to_lemlist.py + Lemlist API",
  },
];

const PIPELINE_TYP_B: PipelineStepDef[] = [
  {
    step: 1,
    label: "Discovery & Analyse",
    agent: "research-agent",
    description: "Ist-Zustand analysieren, bestehende Prozesse erfassen, Anforderungen ermitteln.",
  },
  {
    step: 2,
    label: "CRM-Strategie",
    agent: "pm-agent",
    description: "Strategie und Architektur definieren. Pipeline-Stufen, Properties, Automatisierungen planen.",
  },
  {
    step: 3,
    label: "HubSpot Setup",
    agent: "coding-agent",
    description: "Pipeline, Properties, Workflows und Integrationen in HubSpot einrichten.",
  },
  {
    step: 4,
    label: "Daten-Migration",
    agent: "coding-agent",
    description: "Bestehende Kontakte und Deals importieren, bereinigen und validieren.",
  },
  {
    step: 5,
    label: "Prozesse konfigurieren",
    agent: "pm-agent",
    description: "Sales-Prozesse, E-Mail-Sequenzen und Automatisierungen einrichten und testen.",
  },
  {
    step: 6,
    label: "Go-Live & Training",
    agent: "me",
    description: "Abnahme mit dem Kunden, Training durchführen, Dokumentation übergeben.",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

type StepStatus = "done" | "active" | "pending";

function getPipelineType(project: Project): "typ-a" | "typ-b" | null {
  const tags = project.tags ?? [];
  if (tags.includes("typ-a")) return "typ-a";
  if (tags.includes("typ-b")) return "typ-b";
  return null;
}

function getCurrentStep(project: Project): number {
  const tags = project.tags ?? [];
  const tag = tags.find((t) => t.startsWith("current-step:"));
  if (tag) {
    const n = parseInt(tag.split(":")[1], 10);
    if (!isNaN(n) && n >= 1 && n <= 6) return n;
  }
  return 1;
}

function getStepTasks(tasks: Task[], step: number): Task[] {
  return tasks.filter((t) => (t.tags ?? []).includes(`step-${step}`));
}

function computeStepStatus(step: number, currentStep: number, stepTasks: Task[]): StepStatus {
  if (stepTasks.length > 0) {
    const allDone = stepTasks.every((t) => t.kanban === "done");
    if (allDone) return "done";
    const anyActive = stepTasks.some((t) => t.kanban === "in-progress");
    if (anyActive) return "active";
    return step <= currentStep ? "active" : "pending";
  }
  if (step < currentStep) return "done";
  if (step === currentStep) return "active";
  return "pending";
}

// ─── Step Circle ──────────────────────────────────────────────────────────────

function StepCircle({ step, status }: { step: number; status: StepStatus }) {
  if (status === "done") {
    return (
      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-sm">
        <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="h-10 w-10 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-sm">
        <span className="text-sm font-bold text-primary">{step}</span>
      </div>
    );
  }
  return (
    <div className="h-10 w-10 rounded-full bg-muted border border-border flex items-center justify-center">
      <span className="text-sm font-medium text-muted-foreground">{step}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface WatPipelineTrackerProps {
  project: Project;
  tasks: Task[];
  onSetCurrentStep: (step: number) => Promise<void>;
  onSetPipelineType?: (type: "typ-a" | "typ-b") => Promise<void>;
}

export function WatPipelineTracker({ project, tasks, onSetCurrentStep, onSetPipelineType }: WatPipelineTrackerProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [settingType, setSettingType] = useState(false);

  const pipelineType = getPipelineType(project);
  const currentStep = getCurrentStep(project);
  const steps = pipelineType === "typ-b" ? PIPELINE_TYP_B : PIPELINE_TYP_A;
  const typeLabel = pipelineType === "typ-b" ? "Typ B — CRM Implementation" : "Typ A — Sales Outbound";

  function handleStepClick(step: number) {
    setExpandedStep((prev) => (prev === step ? null : step));
  }

  async function handleSetActive(step: number) {
    await onSetCurrentStep(step);
    setExpandedStep(null);
  }

  async function handleSetType(type: "typ-a" | "typ-b") {
    if (!onSetPipelineType) return;
    setSettingType(true);
    try {
      await onSetPipelineType(type);
    } finally {
      setSettingType(false);
    }
  }

  if (!pipelineType) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center space-y-3">
          <p className="text-sm font-medium">Pipeline-Typ nicht konfiguriert</p>
          {onSetPipelineType ? (
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={settingType}
                onClick={() => handleSetType("typ-a")}
                className="gap-1.5"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                Typ A — Sales Outbound
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={settingType}
                onClick={() => handleSetType("typ-b")}
                className="gap-1.5"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                Typ B — CRM Implementation
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Füge <code className="bg-muted px-1 rounded">typ-a</code> oder{" "}
              <code className="bg-muted px-1 rounded">typ-b</code> zu den Projekt-Tags hinzu.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">WAT Pipeline</span>
        <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
        {onSetPipelineType && (
          <button
            onClick={() => handleSetType(pipelineType === "typ-a" ? "typ-b" : "typ-a")}
            disabled={settingType}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 disabled:opacity-50"
          >
            Wechseln zu {pipelineType === "typ-a" ? "Typ B" : "Typ A"}
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">Step {currentStep} / 6 aktiv</span>
      </div>

      {/* Step Tracker — horizontal */}
      <div className="relative flex">
        {/* Connector line behind circles */}
        <div
          className="absolute h-px bg-border"
          style={{ top: "20px", left: "calc(100% / 12)", right: "calc(100% / 12)" }}
        />

        {steps.map((stepDef) => {
          const stepTasks = getStepTasks(tasks, stepDef.step);
          const status = computeStepStatus(stepDef.step, currentStep, stepTasks);
          const isExpanded = expandedStep === stepDef.step;
          const doneTasks = stepTasks.filter((t) => t.kanban === "done").length;

          return (
            <button
              key={stepDef.step}
              onClick={() => handleStepClick(stepDef.step)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg transition-colors",
                "hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                isExpanded && "bg-accent/50"
              )}
              title={stepDef.description}
            >
              {/* Circle (sits above the connector line via relative z-10) */}
              <div className="relative z-10">
                <StepCircle step={stepDef.step} status={status} />
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-[10px] font-medium text-center leading-tight max-w-[70px]",
                  status === "done" && "text-primary",
                  status === "active" && "text-foreground font-semibold",
                  status === "pending" && "text-muted-foreground"
                )}
              >
                {stepDef.label}
              </span>

              {/* Task count — only if tasks are tagged */}
              {stepTasks.length > 0 && (
                <Badge
                  variant={status === "done" ? "default" : "secondary"}
                  className="text-[9px] h-4 px-1"
                >
                  {doneTasks}/{stepTasks.length}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail panel for expanded step */}
      {expandedStep !== null && (() => {
        const stepDef = steps.find((s) => s.step === expandedStep)!;
        const stepTasks = getStepTasks(tasks, expandedStep);
        const status = computeStepStatus(expandedStep, currentStep, stepTasks);
        const isCurrentStep = expandedStep === currentStep;

        const statusLabel =
          status === "done" ? "Done" : status === "active" ? "Active" : "Pending";
        const statusClass =
          status === "done"
            ? "border-primary/20 bg-primary/[0.02]"
            : status === "active"
            ? "border-primary/40 bg-primary/[0.04]"
            : "border-border";

        return (
          <Card className={cn("border transition-colors", statusClass)}>
            <CardContent className="p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">Step {stepDef.step}</span>
                    <Badge
                      variant={status === "done" ? "default" : "outline"}
                      className="text-[10px] px-1.5"
                    >
                      {statusLabel}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-semibold">{stepDef.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{stepDef.description}</p>
                </div>

                {!isCurrentStep && status !== "done" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs shrink-0"
                    onClick={() => handleSetActive(expandedStep)}
                  >
                    Als aktiv markieren
                  </Button>
                )}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                <span>
                  Agent:{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-medium">
                    {stepDef.agent}
                  </code>
                </span>
                {stepDef.tool && (
                  <span>
                    Tool:{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-medium">
                      {stepDef.tool}
                    </code>
                  </span>
                )}
              </div>

              {/* Tasks for this step */}
              {stepTasks.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Verknüpfte Aufgaben
                  </span>
                  {stepTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 text-xs rounded-md px-2.5 py-1.5 bg-muted/50"
                    >
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          task.kanban === "done" && "bg-emerald-500",
                          task.kanban === "in-progress" && "bg-primary animate-pulse",
                          task.kanban === "not-started" && "bg-muted-foreground/40"
                        )}
                      />
                      <span
                        className={cn(
                          "flex-1 truncate",
                          task.kanban === "done" && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                        {task.kanban === "done"
                          ? "done"
                          : task.kanban === "in-progress"
                          ? "active"
                          : "todo"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {stepTasks.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Keine Aufgaben verknüpft. Aufgaben mit Tag{" "}
                  <code className="bg-muted px-1 rounded">step-{expandedStep}</code> versehen, um sie hier anzuzeigen.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
