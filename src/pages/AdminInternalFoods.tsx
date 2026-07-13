import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { numberInputValue, numberOrFallback, type AdminNumberValue } from "@/lib/adminNumberInput";
import { Calculator, Download, Edit3, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

type InternalFood = {
  id: string;
  name: string;
  synonyms: string[];
  base_quantity: number;
  base_unit: "g" | "ml" | "serving";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  salt: number;
  azucares_g?: number | null;
  grasas_saturadas_g?: number | null;
  category: string;
  source: string;
  is_active: boolean;
};

type FormState = Omit<InternalFood, "id" | "synonyms" | "base_quantity" | "calories" | "protein" | "carbs" | "fat" | "fiber" | "salt" | "azucares_g" | "grasas_saturadas_g"> & {
  synonyms: string;
  base_quantity: AdminNumberValue;
  calories: AdminNumberValue;
  protein: AdminNumberValue;
  carbs: AdminNumberValue;
  fat: AdminNumberValue;
  fiber: AdminNumberValue;
  salt: AdminNumberValue;
  azucares_g: AdminNumberValue;
  grasas_saturadas_g: AdminNumberValue;
};

type BaseUnitOption = "100g" | "50g" | "25g" | "100ml" | "serving";
type NutrientFieldKey = "calories" | "protein" | "carbs" | "fat" | "grasas_saturadas_g" | "fiber" | "azucares_g" | "salt";
type ImportableFoodPayload = Omit<FormState, "synonyms" | "base_quantity" | "calories" | "protein" | "carbs" | "fat" | "fiber" | "salt" | "azucares_g" | "grasas_saturadas_g"> & {
  synonyms: string[];
  base_quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  salt: number;
  azucares_g: number | null;
  grasas_saturadas_g: number | null;
};

type ImportCandidate = Partial<ImportableFoodPayload> & {
  name: string;
  includedFields: Array<keyof ImportableFoodPayload>;
};

type ImportConflict = {
  row: number;
  name: string;
  field: string;
  current: string;
  incoming: string;
};

type ImportPlanItem = {
  row: number;
  name: string;
  action: "create" | "update" | "unchanged";
  existingId?: string;
  payload: ImportableFoodPayload;
  includedFields: Array<keyof ImportableFoodPayload>;
  changedFields: Array<keyof ImportableFoodPayload>;
  conflicts: ImportConflict[];
};

type ImportReport = {
  created: string[];
  updated: string[];
  skipped: Array<{ row: number; name: string; reason: string }>;
};

type ImportPreview = ImportReport & {
  fileName: string;
  items: ImportPlanItem[];
  conflicts: ImportConflict[];
};

const NUTRIENT_FIELDS: Array<[NutrientFieldKey, string]> = [
  ["calories", "Calorías"],
  ["protein", "Proteínas"],
  ["carbs", "Hidratos"],
  ["azucares_g", "Azúcares"],
  ["fat", "Grasas"],
  ["grasas_saturadas_g", "Grasas saturadas"],
  ["fiber", "Fibra"],
  ["salt", "Sal"],
];
const NUTRIENT_QUICK_STEPS = [-50, -10, -1, 1, 10, 50];
const emptyForm: FormState = {
  name: "",
  synonyms: "",
  base_quantity: 100,
  base_unit: "g",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  salt: 0,
  azucares_g: "",
  grasas_saturadas_g: "",
  category: "general",
  source: "Tabla interna",
  is_active: true,
};

const toNumber = (value: any) => Number(value) || 0;
const toNullableNumber = (value: any) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
const hasNumericValue = (value: unknown) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const formatOptionalGramValue = (value: unknown) => hasNumericValue(value) ? `${value}g` : "—";
const synonymsToText = (value: string[] | null | undefined) => (value ?? []).join(", ");
const UNCATEGORIZED_INTERNAL_FOOD_CATEGORY = "Sin categoría";
const displayFoodCategory = (value: string | null | undefined) => String(value ?? "").trim() || UNCATEGORIZED_INTERNAL_FOOD_CATEGORY;
const textToSynonyms = (value: string) =>
  value
    .split(/[,;]/)
    .map(item => item.trim())
    .filter(Boolean);
const normalizeText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeImportHeader = (value: unknown) =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const importHeaderWithoutUnit = (header: string) =>
  header
    .replace(/_(?:kcal|kj|g|mg|ml)_100(?:g|ml)$/g, "")
    .replace(/_100(?:g|ml)$/g, "")
    .replace(/_por_100(?:g|ml)$/g, "");

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["nombre", "name", "alimento", "food"],
  category: ["categoria", "category"],
  status: ["estado", "estado_del_alimento", "estado_alimento", "estado_de_revision", "activo", "is_active"],
  base_quantity: ["cantidad_base", "cantidad", "base_quantity", "valor_base"],
  base_unit: ["unidad_base", "unidad", "base_unit"],
  calories: ["calorias", "calorias_kcal", "kcal", "energia", "energia_kcal", "calories"],
  protein: ["proteinas", "proteinas_g", "proteina", "protein"],
  carbs: ["hidratos", "hidratos_g", "hidratos_de_carbono", "carbohidratos", "carbs"],
  azucares_g: ["azucares", "azucares_g", "azucares_9", "azucares_totales", "sugars"],
  fat: ["grasas", "grasas_g", "grasa", "fat"],
  grasas_saturadas_g: ["grasas_saturadas", "grasas_saturadas_g", "saturadas", "saturated_fat"],
  fiber: ["fibra", "fibra_g", "fiber"],
  salt: ["sal", "sal_g", "salt"],
  synonyms: ["sinonimos", "sinonimo", "aliases", "synonyms"],
  source: ["origen", "fuente", "source", "fuente_principal"],
};

