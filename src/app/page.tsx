import { Medal } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { MedalTable } from "@/components/medal-table";
import { DEMO_PLAYERS, DEMO_SCORE_LINES } from "@/lib/demo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Bachelor Olympics</h1>
        <p className="text-muted-foreground text-sm">
          Eight events. Eight competitors. One medal table.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="text-chart-3 size-5" />
            Medal Table
          </CardTitle>
          <CardDescription>
            Live standings — raw event points and multiplier-adjusted totals.
            {" "}
            <span className="italic">Demo data, pending the live data layer.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MedalTable players={DEMO_PLAYERS} scoreLines={DEMO_SCORE_LINES} />
        </CardContent>
      </Card>
    </main>
  );
}
