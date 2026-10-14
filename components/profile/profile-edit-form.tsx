"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, Card } from "@/components/ui/display";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { LocationFields } from "@/components/ui/location-fields";
import { CategoryIcon } from "@/components/requests/category-icon";
import { useRunAction } from "@/hooks/useRunAction";
import { saveHelperPrefsAction, setAvatarAction, updateProfileAction } from "@/app/actions/profile";
import { createClient } from "@/lib/supabase/client";
import { helperPrefsSchema, profileUpdateSchema } from "@/lib/validations";
import { WEEKDAY_SHORT } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Category, HelperPreferences } from "@/types";

type ProfileForm = z.input<typeof profileUpdateSchema>;
type PrefsForm = z.input<typeof helperPrefsSchema>;

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function ProfileEditForm({
  userId, categories, initial, prefs,
}: {
  userId: string;
  categories: Category[];
  initial: { fullName: string; phone: string; bio: string; state: string; city: string; neighborhood: string; categoryIds: string[]; avatarUrl: string | null };
  prefs: HelperPreferences | null;
}) {
  const router = useRouter();
  const { run, pending } = useRunAction();
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileUpdateSchema as never) as never,
    mode: "onTouched",
    defaultValues: { fullName: initial.fullName, phone: initial.phone, bio: initial.bio, state: initial.state, city: initial.city, neighborhood: initial.neighborhood, categoryIds: initial.categoryIds },
  });
  const prefsForm = useForm<PrefsForm>({
    resolver: zodResolver(helperPrefsSchema as never) as never,
    mode: "onTouched",
    defaultValues: {
      description: prefs?.description ?? "", maxDistanceKm: prefs?.max_distance_km ?? 15,
      acceptsPaid: prefs?.accepts_paid ?? true, acceptsFree: prefs?.accepts_free ?? true, acceptsExchange: prefs?.accepts_exchange ?? true,
      availableDays: prefs?.available_days ?? [1, 2, 3, 4, 5], availabilityStart: (prefs?.availability_start ?? "08:00").slice(0, 5),
      availabilityEnd: (prefs?.availability_end ?? "20:00").slice(0, 5), active: prefs?.active ?? true,
    },
  });

  const pf = profileForm;
  const pr = prefsForm;
  const selected = pf.watch("categoryIds");
  const days = pr.watch("availableDays");

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    const ext = AVATAR_TYPES[file.type];
    if (!ext) return void toast.error("Use uma imagem JPG, PNG ou WebP.");
    if (file.size > MAX_AVATAR_BYTES) return void toast.error("A imagem deve ter até 2 MB.");
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const res = await setAvatarAction(data.publicUrl);
      if (!res.ok) throw new Error(res.message);
      setAvatarUrl(data.publicUrl);
      toast.success("Foto atualizada!");
      router.refresh();
    } catch {
      toast.error("Não conseguimos enviar a foto agora. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  const toggleCategory = (id: string) => {
    const cur = pf.getValues("categoryIds");
    pf.setValue("categoryIds", cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id], { shouldDirty: true });
  };
  const toggleDay = (d: number) => {
    const cur = pr.getValues("availableDays");
    pr.setValue("availableDays", cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort(), { shouldDirty: true, shouldValidate: true });
  };

  const saveAll = async () => {
    const [a, b] = await Promise.all([pf.trigger(), pr.trigger()]);
    if (!a || !b) return toast.error("Revise os campos destacados.");
    run(async () => {
      const first = await updateProfileAction(pf.getValues());
      if (!first.ok) return first;
      return saveHelperPrefsAction(pr.getValues());
    }, { onSuccess: () => router.push("/perfil") });
  };

  const pe = pf.formState.errors;
  const re = pr.formState.errors;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card className="flex items-center gap-4">
        <Avatar name={initial.fullName} src={avatarUrl} size={80} />
        <div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar" onChange={(e) => onAvatar(e.target.files?.[0])} />
          <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}><Camera className="size-4" aria-hidden /> Trocar foto</Button>
          <p className="mt-1 text-xs text-ink-muted">JPG, PNG ou WebP até 2 MB.</p>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">Seus dados</h2>
        <Field label="Nome completo" required error={pe.fullName?.message}>{(a) => <Input {...a} autoComplete="name" {...pf.register("fullName")} />}</Field>
        <Field label="Telefone" error={pe.phone?.message} hint="Só é compartilhado com quem vai realizar a ajuda com você.">
          {(a) => <Input {...a} type="tel" inputMode="tel" autoComplete="tel" {...pf.register("phone")} />}
        </Field>
        <Field label="Sobre você" error={pe.bio?.message} hint="Conte um pouco sobre como você gosta de ajudar.">{(a) => <Textarea {...a} rows={3} maxLength={500} {...pf.register("bio")} />}</Field>
        <LocationFields register={pf.register} errors={pf.formState.errors} stateValue={pf.watch("state")} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Em que você pode ajudar?</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Categorias">
          {categories.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => toggleCategory(c.id)}
                className={cn("flex min-h-12 items-center gap-2 rounded-2xl border p-3 text-left text-sm font-semibold", on ? "border-brand-700 bg-brand-50 text-brand-800" : "border-line bg-white")}>
                <CategoryIcon name={c.icon} className="size-5 shrink-0" /> {c.name}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-4">
        <Switch label="Quero receber pedidos compatíveis" description="Desative para pausar sua disponibilidade." checked={pr.watch("active")} onChange={(v) => pr.setValue("active", v, { shouldDirty: true })} />
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Dias disponíveis</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_SHORT.map((label, d) => (
              <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => toggleDay(d)}
                className={cn("min-h-11 min-w-14 rounded-full border px-3 text-sm font-semibold", days.includes(d) ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white")}>
                {label}
              </button>
            ))}
          </div>
          {re.availableDays && <p role="alert" className="mt-1 text-sm font-medium text-danger-700">{re.availableDays.message ?? "Escolha ao menos um dia"}</p>}
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Das" error={re.availabilityStart?.message}>{(a) => <Input {...a} type="time" {...pr.register("availabilityStart")} />}</Field>
          <Field label="Até" error={re.availabilityEnd?.message}>{(a) => <Input {...a} type="time" {...pr.register("availabilityEnd")} />}</Field>
        </div>
        <Field label="Distância máxima" error={re.maxDistanceKm?.message}>
          {(a) => <Select {...a} {...pr.register("maxDistanceKm", { valueAsNumber: true })}>{[3, 5, 10, 15, 25, 50, 100].map((k) => <option key={k} value={k}>até {k} km</option>)}</Select>}
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold">Aceito ajudar em pedidos</legend>
          <Switch label="Gratuitos" checked={pr.watch("acceptsFree")} onChange={(v) => pr.setValue("acceptsFree", v, { shouldValidate: true })} />
          <Switch label="Remunerados" checked={pr.watch("acceptsPaid")} onChange={(v) => pr.setValue("acceptsPaid", v, { shouldValidate: true })} />
          <Switch label="Troca" checked={pr.watch("acceptsExchange")} onChange={(v) => pr.setValue("acceptsExchange", v, { shouldValidate: true })} />
          {re.acceptsFree && <p role="alert" className="text-sm font-medium text-danger-700">{re.acceptsFree.message}</p>}
        </fieldset>
        <Field label="Algo mais sobre como você ajuda" error={re.description?.message}>{(a) => <Textarea {...a} rows={3} maxLength={500} {...pr.register("description")} />}</Field>
      </Card>

      <Button size="lg" className="w-full" loading={pending} onClick={saveAll}>Salvar alterações</Button>
    </div>
  );
}
