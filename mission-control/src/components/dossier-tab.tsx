"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import {
  Building2,
  ExternalLink,
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dossier } from "@/lib/types";

// ─── DossierDetail ─────────────────────────────────────────────────────────────

function FieldBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

interface DossierCardProps {
  dossier: Dossier;
}

function DossierCard({ dossier }: DossierCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center justify-between w-full text-left gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <CardTitle className="text-sm font-semibold truncate">{dossier.companyName}</CardTitle>
            {dossier.pdfPath && (
              <Badge variant="outline" className="text-xs gap-1 flex-shrink-0">
                <FileText className="h-3 w-3" />
                PDF
              </Badge>
            )}
          </div>
          <div className="flex-shrink-0 text-muted-foreground">
            {expanded
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />
            }
          </div>
        </button>
        {dossier.hook && !expanded && (
          <p className="text-xs text-muted-foreground mt-1 ml-6 line-clamp-1">{dossier.hook}</p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          <div className="h-px bg-border" />

          <FieldBlock label="Herkunft" value={dossier.herkunft} />
          <FieldBlock label="Status Quo" value={dossier.statusQuo} />
          <FieldBlock label="Ansatzpunkte" value={dossier.ansatzpunkte} />

          {dossier.hook && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Hook</p>
              <p className="text-sm leading-relaxed">{dossier.hook}</p>
            </div>
          )}

          {dossier.pdfPath && (
            <a
              href={`/data/projects/${dossier.id}/${dossier.pdfPath}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Dossier-PDF öffnen
            </a>
          )}

          <p className="text-xs text-muted-foreground/50">
            Erstellt: {new Date(dossier.createdAt).toLocaleDateString("de-DE")}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// ─── DossierTab ────────────────────────────────────────────────────────────────

interface DossierTabProps {
  projectId: string;
}

export function DossierTab({ projectId }: DossierTabProps) {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/dossiers`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json() as { dossiers: Dossier[] };
      setDossiers(data.dossiers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Dossiers werden geladen…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={load}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (dossiers.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center space-y-2">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Noch keine Dossiers für dieses Projekt.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Dossiers werden durch den Dossier-Agent generiert und in{" "}
            <code className={cn("font-mono bg-muted px-1 rounded")}>
              data/projects/{projectId}/dossiers.json
            </code>{" "}
            gespeichert.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {dossiers.length} Dossier{dossiers.length !== 1 ? "s" : ""}
      </p>
      {dossiers.map((d) => (
        <DossierCard key={d.id} dossier={d} />
      ))}
    </div>
  );
}
