#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const SOURCE_CONFIG = {
  bedca: {
    defaultInput: "data/bedca/bedca_official.csv",
    defaultOutput: "supabase/generated/bedca_food_items_import.sql",
    sourceLabel: "BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)",
  },
  usda: {
    defaultInput: "data/usda/usda_fooddata_export.json",
    defaultOutput: "supabase/generated/usda_food_items_import.sql",
    sourceLabel: "USDA FoodData Central (https://fdc.nal.usda.gov/)",
  },
  open_food_facts: {
    defaultInput: "data/open-food-facts/open_food_facts_export.csv",
    defaultOutput: "supabase/generated/open_food_facts_food_items_import.sql",
    sourceLabel: "Open Food Facts (https://world.openfoodfacts.org/)",
  },
};

const args = process.argv.slice(2);
const source = args.find(arg => arg.startsWith("--source="))?.split("=").slice(1).join("=");
const sourceType = source === "off" ? "open_food_facts" : source;
const config = SOURCE_CONFIG[sourceType];

if (args.includes("--help") || args.includes("-h") || !config) {
  console.log(`
Genera un SQL idempotente para importar alimentos en public.food_items.

Fuentes soportadas:
  --source=bedca
  --source=usda
  --source=open_food_facts

Ejemplos:
  node scripts/build-food-import-sql.mjs --source=bedca
  node scripts/build-food-import-sql.mjs --source=bedca --input=data/bedca/bedca_official.xml
  node scripts/build-food-import-sql.mjs --source=usda --input=data/usda/usda_fooddata_export.json
  node scripts/build-food-import-sql.mjs --source=open_food_facts --input=data/open-food-facts/open_food_facts_export.csv

No descarga datos ni toca Supabase directamente.
Solo genera un SQL revisable con INSERT ... ON CONFLICT ... DO UPDATE.
`);
  process.exit(args.includes("--help") || args.includes("-h") ? 0 : 1);
}

const inputArg = args.find(arg => arg.startsWith("--input="))?.split("=").slice(1).join("=") || config.defaultInput;
const outputArg = args.find(arg => arg.startsWith("--output="))?.split("=").slice(1).join("=") || config.defaultOutput;
const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeFoodName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(line => line.trim()) ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  if (tabs > semicolons && tabs > commas) return "\t";
  return semicolons >= commas ? ";" : ",";
}

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some(value => String(value).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some(value => String(value).trim() !== "")) rows.push(row);
  return rows;
}

function parseXmlRecords(text) {
  const records = [];
  const blockPattern = /<(food|alimento|record|row|item)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = blockPattern.exec(text))) {
    const body = match[2];
    const record = {};
    const fieldPattern = /<([a-zA-Z0-9_:-]+)\b[^>]*>([\s\S]*?)<\/\1>/g;
    let field;
    while ((field = fieldPattern.exec(body))) {
      const key = normalizeHeader(field[1]);
      const value = field[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (key && value) record[key] = value;
    }
    if (Object.keys(record).length) records.push(record);
  }
  return records;
}

function parseInput(text, path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".json") {
    const payload = JSON.parse(text);
    const rows = Array.isArray(payload)
      ? payload
      : payload.foods ?? payload.products ?? payload.items ?? payload.data ?? [];
    return rows.map(flattenObject);
  }
  if (extension === ".xml") return parseXmlRecords(text);
  const rows = parseCsv(text, detectDelimiter(text));
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function flattenObject(value, prefix = "", output = {}) {
  for (const [key, nestedValue] of Object.entries(value ?? {})) {
    const normalizedKey = normalizeHeader(prefix ? `${prefix}_${key}` : key);
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      flattenObject(nestedValue, normalizedKey, output);
    } else {
      output[normalizedKey] = Array.isArray(nestedValue) ? nestedValue.join("|") : nestedValue;
    }
  }
  return output;
}

