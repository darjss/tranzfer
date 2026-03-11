import * as v from "valibot";
import { type PaidPlanKey } from "@/lib/billing/plans";

export type AuthMode = "sign-in" | "sign-up";

export const emailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty("Email is required."),
  v.email("Enter a valid email address."),
);

export const passwordSchema = v.pipe(
  v.string(),
  v.minLength(8, "Password must be at least 8 characters."),
);

export const signInSchema = v.object({
  email: emailSchema,
  name: v.string(),
  password: passwordSchema,
});

export const signUpSchema = v.object({
  email: emailSchema,
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("Name is required."),
    v.maxLength(80, "Name must be 80 characters or less."),
  ),
  password: passwordSchema,
});

export type AuthFormValues = v.InferOutput<typeof signUpSchema>;

export const authSharedFields = [
  {
    autoComplete: "email",
    label: "Email",
    minlength: undefined,
    name: "email",
    placeholder: "you@studio.com",
    type: "email",
  },
  {
    autoComplete: "current-password",
    label: "Password",
    minlength: 8,
    name: "password",
    placeholder: "At least 8 characters",
    type: "password",
  },
] as const satisfies ReadonlyArray<{
  autoComplete: string;
  label: string;
  minlength: number | undefined;
  name: "email" | "password";
  placeholder: string;
  type: "email" | "password";
}>;

export function getAuthSchema(mode: AuthMode) {
  return mode === "sign-up" ? signUpSchema : signInSchema;
}

export function getAuthHeading(mode: AuthMode) {
  return mode === "sign-up" ? "Create your Tranzfer account" : "Sign back in";
}

export function getAuthSubtitle(mode: AuthMode, plan: PaidPlanKey | null) {
  if (plan === "pro") {
    return "Google is the fastest path. If you prefer, create an account with email and continue into Pro after auth.";
  }

  return mode === "sign-up"
    ? "Start sending large files with a free account, then upgrade only when your transfer sizes outgrow it."
    : "Open your transfers, billing, and recent delivery history.";
}

export function getAuthSubmitLabel(
  mode: AuthMode,
  isSubmitting: boolean,
  plan: PaidPlanKey | null,
) {
  if (isSubmitting) {
    return plan ? "Opening Pro..." : "Working...";
  }

  return mode === "sign-up" ? "Create account" : "Sign in";
}

export function getAuthSubmitErrorMessage(error: unknown, mode: AuthMode) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return mode === "sign-up"
    ? "Could not create your account."
    : "Authentication failed.";
}

export function getFieldErrorMessage(errors: readonly unknown[]) {
  const firstError = errors[0];

  if (!firstError) {
    return null;
  }

  if (typeof firstError === "string") {
    return firstError;
  }

  if (
    typeof firstError === "object" &&
    firstError !== null &&
    "message" in firstError &&
    typeof firstError.message === "string"
  ) {
    return firstError.message;
  }

  return "Enter a valid value.";
}
