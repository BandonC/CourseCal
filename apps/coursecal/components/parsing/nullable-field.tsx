"use client";

import { Controller, useFormContext, type FieldPath } from "react-hook-form";
import type { ParseResult } from "@coursecal/syllabus-parser";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Nullable scalar field bound to a controlled input. The library schema types
// fields like due_date/weight_percent/code as `string | number | null`, and an
// empty input must round-trip to `null` (not ""), which "" would fail validation
// for. Controlled (not register) so a null default renders as an empty input.
export function NullableField({
  name,
  label,
  id,
  type = "text",
  numeric = false,
}: {
  name: FieldPath<ParseResult>;
  label: string;
  id: string;
  type?: string;
  numeric?: boolean;
}) {
  const { control } = useFormContext<ParseResult>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{label}</Label>
          <Input
            id={id}
            type={type}
            value={field.value == null ? "" : String(field.value)}
            onBlur={field.onBlur}
            onChange={(e) => {
              const raw = e.target.value;
              field.onChange(raw === "" ? null : numeric ? Number(raw) : raw);
            }}
          />
          {fieldState.error ? (
            <p className="text-xs text-destructive">{fieldState.error.message}</p>
          ) : null}
        </div>
      )}
    />
  );
}
