/**
 * Estados e centróides de cidades do Brasil.
 * O banco aceita QUALQUER cidade/estado (texto); os centróides só habilitam distância.
 * Cidades fora desta lista funcionam normalmente: o matching usa correspondência por cidade/estado.
 * Para cobertura nacional completa, substitua CITY_CENTROIDS por uma tabela IBGE (ver docs/architecture.md).
 */
import type { Coords } from "./distance";

export const BR_STATES: { code: string; name: string }[] = [
  { code: "AC", name: "Acre" }, { code: "AL", name: "Alagoas" }, { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" }, { code: "BA", name: "Bahia" }, { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" }, { code: "ES", name: "Espírito Santo" }, { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" }, { code: "MT", name: "Mato Grosso" }, { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" }, { code: "PA", name: "Pará" }, { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" }, { code: "PE", name: "Pernambuco" }, { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" }, { code: "RN", name: "Rio Grande do Norte" }, { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" }, { code: "RR", name: "Roraima" }, { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" }, { code: "SE", name: "Sergipe" }, { code: "TO", name: "Tocantins" },
];

export const stateName = (code: string | null | undefined) =>
  BR_STATES.find((s) => s.code === code)?.name ?? code ?? "";

export const normalizeName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// [estado, cidade, lat, lng]
const RAW: [string, string, number, number][] = [
  ["AC", "Rio Branco", -9.97, -67.81], ["AL", "Maceió", -9.67, -35.74], ["AP", "Macapá", 0.03, -51.07],
  ["AM", "Manaus", -3.12, -60.02], ["BA", "Salvador", -12.97, -38.51], ["CE", "Fortaleza", -3.73, -38.52],
  ["DF", "Brasília", -15.79, -47.88], ["ES", "Vitória", -20.32, -40.34], ["GO", "Goiânia", -16.68, -49.25],
  ["MA", "São Luís", -2.53, -44.3], ["MT", "Cuiabá", -15.6, -56.1], ["MS", "Campo Grande", -20.46, -54.62],
  ["MG", "Belo Horizonte", -19.92, -43.94], ["PA", "Belém", -1.46, -48.5], ["PB", "João Pessoa", -7.12, -34.86],
  ["PR", "Curitiba", -25.43, -49.27], ["PE", "Recife", -8.05, -34.88], ["PI", "Teresina", -5.09, -42.8],
  ["RJ", "Rio de Janeiro", -22.91, -43.17], ["RN", "Natal", -5.79, -35.21], ["RS", "Porto Alegre", -30.03, -51.23],
  ["RO", "Porto Velho", -8.76, -63.9], ["RR", "Boa Vista", 2.82, -60.67], ["SC", "Florianópolis", -27.6, -48.55],
  ["SP", "São Paulo", -23.55, -46.63], ["SE", "Aracaju", -10.91, -37.07], ["TO", "Palmas", -10.18, -48.33],
  // Região metropolitana do RJ e outras cidades frequentes
  ["RJ", "Niterói", -22.88, -43.1], ["RJ", "São Gonçalo", -22.83, -43.05], ["RJ", "Maricá", -22.92, -42.82],
  ["RJ", "Itaboraí", -22.75, -42.86], ["RJ", "Duque de Caxias", -22.79, -43.31], ["RJ", "Nova Iguaçu", -22.76, -43.45],
  ["RJ", "Petrópolis", -22.51, -43.18], ["RJ", "Campos dos Goytacazes", -21.75, -41.32], ["RJ", "Volta Redonda", -22.52, -44.1],
  ["RJ", "Tanguá", -22.73, -42.72],
  ["SP", "Campinas", -22.91, -47.06], ["SP", "Santos", -23.96, -46.33], ["SP", "Guarulhos", -23.46, -46.53],
  ["SP", "Ribeirão Preto", -21.18, -47.81], ["MG", "Uberlândia", -18.92, -48.28], ["MG", "Juiz de Fora", -21.76, -43.35],
  ["PR", "Londrina", -23.31, -51.16], ["RS", "Caxias do Sul", -29.17, -51.18], ["SC", "Joinville", -26.3, -48.85],
  ["BA", "Feira de Santana", -12.27, -38.97], ["PE", "Caruaru", -8.28, -35.98], ["CE", "Juazeiro do Norte", -7.21, -39.32],
];

const KEY = (state: string, city: string) => `${state.toUpperCase()}|${normalizeName(city)}`;
const CITY_CENTROIDS = new Map<string, Coords>(RAW.map(([s, c, lat, lng]) => [KEY(s, c), { lat, lng }]));

export function cityCentroid(state: string | null | undefined, city: string | null | undefined): Coords | null {
  if (!state || !city) return null;
  return CITY_CENTROIDS.get(KEY(state, city)) ?? null;
}

export const KNOWN_CITIES: { state: string; city: string }[] = RAW.map(([state, city]) => ({ state, city }));
