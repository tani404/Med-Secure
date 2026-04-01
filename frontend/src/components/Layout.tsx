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
      <header className="topbar">
        <Link to="/" className="logo">
          MedSecure
        </Link>
        <nav
          className="nav max-w-[calc(100vw-8rem)] flex-1 overflow-x-auto pb-0.5 sm:max-w-none sm:flex-wrap sm:overflow-visible sm:pb-0"
          aria-label="Main"
        >
          {links.map(([label, href], i) => (
            <NavLink key={`${href}-${i}`} to={href} className={({ isActive }) => (isActive ? "active shrink-0" : "shrink-0")}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <ConnectButton />
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
