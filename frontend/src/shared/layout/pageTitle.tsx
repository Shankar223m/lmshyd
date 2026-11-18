import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * A page names itself once, in the top bar: the title follows the screen (and the action being done on it), so the
 * page itself carries no second heading. Pages set it through ``PageHeader``; outside the app layout there is no top
 * bar and ``PageHeader`` keeps drawing its own heading.
 */
const SetTitle = createContext<((title: ReactNode) => void) | null>(null);
const Title = createContext<ReactNode>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<ReactNode>(null);
  return (
    <SetTitle.Provider value={setTitle}>
      <Title.Provider value={title}>{children}</Title.Provider>
    </SetTitle.Provider>
  );
}

/**
 * The title in the top bar. Only this small component listens for the title, so setting it never re-renders the page
 * (a page that re-rendered on every title change would set it again, without end, whenever its title is not a plain string).
 */
export function TopBarTitle() {
  const title = useContext(Title);
  if (!title) return null;
  return <h1 className="min-w-0 truncate text-base font-semibold text-navy-950 sm:text-lg">{title}</h1>;
}

/** Registers the page's title in the top bar; returns false when there is no top bar to show it in. */
export function useShowTitleInTopBar(title: ReactNode): boolean {
  const set = useContext(SetTitle);
  useEffect(() => {
    if (!set) return;
    set(title);
    return () => set(null);
  }, [set, title]);
  return set !== null;
}

/** For a screen that only names itself: the name goes to the top bar and nothing is drawn in the page. */
export function PageTitle({ children }: { children: ReactNode }) {
  const inTopBar = useShowTitleInTopBar(children);
  return inTopBar ? null : <h1 className="mb-5 text-2xl font-bold tracking-tight text-navy-950">{children}</h1>;
}
