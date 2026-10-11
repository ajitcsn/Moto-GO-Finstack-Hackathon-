import { z } from "zod";
import type { FieldSpec, RuleSpec, StepSpec } from "@/api/types";

const PATTERNS: Record<string, [RegExp, string]> = {
  tel: [/^[6-9][0-9]{9}$/, "Enter a 10-digit Indian mobile number starting with 6-9"],
  pan: [/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN must look like ABCDE1234F"],
  ifsc: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC must look like ABCD0123456"],
  pincode: [/^[0-9]{6}$/, "Pincode must be 6 digits"],
  account: [/^[0-9]{9,18}$/, "Account number must be 9-18 digits"],
};

export const isVisible = (f: FieldSpec, values: Record<string, unknown>) => !f.show_if || values[f.show_if.field] === f.show_if.equals;
export const isMasked = (v: unknown) => typeof v === "string" && v.includes("•");

function fieldSchema(f: FieldSpec): z.ZodTypeAny {
  const req = `${f.label.replace(/\s*\(.*\)$/, "")} is required`;
  switch (f.type) {
    case "checkbox":
      return f.required ? z.literal(true, { errorMap: () => ({ message: "This must be ticked to continue" }) }) : z.boolean().optional();
    case "money":
    case "number": {
      const n = z.coerce.number({ invalid_type_error: "Enter a number" }).int("Whole numbers only").min(f.min ?? 0, `At least ${f.min ?? 0}`);
      const capped = f.max != null ? n.max(f.max, `At most ${f.max}`) : n;
      return f.required ? z.preprocess((v) => (v === "" || v == null ? undefined : v), capped.or(z.undefined()).refine((v) => v !== undefined, req))
        : z.preprocess((v) => (v === "" || v == null ? undefined : v), capped.optional());
    }
    case "date":
      return f.required ? z.string({ required_error: req }).regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date") : z.string().optional();
    default: {
      const pat = PATTERNS[f.type];
      let s = z.string({ required_error: req }).trim();
      if (pat) s = s.regex(pat[0], pat[1]);
      if (f.min && !pat) s = s.min(f.min, `At least ${f.min} characters`);
      if (f.max && !pat) s = s.max(f.max, `At most ${f.max} characters`);
      return f.required ? s.min(1, req) : s.optional().or(z.literal(""));
    }
  }
}

export const ageOn = (iso: string) => {
  const d = new Date(iso), t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
};

/** Build the client schema from the same field spec the server validates against. */
export function zodFromSpec(spec: Pick<StepSpec, "fields" | "rules">) {
  return z.object({}).passthrough().superRefine((vals, ctx) => {
    for (const f of spec.fields) {
      if (!isVisible(f, vals) || isMasked(vals[f.name])) continue;
      const parsed = fieldSchema(f).safeParse(vals[f.name]);
      if (!parsed.success) ctx.addIssue({ code: "custom", path: [f.name], message: parsed.error.issues[0].message });
      else if (f.options && f.required && vals[f.name] != null && !f.options.some((o) => o.value === String(vals[f.name])))
        ctx.addIssue({ code: "custom", path: [f.name], message: "Choose one of the listed options" });
    }
    for (const r of spec.rules) applyRule(r, vals, ctx);
  });
}

function applyRule(r: RuleSpec, v: Record<string, unknown>, ctx: z.RefinementCtx) {
  if (r.type === "sum_equals" && r.fields && r.target) {
    const [a, b, t] = [Number(v[r.fields[0]]), Number(v[r.fields[1]]), Number(v[r.target])];
    if ([a, b, t].every((x) => Number.isFinite(x)) && t > 0 && Math.abs(a + b - t) > t * (r.tolerance ?? 0))
      ctx.addIssue({ code: "custom", path: [r.fields[0]], message: r.message });
  }
  if (r.type === "age_range" && r.field && typeof v[r.field] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v[r.field] as string)) {
    const age = ageOn(v[r.field] as string);
    if (age < (r.min ?? 0) || age > (r.max ?? 200)) ctx.addIssue({ code: "custom", path: [r.field], message: r.message });
  }
}

export function cleanValues(spec: StepSpec, values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of spec.fields) {
    if (!isVisible(f, values)) continue;
    const v = values[f.name];
    if (v === "" || v === undefined) continue;
    out[f.name] = f.type === "pan" || f.type === "ifsc" ? String(v).toUpperCase() : v;
  }
  return out;
}
