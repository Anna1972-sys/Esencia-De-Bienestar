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
  return undefined;
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
  const qtyPattern = /(\d+(?:[,.]\d+)?)\s*(medio\s+cacito|medios\s+cacitos|huevo\s+mediano|huevos\s+medianos|cacito|cacitos|scoop|scoops|sobre|sobres|stick|sticks|barrita|barritas|diente|dientes|clara|claras|huevo|huevos|g|gr|gramos|ml|mililitros|pieza|piezas|unidad|unidades|cucharada|cucharadas|cda|cdas|cucharadita|cucharaditas|cdta|cdtas)\b/i;
  const qtyMatch = rawText.match(qtyPattern);
  const unitlessCountMatch = !qtyMatch ? rawText.match(/^\s*(\d+(?:[,.]\d+)?)\s+(.+)$/i) : null;
  const quantity = qtyMatch ? Number(qtyMatch[1].replace(",", ".")) : unitlessCountMatch ? Number(unitlessCountMatch[1].replace(",", ".")) : undefined;
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
  ["1 lata", 1, undefined, undefined],
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
