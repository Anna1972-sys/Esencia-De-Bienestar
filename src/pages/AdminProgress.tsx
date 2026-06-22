import SimpleListAdmin from "@/components/admin/SimpleListAdmin";

export default function AdminProgress() {
  return (
    <SimpleListAdmin
      table="progress_metrics"
      title="Mi progreso"
      subtitle="Define las métricas y objetivos que los usuarios podrán seguir."
      primaryField="name"
      secondaryField="description"
      defaults={{ is_active: true }}
      fields={[
        { key: "name", label: "Nombre de la métrica", required: true, placeholder: "Peso, pasos, agua…" },
        { key: "description", label: "Descripción", type: "textarea" },
        { key: "unit", label: "Unidad", placeholder: "kg, pasos, vasos…" },
        { key: "target_value", label: "Objetivo (opcional)", type: "number" },
        { key: "is_active", label: "Activa", type: "checkbox", placeholder: "Mostrar a los usuarios" },
      ]}
    />
  );
}
