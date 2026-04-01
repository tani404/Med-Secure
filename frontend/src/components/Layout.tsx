import { Link, NavLink, Outlet } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const links = [
  ["Home", "/"],
  ["Verify", "/verify"],
  ["Manufacturer", "/manufacturer"],
  ["Create Batch", "/manufacturer/create"],
  ["My Batches", "/manufacturer/batches"],
  ["Distributor", "/distributor"],
  ["To Pharmacy", "/distributor/transfer"],
  ["Pharmacy", "/pharmacy"],
  ["Mark Sold", "/pharmacy/sell"]
] as const;

export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="logo">MedSecure</Link>
        <nav className="nav">
          {links.map(([label, href]) => (
            <NavLink key={href} to={href} className={({ isActive }) => isActive ? "active" : ""}>
              {label}
            </NavLink>
          ))}
        </nav>
        <ConnectButton />
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
