"use client";

import { CheckIcon } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import {
  DeliverableTypeSchema,
  type Confidence,
  type ParseResult,
} from "@coursecal/syllabus-parser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NullableField } from "./nullable-field";

// Confidence is the model's own assessment (§8.3) — shown, not edited.
const CONFIDENCE_VARIANT: Record<Confidence, "success" | "warning" | "destructive"> = {
  high: "success",
  medium: "warning",
  low: "destructive",
};

export function DeliverableRow({ index }: { index: number }) {
  const { register, control, watch, setValue, formState } = useFormContext<ParseResult>();

  const confidence = watch(`deliverables.${index}.confidence`);
  const ambiguity = watch(`deliverables.${index}.ambiguity_reason`);
  const recurrence = watch(`deliverables.${index}.recurrence`);
  const titleError = formState.errors.deliverables?.[index]?.title;

  // Confirm a flagged item — a human review clears the model's uncertainty, so
  // mark it high-confidence and drop the reason. Carries into the saved semester
  // (the confidence field is part of the ParseResult the form submits).
  function markResolved() {
    setValue(`deliverables.${index}.confidence`, "high");
    setValue(`deliverables.${index}.ambiguity_reason`, null);
  }

  return (
    <li className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={CONFIDENCE_VARIANT[confidence]} className="capitalize">
            {confidence} confidence
          </Badge>
          {confidence !== "high" ? (
            <Button type="button" size="sm" variant="outline" onClick={markResolved}>
              <CheckIcon className="size-4" />
              Looks good
            </Button>
          ) : null}
        </div>
        {recurrence ? (
          <span className="text-xs text-muted-foreground">
            Recurring · every {recurrence.interval} {recurrence.unit}
            {recurrence.interval > 1 ? "s" : ""} until{" "}
            {recurrence.end_date ?? `${recurrence.count} occurrences`}
          </span>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`title-${index}`}>Title</Label>
        <Input id={`title-${index}`} {...register(`deliverables.${index}.title`)} />
        {titleError ? (
          <p className="text-xs text-destructive">{titleError.message}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Controller
            control={control}
            name={`deliverables.${index}.type`}
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                <SelectTrigger className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DeliverableTypeSchema.options.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <NullableField
          name={`deliverables.${index}.weight_percent`}
          id={`weight-${index}`}
          label="Weight %"
          type="number"
          numeric
        />
      </div>

      {recurrence ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <NullableField
            name={`deliverables.${index}.due_date`}
            id={`date-${index}`}
            label="Due date"
            type="date"
          />
          <NullableField
            name={`deliverables.${index}.due_time`}
            id={`time-${index}`}
            label="Due time"
            type="time"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${index}`}>Notes</Label>
        <Controller
          control={control}
          name={`deliverables.${index}.notes`}
          render={({ field }) => (
            <Textarea
              id={`notes-${index}`}
              className="min-h-16"
              value={field.value ?? ""}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
            />
          )}
        />
      </div>

      {ambiguity ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Why flagged:</span> {ambiguity}
        </p>
      ) : null}
    </li>
  );
}
