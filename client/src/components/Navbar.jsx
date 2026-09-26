import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import BrandLogo from "./BrandLogo";
import { Link, useRouter } from "../routing";
import "./Navbar.css";

const links = [
  ["Home", "/"],
  ["About", "/about"],
  ["How It Works", "/how-it-works"],
  ["Safety Map", "/safety-map"],
  ["FAQ", "/faq"],
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const headerRef = useRef(null);
  const { pathname } = useRouter();
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const key = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const outside = (e) => {
      if (!headerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return (
    <header
      ref={headerRef}
      className={`navbar navbar--focused public-navbar ${scrolled || pathname !== "/" ? "is-scrolled" : ""}`}
    >
      <div className="container nav-inner">
        <Link to="/" className="nav-logo-link">
          <BrandLogo />
        </Link>
        <button
          className="menu-button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="main-navigation"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <Icon name={open ? "close" : "menu"} size={24} />
        </button>
        <nav
          id="main-navigation"
          className={`nav-links ${open ? "is-open" : ""}`}
          aria-label="Public navigation"
        >
          {links.map(([label, to]) => (
            <Link
              key={to}
              to={to}
              aria-current={pathname === to ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
          <div className="mobile-actions">
            <Link className="login" to="/login">
              Login
            </Link>
            <Link className="button button-sm" to="/register">
              Get Started <Icon name="arrow" size={15} />
            </Link>
          </div>
        </nav>
        <div className="nav-actions">
          <Link className="login" to="/login">
            Login
          </Link>
          <Link className="button button-sm" to="/register">
            Get Started <Icon name="arrow" size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}