const findHeaderKey = (headers: string[], field: string) => {
  const aliases = HEADER_ALIASES[field] ?? [field];
  return headers.find(header => aliases.includes(header) || aliases.includes(importHeaderWithoutUnit(header)));
};

const looksLikeImportHeader = (headers: string[]) => {
  const recognizedFields = ["category", "calories", "protein", "carbs", "azucares_g", "fat", "grasas_saturadas_g", "fiber", "salt"];
  return recognizedFields.filter(field => Boolean(findHeaderKey(headers, field))).length >= 2;
};

const looksLikeImportDataRow = (row: any[]) => {
  const firstCell = String(row[0] ?? "").trim();
  if (!firstCell) return false;
  const numericCells = row.slice(1).filter(value => parseImportNumber(value) !== null).length;
  return numericCells >= 2;
};

const fallbackHeadersForNutritionRows = (rowLength: number) => {
  const defaults = ["nombre", "category", "calories", "fat", "protein", "azucares_g", "salt", "carbs", "fiber", "grasas_saturadas_g"];
  return Array.from({ length: rowLength }, (_, index) => defaults[index] ?? `extra_${index}`);
};

const worksheetToImportRows = (sheet: XLSX.WorkSheet) => {
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  const normalizedMatrix = matrix.map(row => row.map(cell => normalizeImportHeader(cell)));
  const headerWithNameIndex = normalizedMatrix.findIndex(headers => Boolean(findHeaderKey(headers, "name")));
  let headerRowIndex = headerWithNameIndex >= 0 ? headerWithNameIndex : normalizedMatrix.findIndex(looksLikeImportHeader);
  const dataFallbackIndex = matrix.findIndex(looksLikeImportDataRow);
  if (headerRowIndex === -1 && dataFallbackIndex === -1) throw new Error("No se encontró la columna Nombre o Alimento en el archivo");

  const hasHeaderRow = headerRowIndex >= 0;
  if (!hasHeaderRow) headerRowIndex = Math.max(dataFallbackIndex - 1, 0);
  const headers = hasHeaderRow ? [...normalizedMatrix[headerRowIndex]] : fallbackHeadersForNutritionRows(matrix[dataFallbackIndex]?.length ?? 0);
  if (!findHeaderKey(headers, "name")) headers[0] = "nombre";
  return matrix
    .slice(hasHeaderRow ? headerRowIndex + 1 : dataFallbackIndex)
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
    .filter(row => Object.values(row).some(value => String(value ?? "").trim() !== ""));
};

const parseImportNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^0-9.+-]/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRequiredImportNumber = (value: unknown, label: string) => {
  const parsed = parseImportNumber(value);
  if (parsed === null) throw new Error(`${label} no es numérico`);
  return parsed;
};

const parseBaseUnit = (value: unknown) => {
  const normalized = normalizeText(value).replace(/\s+/g, " ").trim();
  const number = parseImportNumber(value);
  if (/racion|serving/.test(normalized)) return { base_quantity: number ?? 1, base_unit: "serving" as const };
  if (/\bml\b|mililitro/.test(normalized)) return { base_quantity: number ?? 100, base_unit: "ml" as const };
  if (/\bg\b|gramo/.test(normalized)) return { base_quantity: number ?? 100, base_unit: "g" as const };
  throw new Error("Unidad base no válida");
};

const parseActiveState = (value: unknown) => {
  const normalized = normalizeText(value).trim();
  if (!normalized) return true;
  if (/^(inactivo|inactive|no|false|0|oculto|desactivado|baja)$/.test(normalized)) return false;
  return true;
};

const baseUnitOptionFromForm = (form: FormState): BaseUnitOption => {
  if (form.base_unit === "serving") return "serving";
  if (form.base_unit === "ml") return "100ml";
  if (Number(form.base_quantity) === 25) return "25g";
  return Number(form.base_quantity) === 50 ? "50g" : "100g";
};

const baseUnitPatch = (value: BaseUnitOption): Pick<FormState, "base_quantity" | "base_unit"> => {
  if (value === "50g") return { base_quantity: 50, base_unit: "g" };
  if (value === "25g") return { base_quantity: 25, base_unit: "g" };
  if (value === "100ml") return { base_quantity: 100, base_unit: "ml" };
  if (value === "serving") return { base_quantity: 1, base_unit: "serving" };
  return { base_quantity: 100, base_unit: "g" };
};

