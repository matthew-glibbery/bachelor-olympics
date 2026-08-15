"use client";

import { useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";

import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setBootVideo } from "@/lib/data/mutations";
import { uploadVideo } from "@/lib/supabase/storage";

/** Groom-only upload for the shared N64 boot-screen video (docs/VISUAL_SPEC.md). */
export function BootVideoUploader({ currentUrl }: { currentUrl: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const client = getSupabaseBrowserClient();
      const url = await uploadVideo(client, "app", "boot", file);
      await setBootVideo(client, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm">
        <Upload className="size-4" />
        {currentUrl ? "Replace boot video" : "Upload boot video"}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleUpload}
          disabled={busy}
        />
      </Label>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
