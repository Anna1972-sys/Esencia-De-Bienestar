export type LibraryContext = {
  selectedCat: string | null;
  query: string;
  scrollY: number;
};

const LIBRARY_RETURN_CONTEXT_KEY = "esencia:library-recipes-return";

const isLibraryContext = (value: unknown): value is LibraryContext => {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<LibraryContext>;
  return (
    (typeof context.selectedCat === "string" || context.selectedCat === null || context.selectedCat === undefined) &&
    typeof context.query === "string" &&
    typeof context.scrollY === "number"
  );
};

export const readLibraryReturnContext = (): LibraryContext | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LIBRARY_RETURN_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isLibraryContext(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const resolveLibraryReturnContext = (value: unknown): LibraryContext | null => {
  return isLibraryContext(value) ? value : readLibraryReturnContext();
};

export const saveLibraryReturnContext = (context: LibraryContext) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LIBRARY_RETURN_CONTEXT_KEY, JSON.stringify(context));
};
