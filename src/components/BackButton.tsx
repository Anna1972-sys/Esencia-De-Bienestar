import { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  fallbackTo?: string;
};

export default function BackButton({
  children,
  fallbackTo = "/app",
  type = "button",
  onClick,
  ...props
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const historyIndex = window.history.state?.idx;
    const hasPreviousRoute =
      (typeof historyIndex === "number" && historyIndex > 0) ||
      (location.key !== "default" && window.history.length > 1);

    if (hasPreviousRoute) navigate(-1);
    else navigate(fallbackTo, { replace: true });
  };

  return (
    <button type={type} onClick={goBack} {...props}>
      {children}
    </button>
  );
}
