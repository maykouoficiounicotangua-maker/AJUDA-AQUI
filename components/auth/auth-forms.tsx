"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/display";
import { LocationFields } from "@/components/ui/location-fields";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "@/app/actions/auth";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/lib/validations";
import type { ActionResult } from "@/types";

/** Estado de envio compartilhado pelos formulários (o formulário tipado é criado em cada componente). */
function useSubmit<TValues extends FieldValues>(form: UseFormReturn<TValues>) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const submit = (run: (values: TValues) => Promise<ActionResult | void>) =>
    form.handleSubmit((values) => {
      setResult(null);
      start(async () => {
        const res = await run(values);
        if (res) {
          setResult(res);
          Object.entries(res.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as Path<TValues>, { message }));
        }
      });
    });
  return { pending, result, submit };
}

function useTypedForm<TIn extends FieldValues>(schema: z.ZodType, defaults: DefaultValues<TIn>) {
  // O resolver valida com o MESMO schema do servidor (que valida de novo).
  return useForm<TIn>({ resolver: zodResolver(schema as never) as never, defaultValues: defaults, mode: "onTouched" });
}

function FormMessage({ result }: { result: ActionResult | null }) {
  if (!result?.message) return null;
  return <Notice tone={result.ok ? "success" : "danger"}>{result.message}</Notice>;
}

export function SignInForm({ next }: { next?: string }) {
  const form = useTypedForm<z.input<typeof signInSchema>>(signInSchema, { email: "", password: "" });
  const { pending, result, submit } = useSubmit(form);
  const { register, formState: { errors } } = form;
  return (
    <form onSubmit={submit((v) => signInAction(v, next))} className="space-y-4" noValidate>
      <Field label="E-mail" error={errors.email?.message} required>
        {(a) => <Input {...a} type="email" autoComplete="email" inputMode="email" {...register("email")} />}
      </Field>
      <Field label="Senha" error={errors.password?.message} required>
        {(a) => <Input {...a} type="password" autoComplete="current-password" {...register("password")} />}
      </Field>
      <FormMessage result={result} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>Entrar</Button>
      <p className="text-center text-sm">
        <Link href="/recuperar-senha" className="font-semibold text-brand-700 underline">Esqueci minha senha</Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const form = useTypedForm<z.input<typeof signUpSchema>>(signUpSchema, {
    fullName: "", email: "", phone: "", password: "", state: "", city: "", neighborhood: "",
  });
  const { pending, result, submit } = useSubmit(form);
  const { register, watch, formState: { errors } } = form;
  if (result?.ok) {
    return (
      <Notice tone="success" title="Quase lá!">
        {result.message}
      </Notice>
    );
  }
  return (
    <form onSubmit={submit(signUpAction)} className="space-y-4" noValidate>
      <Field label="Nome completo" error={errors.fullName?.message} required>
        {(a) => <Input {...a} autoComplete="name" {...register("fullName")} />}
      </Field>
      <Field label="E-mail" error={errors.email?.message} required>
        {(a) => <Input {...a} type="email" autoComplete="email" inputMode="email" {...register("email")} />}
      </Field>
      <Field label="Telefone (com DDD)" error={errors.phone?.message} required hint="Só é compartilhado com quem for realizar a ajuda com você.">
        {(a) => <Input {...a} type="tel" autoComplete="tel" inputMode="tel" placeholder="(21) 99999-0000" {...register("phone")} />}
      </Field>
      <Field label="Senha" error={errors.password?.message} required hint="Mínimo de 8 caracteres, com letras e números.">
        {(a) => <Input {...a} type="password" autoComplete="new-password" {...register("password")} />}
      </Field>
      <LocationFields register={register} errors={errors} stateValue={watch("state")} />
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 size-5 accent-brand-700" {...register("acceptTerms")} />
          <span>
            Li e aceito os <Link href="/termos" target="_blank" className="font-semibold text-brand-700 underline">Termos de Uso</Link>,
            a <Link href="/privacidade" target="_blank" className="font-semibold text-brand-700 underline">Política de Privacidade</Link> e
            as <Link href="/seguranca" target="_blank" className="font-semibold text-brand-700 underline">Regras de Segurança</Link>.
          </span>
        </label>
        {errors.acceptTerms && <p role="alert" className="mt-1 text-sm font-medium text-danger-700">{errors.acceptTerms.message}</p>}
      </div>
      <FormMessage result={result} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>Criar minha conta</Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const form = useTypedForm<z.input<typeof forgotPasswordSchema>>(forgotPasswordSchema, { email: "" });
  const { pending, result, submit } = useSubmit(form);
  const { register, formState: { errors } } = form;
  if (result?.ok) return <Notice tone="success">{result.message}</Notice>;
  return (
    <form onSubmit={submit(forgotPasswordAction)} className="space-y-4" noValidate>
      <Field label="E-mail da sua conta" error={errors.email?.message} required>
        {(a) => <Input {...a} type="email" autoComplete="email" inputMode="email" {...register("email")} />}
      </Field>
      <FormMessage result={result} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>Enviar instruções</Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const form = useTypedForm<z.input<typeof resetPasswordSchema>>(resetPasswordSchema, { password: "", confirm: "" });
  const { pending, result, submit } = useSubmit(form);
  const { register, formState: { errors } } = form;
  return (
    <form onSubmit={submit(resetPasswordAction)} className="space-y-4" noValidate>
      <Field label="Nova senha" error={errors.password?.message} required hint="Mínimo de 8 caracteres, com letras e números.">
        {(a) => <Input {...a} type="password" autoComplete="new-password" {...register("password")} />}
      </Field>
      <Field label="Repita a nova senha" error={errors.confirm?.message} required>
        {(a) => <Input {...a} type="password" autoComplete="new-password" {...register("confirm")} />}
      </Field>
      <FormMessage result={result} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>Salvar nova senha</Button>
    </form>
  );
}
