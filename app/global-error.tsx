"use client";

import { ErrorPanel } from "@/components/linc/error-panel";

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <ErrorPanel error={error} retry={retry} fullPage />
      </body>
    </html>
  );
}