const SEARCH_FAMILIES: Record<string, string[]> = {
  carne: ["carne", "pollo", "pavo", "ternera", "cerdo", "conejo", "lomo", "jamon", "picada"],
  carnes: ["carne", "pollo", "pavo", "ternera", "cerdo", "conejo", "lomo", "jamon", "picada"],
  verdura: ["verdura", "verduras", "tomate", "calabacin", "cebolla", "brocoli", "espinacas", "lechuga", "pimiento", "pepino", "berenjena", "coliflor", "setas", "champinon", "esparragos", "judias verdes", "acelgas", "alcachofa", "puerro", "apio", "rucula"],
  verduras: ["verdura", "verduras", "tomate", "calabacin", "cebolla", "brocoli", "espinacas", "lechuga", "pimiento", "pepino", "berenjena", "coliflor", "setas", "champinon", "esparragos", "judias verdes", "acelgas", "alcachofa", "puerro", "apio", "rucula"],
  lacteo: ["lacteo", "lacteos", "leche", "yogur", "kefir", "queso", "cottage", "burgos", "requeson", "skyr"],
  lacteos: ["lacteo", "lacteos", "leche", "yogur", "kefir", "queso", "cottage", "burgos", "requeson", "skyr"],
  lácteo: ["lacteo", "lacteos", "leche", "yogur", "kefir", "queso", "cottage", "burgos", "requeson", "skyr"],
  lácteos: ["lacteo", "lacteos", "leche", "yogur", "kefir", "queso", "cottage", "burgos", "requeson", "skyr"],
};

const getSessionHeaders = async (refresh = false) => {
  if (refresh) await supabase.auth.refreshSession().catch(() => null);
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.access_token
    ? { Authorization: `Bearer ${sessionData.session.access_token}` }
    : {};
};

const fetchInternalFoodsApi = async (init: RequestInit = {}) => {
  const buildRequest = async (refresh = false) => fetch("/api/internal-foods", {
    ...init,
    headers: {
      ...((init.headers as Record<string, string> | undefined) ?? {}),
      ...(await getSessionHeaders(refresh)),
    },
  });

  let response = await buildRequest(false);
  if (response.status === 401) {
    const payload = await response.clone().json().catch(() => null);
    if (/sesión|session/i.test(String(payload?.error ?? ""))) {
      response = await buildRequest(true);
    }
  }
  return response;
};

