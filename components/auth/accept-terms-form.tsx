"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";
import { acceptTermsAction } from "@/app/actions/auth";

export function AcceptTermsForm() {
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const { run, pending } = useRunAction();
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 size-5 accent-brand-700" />
        <span>
          Li e aceito os <Link href="/termos" target="_blank" className="font-semibold text-brand-700 underline">Termos de Uso</Link>,
          a <Link href="/privacidade" target="_blank" className="font-semibold text-brand-700 underline">Política de Privacidade</Link> e
          as <Link href="/seguranca" target="_blank" className="font-semibold text-brand-700 underline">Regras de Segurança</Link>.
        </span>
      </label>
      <Button
        size="lg"
        className="w-full"
        disabled={!checked}
        loading={pending}
        onClick={() => run(() => acceptTermsAction(), { refresh: false, onSuccess: () => router.replace("/inicio") })}
      >
        Aceitar e continuar
      </Button>
    </div>
  );
}
