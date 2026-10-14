import type { Metadata } from "next";
import Link from "next/link";
import { Download, LogOut } from "lucide-react";
import { BlockedUsers, DeleteAccount, NotificationSettings, PrivacySettings } from "@/components/profile/settings-forms";
import { PageHeader } from "@/components/ui/display";
import { Button, buttonClasses } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { getPrefs } from "@/services/notifications";
import { listMyBlocks } from "@/services/social";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const { userId, profile } = await requireUser();
  const db = await getSupabase();
  const [prefs, blocked] = await Promise.all([getPrefs(db, userId), listMyBlocks(db)]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title="Configurações" />
      <section aria-labelledby="privacidade" className="space-y-3">
        <h2 id="privacidade" className="text-xl font-extrabold">Privacidade</h2>
        <PrivacySettings initial={{ profileVisibility: profile.profile_visibility, showRating: profile.show_rating, showHelpCount: profile.show_help_count }} />
        <p className="text-sm text-ink-muted">Seu endereço exato nunca é público e seu telefone só é visto por quem tem uma ajuda em andamento com você.</p>
      </section>
      <section aria-labelledby="notificacoes" className="space-y-3">
        <h2 id="notificacoes" className="text-xl font-extrabold">Notificações</h2>
        <NotificationSettings initial={prefs} />
      </section>
      <section aria-labelledby="bloqueios" className="space-y-3">
        <h2 id="bloqueios" className="text-xl font-extrabold">Pessoas bloqueadas</h2>
        <BlockedUsers users={blocked} />
      </section>
      <section aria-labelledby="dados" className="space-y-3">
        <h2 id="dados" className="text-xl font-extrabold">Seus dados (LGPD)</h2>
        <p className="text-sm text-ink-muted">Baixe uma cópia de tudo o que guardamos sobre você, ou exclua sua conta.</p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/conta/exportar" className={buttonClasses({ variant: "secondary" })} download>
            <Download className="size-5" aria-hidden /> Baixar meus dados
          </a>
        </div>
        <DeleteAccount />
      </section>
      <section aria-labelledby="conta" className="space-y-3">
        <h2 id="conta" className="text-xl font-extrabold">Conta</h2>
        <nav className="flex flex-wrap gap-4 text-sm font-semibold text-brand-700 underline">
          <Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/seguranca">Segurança</Link>
        </nav>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary"><LogOut className="size-5" aria-hidden /> Sair da conta</Button>
        </form>
      </section>
    </div>
  );
}
