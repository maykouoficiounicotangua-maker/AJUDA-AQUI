"use client";
import type { FieldErrors, FieldValues, Path, UseFormRegister } from "react-hook-form";
import { Field, Input, Select } from "@/components/ui/form";
import { BR_STATES, KNOWN_CITIES } from "@/lib/geo/locations";

/**
 * Estado / cidade / bairro. Cidade aceita QUALQUER texto (sugestões via datalist),
 * para funcionar em todo o Brasil sem depender de uma lista fechada.
 */
export function LocationFields<T extends FieldValues>({
  register,
  errors,
  stateValue,
  names = { state: "state", city: "city", neighborhood: "neighborhood" },
  neighborhoodLabel = "Bairro ou região",
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  stateValue?: string;
  names?: { state: string; city: string; neighborhood: string };
  neighborhoodLabel?: string;
}) {
  const err = (n: string) => (errors as Record<string, { message?: string } | undefined>)[n]?.message;
  const suggestions = KNOWN_CITIES.filter((c) => !stateValue || c.state === stateValue);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label="Estado" required error={err(names.state)}>
          {(a) => (
            <Select {...a} autoComplete="address-level1" {...register(names.state as Path<T>)}>
              <option value="">Selecione</option>
              {BR_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Cidade" required error={err(names.city)}>
          {(a) => (
            <>
              <Input {...a} list="city-suggestions" autoComplete="address-level2" placeholder="Digite sua cidade" {...register(names.city as Path<T>)} />
              <datalist id="city-suggestions">
                {suggestions.map((c) => (
                  <option key={`${c.state}-${c.city}`} value={c.city} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      </div>
      <Field label={neighborhoodLabel} error={err(names.neighborhood)} hint="Só a região aparece para outras pessoas.">
        {(a) => <Input {...a} autoComplete="off" placeholder="Ex.: Icaraí" {...register(names.neighborhood as Path<T>)} />}
      </Field>
    </>
  );
}
