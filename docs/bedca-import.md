# Importación futura de BEDCA en `spanish_foods`

Esta app ya tiene el motor preparado para usar esta prioridad:

1. Productos Herbalife propios.
2. `public.spanish_foods`.
3. USDA / FoodData Central.
4. FatSecret.
5. Tablas internas de respaldo.

Si `spanish_foods` está vacía o todavía no se ha importado el CSV oficial, la app sigue funcionando como hasta ahora.

## Dónde colocar el CSV oficial

Cuando tengas el CSV oficial de BEDCA, colócalo aquí:

```text
data/bedca/bedca_official.csv
```

No se descarga nada automáticamente y no se incluyen datos inventados.

## Columnas reconocidas

El importador acepta nombres de columnas habituales. Como mínimo debe encontrar:

- Nombre: `nombre`, `alimento`, `nombre_alimento`, `descripcion`, `food_name` o `name`.
- Energía: `kcal_100g`, `energia_kcal`, `energia`, `kcal` o `valor_energetico_kcal`.
- Proteína: `proteina_100g`, `proteinas_100g`, `proteina`, `proteinas` o `protein`.
- Hidratos: `hidratos_100g`, `hidratos_de_carbono`, `carbohidratos`, `carbohidratos_100g`, `carbs` o `carbohydrate`.
- Grasas: `grasa_100g`, `grasas_100g`, `grasa`, `grasas`, `lipidos` o `fat`.
- Fibra: `fibra_100g`, `fibra` o `fiber`.

También reconoce opcionalmente:

- `nombre_normalizado`
- `categoria` / `grupo`
- `estado`
- `aliases` / `sinonimos`
- `azucares_100g`
- `sal_100g`
- `fuente`

## Cómo generar el SQL

Desde la carpeta del proyecto:

```bash
npm run bedca:build-sql
```

Esto genera:

```text
supabase/generated/bedca_import.sql
```

## Cómo ejecutarlo

1. Abre Supabase.
2. Entra en el proyecto correcto.
3. Abre SQL Editor.
4. Abre el archivo generado `supabase/generated/bedca_import.sql`.
5. Copia todo el contenido.
6. Pégalo en SQL Editor.
7. Ejecuta.

## Seguridad de la importación

El SQL generado usa:

```sql
ON CONFLICT (nombre_normalizado) DO UPDATE
```

Eso significa:

- Si el alimento no existe, lo inserta.
- Si ya existe, lo actualiza.
- No crea duplicados por `nombre_normalizado`.
- No borra alimentos.
- No borra recetas.
- No modifica productos Herbalife.
- No toca USDA ni FatSecret.

## Verificación rápida

Después de ejecutar el SQL:

```sql
select count(*) from public.spanish_foods where verificado = true and is_active = true;
```

Y para comprobar un alimento:

```sql
select nombre, categoria, estado, kcal_100g, proteina_100g, hidratos_100g, grasa_100g, fibra_100g
from public.spanish_foods
where nombre_normalizado like '%tomate%';
```
