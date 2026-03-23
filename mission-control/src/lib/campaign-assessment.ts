// ─── Campaign Assessment Engine ─────────────────────────────────────────────
// Rule-based, deterministic. No LLM calls. Pure function.
// Benchmarks from Orchestrator system prompt.

export interface CampaignStats {
  total_leads: number;
  sent: number;
  opened: number;
  open_rate: number;
  replied: number;
  reply_rate: number;
  accepts: number;
  accept_rate: number;
  bounces: number;
  bounce_rate: number;
}

export interface RecentReply {
  leadName: string;
  company: string;
  text: string;
  createdAt: string;
}

export type AlertLevel = "info" | "warning" | "critical";

export interface CampaignAssessment {
  assessment: string;
  recommendations: string[];
  alert_level: AlertLevel;
}

// ─── Thresholds ─────────────────────────────────────────────────────────────

type Rating = "good" | "medium" | "bad";

function rateAccept(rate: number): Rating {
  if (rate >= 30) return "good";
  if (rate >= 15) return "medium";
  return "bad";
}

function rateReply(rate: number): Rating {
  if (rate >= 10) return "good";
  if (rate >= 5) return "medium";
  return "bad";
}

function rateOpen(rate: number): Rating {
  if (rate >= 40) return "good";
  if (rate >= 20) return "medium";
  return "bad";
}

function rateBounce(rate: number): Rating {
  if (rate <= 5) return "good";
  if (rate <= 10) return "medium";
  return "bad";
}

// ─── Assessment Builder ─────────────────────────────────────────────────────