export default function AdminInternalFoods() {
  const [foods, setFoods] = useState<InternalFood[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preparingImport, setPreparingImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  const loadFoods = async () => {
    setLoading(true);
    const response = await fetchInternalFoodsApi();
    const payload = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      toast.error(payload?.error || "No se pudieron cargar los alimentos internos");
      return;
    }
    if (payload?.warning) {
      toast.warning("Mostrando base interna de respaldo hasta que Supabase exponga la tabla.");
    }
    setFoods((payload?.data ?? []).map((item: any) => ({
      ...item,
      base_quantity: toNumber(item.base_quantity),
      calories: toNumber(item.calories),
      protein: toNumber(item.protein),
      carbs: toNumber(item.carbs),
      fat: toNumber(item.fat),
      fiber: toNumber(item.fiber),
      salt: toNumber(item.salt),
      azucares_g: toNullableNumber(item.azucares_g ?? item.azucares_9),
      grasas_saturadas_g: toNullableNumber(item.grasas_saturadas_g),
      synonyms: item.synonyms ?? [],
    })));
  };

  useEffect(() => {
    loadFoods();
  }, []);

  const filtered = useMemo(() => {
    const normalized = normalizeText(query.trim());
    if (!normalized) return foods;
    const terms = [normalized, ...(SEARCH_FAMILIES[normalized] ?? [])].map(normalizeText);
    return foods.filter(food =>
      terms.some(term => {
        const searchable = normalizeText([
          food.name,
          food.category,
          food.source,
          ...food.synonyms,
        ].join(" "));
        return searchable.includes(term);
      })
    );
  }, [foods, query]);

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const edit = (food: InternalFood) => {
    setEditingId(food.id);
    setForm({
      name: food.name,
      synonyms: synonymsToText(food.synonyms),
      base_quantity: food.base_quantity,
      base_unit: food.base_unit,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      salt: food.salt,
      azucares_g: food.azucares_g ?? "",
      grasas_saturadas_g: food.grasas_saturadas_g ?? "",
      category: food.category,
      source: food.source || "Tabla interna",
      is_active: food.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      synonyms: textToSynonyms(form.synonyms),
      base_quantity: numberOrFallback(form.base_quantity, 100),
      base_unit: form.base_unit,
      calories: numberOrFallback(form.calories),
      protein: numberOrFallback(form.protein),
      carbs: numberOrFallback(form.carbs),
      fat: numberOrFallback(form.fat),
      fiber: numberOrFallback(form.fiber),
      salt: numberOrFallback(form.salt),
      azucares_g: toNullableNumber(form.azucares_g),
      grasas_saturadas_g: toNullableNumber(form.grasas_saturadas_g),
      category: form.category.trim() || "general",
      source: form.source.trim() || "Tabla interna",
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    const response = await fetchInternalFoodsApi({
      method: editingId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      toast.error(result?.error || "No se pudo guardar el alimento");
      return;
    }
    toast.success(editingId ? "Alimento actualizado" : "Alimento creado");
    reset();
    loadFoods();
  };

  const remove = async (food: InternalFood) => {
    if (!confirm(`¿Eliminar "${food.name}" de Alimentos internos?`)) return;
    const response = await fetchInternalFoodsApi({
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: food.id }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(result?.error || "No se pudo eliminar el alimento");
      return;
    }
    toast.success("Alimento eliminado");
    loadFoods();
  };

  const buildFoodLookup = (foodList: InternalFood[]) => {
    const lookup = new Map<string, InternalFood[]>();
    foodList.forEach(food => {
      const keys = [food.name, ...(food.synonyms ?? [])].map(normalizeText).filter(Boolean);
      keys.forEach(key => {
        const list = lookup.get(key) ?? [];
        list.push(food);
        lookup.set(key, list);
      });
    });
    return lookup;
  };

  const findExistingFoodForImport = (payload: Pick<ImportableFoodPayload, "name"> & Partial<ImportableFoodPayload>, foodList: InternalFood[]) => {
    const lookup = buildFoodLookup(foodList);
    const keys = [payload.name, ...(payload.synonyms ?? [])].map(normalizeText).filter(Boolean);
    const matches = new Map<string, InternalFood>();
    keys.forEach(key => (lookup.get(key) ?? []).forEach(food => matches.set(food.id, food)));
    const found = [...matches.values()];
    if (found.length > 1) {
      throw new Error(`coincidencia ambigua con ${found.map(item => item.name).join(", ")}`);
    }
    return found[0] ?? null;
  };

  const rowToCandidate = (row: Record<string, any>): ImportCandidate => {
    const headers = Object.keys(row).map(normalizeImportHeader);
    const headerFor = (field: string) => findHeaderKey(headers, field);
    const hasField = (field: string) => Boolean(headerFor(field));
    const value = (field: string) => {
      const header = findHeaderKey(headers, field);
      return header ? row[header] : undefined;
    };
    const name = String(value("name") ?? "").trim();
    if (!name) throw new Error("Nombre vacío");
    const candidate: ImportCandidate = { name, includedFields: ["name"] };

    if (hasField("synonyms") && String(value("synonyms") ?? "").trim()) {
      candidate.synonyms = textToSynonyms(String(value("synonyms") ?? ""));
      candidate.includedFields.push("synonyms");
    }
    if (hasField("source") && String(value("source") ?? "").trim()) {
      candidate.source = String(value("source") ?? "").trim();
      candidate.includedFields.push("source");
    }
    if (hasField("status") && String(value("status") ?? "").trim()) {
      candidate.is_active = parseActiveState(value("status"));
      candidate.includedFields.push("is_active");
    }
    if (hasField("base_quantity") && String(value("base_quantity") ?? "").trim()) {
      candidate.base_quantity = parseRequiredImportNumber(value("base_quantity"), "Cantidad base");
      candidate.includedFields.push("base_quantity");
    }
    if (hasField("base_unit") && String(value("base_unit") ?? "").trim()) {
      const base = parseBaseUnit(value("base_unit"));
      candidate.base_quantity = candidate.base_quantity ?? base.base_quantity;
      candidate.base_unit = base.base_unit;
      if (!candidate.includedFields.includes("base_quantity")) candidate.includedFields.push("base_quantity");
      candidate.includedFields.push("base_unit");
    }
    if (!candidate.base_unit) {
      if (headers.some(header => /100ml/.test(header))) {
        candidate.base_quantity = candidate.base_quantity ?? 100;
        candidate.base_unit = "ml";
        if (!candidate.includedFields.includes("base_quantity")) candidate.includedFields.push("base_quantity");
        candidate.includedFields.push("base_unit");
      } else if (headers.some(header => /100g/.test(header))) {
        candidate.base_quantity = candidate.base_quantity ?? 100;
        candidate.base_unit = "g";
        if (!candidate.includedFields.includes("base_quantity")) candidate.includedFields.push("base_quantity");
        candidate.includedFields.push("base_unit");
      }
    }

    const numericFields: Array<[keyof ImportableFoodPayload, string, string]> = [
      ["calories", "calories", "Calorías"],
      ["protein", "protein", "Proteínas"],
      ["carbs", "carbs", "Hidratos"],
      ["azucares_g", "azucares_g", "Azúcares"],
      ["fat", "fat", "Grasas"],
      ["grasas_saturadas_g", "grasas_saturadas_g", "Grasas saturadas"],
      ["fiber", "fiber", "Fibra"],
      ["salt", "salt", "Sal"],
    ];

    numericFields.forEach(([payloadKey, field, label]) => {
      if (!hasField(field)) return;
      (candidate as any)[payloadKey] = parseRequiredImportNumber(value(field), label);
      candidate.includedFields.push(payloadKey);
    });

    return candidate;
  };

  const isImportValueEmpty = (value: unknown) => {
    if (Array.isArray(value)) return value.length === 0;
    return value === null || value === undefined || value === "";
  };

  const formatImportValue = (value: unknown) => Array.isArray(value) ? value.join(", ") : String(value ?? "");

  const importValuesAreEqual = (current: unknown, incoming: unknown) => {
    if (Array.isArray(current) || Array.isArray(incoming)) {
      return normalizeText(formatImportValue(current)) === normalizeText(formatImportValue(incoming));
    }
    if (typeof current === "number" || typeof incoming === "number") {
      const currentNumber = Number(current);
      const incomingNumber = Number(incoming);
      return Number.isFinite(currentNumber) && Number.isFinite(incomingNumber) && Math.abs(currentNumber - incomingNumber) < 0.0001;
    }
    return normalizeText(current) === normalizeText(incoming);
  };

  const mergeImportPayload = (candidate: ImportCandidate, existing?: InternalFood, row = 0) => {
    const payload: ImportableFoodPayload = {
      name: existing?.name || candidate.name,
      synonyms: existing?.synonyms ?? [],
      base_quantity: existing?.base_quantity ?? 100,
      base_unit: existing?.base_unit ?? "g",
      calories: existing?.calories ?? 0,
      protein: existing?.protein ?? 0,
      carbs: existing?.carbs ?? 0,
      azucares_g: existing?.azucares_g ?? null,
      fat: existing?.fat ?? 0,
      grasas_saturadas_g: existing?.grasas_saturadas_g ?? null,
      fiber: existing?.fiber ?? 0,
      salt: existing?.salt ?? 0,
      category: displayFoodCategory(existing?.category),
      source: existing?.source ?? "Tabla interna",
      is_active: existing?.is_active ?? true,
    };
    const changedFields: Array<keyof ImportableFoodPayload> = [];
    const conflicts: ImportConflict[] = [];

    if (!existing) {
      return {
        payload: {
          name: candidate.name,
          synonyms: candidate.synonyms ?? [],
          base_quantity: candidate.base_quantity ?? 100,
          base_unit: candidate.base_unit ?? "g",
          calories: candidate.calories ?? 0,
          protein: candidate.protein ?? 0,
          carbs: candidate.carbs ?? 0,
          azucares_g: candidate.azucares_g ?? null,
          fat: candidate.fat ?? 0,
          grasas_saturadas_g: candidate.grasas_saturadas_g ?? null,
          fiber: candidate.fiber ?? 0,
          salt: candidate.salt ?? 0,
          category: UNCATEGORIZED_INTERNAL_FOOD_CATEGORY,
          source: candidate.source ?? "Tabla interna",
          is_active: candidate.is_active ?? true,
        },
        changedFields: candidate.includedFields,
        conflicts,
      };
    }

    candidate.includedFields.forEach(field => {
      if (field === "name") return;
      const incoming = candidate[field];
      if (incoming === undefined) return;
      const current = payload[field];
      if (!importValuesAreEqual(current, incoming)) {
        (payload as any)[field] = incoming;
        changedFields.push(field);
      }
    });

    return { payload, changedFields, conflicts };
  };

  const ensureNewFoodIsComplete = (candidate: ImportCandidate) => {
    const required: Array<[keyof ImportableFoodPayload, string]> = [
      ["name", "Nombre"],
    ];
    const missing = required
      .filter(([key]) => (candidate as any)[key] === undefined)
      .map(([, label]) => label);
    if (missing.length > 0) throw new Error(`faltan campos obligatorios: ${missing.join(", ")}`);
  };

  const buildImportPreview = (fileName: string, rows: Array<Record<string, any>>): ImportPreview => {
    const preview: ImportPreview = { fileName, created: [], updated: [], skipped: [], items: [], conflicts: [] };
    const simulatedFoods = [...foods];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      try {
        const candidate = rowToCandidate(row);
        const existing = findExistingFoodForImport(candidate, simulatedFoods);
        if (existing?.id?.startsWith("__pending_import__")) {
          throw new Error("duplicado dentro del archivo");
        }
        if (!existing) ensureNewFoodIsComplete(candidate);
        const { payload, changedFields, conflicts } = mergeImportPayload(candidate, existing ?? undefined, rowNumber);
        const action = existing ? (changedFields.length > 0 ? "update" : "unchanged") : "create";
        const item: ImportPlanItem = {
          row: rowNumber,
          name: payload.name,
          action,
          existingId: existing?.id,
          payload,
          includedFields: candidate.includedFields,
          changedFields,
          conflicts,
        };
        preview.items.push(item);
        preview.conflicts.push(...conflicts);
        if (action === "update") {
          preview.updated.push(payload.name);
          const position = simulatedFoods.findIndex(food => food.id === existing.id);
          if (position >= 0) simulatedFoods[position] = { ...simulatedFoods[position], ...payload };
        } else if (action === "create") {
          preview.created.push(payload.name);
          simulatedFoods.push({ id: `__pending_import__${rowNumber}`, ...payload });
        }
      } catch (error: any) {
        preview.skipped.push({
          row: rowNumber,
          name: String(row.nombre ?? row.name ?? "Sin nombre"),
          reason: error?.message || "Fila no válida",
        });
      }
    });

    return preview;
  };

  const prepareImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(extension ?? "")) {
      toast.error("Formato no soportado. Sube un archivo Excel o CSV.");
      return;
    }

    setPreparingImport(true);
    setImportReport(null);
    setImportPreview(null);

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = worksheetToImportRows(sheet);
      const preview = buildImportPreview(file.name, rows);
      setImportPreview(preview);
      toast.success(`Archivo analizado: ${preview.created.length} se crearán, ${preview.updated.length} se actualizarán, ${preview.skipped.length} se omitirán.`);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo leer el archivo");
    } finally {
      setPreparingImport(false);
    }
  };

  const confirmImportPreview = async () => {
    if (!importPreview) return;
    setImporting(true);
    setImportReport(null);
    const report: ImportReport = { created: [], updated: [], skipped: [] };

    try {
      for (const item of importPreview.items.filter(item => item.action !== "unchanged")) {
        try {
          const body = item.existingId ? { id: item.existingId, ...item.payload } : item.payload;
          const response = await fetchInternalFoodsApi({
            method: item.existingId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const result = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(result?.error || "No se pudo guardar esta fila");
          }
          if (item.existingId) {
            report.updated.push(item.payload.name);
          } else {
            report.created.push(item.payload.name);
          }
        } catch (error: any) {
          report.skipped.push({
            row: item.row,
            name: item.name,
            reason: error?.message || "Fila no válida",
          });
        }
      }

      setImportReport(report);
      setImportPreview(null);
      toast.success(`Importación finalizada: ${report.created.length} creados, ${report.updated.length} actualizados, ${report.skipped.length} omitidos.`);
      await loadFoods();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo importar el archivo");
    } finally {
      setImporting(false);
    }
  };

  const updateForm = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));
  const quickAdjustNutrient = (key: NutrientFieldKey, delta: number) => {
    setForm(prev => {
      const current = numberOrFallback(prev[key], 0);
      const next = Math.max(0, current + delta);
      return { ...prev, [key]: Number(next.toFixed(3)) };
    });
  };

  const importFieldLabel = (field: keyof ImportableFoodPayload | string) => ({
    name: "Nombre",
    synonyms: "Sinónimos",
    base_quantity: "Cantidad base",
    base_unit: "Unidad base",
    calories: "Calorías",
    protein: "Proteínas",
    carbs: "Hidratos",
    azucares_g: "Azúcares",
    fat: "Grasas",
    grasas_saturadas_g: "Grasas saturadas",
    fiber: "Fibra",
    salt: "Sal",
    category: "Categoría",
    source: "Origen",
    is_active: "Estado",
  }[String(field)] ?? String(field));

  const importActionLabel = (action: ImportPlanItem["action"]) => {
    if (action === "create") return "Crear";
    if (action === "update") return "Actualizar con Excel";
    return "Sin cambios";
  };

  const importFieldsText = (fields: Array<keyof ImportableFoodPayload>) =>
    fields.length ? fields.map(importFieldLabel).join(", ") : "Ninguno";

  const downloadImportPreviewReport = () => {
    if (!importPreview) return;
    const headers = ["Fila", "Alimento", "Acción", "Campos que se actualizarán", "Campos del Excel", "Avisos"];
    const rows = importPreview.items.map(item => [
      item.row,
      item.name,
      importActionLabel(item.action),
      importFieldsText(item.changedFields),
      importFieldsText(item.includedFields),
      item.conflicts.map(conflict => `${importFieldLabel(conflict.field)}: base "${conflict.current}" / Excel "${conflict.incoming}"`).join(" | "),
    ]);
    importPreview.skipped.forEach(item => rows.push([
      item.row,
      item.name,
      "Omitir",
      "",
      "",
      item.reason,
    ]));
    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `informe-importacion-alimentos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-internal-foods-page pb-28 max-w-3xl mx-auto">
      <AdminPageHeader
        title="Alimentos internos"
        subtitle="Base editable que el cálculo nutricional consulta antes de USDA y FatSecret."
      />

      <form onSubmit={save} className="card-soft admin-internal-foods-container p-4 space-y-4 mb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg">{editingId ? "Editar alimento" : "Nuevo alimento"}</h2>
            <p className="text-xs muted">Los valores deben corresponder a la cantidad base indicada.</p>
          </div>
          {editingId && (
            <button type="button" onClick={reset} className="btn-ghost">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs muted">Nombre</span>
            <input className="field" value={form.name} onChange={e => updateForm({ name: e.target.value })} required />
          </label>
          <label className="space-y-1">
            <span className="text-xs muted">Categoría</span>
            <input className="field" value={form.category} onChange={e => updateForm({ category: e.target.value })} />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-xs muted">Sinónimos separados por comas</span>
          <input className="field" placeholder="Ej. aove, aceite, olive oil" value={form.synonyms} onChange={e => updateForm({ synonyms: e.target.value })} />
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-xs muted">Cantidad base</span>
            <input className="field" type="number" min="0" step="0.1" value={form.base_quantity} onChange={e => updateForm({ base_quantity: numberInputValue(e.target.value) })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs muted">Unidad base</span>
            <select className="field" value={baseUnitOptionFromForm(form)} onChange={e => updateForm(baseUnitPatch(e.target.value as BaseUnitOption))}>
              <option value="100g">100 g / gramos</option>
              <option value="50g">50 g / gramos</option>
              <option value="25g">25 g / gramos</option>
              <option value="100ml">100 ml / mililitros</option>
              <option value="serving">1 ración</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs muted">Fuente</span>
            <input className="field" value={form.source} onChange={e => updateForm({ source: e.target.value })} />
          </label>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          {NUTRIENT_FIELDS.map(([key, label]) => (
            <div key={key} className="space-y-1">
              <span className="text-xs muted">{label}</span>
              <input
                className="field"
                type="number"
                step="0.001"
                min="0"
                value={form[key]}
                onChange={e => updateForm({ [key]: numberInputValue(e.target.value) } as Partial<FormState>)}
              />
              <div className="admin-fast-number-actions">
                {NUTRIENT_QUICK_STEPS.map(step => (
                  <button
                    key={step}
                    type="button"
                    className="admin-fast-number-button"
                    onClick={() => quickAdjustNutrient(key, step)}
                    aria-label={`${step > 0 ? "Sumar" : "Restar"} ${Math.abs(step)} a ${label}`}
                  >
                    {step > 0 ? `+${step}` : step}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={e => updateForm({ is_active: e.target.checked })} />
          Activo para el cálculo nutricional
        </label>

        <button className="btn-primary w-full" disabled={saving}>
          {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear alimento"}
        </button>
      </form>

      <section className="card-soft admin-internal-foods-container p-4 mb-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg">Importar Excel/CSV</h2>
            <p className="text-xs muted">Crea o actualiza alimentos por nombre o sinónimo. Nunca elimina registros.</p>
          </div>
          <label className={`btn-primary cursor-pointer ${(preparingImport || importing) ? "opacity-70 pointer-events-none" : ""}`}>
            <Upload className="h-4 w-4" />
            {preparingImport ? "Analizando…" : importing ? "Importando…" : "Subir archivo"}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={prepareImportFile}
              disabled={preparingImport || importing}
            />
          </label>
        </div>

        {importPreview && (
          <div className="rounded-2xl border border-[#FF2D95]/50 bg-white/70 p-3 text-sm space-y-3">
            <div>
              <h3 className="font-medium">Vista previa de importación</h3>
              <p className="text-xs muted">{importPreview.fileName}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-secondary p-2"><strong>{importPreview.created.length}</strong><br /><span className="text-xs muted">se crearán</span></div>
              <div className="rounded-xl bg-secondary p-2"><strong>{importPreview.updated.length}</strong><br /><span className="text-xs muted">se actualizarán</span></div>
              <div className="rounded-xl bg-secondary p-2"><strong>{importPreview.skipped.length}</strong><br /><span className="text-xs muted">se omitirán</span></div>
            </div>
            <p className="text-xs muted">
              No se eliminará ningún alimento. En alimentos existentes, el Excel actualizará los campos que incluya; las columnas que no estén en el Excel conservarán el valor actual de la base.
              Las categorías del Excel no se aplican automáticamente: los alimentos nuevos quedarán en “Sin categoría” y los existentes conservarán su categoría actual.
            </p>
            {importPreview.conflicts.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-primary">
                  {importPreview.conflicts.length} posibles actualizaciones no se aplicarán automáticamente
                </summary>
                <ul className="mt-2 space-y-1">
                  {importPreview.conflicts.slice(0, 12).map((item, index) => (
                    <li key={`${item.row}-${item.field}-${index}`}>
                      Fila {item.row}: {item.name} · {item.field}: base “{item.current}” / Excel “{item.incoming}”
                    </li>
                  ))}
                  {importPreview.conflicts.length > 12 && <li>…y {importPreview.conflicts.length - 12} posibles cambios más.</li>}
                </ul>
              </details>
            )}
            {importPreview.skipped.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">Ver filas que se omitirán</summary>
                <ul className="mt-2 space-y-1">
                  {importPreview.skipped.slice(0, 12).map(item => (
                    <li key={`${item.row}-${item.name}`}>Fila {item.row}: {item.name} · {item.reason}</li>
                  ))}
                  {importPreview.skipped.length > 12 && <li>…y {importPreview.skipped.length - 12} filas más.</li>}
                </ul>
              </details>
            )}
            <details className="rounded-xl border border-border bg-white/60 p-3 text-xs">
              <summary className="cursor-pointer font-medium text-primary">Ver detalles</summary>
              <div className="mt-3 space-y-3 max-h-72 overflow-auto pr-1">
                {importPreview.items.map(item => (
                  <div key={`${item.row}-${item.name}`} className="rounded-xl bg-secondary/70 p-2">
                    <div className="font-medium">Fila {item.row}: {item.name}</div>
                    <div>Acción: {importActionLabel(item.action)}</div>
                    {item.action === "create" && (
                      <div>Se creará con los campos incluidos en el Excel: {importFieldsText(item.includedFields)}</div>
                    )}
                    {item.action === "update" && (
                      <div>Se actualizarán con los datos del Excel: {importFieldsText(item.changedFields)}</div>
                    )}
                    {item.action === "unchanged" && (
                      <div>No se aplicarán cambios automáticos.</div>
                    )}
                    {item.conflicts.length > 0 && (
                      <ul className="mt-1 space-y-1">
                        {item.conflicts.map((conflict, index) => (
                          <li key={`${conflict.field}-${index}`}>
                            Se conserva {importFieldLabel(conflict.field)}: base “{conflict.current}” / Excel “{conflict.incoming}”
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                {importPreview.skipped.map(item => (
                  <div key={`skipped-${item.row}-${item.name}`} className="rounded-xl bg-secondary/70 p-2">
                    <div className="font-medium">Fila {item.row}: {item.name}</div>
                    <div>Acción: Omitir</div>
                    <div>Motivo: {item.reason}</div>
                  </div>
                ))}
              </div>
            </details>
            <button type="button" className="btn-secondary w-full" onClick={downloadImportPreviewReport}>
              <Download className="h-4 w-4" />
              Descargar informe
            </button>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" className="btn-primary flex-1" onClick={confirmImportPreview} disabled={importing}>
                {importing ? "Importando…" : "Confirmar importación"}
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setImportPreview(null)} disabled={importing}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {importReport && (
          <div className="rounded-2xl border border-[#FF2D95]/50 bg-white/70 p-3 text-sm space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-secondary p-2"><strong>{importReport.created.length}</strong><br /><span className="text-xs muted">creados</span></div>
              <div className="rounded-xl bg-secondary p-2"><strong>{importReport.updated.length}</strong><br /><span className="text-xs muted">actualizados</span></div>
              <div className="rounded-xl bg-secondary p-2"><strong>{importReport.skipped.length}</strong><br /><span className="text-xs muted">omitidos</span></div>
            </div>
            {importReport.skipped.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">Ver filas omitidas</summary>
                <ul className="mt-2 space-y-1">
                  {importReport.skipped.slice(0, 40).map(item => (
                    <li key={`${item.row}-${item.name}`}>Fila {item.row}: {item.name} · {item.reason}</li>
                  ))}
                  {importReport.skipped.length > 40 && <li>…y {importReport.skipped.length - 40} filas más.</li>}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="card-soft admin-internal-foods-container p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 muted" />
          <input className="field" placeholder="Buscar alimento, categoría, fuente o sinónimo…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <div className="flex items-center justify-between text-xs muted mb-3">
          <span>{loading ? "Cargando…" : `${filtered.length} de ${foods.length} alimentos`}</span>
          <span>Prioridad: internos → USDA → FatSecret</span>
        </div>

        <div className="space-y-2">
          {filtered.map(food => (
            <div key={food.id} className={`admin-internal-food-row rounded-2xl border p-3 ${food.is_active ? "border-border" : "border-dashed opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    <h3 className="font-medium truncate">{food.name}</h3>
                    {!food.is_active && <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted">Inactivo</span>}
                  </div>
                  <p className="text-xs muted mt-1">
                    {displayFoodCategory(food.category)} · Base: {food.base_quantity} {food.base_unit === "serving" ? "ración" : food.base_unit} · Fuente: {food.source}
                  </p>
                  {food.synonyms.length > 0 && <p className="text-xs muted mt-1">Sinónimos: {food.synonyms.join(", ")}</p>}
                  <div className="grid grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-4 gap-1 text-center text-[11px] mt-2">
                    <span className="rounded-lg bg-secondary p-1">{food.calories} kcal</span>
                    <span className="rounded-lg bg-secondary p-1">{food.protein}g prot</span>
                    <span className="rounded-lg bg-secondary p-1">{food.carbs}g hidr</span>
                    <span className="rounded-lg bg-secondary p-1">{formatOptionalGramValue(food.azucares_g)} azúcar</span>
                    <span className="rounded-lg bg-secondary p-1">{food.fat}g grasa</span>
                    <span className="rounded-lg bg-secondary p-1">{formatOptionalGramValue(food.grasas_saturadas_g)} sat</span>
                    <span className="rounded-lg bg-secondary p-1">{food.fiber}g fibra</span>
                    <span className="rounded-lg bg-secondary p-1">{food.salt}g sal</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button type="button" onClick={() => edit(food)} className="btn-ghost text-xs">
                    <Edit3 className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button type="button" onClick={() => remove(food)} className="btn-ghost text-xs text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && <p className="text-sm muted text-center py-6">No hay alimentos que coincidan con la búsqueda.</p>}
        </div>
      </section>
    </div>
  );
}
