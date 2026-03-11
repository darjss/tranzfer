import { createForm } from "@tanstack/solid-form";
import { For, Show, createSignal } from "solid-js";
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

function getAuthRedirectPath(nextPath: string, plan: PaidPlanKey | null) {
  if (plan === "pro") {
    return `/account/billing?checkout=pro&next=${encodeURIComponent(nextPath)}`;
  }

  return nextPath || "/account/transfers";
}

export default function AuthForm(props: AuthFormProps) {
  const [submitError, setSubmitError] = createSignal<string | null>(null);
  const [isSocialLoading, setIsSocialLoading] = createSignal(false);

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
            callbackURL: getAuthRedirectPath(props.nextPath, props.plan),
            email: value.email.trim(),
            name: value.name.trim(),
            password: value.password,
          });

          if (result.error) {
            throw new Error(result.error.message || "Could not create your account.");
          }
        } else {
          const result = await authClient.signIn.email({
            callbackURL: getAuthRedirectPath(props.nextPath, props.plan),
            email: value.email.trim(),
            password: value.password,
          });

          if (result.error) {
            throw new Error(result.error.message || "Could not sign you in.");
          }
        }

        if (props.plan === "pro") {
          window.location.assign("/account/billing?checkout=pro");
          return;
        }

        window.location.assign(props.nextPath || "/account/transfers");
      } catch (error) {
        setSubmitError(getAuthSubmitErrorMessage(error, props.mode));
      }
    },
    validators: {
      onBlur: getAuthSchema(props.mode),
      onSubmit: getAuthSchema(props.mode),
    },
  }));

  async function handleGoogleAuth() {
    setSubmitError(null);
    setIsSocialLoading(true);

    try {
      const result = await authClient.signIn.social({
        callbackURL: getAuthRedirectPath(props.nextPath, props.plan),
        provider: "google",
      });

      if (result.error) {
        throw new Error(result.error.message || "Could not start Google sign-in.");
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not start Google sign-in.",
      );
      setIsSocialLoading(false);
    }
  }

  return (
    <div class="glass-panel rounded-[2rem] p-8 sm:p-10 relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 bg-electric/10 rounded-full blur-[40px] pointer-events-none"></div>

      <div class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-zinc-500 mb-2">
        {props.mode === "sign-up" ? "System Registration" : "Terminal Access"}
      </div>
      <h1 class="text-3xl font-medium tracking-tight text-white mb-3">
        {getAuthHeading(props.mode)}
      </h1>
      <p class="text-sm leading-relaxed text-zinc-400 mb-8 font-light">
        {getAuthSubtitle(props.mode, props.plan)}
      </p>

      <div class="grid gap-4 mb-8">
        <button
          class="relative w-full rounded-full border border-white/10 bg-white/5 py-4 text-[0.75rem] font-mono uppercase tracking-widest text-zinc-300 transition-all duration-300 hover:bg-white/10 hover:border-white/20 disabled:opacity-50"
          disabled={isSocialLoading()}
          onClick={() => void handleGoogleAuth()}
          type="button"
        >
          {isSocialLoading() ? "AUTHORIZING..." : "CONTINUE WITH GOOGLE"}
        </button>

        <div class="flex items-center gap-4 py-2">
          <div class="h-px flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
          <div class="text-[0.65rem] font-mono uppercase tracking-widest text-zinc-500">OR OVERRIDE</div>
          <div class="h-px flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
        </div>
      </div>

      <form
        class="grid gap-6"
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
                <span class="text-[0.7rem] font-mono uppercase tracking-widest text-zinc-500">Operator Name</span>
                <input
                  autocomplete="name"
                  class="w-full bg-transparent border-b border-white/10 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-electric transition-colors"
                  minlength={1}
                  onBlur={field().handleBlur}
                  onInput={(event) => {
                    setSubmitError(null);
                    field().handleChange(event.currentTarget.value);
                  }}
                  placeholder="Studio North"
                  required
                  value={field().state.value}
                />
                <Show
                  when={
                    field().state.meta.isTouched &&
                    getFieldErrorMessage(field().state.meta.errors)
                  }
                >
                  <div class="text-[0.7rem] font-mono text-red-400 mt-1">
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
                  <span class="text-[0.7rem] font-mono uppercase tracking-widest text-zinc-500">{fieldConfig.label}</span>
                  <input
                    autocomplete={
                      fieldConfig.name === "password" && props.mode === "sign-up"
                        ? "new-password"
                        : fieldConfig.autoComplete
                    }
                    class="w-full bg-transparent border-b border-white/10 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-electric transition-colors"
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
                    <div class="text-[0.7rem] font-mono text-red-400 mt-1">
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
            <button
              class="mt-4 relative w-full rounded-full bg-white py-4 text-[0.8rem] font-bold uppercase tracking-[0.15em] text-zinc-950 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 hover:scale-[1.01] active:scale-95"
              disabled={!state().canSubmit || state().isSubmitting}
              type="submit"
            >
              {getAuthSubmitLabel(props.mode, state().isSubmitting, props.plan).toUpperCase()}
            </button>
          )}
        </form.Subscribe>

        <Show when={submitError()}>
          <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[0.75rem] font-mono text-red-400 mt-2 text-center">
            ERR: {submitError()}
          </div>
        </Show>
        
        <div class="text-center mt-6">
          <a
            href={props.mode === "sign-in" ? "/auth/sign-up" : "/auth/sign-in"}
            class="text-[0.7rem] font-mono uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
          >
            {props.mode === "sign-in" ? "CREATE NEW CREDENTIALS" : "RETURN TO LOGIN"}
          </a>
        </div>
      </form>
    </div>
  );
}
