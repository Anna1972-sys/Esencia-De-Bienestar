import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="app-shell px-6 pt-20 text-center">
      <h1 className="heading-xl">404</h1>
      <p className="muted mb-6">Esta página no existe.</p>
      <Link to="/" className="btn-primary">Volver al inicio</Link>
    </div>
  );
}