function first(row, names) {
  for (const name of names) {
    const key = normalizeHeader(name);
    const value = row[key];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function parseNumber(value) {
  const cleaned = String(value ?? "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")
    .trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEnergyKcal(row) {
  const kcal = parseNumber(first(row, [
    "kcal_100g",
    "energia_kcal",
    "energy_kcal_100g",
    "nutriments_energy_kcal_100g",
    "energy-kcal_100g",
    "kcal",
    "valor_energetico_kcal",
  ]));
  if (kcal !== null) return kcal;
  const kj = parseNumber(first(row, ["energia_kj", "energy_100g", "nutriments_energy_100g", "energy-kj_100g"]));
  return kj === null ? null : Math.round((kj / 4.184) * 10) / 10;
}

function sqlText(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  return value === null || value === undefined || Number.isNaN(value) ? "NULL" : String(value);
}

function sqlJson(value) {
  return `'${JSON.stringify(value ?? {}).replace(/'/g, "''")}'::jsonb`;
}

function sqlTextArray(values) {
  const uniqueValues = Array.from(new Set(values.map(value => String(value).trim()).filter(Boolean)));
  if (!uniqueValues.length) return "ARRAY[]::text[]";
  return `ARRAY[${uniqueValues.map(sqlText).join(", ")}]::text[]`;
}

function aliasesFrom(value) {
  return String(value ?? "")
    .split(/[|,;]/)
    .map(alias => alias.trim())
    .filter(Boolean);
}

function inferEstado(nombre, explicit) {
  const normalizedExplicit = normalizeFoodName(explicit);
  if (["crudo", "cocido", "natural", "procesado"].includes(normalizedExplicit)) return normalizedExplicit;
  const normalizedName = normalizeFoodName(nombre);
  if (/\b(crudo|cruda|raw)\b/.test(normalizedName)) return "crudo";
  if (/\b(cocido|cocida|hervido|hervida|cooked|boiled)\b/.test(normalizedName)) return "cocido";
  if (/\b(frito|frita|galleta|pan|harina|concentrado|deshidratado|procesado|cookie|bread|powder|starch|chips|snack)\b/.test(normalizedName)) return "procesado";
  return sourceType === "open_food_facts" ? "procesado" : "natural";
}

function buildItem(row) {
  const nombre = first(row, [
    "nombre",
    "alimento",
    "nombre_alimento",
    "descripcion",
    "description",
    "food_name",
    "product_name",
    "product_name_es",
    "generic_name",
    "name",
  ]);
  if (!nombre) return null;

  const sourceId = first(row, ["source_id", "fdc_id", "fdcid", "code", "codigo", "id"]) || "";
  const nombreNormalizado = first(row, ["nombre_normalizado", "normalized_name"]) || normalizeFoodName(nombre);
  if (!nombreNormalizado) return null;

  const item = {
    source_type: sourceType,
    source_id: sourceId,
    nombre,
    nombre_normalizado: nombreNormalizado,
    aliases: aliasesFrom(first(row, ["aliases", "alias", "sinonimos", "sinónimos", "brands", "brands_tags"])),
    categoria: first(row, ["categoria", "grupo", "grupo_alimentos", "food_category", "food_category_description", "categories", "categories_tags", "category"]) || "general",
    estado: inferEstado(nombre, first(row, ["estado", "state"])),
    kcal_100g: parseEnergyKcal(row),
    proteina_100g: parseNumber(first(row, ["proteina_100g", "proteinas_100g", "proteins_100g", "nutriments_proteins_100g", "protein"])),
    hidratos_100g: parseNumber(first(row, ["hidratos_100g", "hidratos_de_carbono", "carbohidratos", "carbohydrates_100g", "nutriments_carbohydrates_100g", "carbs", "carbohydrate"])),
    grasa_100g: parseNumber(first(row, ["grasa_100g", "grasas_100g", "fat_100g", "nutriments_fat_100g", "lipidos", "fat"])),
    fibra_100g: parseNumber(first(row, ["fibra_100g", "fiber_100g", "nutriments_fiber_100g", "fibra", "fiber"])),
    azucares_100g: parseNumber(first(row, ["azucares_100g", "sugars_100g", "nutriments_sugars_100g", "azucares", "sugars"])),
    sal_100g: parseNumber(first(row, ["sal_100g", "salt_100g", "nutriments_salt_100g", "sal", "salt"])),
    fuente: first(row, ["fuente", "source"]) || config.sourceLabel,
    verificado: true,
    is_active: true,
    raw_data: row,
  };

  if ([item.kcal_100g, item.proteina_100g, item.hidratos_100g, item.grasa_100g, item.fibra_100g].every(value => value === null)) return null;
  return item;
}

let text;
try {
  text = readFileSync(inputPath, "utf8");
} catch {
  console.error(`No se encontró el archivo: ${inputPath}`);
  console.error("Coloca primero el archivo oficial o usa --input=RUTA.");
  process.exit(1);
}

const parsedRows = parseInput(text, inputPath);
const seen = new Set();
const items = [];
for (const row of parsedRows) {
  const item = buildItem(row);
  if (!item) continue;
  const key = `${item.source_type}|${item.nombre_normalizado}|${item.source_id}`;
  if (seen.has(key)) continue;
  seen.add(key);
  items.push(item);
}

if (!items.length) {
  console.error("No se encontró ningún alimento importable con macros por 100 g.");
  process.exit(1);
}

const values = items.map(item => `(${[
  sqlText(item.source_type),
  sqlText(item.source_id),
  sqlText(item.nombre),
  sqlText(item.nombre_normalizado),
  sqlTextArray(item.aliases),
  sqlText(item.categoria),
  sqlText(item.estado),
  sqlNumber(item.kcal_100g),
  sqlNumber(item.proteina_100g),
  sqlNumber(item.hidratos_100g),
  sqlNumber(item.grasa_100g),
  sqlNumber(item.fibra_100g),
  sqlNumber(item.azucares_100g),
  sqlNumber(item.sal_100g),
  sqlText(item.fuente),
  "true",
  "true",
  sqlJson(item.raw_data),
].join(", ")})`);

const sql = `-- Generado desde ${inputArg}
-- Fuente: ${sourceType}
-- Revisa el contenido antes de ejecutarlo en Supabase SQL Editor.
-- No borra datos: inserta nuevos alimentos y actualiza existentes por source_type + nombre_normalizado + source_id.

INSERT INTO public.food_items (
  source_type,
  source_id,
  nombre,
  nombre_normalizado,
  aliases,
  categoria,
  estado,
  kcal_100g,
  proteina_100g,
  hidratos_100g,
  grasa_100g,
  fibra_100g,
  azucares_100g,
  sal_100g,
  fuente,
  verificado,
  is_active,
  raw_data
)
VALUES
${values.join(",\n")}
ON CONFLICT (source_type, nombre_normalizado, source_id) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  aliases = EXCLUDED.aliases,
  categoria = EXCLUDED.categoria,
  estado = EXCLUDED.estado,
  kcal_100g = EXCLUDED.kcal_100g,
  proteina_100g = EXCLUDED.proteina_100g,
  hidratos_100g = EXCLUDED.hidratos_100g,
  grasa_100g = EXCLUDED.grasa_100g,
  fibra_100g = EXCLUDED.fibra_100g,
  azucares_100g = EXCLUDED.azucares_100g,
  sal_100g = EXCLUDED.sal_100g,
  fuente = EXCLUDED.fuente,
  verificado = EXCLUDED.verificado,
  is_active = EXCLUDED.is_active,
  raw_data = EXCLUDED.raw_data,
  imported_at = now(),
  updated_at = now();

NOTIFY pgrst, 'reload schema';
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sql, "utf8");
console.log(`SQL generado: ${outputPath}`);
console.log(`Fuente: ${sourceType}`);
console.log(`Alimentos preparados: ${items.length}`);
