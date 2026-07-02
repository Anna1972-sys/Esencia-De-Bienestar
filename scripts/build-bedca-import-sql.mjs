#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_INPUT = "data/bedca/bedca_official.csv";
const DEFAULT_OUTPUT = "supabase/generated/bedca_import.sql";
const SOURCE_LABEL = "BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)";

const args = process.argv.slice(2);
const inputArg = args.find(arg => arg.startsWith("--input="))?.split("=").slice(1).join("=") || DEFAULT_INPUT;
const outputArg = args.find(arg => arg.startsWith("--output="))?.split("=").slice(1).join("=") || DEFAULT_OUTPUT;

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Genera un SQL idempotente para importar un CSV oficial de BEDCA en public.spanish_foods.

Uso:
  node scripts/build-bedca-import-sql.mjs
  node scripts/build-bedca-import-sql.mjs --input=data/bedca/bedca_official.csv --output=supabase/generated/bedca_import.sql

El CSV no se importa directamente. El script genera un archivo SQL revisable con:
  INSERT INTO public.spanish_foods (...) VALUES (...)
  ON CONFLICT (nombre_normalizado) DO UPDATE SET ...
`);
  process.exit(0);
}

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

function getFirst(row, headerMap, names) {
  for (const name of names) {
    const index = headerMap.get(name);
    if (index !== undefined) {
      const value = row[index];
      if (value !== undefined && String(value).trim() !== "") return String(value).trim();
    }
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

function sqlText(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  return value === null || value === undefined || Number.isNaN(value) ? "NULL" : String(value);
}

function sqlTextArray(values) {
  const uniqueValues = Array.from(new Set(values.map(value => String(value).trim()).filter(Boolean)));
  if (!uniqueValues.length) return "ARRAY[]::text[]";
  return `ARRAY[${uniqueValues.map(sqlText).join(", ")}]::text[]`;
}

function inferEstado(nombre, explicit) {
  const normalizedExplicit = normalizeFoodName(explicit);
  if (["crudo", "cocido", "natural", "procesado"].includes(normalizedExplicit)) return normalizedExplicit;
  const normalizedName = normalizeFoodName(nombre);
  if (/\b(crudo|cruda)\b/.test(normalizedName)) return "crudo";
  if (/\b(cocido|cocida|hervido|hervida)\b/.test(normalizedName)) return "cocido";
  if (/\b(frito|frita|galleta|pan|harina|concentrado|deshidratado|procesado)\b/.test(normalizedName)) return "procesado";
  return "natural";
}

function aliasesFrom(value) {
  return String(value ?? "")
    .split(/[|,;]/)
    .map(alias => alias.trim())
    .filter(Boolean);
}

let csvText;
try {
  csvText = readFileSync(inputPath, "utf8");
} catch {
  console.error(`No se encontró el CSV: ${inputPath}`);
  console.error("Coloca el archivo oficial en data/bedca/bedca_official.csv o usa --input=RUTA.");
  process.exit(1);
}

const delimiter = detectDelimiter(csvText);
const rows = parseCsv(csvText, delimiter);
if (rows.length < 2) {
  console.error("El CSV no contiene filas suficientes.");
  process.exit(1);
}

const headers = rows[0].map(normalizeHeader);
const headerMap = new Map(headers.map((header, index) => [header, index]));
const values = [];
const seen = new Set();

for (const row of rows.slice(1)) {
  const nombre = getFirst(row, headerMap, ["nombre", "alimento", "nombre_alimento", "descripcion", "food_name", "name"]);
  if (!nombre) continue;

  const nombreNormalizado = getFirst(row, headerMap, ["nombre_normalizado", "normalized_name"]) || normalizeFoodName(nombre);
  if (!nombreNormalizado || seen.has(nombreNormalizado)) continue;
  seen.add(nombreNormalizado);

  const categoria = getFirst(row, headerMap, ["categoria", "grupo", "grupo_alimentos", "food_group", "category"]) || "general";
  const estado = inferEstado(nombre, getFirst(row, headerMap, ["estado", "state"]));
  const aliases = aliasesFrom(getFirst(row, headerMap, ["aliases", "alias", "sinonimos", "sinónimos"]));
  const fuente = getFirst(row, headerMap, ["fuente", "source"]) || SOURCE_LABEL;

  const kcal = parseNumber(getFirst(row, headerMap, ["kcal_100g", "energia_kcal", "energia", "kcal", "valor_energetico_kcal"]));
  const proteina = parseNumber(getFirst(row, headerMap, ["proteina_100g", "proteinas_100g", "proteina", "proteinas", "protein"]));
  const hidratos = parseNumber(getFirst(row, headerMap, ["hidratos_100g", "hidratos_de_carbono", "carbohidratos", "carbohidratos_100g", "carbs", "carbohydrate"]));
  const grasa = parseNumber(getFirst(row, headerMap, ["grasa_100g", "grasas_100g", "grasa", "grasas", "lipidos", "fat"]));
  const fibra = parseNumber(getFirst(row, headerMap, ["fibra_100g", "fibra", "fiber"]));
  const azucares = parseNumber(getFirst(row, headerMap, ["azucares_100g", "azucares", "azúcares", "sugars"]));
  const sal = parseNumber(getFirst(row, headerMap, ["sal_100g", "sal", "salt"]));

  if ([kcal, proteina, hidratos, grasa, fibra].every(value => value === null)) continue;

  values.push(`(${[
    sqlText(nombre),
    sqlText(nombreNormalizado),
    sqlTextArray(aliases),
    sqlText(categoria),
    sqlText(estado),
    sqlNumber(kcal),
    sqlNumber(proteina),
    sqlNumber(hidratos),
    sqlNumber(grasa),
    sqlNumber(fibra),
    sqlNumber(azucares),
    sqlNumber(sal),
    sqlText(fuente),
    "true",
    "true",
  ].join(", ")})`);
}

if (!values.length) {
  console.error("No se encontró ningún alimento importable con macros por 100 g.");
  process.exit(1);
}

const sql = `-- Generado desde ${inputArg}
-- Revisa el contenido antes de ejecutarlo en Supabase SQL Editor.
-- No borra datos: inserta nuevos alimentos y actualiza los existentes por nombre_normalizado.

INSERT INTO public.spanish_foods (
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
  is_active
)
VALUES
${values.join(",\n")}
ON CONFLICT (nombre_normalizado) DO UPDATE
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
  updated_at = now();

NOTIFY pgrst, 'reload schema';
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sql, "utf8");
console.log(`SQL generado: ${outputPath}`);
console.log(`Alimentos preparados: ${values.length}`);
