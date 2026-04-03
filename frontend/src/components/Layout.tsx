import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, medicineSupplyChainAbi } from "../config/contract";

type Role = "manufacturer" | "distributor" | "pharmacy" | "consumer";

const roleForAddress = (address?: string): Role | null => {
  if (!address) return null;
  return (localStorage.getItem(`medsecure-role:${address.toLowerCase()}`) as Role | null) ?? null;
};

function effectiveRole(address: string | undefined, isOwner: boolean): Role | null {
  const stored = roleForAddress(address);
  if (stored) return stored;
  if (isOwner) return "manufacturer";
  return null;
}

export function Layout() {
  const { address, isConnected } = useAccount();
  const location = useLocation();
  const [roleVersion, setRoleVersion] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: owner } = useReadContract({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "owner" });
  const isOwner = !!address && address.toLowerCase() === String(owner).toLowerCase();

  useEffect(() => {
    const bump = () => setRoleVersion((v) => v + 1);
    window.addEventListener("medsecure-role-change", bump);
    return () => window.removeEventListener("medsecure-role-change", bump);
  }, []);

  useEffect(() => {
    setRoleVersion((v) => v + 1);
  }, [location.pathname, address]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const role = useMemo(() => effectiveRole(address, isOwner), [address, isOwner, roleVersion]);

  const links: Array<[string, string]> = [["Home", "/"]];
  if (isConnected) links.push(["Join Role", "/portal"]);

  if (!isConnected) {
    links.push(["Verify medicine", "/verify"]);
  } else if (role === "manufacturer") {
    links.push(
      ["Create batch", "/manufacturer/create"],
      ["My batches", "/manufacturer/batches"],
      ["Assign distributor", "/manufacturer/assign"]
    );
  } else if (role === "distributor") {
    links.push(
      ["Assign to pharmacy", "/distributor/transfer"],
      ["Assigned batches", "/distributor"],
      ["View timeline", "/distributor/timeline"]
    );
  } else if (role === "pharmacy") {
    links.push(
      ["Mark as sold", "/pharmacy/sell"],
      ["Assigned batches", "/pharmacy"],
      ["View timeline", "/pharmacy/timeline"]
    );
  } else if (role === "consumer") {
    links.push(["Verify medicine", "/verify"]);
  } else {
    links.push(["Verify medicine", "/verify"]);
  }

  return (
    <div className="app-shell">
      {/* Glass Nav */}
      <header className="topbar">
        <div className="flex items-center gap-8">
          <Link to="/" className="logo flex items-center gap-2"><img src="/logo.svg" alt="MedSecure" className="h-8 w-8" />MedSecure</Link>
          <nav className="nav" aria-label="Main">
            {links.map(([label, href], i) => (
              <NavLink
                key={`${href}-${i}`}
                to={href}
                className={({ isActive }) => isActive ? "active shrink-0" : "shrink-0"}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden material-symbols-outlined text-on-surface-variant hover:opacity-80 transition-opacity"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? "close" : "menu"}
          </button>
          <ConnectButton />
        </div>
      </header>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-white/95 backdrop-blur-md pt-20 px-6 md:hidden animate-fade-in">
          <nav className="flex flex-col gap-2">
            {links.map(([label, href], i) => (
              <NavLink
                key={`${href}-${i}`}
                to={href}
                className={({ isActive }) =>
                  `px-4 py-3 rounded-xl font-label text-sm tracking-wide transition-colors ${
                    isActive ? "bg-primary text-on-primary" : "text-slate-600 hover:bg-surface-c-low"
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      {/* Page content — offset by nav height */}
      <main className="container pt-24">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-12 max-w-7xl mx-auto gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="MedSecure" className="h-6 w-6" />
            <span className="font-headline italic text-slate-700">MedSecure Ledger</span>
            <span className="text-slate-300 mx-2">|</span>
            <span className="font-body text-sm tracking-wide text-slate-500">Live on Ethereum Sepolia</span>
          </div>
          <div className="flex items-center gap-8">
            <span className="text-slate-500 font-body text-sm tracking-wide">Documentation</span>
            <span className="text-slate-500 font-body text-sm tracking-wide">Security</span>
            <span className="text-slate-500 font-body text-sm tracking-wide">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
