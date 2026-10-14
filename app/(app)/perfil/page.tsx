import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText, Heart, HandHeart, Pencil, Settings, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/display";
import { LinkButton } from "@/components/ui/button";
import { ProfileView } from "@/components/profile/profile-view";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { listCategories } from "@/services/categories";
import { getHelperPrefs, getProfilesByIds, getStatsByIds, getUserCategoryIds, listReviewsReceived } from "@/services/profiles";

export const metadata: Metadata = { title: "Meu perfil" };

const menu = [
  { href: "/meus-pedidos", label: "Meus pedidos", icon: FileText },
  { href: "/minhas-ajudas", label: "Minhas ajudas", icon: HandHeart },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
  { href: "/configuracoes", label: "Configurações e privacidade", icon: Settings },
  { href: "/seguranca", label: "Segurança no Ajuda Aqui", icon: ShieldCheck },
];

export default async function MyProfilePage() {
  const { userId, profile } = await requireUser();
  const db = await getSupabase();
  const [stats, categoryIds, allCategories, prefs, reviews] = await Promise.all([
    getStatsByIds(db, [userId]), getUserCategoryIds(db, userId), listCategories(db, { includeInactive: true }),
    getHelperPrefs(db, userId), listReviewsReceived(db, userId),
  ]);
  const reviewers = await getProfilesByIds(db, reviews.map((r) => r.reviewer_id));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex justify-end">
        <LinkButton href="/perfil/editar" variant="secondary" size="sm"><Pencil className="size-4" aria-hidden /> Editar perfil</LinkButton>
      </div>
      <ProfileView
        profile={profile} stats={stats.get(userId) ?? null} isSelf
        categories={allCategories.filter((c) => categoryIds.includes(c.id))} prefs={prefs} reviews={reviews}
        reviewerNames={new Map([...reviewers].map(([id, p]) => [id, p.full_name]))}
      />
      <nav aria-label="Mais opções">
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
          {menu.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-slate-50">
                <Icon className="size-5 text-brand-700" aria-hidden /> <span className="flex-1 font-semibold">{label}</span> <ChevronRight className="size-5 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Card className="text-sm text-ink-muted">Seu telefone e endereço nunca aparecem no perfil público.</Card>
    </div>
  );
}
