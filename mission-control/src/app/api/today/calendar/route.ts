import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

const CALENDAR_ACCOUNT = "rene@lassmalmachen.work";

// AppleScript that reads today's events from a specific calendar account.
// macOS Calendar syncs Google Calendars automatically.
function buildScript(): string {
  return `
set today to current date
set time of today to 0
set tomorrow to today + (1 * days)
set output to ""

tell application "Calendar"
  set matchedCals to {}

  -- Find calendars belonging to the target account
  repeat with c in calendars
    try
      set acctName to name of account of c
      if acctName contains "${CALENDAR_ACCOUNT}" then
        set end of matchedCals to c
      end if
    end try
  end repeat

  -- If no matching account found, use all calendars as fallback
  if (count of matchedCals) = 0 then
    set matchedCals to every calendar
  end if

  repeat with cal in matchedCals
    set dayEvents to (every event of cal whose start date >= today and start date < tomorrow)
    repeat with evt in dayEvents
      set evtTitle to summary of evt
      set evtStart to start date of evt
      set evtEnd to end date of evt
      set evtLoc to ""
      try
        set evtLoc to location of evt
      end try
      if evtLoc is missing value then set evtLoc to ""

      set h1 to text -2 thru -1 of ("0" & (hours of evtStart as text))
      set m1 to text -2 thru -1 of ("0" & (minutes of evtStart as text))
      set h2 to text -2 thru -1 of ("0" & (hours of evtEnd as text))
      set m2 to text -2 thru -1 of ("0" & (minutes of evtEnd as text))

      set output to output & h1 & ":" & m1 & "|" & h2 & ":" & m2 & "|" & evtTitle & "|" & evtLoc & "|||"
    end repeat
  end repeat
end tell

return output
`.trim();
}

export async function GET() {
  try {
    const raw = execSync(`osascript -e '${buildScript().replace(/'/g, "'\\''")}'`, {
      encoding: "utf-8",
      timeout: 10000,
    }).trim();

    if (!raw) {
      return NextResponse.json({ events: [], calendar: CALENDAR_ACCOUNT });
    }

    const events = raw
      .split("|||")
      .filter(Boolean)
      .map((entry) => {
        const [start, end, title, location] = entry.split("|");
        return { title: title ?? "", start: start ?? "", end: end ?? "", location: location ?? "" };
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    return NextResponse.json(
      { events, calendar: CALENDAR_ACCOUNT },
      { headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" } }
    );
  } catch (err) {
    return NextResponse.json({
      events: [],
      calendar: CALENDAR_ACCOUNT,
      error: err instanceof Error ? err.message : "Calendar fetch failed",
    });
  }
}
