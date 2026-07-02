# Importación modular de alimentos en `food_items`

La aplicación usa esta prioridad para calcular macros:

1. Productos Herbalife propios.
2. `public.food_items`.
3. USDA / FoodData Central.
4. FatSecret.
5. `public.internal_foods` como respaldo.
6. Tabla básica integrada como último respaldo.

`food_items` es la tabla unificada para alimentos importados desde distintas fuentes.

## Fuentes preparadas

- BEDCA: alimentos españoles básicos.
- USDA FoodData Central: alimentos internacionales.
- Open Food Facts: productos comerciales.

No se descarga nada automáticamente y no se importan datos inventados.

## Dónde colocar los archivos

BEDCA:

```text
data/bedca/bedca_official.csv
data/bedca/bedca_official.xml
```

USDA:

```text
data/usda/usda_fooddata_export.json
```

Open Food Facts:

```text
data/open-food-facts/open_food_facts_export.csv
```

## Cómo generar SQL

BEDCA:

```bash
npm run bedca:build-sql
```

USDA:

```bash
npm run usda:build-sql
```

Open Food Facts:

```bash
npm run off:build-sql
```

Comando genérico:

```bash
npm run foods:build-sql -- --source=bedca --input=data/bedca/bedca_official.xml
```

## Qué hace el SQL generado

El SQL generado inserta o actualiza en:

```text
public.food_items
```

Usa:

```sql
ON CONFLICT (source_type, nombre_normalizado, source_id) DO UPDATE
```

Eso significa:

- Si el alimento no existe, lo añade.
- Si ya existe, lo actualiza.
- No duplica alimentos de la misma fuente.
- No borra alimentos.
- No borra recetas.
- No toca productos Herbalife.
- No modifica diseño ni pantallas.

## Verificación rápida

Total por fuente:

```sql
select source_type, count(*)
from public.food_items
where verificado = true and is_active = true
group by source_type
order by source_type;
```

Comprobar un alimento:

```sql
select
  source_type,
  nombre,
  categoria,
  estado,
  kcal_100g,
  proteina_100g,
  hidratos_100g,
  grasa_100g,
  fibra_100g
from public.food_items
where nombre_normalizado like '%tomate%';
```

Comprobar que `internal_foods` queda como respaldo:

```sql
select count(*) from public.internal_foods;
select count(*) from public.food_items;
```
