const normalizeName = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9ñ]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

const quantityToGrams = (quantity, unit) => {
  const normalizedUnit = String(unit ?? "").toLowerCase();
  if (["g", "gr", "gramos"].includes(normalizedUnit)) return quantity;
  if (["ml", "mililitros"].includes(normalizedUnit)) return quantity;
  if (["cucharada", "cucharadas", "cda", "cdas"].includes(normalizedUnit)) return quantity * 10;
  if (["cucharadita", "cucharaditas", "cdta", "cdtas"].includes(normalizedUnit)) return quantity * 5;
  return undefined;
};

const parseQuantityValue = (value) => {
  const text = String(value ?? "").trim();
  if (text === "¼") return 0.25;
  if (text === "½") return 0.5;
  if (text === "¾") return 0.75;
  const fractionMatch = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) return Number(fractionMatch[1]) / Number(fractionMatch[2]);
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const ingredientInputToRawText = (raw) => {
  if (typeof raw === "string" || typeof raw === "number") return String(raw ?? "").trim();
  if (!raw || typeof raw !== "object") return String(raw ?? "").trim();
  const name = String(raw.name ?? raw.ingredient ?? raw.food ?? raw.food_name ?? raw.label ?? raw.title ?? raw.text ?? raw.raw ?? "").trim();
  const quantity = String(raw.quantity ?? raw.amount ?? raw.qty ?? "").trim();
  const unit = String(raw.unit ?? raw.units ?? "").trim();
  const grams = raw.grams ?? raw.gramos ?? raw.weight_g ?? raw.weight;
  if (quantity && name) {
    const quantityWithUnit = unit && !normalizeName(quantity).split(" ").includes(normalizeName(unit)) ? `${quantity} ${unit}` : quantity;
    return `${quantityWithUnit} ${name}`.replace(/\s+/g, " ").trim();
  }
  if (grams !== undefined && grams !== null && grams !== "" && name) return `${grams} g ${name}`.replace(/\s+/g, " ").trim();
  return name || String(raw.raw ?? "").trim();
};

const parseIngredient = (raw) => {
  const rawText = ingredientInputToRawText(raw);
  const quantityValuePattern = String.raw`(\d+(?:[,.]\d+)?|\d+\s*\/\s*\d+|[¼½¾])`;
  const qtyPattern = new RegExp(`${quantityValuePattern}\\s*(medio\\s+cacito|medios\\s+cacitos|huevo\\s+mediano|huevos\\s+medianos|cacito|cacitos|scoop|scoops|sobre|sobres|stick|sticks|barrita|barritas|lata|latas|tostada|tostadas|rebanada|rebanadas|rodaja|rodajas|vaso|vasos|taza|tazas|diente|dientes|clara|claras|huevo|huevos|g|gr|gramos|ml|mililitros|pieza|piezas|unidad|unidades|cucharada|cucharadas|cda|cdas|cucharadita|cucharaditas|cdta|cdtas)\\b`, "i");
  const qtyMatch = rawText.match(qtyPattern);
  const unitlessCountMatch = !qtyMatch ? rawText.match(new RegExp(`^\\s*${quantityValuePattern}\\s+(.+)$`, "i")) : null;
  const quantity = qtyMatch ? parseQuantityValue(qtyMatch[1]) : unitlessCountMatch ? parseQuantityValue(unitlessCountMatch[1]) : undefined;
  const unit = qtyMatch?.[2]?.toLowerCase();
  const grams = quantity && unit ? quantityToGrams(quantity, unit) : undefined;
  return { raw: rawText, quantity, unit, grams };
};

const cases = [
  ["125 g yogur natural 0%", 125, "g", 125],
  ["150 g pollo", 150, "g", 150],
  ["200 g espárragos", 200, "g", 200],
  ["250 ml caldo", 250, "ml", 250],
  [{ quantity: "125 g", grams: 25, name: "yogur natural 0%" }, 125, "g", 125],
  ["1 yogur", 1, undefined, undefined],
  ["1 lata", 1, "lata", undefined],
  ["1 lata de atún", 1, "lata", undefined],
  ["2 rebanadas pan", 2, "rebanadas", undefined],
  ["1 tostada integral", 1, "tostada", undefined],
  ["3 rodajas tomate", 3, "rodajas", undefined],
  ["1 vaso leche", 1, "vaso", undefined],
  ["1 taza arroz", 1, "taza", undefined],
  ["1/2 cucharadita sal", 0.5, "cucharadita", 5 * 0.5],
  ["½ cucharadita pimienta", 0.5, "cucharadita", 5 * 0.5],
  ["¼ cucharadita canela", 0.25, "cucharadita", 5 * 0.25],
  ["1 unidad tomate", 1, "unidad", undefined],
];

for (const [input, quantity, unit, grams] of cases) {
  const parsed = parseIngredient(input);
  if (parsed.quantity !== quantity || parsed.unit !== unit || parsed.grams !== grams) {
    console.error("Parser incorrecto", { input, expected: { quantity, unit, grams }, parsed });
    process.exit(1);
  }
}

console.log("Parser de ingredientes OK");
