import { Trophy, Flame, Sliders } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <Badge variant="secondary" className="gap-1.5">
        <Flame className="size-3" />
        Setup check
      </Badge>
      <h1 className="text-3xl font-semibold tracking-tight">Bachelor Olympics</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Project scaffold is wired up: Tailwind v4, shadcn/ui primitives, tweakcn-ready
        theme tokens, and lucide-react icons. Replace this page with the real event
        board, multiplier sliders, and medal table.
      </p>
      <Card className="w-full text-left">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-primary" />
            Example card
          </CardTitle>
          <CardDescription>
            Confirms the primary color, radius, and shadow tokens are flowing
            through from globals.css.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Sliders className="size-3.5" />
            Multiplier sliders go here
          </span>
          <Button size="sm">Looks right</Button>
        </CardContent>
      </Card>
    </main>
  );
}
