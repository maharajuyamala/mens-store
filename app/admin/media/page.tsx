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
          Product images live in Firebase Storage under{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            products/
          </code>
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
            List objects from the Storage bucket, replace assets, or wire a
            picker for the product editor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only admin users can upload or delete files in{" "}
            <code className="text-xs">products/</code> per your storage rules.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
