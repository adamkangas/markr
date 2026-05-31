import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@markr/ui/alert";
import { Button } from "@markr/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@markr/ui/card";

import { importResults } from "../api";

export const Route = createFileRoute("/")({
  component: UploadPage,
});

function UploadPage() {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const importMutation = useMutation({
    mutationFn: async (file: File) => importResults(await file.text()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tests"] });
      void queryClient.invalidateQueries({ queryKey: ["test-results"] });
    },
  });
  const imported = importMutation.data?.imported;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="font-heading text-4xl font-semibold tracking-normal text-foreground">
          Upload exam results
        </h1>
      </header>

      <Card className="max-w-2xl rounded-md">
        <CardHeader>
          <CardTitle>Import XML</CardTitle>
          <CardDescription>
            Select a Markr results export to add its records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();

              if (!selectedFile) {
                setFileError("Select an XML file to import");
                return;
              }

              try {
                await importMutation.mutateAsync(selectedFile);
              } catch {
                // TanStack Query stores the error for rendering below.
              }
            }}
          >
            <div className="space-y-2">
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="file"
              >
                XML file
              </label>
              <input
                id="file"
                accept=".xml,text/xml"
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                name="file"
                type="file"
                onChange={(event) => {
                  setSelectedFile(event.currentTarget.files?.[0] ?? null);
                  setFileError("");
                  importMutation.reset();
                }}
              />
              {fileError ? (
                <p className="text-sm text-destructive">{fileError}</p>
              ) : null}
            </div>

            <Button type="submit" disabled={importMutation.isPending}>
              {importMutation.isPending ? "Uploading" : "Upload"}
            </Button>

            {imported !== undefined && (
              <ImportSuccessAlert imported={imported} />
            )}

            {importMutation.error && (
              <ImportErrorAlert error={importMutation.error} />
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function ImportSuccessAlert({ imported }: { imported: number }) {
  const noun = imported === 1 ? "record" : "records";

  return (
    <Alert role="status" variant="success">
      <AlertTitle>Import complete</AlertTitle>
      <AlertDescription>
        {imported} {noun} imported
      </AlertDescription>
    </Alert>
  );
}

function ImportErrorAlert({ error }: { error: unknown }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Import failed</AlertTitle>
      <AlertDescription>
        {error instanceof Error ? error.message : "Import failed"}
      </AlertDescription>
    </Alert>
  );
}
