"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Upload,
  Users,
  Linkedin,
  Mail,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { useProjects } from "@/hooks/use-data";
import type { Lead, LinkedinStatus, DossierStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useLeads(projectId: string) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/leads`);
      if (!res.ok) throw new Error("Failed to load leads");
      const json = await res.json();
      setLeads(json.leads ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial load
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const importCsv = useCallback(
    async (csvText: string) => {
      const res = await fetch(`/api/projects/${projectId}/leads?action=import-csv`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: csvText,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Import failed");
      }
      const result = await res.json();
      await fetchLeads();
      return result as { imported: number; skippedRows: number[] };
    },
    [projectId, fetchLeads]
  );

  const deleteLead = useCallback(
    async (leadId: string) => {
      const res = await fetch(`/api/projects/${projectId}/leads?leadId=${leadId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
    },
    [projectId]
  );

  return { leads, loading, error, fetchLeads, importCsv, deleteLead };
}

// ─── Status Indicators ────────────────────────────────────────────────────────

function LinkedinStatusBadge({ status, url }: { status: LinkedinStatus; url: string }) {
  if (status === "found" && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        <Linkedin className="h-3.5 w-3.5" />
        Gefunden
      </a>
    );
  }
  if (status === "not-found") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <XCircle className="h-3.5 w-3.5 text-destructive/60" />
        Nicht gefunden
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5 text-amber-500" />
      Ausstehend
    </span>
  );
}

function DossierStatusBadge({ status }: { status: DossierStatus }) {
  if (status === "done") {
    return (
      <Badge variant="outline" className="text-xs gap-1 border-green-500/40 text-green-600">
        <CheckCircle2 className="h-3 w-3" />
        Fertig
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="outline" className="text-xs gap-1 border-amber-500/40 text-amber-600">
        <Loader2 className="h-3 w-3" />
        In Arbeit
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
      <AlertCircle className="h-3 w-3" />
      Kein Dossier
    </Badge>
  );
}

// ─── CSV Import Dialog ────────────────────────────────────────────────────────

function CsvImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (csv: string) => Promise<{ imported: number; skippedRows: number[] }>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skippedRows: number[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    setImportError(null);
    try {
      const text = await file.text();
      const res = await onImport(text);
      setResult(res);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import fehlgeschlagen");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleClose() {
    setResult(null);
    setImportError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>CSV importieren</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            CSV muss eine <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">email</code> Spalte enthalten.
            Optionale Spalten:{" "}
            <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
              firstName, lastName, company, linkedinUrl
            </code>
          </p>

          {!result && !importError && (
            <label
              className={cn(
                "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer",
                "hover:bg-accent hover:border-primary/40 transition-colors"
              )}
            >
              <Upload className={cn("h-8 w-8 text-muted-foreground", importing && "animate-bounce")} />
              <span className="text-sm font-medium">
                {importing ? "Importiere…" : "CSV-Datei auswählen"}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleFile}
                disabled={importing}
              />
            </label>
          )}

          {result && (
            <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-4 space-y-1">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Import erfolgreich
              </p>
              <p className="text-sm text-green-600 dark:text-green-500">
                {result.imported} Lead{result.imported !== 1 ? "s" : ""} importiert
              </p>
              {result.skippedRows.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {result.skippedRows.length} Zeile(n) übersprungen (fehlende E-Mail)
                </p>
              )}
            </div>
          )}

          {importError && (
            <div className="rounded-lg border bg-destructive/5 border-destructive/20 p-4">
              <p className="text-sm font-medium text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Fehler
              </p>
              <p className="text-sm text-muted-foreground mt-1">{importError}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? "Schließen" : "Abbrechen"}
          </Button>
          {result && (
            <Button
              onClick={() => {
                setResult(null);
                setImportError(null);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Weitere importieren
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectLeadsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { projects } = useProjects();
  const { leads, loading, error, importCsv, deleteLead } = useLeads(projectId);
  const [showImport, setShowImport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const project = projects.find((p) => p.id === projectId);

  const stats = {
    total: leads.length,
    linkedinFound: leads.filter((l) => l.linkedinStatus === "found").length,
    withEmail: leads.filter((l) => l.email).length,
    dossierDone: leads.filter((l) => l.dossierStatus === "done").length,
  };

  return (
    <div className="space-y-4">
      <BreadcrumbNav
        items={[
          { label: "Missions", href: "/projects" },
          { label: project?.name ?? projectId, href: `/projects/${projectId}` },
          { label: "Leads" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {project && (
            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: project.color }} />
          )}
          <h1 className="text-xl font-bold">Leads & Kontakte</h1>
          <Badge variant="secondary">{stats.total}</Badge>
        </div>
        <Button size="sm" onClick={() => setShowImport(true)} className="gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          CSV importieren
        </Button>
      </div>

      {/* Stats */}
      {leads.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold tabular-nums">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Leads gesamt</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Linkedin className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-lg font-bold tabular-nums">{stats.linkedinFound}</p>
                <p className="text-xs text-muted-foreground">LinkedIn gefunden</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold tabular-nums">{stats.withEmail}</p>
                <p className="text-xs text-muted-foreground">Mit E-Mail</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-lg font-bold tabular-nums">{stats.dossierDone}</p>
                <p className="text-xs text-muted-foreground">Dossiers fertig</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="border-destructive/20">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : leads.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <Users className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">Noch keine Leads für dieses Projekt.</p>
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              CSV importieren
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  Firma
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  LinkedIn
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  E-Mail
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  Dossier
                </th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, idx) => (
                <tr
                  key={lead.id}
                  className={cn(
                    "border-b last:border-0 hover:bg-muted/20 transition-colors",
                    idx % 2 === 0 ? "bg-background" : "bg-muted/5"
                  )}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">
                      {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">
                      {lead.company || <span className="italic">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <LinkedinStatusBadge status={lead.linkedinStatus} url={lead.linkedinUrl} />
                  </td>
                  <td className="px-4 py-3">
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-muted-foreground hover:text-foreground hover:underline truncate max-w-[180px] block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DossierStatusBadge status={lead.dossierStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setConfirmDeleteId(lead.id)}
                      className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                      title="Lead entfernen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={importCsv}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Lead entfernen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Dieser Lead wird aus der Liste entfernt. Die Aktion kann nicht rückgängig gemacht werden.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (confirmDeleteId) {
                  await deleteLead(confirmDeleteId);
                  setConfirmDeleteId(null);
                }
              }}
            >
              Entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
