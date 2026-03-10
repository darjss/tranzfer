import { createForm } from "@tanstack/solid-form";
import { For, Show, createSignal } from "solid-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { type PaidPlanKey } from "@/lib/billing/plans";
import {
  authSharedFields,
  getAuthHeading,
  getAuthSchema,
  getAuthSubmitErrorMessage,
  getAuthSubmitLabel,
  getAuthSubtitle,
  getFieldErrorMessage,
  type AuthFormValues,
  type AuthMode,
} from "@/lib/forms/auth-form";

type AuthFormProps = {
  mode: AuthMode;
  nextPath: string;
  plan: PaidPlanKey | null;
};

export default function AuthForm(props: AuthFormProps) {
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  const form = createForm(() => ({
    defaultValues: {
      email: "",
      name: "",
      password: "",
    } satisfies AuthFormValues,
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        if (props.mode === "sign-up") {
          const result = await authClient.signUp.email({
            email: value.email.trim(),
            name: value.name.trim(),
            password: value.password,
          });

          if (result.error) {
            throw new Error(result.error.message || "Could not create your account.");
          }
        } else {
          const result = await authClient.signIn.email({
            email: value.email.trim(),
            password: value.password,
          });

          if (result.error) {
            throw new Error(result.error.message || "Could not sign you in.");
          }
        }

        if (props.plan) {
          const checkout = await authClient.checkout({
            slug: props.plan,
          });

          if (checkout.error) {
            throw new Error(checkout.error.message || "Could not start checkout.");
          }

          const url = checkout.data?.url;

          if (!url) {
            throw new Error("Polar checkout did not return a redirect URL.");
          }

          window.location.assign(url);
          return;
        }

        window.location.assign(props.nextPath || "/account/billing");
      } catch (error) {
        setSubmitError(getAuthSubmitErrorMessage(error, props.mode));
      }
    },
    validators: {
      onBlur: getAuthSchema(props.mode),
      onSubmit: getAuthSchema(props.mode),
    },
  }));

  return (
    <div class="rounded-[2rem] border border-zinc-200 bg-white/92 p-6 shadow-[0_28px_75px_-42px_rgba(24,24,27,0.22)] sm:p-8">
      <div class="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">
        {props.mode === "sign-up" ? "Sign up" : "Sign in"}
      </div>
      <h1 class="mt-4 text-3xl font-semibold tracking-[-0.05em] text-zinc-950 sm:text-4xl">
        {getAuthHeading(props.mode)}
      </h1>
      <p class="mt-4 max-w-xl text-base leading-relaxed text-zinc-600">
        {getAuthSubtitle(props.mode, props.plan)}
      </p>

      <form
        class="mt-8 grid gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <Show when={props.mode === "sign-up"}>
          <form.Field name="name">
            {(field) => (
              <label class="grid gap-2">
                <span class="text-sm font-medium text-zinc-800">Name</span>
                <Input
                  autocomplete="name"
                  minlength={1}
                  onBlur={field().handleBlur}
                  onInput={(event) => {
                    setSubmitError(null);
                    field().handleChange(event.currentTarget.value);
                  }}
                  placeholder="North Pier"
                  required
                  value={field().state.value}
                />
                <Show
                  when={
                    field().state.meta.isTouched &&
                    getFieldErrorMessage(field().state.meta.errors)
                  }
                >
                  <div class="text-sm text-red-700">
                    {getFieldErrorMessage(field().state.meta.errors)}
                  </div>
                </Show>
              </label>
            )}
          </form.Field>
        </Show>

        <For each={authSharedFields}>
          {(fieldConfig) => (
            <form.Field name={fieldConfig.name}>
              {(field) => (
                <label class="grid gap-2">
                  <span class="text-sm font-medium text-zinc-800">{fieldConfig.label}</span>
                  <Input
                    autocomplete={
                      fieldConfig.name === "password" && props.mode === "sign-up"
                        ? "new-password"
                        : fieldConfig.autoComplete
                    }
                    minlength={fieldConfig.minlength}
                    onBlur={field().handleBlur}
                    onInput={(event) => {
                      setSubmitError(null);
                      field().handleChange(event.currentTarget.value);
                    }}
                    placeholder={fieldConfig.placeholder}
                    required
                    type={fieldConfig.type}
                    value={field().state.value}
                  />
                  <Show
                    when={
                      field().state.meta.isTouched &&
                      getFieldErrorMessage(field().state.meta.errors)
                    }
                  >
                    <div class="text-sm text-red-700">
                      {getFieldErrorMessage(field().state.meta.errors)}
                    </div>
                  </Show>
                </label>
              )}
            </form.Field>
          )}
        </For>

        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {(state) => (
            <Button
              class="mt-2 rounded-2xl"
              disabled={!state().canSubmit || state().isSubmitting}
              type="submit"
            >
              {getAuthSubmitLabel(props.mode, state().isSubmitting, props.plan)}
            </Button>
          )}
        </form.Subscribe>

        <Show when={submitError()}>
          <div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError()}
          </div>
        </Show>
      </form>
    </div>
  );
}
