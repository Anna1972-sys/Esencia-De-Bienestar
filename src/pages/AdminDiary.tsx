import SimpleListAdmin from "@/components/admin/SimpleListAdmin";

export default function AdminDiary() {
  return (
    <SimpleListAdmin
      table="diary_questions"
      title="Diario"
      subtitle="Configura las preguntas que verán los usuarios en su diario."
      primaryField="question"
      secondaryField="hint"
      defaults={{ field_type: "text", is_active: true }}
      fields={[
        { key: "question", label: "Pregunta", required: true, placeholder: "¿Cómo te has sentido hoy?" },
        { key: "hint", label: "Pista o aclaración", type: "textarea" },
        { key: "field_type", label: "Tipo de respuesta", type: "select", options: [
          { value: "text", label: "Texto corto" },
          { value: "textarea", label: "Texto largo" },
          { value: "number", label: "Número" },
          { value: "scale", label: "Escala 1–10" },
        ]},
        { key: "is_active", label: "Mostrar en el diario", type: "checkbox", placeholder: "Activa esta pregunta" },
      ]}
    />
  );
}
