import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useRef } from 'react';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@markr/ui/alert';
import { Button } from '@markr/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@markr/ui/card';

import { importResults } from '../api';

const uploadFormSchema = z.object({
  file: z.custom<File>(
    (value) => typeof File !== 'undefined' && value instanceof File,
    'Select an XML file to import',
  ),
});

export const Route = createFileRoute('/')({
  component: UploadPage,
});

function UploadPage() {
  const queryClient = useQueryClient();
  const formElementRef = useRef<HTMLFormElement>(null);
  const resetFormAfterImportRef = useRef<() => void>(() => {});

  const importMutation = useMutation({
    mutationFn: async (file: File) => importResults(await file.text()),
    onSuccess: () => {
      resetFormAfterImportRef.current();
      void queryClient.invalidateQueries({ queryKey: ['tests'] });
      void queryClient.invalidateQueries({ queryKey: ['test-results'] });
    },
  });

  const form = useForm({
    defaultValues: {
      file: null as File | null,
    },
    validators: {
      onSubmit: uploadFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (!value.file) {
        return;
      }
      try {
        await importMutation.mutateAsync(value.file);
      } catch {
        // React Query stores mutation errors for the alert below.
      }
    },
  });

  resetFormAfterImportRef.current = () => {
    form.reset();
    formElementRef.current?.reset();
  };

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
            ref={formElementRef}
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              event.stopPropagation();
              await form.handleSubmit();
            }}
          >
            <form.Field name="file">
              {(field) => (
                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-foreground"
                    htmlFor={field.name}
                  >
                    XML file
                  </label>
                  <input
                    id={field.name}
                    accept=".xml,text/xml"
                    className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    name={field.name}
                    type="file"
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(
                        event.currentTarget.files?.[0] ?? null,
                      );
                      importMutation.reset();
                    }}
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <p className="text-sm text-destructive">
                      {field.state.meta.errors.map(getErrorMessage).join(', ')}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <Button type="submit" disabled={importMutation.isPending}>
              {importMutation.isPending ? 'Uploading' : 'Upload'}
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

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Invalid value';
}

function ImportSuccessAlert({ imported }: { imported: number }) {
  const noun = imported === 1 ? 'record' : 'records';

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
        {error instanceof Error ? error.message : 'Import failed'}
      </AlertDescription>
    </Alert>
  );
}