export function assessCampaign(
  stats: CampaignStats,
  recentReplies: RecentReply[] = [],
): CampaignAssessment {
  const observations: string[] = [];
  const recommendations: string[] = [];
  let hasCritical = false;
  let hasWarning = false;

  const acceptRating = rateAccept(stats.accept_rate);
  const replyRating = rateReply(stats.reply_rate);
  const openRating = rateOpen(stats.open_rate);
  const bounceRating = rateBounce(stats.bounce_rate);

  // ─── Individual metric assessments ──────────────────────────────────────

  // Accept rate
  if (acceptRating === "good") {
    observations.push(`Die Akzeptanzrate liegt bei ${stats.accept_rate}% — das ist ein starker Wert.`);
  } else if (acceptRating === "medium") {
    observations.push(`Die Akzeptanzrate liegt bei ${stats.accept_rate}%. Da ist noch Luft nach oben.`);
    recommendations.push("Connection-Request ueberarbeiten: Personalisierung und Hook schaerfen.");
    hasWarning = true;
  } else {
    observations.push(`Die Akzeptanzrate liegt nur bei ${stats.accept_rate}% — das ist unter dem Benchmark.`);
    recommendations.push("Connection-Request dringend ueberarbeiten. Unter 15% deutet auf einen schwachen Hook oder falsche Zielgruppe hin.");
    hasCritical = true;
  }

  // Reply rate
  if (replyRating === "good") {
    observations.push(`${stats.reply_rate}% Antwortrate zeigt, dass die Nachrichten ankommen.`);
  } else if (replyRating === "medium") {
    observations.push(`Die Antwortrate von ${stats.reply_rate}% ist okay, aber ausbaufaehig.`);
    recommendations.push("Follow-up Nachricht variieren. Anderen CTA testen.");
    hasWarning = true;
  } else if (stats.sent > 20) {
    observations.push(`Nur ${stats.reply_rate}% Antwortrate. Die Nachrichten erzeugen zu wenig Resonanz.`);
    recommendations.push("Nachricht nach dem Connect komplett ueberarbeiten. Weniger Pitch, mehr Relevanz.");
    hasCritical = true;
  }

  // Open rate (email)
  if (stats.opened > 0 || stats.sent > 0) {
    if (openRating === "good") {
      observations.push(`Oeffnungsrate ${stats.open_rate}% — die Betreffzeilen funktionieren.`);
    } else if (openRating === "medium") {
      hasWarning = true;
    } else if (stats.sent > 20) {
      recommendations.push("Betreffzeilen testen. Unter 20% Oeffnungsrate verliert man die meisten Leads schon vor dem Inhalt.");
      hasCritical = true;
    }
  }

  // Bounce rate
  if (bounceRating === "bad") {
    observations.push(`Bounce-Rate bei ${stats.bounce_rate}% — Datenqualitaet pruefen.`);
    recommendations.push("Hohe Bounce-Rate. Betroffene Adressen entfernen und Datenquelle ueberpruefen.");
    hasCritical = true;
  } else if (bounceRating === "medium") {
    recommendations.push("Bounce-Rate bei " + stats.bounce_rate + "%. Adressen stichprobenartig pruefen.");
    hasWarning = true;
  }

  // ─── Cross-pattern detection ────────────────────────────────────────────

  // Good connects but no replies
  if (stats.accept_rate > 25 && stats.reply_rate < 5 && stats.sent > 20) {
    observations.push("Connects laufen gut, aber es kommen keine Antworten. Die Nachricht nach dem Connect koennte staerker sein.");
    if (!recommendations.includes("Nachricht nach dem Connect komplett ueberarbeiten. Weniger Pitch, mehr Relevanz.")) {
      recommendations.push("CTA in der Follow-up Nachricht ueberarbeiten. Der Hook zieht, aber die Konvertierung fehlt.");
    }
    hasWarning = true;
  }

  // Good opens but no replies (email)
  if (stats.open_rate > 50 && stats.reply_rate < 5 && stats.sent > 20) {
    observations.push("Emails werden geoeffnet, aber nicht beantwortet. Der Inhalt ueberzeugt noch nicht.");
    recommendations.push("Email-Copy testen. Kuerzere Nachrichten, klarerer Mehrwert, anderer CTA.");
    hasWarning = true;
  }

  // ─── Unanswered replies ─────────────────────────────────────────────────

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const staleReplies = recentReplies.filter(
    (r) => r.createdAt && new Date(r.createdAt).getTime() < oneDayAgo,
  );

  if (staleReplies.length > 0) {
    observations.push(
      `${staleReplies.length} ${staleReplies.length === 1 ? "Reply wartet" : "Replies warten"} seit ueber 24 Stunden auf Antwort.`,
    );
    recommendations.push(`Offene Replies beantworten — ${staleReplies.length} ${staleReplies.length === 1 ? "Nachricht" : "Nachrichten"} ausstehend.`);
    hasWarning = true;
  }

  // ─── Sample size caveat ─────────────────────────────────────────────────

  if (stats.sent < 20) {
    observations.push("Noch wenige Datenpunkte. Eine belastbare Aussage ist ab ca. 50 Versendungen moeglich.");
  }

  // ─── Compose assessment text ────────────────────────────────────────────

  // Overall health sentence
  let healthSummary: string;
  if (hasCritical) {
    healthSummary = "Die Kampagne braucht Aufmerksamkeit.";
  } else if (hasWarning) {
    healthSummary = "Die Kampagne laeuft, hat aber Optimierungspotenzial.";
  } else if (stats.sent < 20) {
    healthSummary = "Die Kampagne ist noch in der Anlaufphase.";
  } else {
    healthSummary = "Die Kampagne laeuft solide.";
  }

  const assessment = [healthSummary, "", ...observations].join("\n").trim();

  // ─── Alert level ────────────────────────────────────────────────────────

  let alert_level: AlertLevel = "info";
  if (hasCritical && stats.sent > 50) {
    alert_level = "critical";
  } else if (hasWarning || hasCritical) {
    alert_level = "warning";
  }

  // Cap recommendations at 5, most severe first (order preserved from rules)
  return {
    assessment,
    recommendations: recommendations.slice(0, 5),
    alert_level,
  };
}
