export const SHOPPING_CATEGORIES = [
  { id: "proteinas", label: "Proteínas", emoji: "" },
  { id: "frutas_verduras", label: "Frutas y verduras", emoji: "" },
  { id: "lacteos", label: "Lácteos", emoji: "" },
  { id: "cereales_legumbres", label: "Cereales y legumbres", emoji: "" },
  { id: "grasas_saludables", label: "Grasas saludables", emoji: "" },
  { id: "otros", label: "Otros", emoji: "" },
] as const;

export type ShoppingCategoryId = typeof SHOPPING_CATEGORIES[number]["id"];

const KEYWORDS: Record<ShoppingCategoryId, string[]> = {
  proteinas: ["pollo","pavo","ternera","carne","cerdo","jamón","jamon","atún","atun","salmón","salmon","merluza","bacalao","pescado","gambas","langostinos","huevo","huevos","tofu","tempeh","seitán","seitan","proteína","proteina","whey","herbalife","fórmula 1","formula 1"],
  frutas_verduras: ["manzana","plátano","platano","pera","naranja","mandarina","fresa","fresas","arándano","arandano","frambuesa","mora","kiwi","piña","pina","mango","sandía","sandia","melón","melon","uva","aguacate","tomate","lechuga","espinaca","espinacas","rúcula","rucula","kale","brócoli","brocoli","coliflor","calabacín","calabacin","berenjena","pimiento","cebolla","ajo","zanahoria","pepino","champiñón","champinon","seta","setas","espárrago","esparrago","esparragos","apio","puerro","calabaza","fruta","verdura"],
  lacteos: ["leche","yogur","yogurt","queso","quesito","kefir","kéfir","mantequilla","nata","cuajada","skyr","requesón","requeson","mozzarella","feta","parmesano","cheddar"],
  cereales_legumbres: ["arroz","pasta","macarrones","espagueti","fideos","pan","avena","quinoa","cuscús","cuscus","trigo","centeno","cebada","mijo","harina","tortita","tortitas","cereal","cereales","lenteja","lentejas","garbanzo","garbanzos","judía","judia","judías","judias","alubia","alubias","soja","muesli","granola"],
  grasas_saludables: ["aceite","oliva","aguacate","nuez","nueces","almendra","almendras","avellana","avellanas","pistacho","pistachos","cacahuete","cacahuetes","anacardo","anacardos","semilla","semillas","chía","chia","lino","sésamo","sesamo","tahini","mantequilla de cacahuete","coco"],
  otros: [],
};

export function classifyShoppingItem(name: string): ShoppingCategoryId {
  const n = name.toLowerCase().trim();
  for (const cat of Object.keys(KEYWORDS) as ShoppingCategoryId[]) {
    if (KEYWORDS[cat].some(k => n.includes(k))) return cat;
  }
  return "otros";
}

export const getShoppingCategoryLabel = (id?: string | null) =>
  SHOPPING_CATEGORIES.find(c => c.id === id)?.label ?? "Otros";
