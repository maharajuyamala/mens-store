"use client";

import { ImageIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminMediaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Media
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          New product images are uploaded to ImageKit under the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            products/
          </code>{" "}
          folder. Manage them from the{" "}
          <a
            href="https://imagekit.io/dashboard/media-library"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            ImageKit dashboard
          </a>
          .
        </p>
      </div>
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Image library</CardTitle>
          </div>
          <CardDescription>
            Uploads go direct from the browser to ImageKit via a short-lived
            signed token minted by the admin-only{" "}
            <code className="text-xs">/api/imagekit/auth</code> route.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Legacy product photos still served from Firebase Storage remain
            readable (whitelisted in <code className="text-xs">next.config</code>);
            re-uploading a product will replace its URLs with ImageKit ones.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
