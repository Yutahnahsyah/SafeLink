import { createContext, useContext, useEffect, useMemo, useState } from "react";

const RouterContext = createContext(null);

function readLocation() {
  return {
    pathname: window.location.pathname.replace(/\/+$/, "") || "/",
    search: window.location.search,
  };
}

export function RouterProvider({ children }) {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const update = () => {
      setLocation(readLocation());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const navigate = (to, { replace = false } = {}) => {
    const target = new URL(to, window.location.origin);
    window.history[replace ? "replaceState" : "pushState"](
      {},
      "",
      `${target.pathname}${target.search}${target.hash}`,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const value = useMemo(
    () => ({ ...location, navigate }),
    [location.pathname, location.search],
  );
  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}

export function Link({ to, onClick, children, ...props }) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          navigate(to);
        }
      }}
      {...props}
    >
      {children}
    </a>
  );
}

export function Redirect({ to }) {
  const { navigate } = useRouter();
  useEffect(() => navigate(to, { replace: true }), [navigate, to]);
  return (
    <div className="route-pending" aria-label="Redirecting">
      <span className="skeleton-block" />
    </div>
  );
}
