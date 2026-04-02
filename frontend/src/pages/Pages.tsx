import { FormEvent, useEffect, useMemo, useState } from "react";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAddress } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";
import { CONTRACT_ADDRESS, medicineSupplyChainAbi, ZERO_ADDRESS } from "../config/contract";
import { dateInputToUnix, shortAddress, statusText, toDate } from "../lib";
import { InfiniteGrid } from "@/components/ui/the-infinite-grid";
import { Reveal, StaggerList, StaggerItem, ScaleIn, HoverLift, ParallaxFloat, CountUp } from "@/components/ui/motion";
import { motion } from "framer-motion";

/* ── Shared Types ── */

type Unit = {
  batchId: bigint;
  drugName: string;
  ipfsHash: string;
  distributor: string;
  pharmacy: string;
  currentOwner: string;
  manufacturingDate: bigint;
  expiryDate: bigint;
  status: number;
};

export type UserRole = "manufacturer" | "distributor" | "pharmacy" | "consumer";

const roleKey = (address?: string) => `medsecure-role:${(address ?? "").toLowerCase()}`;

/* ── Material Icon helper ── */
function Icon({ name, className = "", fill }: { name: string; className?: string; fill?: boolean }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

/* ── Hooks ── */

export function useAllUnits() {
  const { data: ids } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: medicineSupplyChainAbi,
    functionName: "getAllBatchIds"
  });
  const contracts = (ids ?? []).map((id: bigint) => ({
    address: CONTRACT_ADDRESS,
    abi: medicineSupplyChainAbi,
    functionName: "getUnit",
    args: [id]
  }));
  const { data } = useReadContracts({ contracts, query: { enabled: contracts.length > 0 } });
  const units = (data ?? []).flatMap((r: { status: string; result?: unknown }) =>
    r.status === "success" && r.result ? [r.result as Unit] : []
  );
  return { ids: ids ?? [], units };
}

function useRoleAccess() {
  const { address, isConnected } = useAccount();
  const { data: owner } = useReadContract({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "owner" });
  const { units } = useAllUnits();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const isOwner = !!address && address.toLowerCase() === String(owner).toLowerCase();
  const isAssignedDistributor = units.some((u: Unit) => u.distributor.toLowerCase() === String(address).toLowerCase());
  const isAssignedPharmacy = units.some((u: Unit) => u.pharmacy.toLowerCase() === String(address).toLowerCase());

  useEffect(() => {
    if (!address) { setSelectedRole(null); return; }
    const stored = localStorage.getItem(roleKey(address)) as UserRole | null;
    setSelectedRole(stored);
  }, [address]);

  const effectiveRole: UserRole | null = selectedRole ?? (isOwner ? "manufacturer" : null);

  const isRoleAllowed = (role: UserRole) => {
    if (!isConnected) return false;
    if (effectiveRole !== role) return false;
    if (role === "manufacturer") return isOwner;
    if (role === "distributor") return isAssignedDistributor;
    if (role === "pharmacy") return isAssignedPharmacy;
    if (role === "consumer") return true;
    return false;
  };

  const chooseRole = (role: UserRole) => {
    if (!address) return;
    localStorage.setItem(roleKey(address), role);
    setSelectedRole(role);
    window.dispatchEvent(new Event("medsecure-role-change"));
  };

  return { address, isConnected, isOwner, selectedRole, effectiveRole, chooseRole, isRoleAllowed, isAssignedDistributor, isAssignedPharmacy };
}

function formatContractRevert(err: unknown): string {
  const base = err as InstanceType<typeof BaseError>;
  if (base && typeof base.walk === "function") {
    const reverted = base.walk(
      (e: unknown) => (e instanceof ContractFunctionRevertedError ? e : false)
    );
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName) {
      const { errorName, args: errArgs } = reverted.data;
      const tail = Array.isArray(errArgs) && errArgs.length > 0 ? ` — args: ${JSON.stringify(errArgs)}` : "";
      return `Contract reverted: ${errorName}()${tail}`;
    }
    if (base.shortMessage) return base.shortMessage;
    if (base.message) return base.message;
  }
  return err instanceof Error ? err.message : "Transaction failed.";
}

/* ── Gates ── */

function WalletGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  if (!isConnected)
    return (
      <div className="card card-padded flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="w-14 h-14 bg-primary-fixed rounded-full flex items-center justify-center text-primary">
          <Icon name="account_balance_wallet" className="text-3xl" />
        </div>
        <p className="text-base font-semibold text-on-surface">Wallet not connected</p>
        <p className="text-sm text-on-surface-variant">Use the button in the header to connect.</p>
      </div>
    );
  return <>{children}</>;
}

function ManufacturerGate({ children }: { children: React.ReactNode }) {
  const { isRoleAllowed } = useRoleAccess();
  if (!isRoleAllowed("manufacturer"))
    return <AccessNotice text="Only the contract owner can use manufacturer tools. Join as Manufacturer on the role page." />;
  return <WalletGate>{children}</WalletGate>;
}

function DistributorGate({ children }: { children: React.ReactNode }) {
  const { isRoleAllowed } = useRoleAccess();
  if (!isRoleAllowed("distributor"))
    return <AccessNotice text="Join as Distributor on the role page. Your wallet must be assigned on-chain by the manufacturer." />;
  return <WalletGate>{children}</WalletGate>;
}

function PharmacyGate({ children }: { children: React.ReactNode }) {
  const { isRoleAllowed } = useRoleAccess();
  if (!isRoleAllowed("pharmacy"))
    return <AccessNotice text="Join as Pharmacy on the role page. Your wallet must be assigned on-chain by the distributor." />;
  return <WalletGate>{children}</WalletGate>;
}

function AccessNotice({ text }: { text: string }) {
  return (
    <div className="card card-padded max-w-lg">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed-variant shrink-0">
          <Icon name="lock" />
        </div>
        <div>
          <h2>Access required</h2>
          <p className="mt-2 text-sm text-on-surface-variant">{text}</p>
          <Link className="btn btn-outline mt-6 text-xs" to="/portal">Choose role</Link>
        </div>
      </div>
    </div>
  );
}

/* Inline success / error feedback */
function SuccessBanner({ text }: { text: string }) {
  return (
    <motion.div
      className="flex items-center gap-3 p-4 rounded-xl bg-secondary-container/20 ring-1 ring-secondary/20"
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Icon name="check_circle" className="text-secondary" fill />
      <span className="text-sm font-semibold text-secondary">{text}</span>
    </motion.div>
  );
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-on-primary/30 border-t-on-primary" />;
}

/* ═══════════════════════════════ LANDING ═══════════════════════════════ */

export function LandingPage() {
  return (
    <div className="space-y-12">
      {/* Full-width Hero with Infinite Grid — full viewport bleed */}
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen -mt-8 sm:-mt-12">
        <InfiniteGrid
          className="hero min-h-screen px-6 md:px-12 flex flex-col items-center justify-center"
          speedX={0.3}
          speedY={0.3}
          spotlightRadius={400}
        >
          {/* Ambient glow orbs */}
          <div className="absolute inset-0 pointer-events-none z-[1]">
            <div className="absolute right-[-10%] top-[-15%] w-[40%] h-[40%] rounded-full bg-blue-500/15 blur-[120px]" />
            <div className="absolute right-[15%] top-[-5%] w-[20%] h-[20%] rounded-full bg-primary/20 blur-[100px]" />
            <div className="absolute left-[-5%] bottom-[-15%] w-[35%] h-[35%] rounded-full bg-blue-400/10 blur-[120px]" />
          </div>

          <div className="relative z-10 max-w-[760px] mx-auto flex flex-col items-center text-center">
            {/* Live badge */}
            <motion.div className="badge badge-live mb-8 gap-2" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Live on Ethereum Sepolia
            </motion.div>

            <motion.h1 className="text-balance" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}>
              Securing the global pharmaceutical supply chain with{" "}
              <span className="text-primary italic">MedSecure</span> Ledger.
            </motion.h1>

            <motion.p className="mt-6 text-base sm:text-[16px] max-w-[520px]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}>
              An immutable protocol designed for manufacturers, distributors, and pharmacists to verify authenticity in real-time.
            </motion.p>

            <motion.div className="flex flex-wrap justify-center gap-4 mt-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}>
              <Link to="/verify" className="btn btn-primary">Verify a Medicine</Link>
              <Link to="/portal" className="btn btn-outline">Browse Batches</Link>
            </motion.div>

            {/* Stats strip */}
            <motion.div className="flex flex-wrap justify-center gap-12 md:gap-24 py-8 border-t border-slate-200/50 w-full max-w-2xl mt-16" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 1, ease: [0.22, 1, 0.36, 1] }}>
              {[["4", "Roles"], ["100%", "On-chain"], ["IPFS", "Documents"], ["0", "Trust needed"]].map(([val, label]) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="text-2xl font-semibold font-label text-on-background">{val}</span>
                  <span className="text-[11px] text-slate-400 font-label uppercase tracking-widest">{label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Contract info bar — floating at bottom of hero */}
          <motion.div className="relative z-10 w-full max-w-4xl mx-auto mt-12" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}>
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-outline-variant/10">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary" />
                </span>
                <span className="text-xs font-bold font-label text-slate-400 uppercase tracking-wider">Deployed Contract</span>
                <code className="font-label text-[13px] text-primary bg-surface-c-low px-3 py-1 rounded-lg select-all">{CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}</code>
              </div>
            </div>
          </motion.div>
        </InfiniteGrid>
      </div>

      {/* How it works — staggered scroll reveal */}
      <section>
        <Reveal>
          <div className="mb-10">
            <h2 className="font-headline text-3xl sm:text-4xl">Protocol Lifecycle</h2>
            <p className="text-slate-500 mt-1">Standardized cryptographic steps for every medical batch.</p>
          </div>
        </Reveal>
        <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" stagger={0.12}>
          {([
            ["factory", "createBatch()", "Manufacturing", "The origin point where medicine details are hashed and stored on-chain.", "/images/manufacturing.svg"],
            ["local_shipping", "transferToDistributor()", "Logistics", "Real-time custody transfers recorded through cryptographically signed events.", "/images/logistics.svg"],
            ["medical_services", "verifyInventory()", "Pharmacy Receipt", "Local pharmacies confirm batch authenticity before stocking items.", "/images/pharmacy.svg"],
            ["qr_code_scanner", "consumerAudit()", "Patient Scan", "End users verify their specific unit's history via secure NFC or QR tags.", "/images/patient-scan.svg"]
          ] as const).map(([icon, badge, title, desc, img]) => (
            <StaggerItem key={title}>
              <HoverLift className="step-card h-full">
                <div className="rounded-lg overflow-hidden mb-5 -mx-2 -mt-2">
                  <img src={img} alt={title} className="w-full h-40 object-cover" />
                </div>
                <div className="step-icon mb-4">
                  <Icon name={icon} />
                </div>
                <span className="step-badge mb-4">{badge}</span>
                <h3 className="font-bold text-lg mb-2 font-body">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </HoverLift>
            </StaggerItem>
          ))}
        </StaggerList>
      </section>

      {/* Divider slogan between sections */}
      <div className="text-center py-8">
        <Reveal delay={0}>
          <p className="font-label text-xs uppercase tracking-[0.3em] text-primary/60 mb-3">Built for trust</p>
        </Reveal>
        <ParallaxFloat speed={0.08}>
          <Reveal delay={0.1}>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl italic text-slate-800 leading-tight">
              Every pill has a <span className="text-primary">provable</span> past.
            </h2>
          </Reveal>
        </ParallaxFloat>
        <Reveal delay={0.2}>
          <p className="text-slate-400 mt-4 max-w-xl mx-auto text-base font-body leading-relaxed">
            From factory floor to patient hands — cryptographic certainty at every step.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-primary/30" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-primary/30" />
          </div>
        </Reveal>
      </div>

      {/* Feature cards — staggered reveal with gradient border */}
      <StaggerList className="grid grid-cols-1 lg:grid-cols-3 gap-8" stagger={0.15}>
        {([
          ["enhanced_encryption", "Tamper-Proof Audit", "Every status change generates a unique transaction hash that cannot be altered or deleted by any central authority."],
          ["monitoring", "Real-time Tracking", "Integrated on-chain event monitoring to ensure every transfer is visible to all authorized parties instantly."],
          ["account_tree", "Zero-Trust Network", "Role-based access control managed via smart contracts ensures only authorized actors can sign transfers."]
        ] as const).map(([icon, title, desc]) => (
          <StaggerItem key={title}>
            <HoverLift className="feature-card gradient-border h-full">
              <div className="flex items-start gap-6">
                <Icon name={icon} className="text-4xl text-primary shrink-0" />
                <div>
                  <h4 className="text-xl font-headline mb-3">{title}</h4>
                  <p className="text-slate-500 leading-relaxed text-sm">{desc}</p>
                </div>
              </div>
            </HoverLift>
          </StaggerItem>
        ))}
      </StaggerList>

      {/* Visual banner between features and CTA */}
      <div className="relative py-4">
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-20">
          {/* Left — Luxury animated network illustration */}
          <ParallaxFloat speed={0.06} className="flex-1 flex justify-center relative">
            {/* Ambient CSS glows behind SVG */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-primary/[0.04] rounded-full blur-[60px] pointer-events-none" />
            <div className="absolute top-1/4 left-1/3 w-32 h-32 bg-blue-300/[0.06] rounded-full blur-[40px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/3 w-28 h-28 bg-green-300/[0.05] rounded-full blur-[40px] pointer-events-none" />

            {/* Use exact pixel positioning via SVG viewBox for perfect hexagon alignment */}
            <div className="relative w-full max-w-[460px] aspect-square">
              {/* ── Orbit rings ── */}
              <motion.div className="absolute inset-0 flex items-center justify-center" initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} viewport={{ once: true }}>
                <div className="absolute w-[94%] h-[94%] rounded-full border border-slate-200/60" />
                <div className="absolute w-[68%] h-[68%] rounded-full border border-slate-200/50" />
                <div className="absolute w-[40%] h-[40%] rounded-full border border-slate-200/40" />
              </motion.div>

              {/* ── Connection lines (SVG overlay, hexagon coords) ── */}
              {/* Hex vertices (center 230,230): T(230,68) TL(98,149) TR(362,149) BL(98,311) BR(362,311) B(230,392) */}
              <svg viewBox="0 0 460 460" className="absolute inset-0 w-full h-full" fill="none">
                <defs>
                  <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#004ac6" stopOpacity="0.18" /><stop offset="100%" stopColor="#004ac6" stopOpacity="0.04" /></linearGradient>
                  <linearGradient id="lg2" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#006e2d" stopOpacity="0.15" /><stop offset="100%" stopColor="#006e2d" stopOpacity="0.03" /></linearGradient>
                </defs>
                {/* Outer hex edges */}
                <motion.path d="M98 149 L230 68" stroke="url(#lg1)" strokeWidth="1.5" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.2 }} viewport={{ once: true }} />
                <motion.path d="M230 68 L362 149" stroke="url(#lg1)" strokeWidth="1.5" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.3 }} viewport={{ once: true }} />
                <motion.path d="M362 149 L362 311" stroke="url(#lg1)" strokeWidth="1.5" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.4 }} viewport={{ once: true }} />
                <motion.path d="M98 149 L98 311" stroke="url(#lg1)" strokeWidth="1.5" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.4 }} viewport={{ once: true }} />
                <motion.path d="M98 311 L230 392" stroke="url(#lg1)" strokeWidth="1.5" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.6 }} viewport={{ once: true }} />
                <motion.path d="M362 311 L230 392" stroke="url(#lg1)" strokeWidth="1.5" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.6 }} viewport={{ once: true }} />
                {/* Inner spokes to center */}
                <motion.path d="M98 149 L230 230" stroke="#94a3b8" strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="4 6" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.9 }} viewport={{ once: true }} />
                <motion.path d="M230 68 L230 230" stroke="#94a3b8" strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="4 6" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 1 }} viewport={{ once: true }} />
                <motion.path d="M362 149 L230 230" stroke="#94a3b8" strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="4 6" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 1.1 }} viewport={{ once: true }} />
                <motion.path d="M98 311 L230 230" stroke="#94a3b8" strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="4 6" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 1.2 }} viewport={{ once: true }} />
                <motion.path d="M362 311 L230 230" stroke="#94a3b8" strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="4 6" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 1.3 }} viewport={{ once: true }} />
                <motion.path d="M230 392 L230 230" stroke="url(#lg2)" strokeWidth="0.8" strokeDasharray="4 6" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 1.4 }} viewport={{ once: true }} />

                {/* Travelling data dots */}
                <motion.circle r="3.5" fill="#004ac6" animate={{ cx: [98, 164, 230], cy: [149, 108, 68], opacity: [0, 0.5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
                <motion.circle r="3.5" fill="#004ac6" animate={{ cx: [230, 296, 362], cy: [68, 108, 149], opacity: [0, 0.5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 3 }} />
                <motion.circle r="3.5" fill="#004ac6" animate={{ cx: [362, 362, 362], cy: [149, 230, 311], opacity: [0, 0.5, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 3.5 }} />
                <motion.circle r="3.5" fill="#004ac6" animate={{ cx: [98, 98, 98], cy: [149, 230, 311], opacity: [0, 0.5, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 2.5 }} />
                <motion.circle r="3" fill="#006e2d" animate={{ cx: [362, 296, 230], cy: [311, 352, 392], opacity: [0, 0.45, 0] }} transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 4 }} />
                <motion.circle r="3" fill="#006e2d" animate={{ cx: [98, 164, 230], cy: [311, 352, 392], opacity: [0, 0.45, 0] }} transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 4.5 }} />
              </svg>

              {/* ── CENTER HUB — absolute center at (230, 230) ── */}
              <motion.div className="absolute z-10 w-20 h-20" style={{ top: "calc(50% - 40px)", left: "calc(50% - 40px)" }} initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} transition={{ delay: 0.8, type: "spring", stiffness: 180, damping: 14 }} viewport={{ once: true }}>
                <motion.div className="absolute -inset-5 rounded-full border border-primary/10" animate={{ scale: [1, 1.6], opacity: [0.3, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }} />
                <motion.div className="absolute -inset-5 rounded-full border border-primary/10" animate={{ scale: [1, 1.9], opacity: [0.2, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.8 }} />
                <div className="w-20 h-20 rounded-2xl bg-white shadow-[0_8px_32px_rgba(0,74,198,0.12),0_2px_8px_rgba(0,74,198,0.06)] flex items-center justify-center border border-primary/10">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>hub</span>
                  </div>
                </div>
              </motion.div>

              {/* Nodes use calc() with exact hex vertex coordinates, offset by half node size (32px) */}

              {/* ── NODE: Manufacturing (top-left vertex: 98, 149) ── */}
              <motion.div className="absolute z-10" style={{ top: "calc(32.4% - 32px)", left: "calc(21.3% - 32px)" }} initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 150, damping: 13 }} viewport={{ once: true }}>
                <div className="relative group">
                  <div className="w-16 h-16 rounded-full bg-white shadow-[0_4px_20px_rgba(0,74,198,0.1)] flex items-center justify-center border border-primary/10 transition-shadow group-hover:shadow-[0_6px_28px_rgba(0,74,198,0.18)]">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 26 }}>factory</span>
                  </div>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-label font-semibold text-slate-400 whitespace-nowrap">Manufacture</span>
                </div>
              </motion.div>

              {/* ── NODE: Logistics (top vertex: 230, 68) ── */}
              <motion.div className="absolute z-10" style={{ top: "calc(14.8% - 32px)", left: "calc(50% - 32px)" }} initial={{ y: -25, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 150, damping: 13 }} viewport={{ once: true }}>
                <div className="relative group">
                  <div className="w-16 h-16 rounded-full bg-white shadow-[0_4px_20px_rgba(0,74,198,0.1)] flex items-center justify-center border border-primary/10 transition-shadow group-hover:shadow-[0_6px_28px_rgba(0,74,198,0.18)]">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 26 }}>local_shipping</span>
                  </div>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-label font-semibold text-slate-400 whitespace-nowrap">Logistics</span>
                </div>
              </motion.div>

              {/* ── NODE: Pharmacy (top-right vertex: 362, 149) ── */}
              <motion.div className="absolute z-10" style={{ top: "calc(32.4% - 32px)", left: "calc(78.7% - 32px)" }} initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} transition={{ delay: 0.45, type: "spring", stiffness: 150, damping: 13 }} viewport={{ once: true }}>
                <div className="relative group">
                  <div className="w-16 h-16 rounded-full bg-white shadow-[0_4px_20px_rgba(0,74,198,0.1)] flex items-center justify-center border border-primary/10 transition-shadow group-hover:shadow-[0_6px_28px_rgba(0,74,198,0.18)]">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 26 }}>local_pharmacy</span>
                  </div>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-label font-semibold text-slate-400 whitespace-nowrap">Pharmacy</span>
                </div>
              </motion.div>

              {/* ── NODE: Audit (bottom-left vertex: 98, 311) ── */}
              <motion.div className="absolute z-10" style={{ top: "calc(67.6% - 32px)", left: "calc(21.3% - 32px)" }} initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6, type: "spring", stiffness: 150, damping: 13 }} viewport={{ once: true }}>
                <div className="relative group">
                  <div className="w-16 h-16 rounded-full bg-white shadow-[0_4px_20px_rgba(0,74,198,0.1)] flex items-center justify-center border border-primary/10 transition-shadow group-hover:shadow-[0_6px_28px_rgba(0,74,198,0.18)]">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 26 }}>verified_user</span>
                  </div>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-label font-semibold text-slate-400 whitespace-nowrap">Audit</span>
                </div>
              </motion.div>

              {/* ── NODE: Patient (bottom-right vertex: 362, 311) ── */}
              <motion.div className="absolute z-10" style={{ top: "calc(67.6% - 32px)", left: "calc(78.7% - 32px)" }} initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} transition={{ delay: 0.75, type: "spring", stiffness: 150, damping: 13 }} viewport={{ once: true }}>
                <div className="relative group">
                  <div className="w-16 h-16 rounded-full bg-white shadow-[0_4px_20px_rgba(0,74,198,0.1)] flex items-center justify-center border border-primary/10 transition-shadow group-hover:shadow-[0_6px_28px_rgba(0,74,198,0.18)]">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 26 }}>qr_code_scanner</span>
                  </div>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-label font-semibold text-slate-400 whitespace-nowrap">Patient</span>
                </div>
              </motion.div>

              {/* ── NODE: Verified (bottom vertex: 230, 392) ── */}
              <motion.div className="absolute z-10" style={{ top: "calc(85.2% - 28px)", left: "calc(50% - 28px)" }} initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} transition={{ delay: 1, type: "spring", stiffness: 160, damping: 13 }} viewport={{ once: true }}>
                <div className="relative group">
                  <motion.div className="absolute -inset-2 rounded-full border border-green-400/20" animate={{ scale: [1, 1.5], opacity: [0.3, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }} />
                  <div className="w-14 h-14 rounded-full bg-white shadow-[0_4px_20px_rgba(0,110,45,0.12)] flex items-center justify-center border border-green-400/20 transition-shadow group-hover:shadow-[0_6px_28px_rgba(0,110,45,0.22)]">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-label font-bold text-secondary whitespace-nowrap">Verified</span>
                </div>
              </motion.div>

              {/* ── Floating sparkle particles ── */}
              <motion.div className="absolute w-1.5 h-1.5 rounded-full bg-primary/20" style={{ top: "10%", left: "36%" }} animate={{ y: [0, -10, 0], opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }} />
              <motion.div className="absolute w-1 h-1 rounded-full bg-primary/15" style={{ top: "28%", right: "18%" }} animate={{ y: [0, -8, 0], opacity: [0.15, 0.4, 0.15] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.8 }} />
              <motion.div className="absolute w-1.5 h-1.5 rounded-full bg-primary/15" style={{ bottom: "40%", left: "12%" }} animate={{ x: [0, 6, 0], opacity: [0.1, 0.35, 0.1] }} transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }} />
              <motion.div className="absolute w-1 h-1 rounded-full bg-green-400/20" style={{ bottom: "18%", right: "30%" }} animate={{ y: [0, 8, 0], opacity: [0.15, 0.4, 0.15] }} transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
              <motion.div className="absolute w-1 h-1 rounded-full bg-primary/10" style={{ top: "50%", left: "6%" }} animate={{ y: [0, -6, 0], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.2 }} />
              <motion.div className="absolute w-1.5 h-1.5 rounded-full bg-primary/10" style={{ top: "50%", right: "6%" }} animate={{ y: [0, 7, 0], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 2.5 }} />
            </div>
          </ParallaxFloat>

          {/* Right — Animated text content */}
          <div className="flex-1 text-center lg:text-left">
            <motion.p className="font-label text-xs uppercase tracking-[0.25em] text-primary/50 mb-3" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }} viewport={{ once: true }}>
              On-chain integrity
            </motion.p>
            <motion.h2 className="font-display text-3xl sm:text-4xl text-slate-800 leading-snug mb-5" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.25 }} viewport={{ once: true }}>
              A transparent network<br />you can <span className="italic text-primary">actually</span> trust.
            </motion.h2>
            <motion.p className="text-slate-400 leading-relaxed max-w-md mx-auto lg:mx-0 mb-8" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.4 }} viewport={{ once: true }}>
              Every node in the supply chain is a verifiable checkpoint. No single entity controls the ledger — only consensus moves medicine forward.
            </motion.p>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-8 max-w-md mx-auto lg:mx-0">
              <CountUp delay={0.5}>
                <div className="text-center lg:text-left">
                  <p className="text-2xl font-headline text-slate-800">6</p>
                  <p className="text-[11px] font-label text-slate-400 mt-0.5">Checkpoints</p>
                </div>
              </CountUp>
              <CountUp delay={0.65}>
                <div className="text-center lg:text-left">
                  <p className="text-2xl font-headline text-slate-800">100%</p>
                  <p className="text-[11px] font-label text-slate-400 mt-0.5">On-chain</p>
                </div>
              </CountUp>
              <CountUp delay={0.8}>
                <div className="text-center lg:text-left">
                  <p className="text-2xl font-headline text-secondary">0</p>
                  <p className="text-[11px] font-label text-slate-400 mt-0.5">Blind Spots</p>
                </div>
              </CountUp>
            </div>

            {/* Feature pills */}
            <motion.div className="flex flex-wrap gap-3 justify-center lg:justify-start" initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.65 }} viewport={{ once: true }}>
              <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100">
                <span className="h-2 w-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(0,110,45,0.4)]" />
                <span className="text-slate-600 text-xs font-label">Immutable Records</span>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100">
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(0,74,198,0.4)]" />
                <span className="text-slate-600 text-xs font-label">Decentralized</span>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100">
                <span className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
                <span className="text-slate-600 text-xs font-label">Instant Audit</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* CTA — scale-in on scroll */}
      <ScaleIn>
        <section className="rounded-2xl bg-primary-container p-12 md:p-20 relative text-center overflow-hidden">
          <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />
          <div className="relative z-10">
            <Reveal delay={0.1}>
              <h2 className="font-headline text-3xl md:text-4xl text-white mb-8">Ready to secure your pharmacy inventory?</h2>
            </Reveal>
            <Reveal delay={0.25} direction="up">
              <div className="flex flex-wrap justify-center gap-6">
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                  <Link to="/portal" className="btn bg-white text-primary font-bold hover:bg-slate-50 shadow-xl">Connect Wallet</Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                  <Link to="/verify" className="btn border-2 border-white/30 text-white font-bold hover:bg-white/10">Verify Medicine</Link>
                </motion.div>
              </div>
            </Reveal>
          </div>
        </section>
      </ScaleIn>
    </div>
  );
}

/* ═══════════════════════════════ ROLE PORTAL ═══════════════════════════════ */

export function RolePortalPage() {
  const navigate = useNavigate();
  const { isConnected, isOwner, chooseRole, isAssignedDistributor, isAssignedPharmacy } = useRoleAccess();

  if (!isConnected)
    return (
      <div className="card card-padded flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="w-14 h-14 bg-primary-fixed rounded-full flex items-center justify-center text-primary">
          <Icon name="account_balance_wallet" className="text-3xl" />
        </div>
        <p className="text-base font-semibold text-on-surface">Connect your wallet to choose a role.</p>
      </div>
    );

  const pick = (role: UserRole) => {
    chooseRole(role);
    if (role === "consumer") navigate("/verify");
    else if (role === "manufacturer") navigate("/manufacturer/create");
    else if (role === "distributor") navigate("/distributor");
    else navigate("/pharmacy");
  };

  const roles: Array<{ role: UserRole; icon: string; title: string; desc: string; enabled: boolean; color: string }> = [
    ...(isOwner ? [{ role: "manufacturer" as UserRole, icon: "factory", title: "Manufacturer", desc: "Create batches and assign distributors. Contract owner only.", enabled: true, color: "bg-primary-fixed text-primary" }] : []),
    { role: "distributor", icon: "local_shipping", title: "Distributor", desc: "Receive batches and forward them to pharmacies.", enabled: isAssignedDistributor, color: "bg-secondary-fixed text-on-secondary-fixed-variant" },
    { role: "pharmacy", icon: "medical_services", title: "Pharmacy", desc: "Receive batches from distributors and record sales.", enabled: isAssignedPharmacy, color: "bg-tertiary-fixed text-on-tertiary-fixed-variant" },
    { role: "consumer", icon: "qr_code_scanner", title: "Consumer", desc: "Verify any medicine batch by its ID. No assignment needed.", enabled: true, color: "bg-surface-c-high text-on-surface-variant" }
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-10">
        <h1 className="font-headline text-[26px] italic">Join MedSecure</h1>
        <p className="text-on-surface-variant mt-1">Pick how you want to use the app. Some roles require an on-chain assignment first.</p>
      </header>

      <StaggerList className="grid gap-4 sm:grid-cols-2" stagger={0.1}>
        {roles.map((r) => (
          <StaggerItem key={r.role}>
            <motion.button
              type="button"
              className="role-card w-full"
              disabled={!r.enabled}
              onClick={() => pick(r.role)}
              whileHover={r.enabled ? { scale: 1.02, y: -3 } : undefined}
              whileTap={r.enabled ? { scale: 0.98 } : undefined}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${r.color}`}>
                <Icon name={r.icon} />
              </div>
              <div className="font-bold text-on-surface">{r.title}</div>
              <p className="text-sm text-on-surface-variant leading-relaxed">{r.desc}</p>
              {!r.enabled && <span className="badge badge-warning self-start">Requires on-chain assignment</span>}
            </motion.button>
          </StaggerItem>
        ))}
      </StaggerList>

      {(!isAssignedDistributor || !isAssignedPharmacy) && (
        <div className="mt-8 bg-surface-c-low rounded-xl p-5 text-sm text-on-surface-variant space-y-2">
          {!isAssignedDistributor && <p>Distributor: unlocks after a manufacturer assigns a batch to your wallet.</p>}
          {!isAssignedPharmacy && <p>Pharmacy: unlocks after a distributor assigns a batch to your wallet.</p>}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════ VERIFY ═══════════════════════════════ */

export function VerifyPage() {
  const [batchId, setBatchId] = useState("");
  const id = batchId ? BigInt(batchId) : undefined;
  const { data, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: medicineSupplyChainAbi,
    functionName: "verifyUnit",
    args: id ? [id] : undefined,
    query: { enabled: !!id }
  });

  const hasResult = data && data[0] !== "";

  return (
    <div className="max-w-[700px] mx-auto space-y-10">
      <header>
        <h1 className="font-headline text-[26px] italic">Verify Medical Integrity</h1>
        <p className="muted mt-1">Query the immutable Ethereum ledger to validate pharmaceutical batches.</p>
      </header>

      {/* Search bar */}
      <div className="space-y-2">
        <div className="flex items-center">
          <input
            className="flex-1 !rounded-l-xl !rounded-r-none"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="Enter Batch ID..."
            inputMode="numeric"
            autoComplete="off"
          />
          <div className="h-12 bg-primary text-on-primary px-8 rounded-r-xl font-label font-bold text-sm flex items-center">
            VERIFY
          </div>
        </div>
        <p className="font-label text-[10px] text-outline px-1 flex items-center gap-1.5">
          <span className="opacity-40">//</span> ENTER THE NUMERIC BATCH ID FROM THE PRIMARY PACKAGING.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 text-sm text-on-surface-variant">
          <Spinner /> Checking on-chain data…
        </div>
      )}
      {error && <p className="error-text text-sm">{error.message}</p>}

      {data && hasResult && (
        <div className="space-y-6 animate-fade-in">
          {/* Verdict */}
          {data[7] ? (
            <div className="verdict-authentic">
              <div className="flex items-center gap-4">
                <div className="bg-secondary text-on-secondary w-10 h-10 rounded-full flex items-center justify-center">
                  <Icon name="check_circle" fill />
                </div>
                <div>
                  <h2 className="text-secondary font-bold text-lg tracking-tight font-body">AUTHENTIC MEDICINE</h2>
                  <p className="font-label text-[11px] text-on-secondary-container uppercase tracking-widest opacity-80">Verified on Sepolia Ledger</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="verdict-fail">
              <div className="flex items-center gap-4">
                <div className="bg-error text-on-error w-10 h-10 rounded-full flex items-center justify-center">
                  <Icon name="error" fill />
                </div>
                <div>
                  <h2 className="text-error font-bold text-lg tracking-tight font-body">VERIFICATION FAILED</h2>
                  <p className="font-label text-[11px] text-on-error-container uppercase tracking-widest opacity-80">{data[5] ? "Expired" : "Already sold"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-3 card card-padded space-y-8">
              <h3 className="border-b border-surface-c-high pb-4">Product Metadata</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-8">
                <div className="detail-field"><span className="detail-label">Drug Name</span><p className="detail-value">{data[0]}</p></div>
                <div className="detail-field"><span className="detail-label">Status</span><p className="detail-value"><span className="badge badge-primary">{statusText(Number(data[4]))}</span></p></div>
                <div className="detail-field"><span className="detail-label">Current Owner</span><p className="detail-value font-label">{shortAddress(data[3])}</p></div>
                <div className="detail-field"><span className="detail-label">Expiry</span><p className="detail-value">{toDate(data[1])}</p></div>
              </div>
            </div>
            <div className="md:col-span-2 bg-surface-c-low p-8 rounded-xl space-y-6">
              <h3 className="font-headline text-lg italic border-b border-surface-c-highest pb-4">Integrity Check</h3>
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Icon name="verified" className={`text-lg ${data[7] ? "text-secondary" : "text-error"}`} fill />
                  <span className="text-sm font-medium text-on-surface-variant">{data[7] ? "Authentic Record" : "Not Authentic"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon name={data[5] ? "cancel" : "verified"} className={`text-lg ${data[5] ? "text-error" : "text-secondary"}`} fill />
                  <span className="text-sm font-medium text-on-surface-variant">{data[5] ? "Expired" : "Not Expired"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon name={data[6] ? "cancel" : "verified"} className={`text-lg ${data[6] ? "text-tertiary" : "text-secondary"}`} fill />
                  <span className="text-sm font-medium text-on-surface-variant">{data[6] ? "Already Sold" : "Not Sold"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* IPFS */}
          <div className="card card-padded flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-surface-c-high rounded-lg flex items-center justify-center">
                <Icon name="description" className="text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-on-surface">IPFS Document</h4>
                <p className="font-label text-[11px] text-outline truncate max-w-[200px]">{data[2]}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {data && !hasResult && (
        <div className="card card-padded text-center text-on-surface-variant py-12">
          No batch found for this ID.
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════ CREATE BATCH ═══════════════════════════════ */

export function CreateBatchPage() {
  const { address } = useAccount();
  const client = usePublicClient();
  const [txError, setTxError] = useState<string>("");
  const [mfgDateMaxUtc, setMfgDateMaxUtc] = useState("");
  const [form, setForm] = useState({ batchId: "", drugName: "", mfgDate: "", expiryDate: "", ipfsHash: "" });
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!client) return;
      const b = await client.getBlock({ blockTag: "latest" });
      if (cancelled) return;
      setMfgDateMaxUtc(new Date(Number(b.timestamp) * 1000).toISOString().slice(0, 10));
    })();
    return () => { cancelled = true; };
  }, [client]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setTxError("");
      if (!client || !address) return;
      const block = await client.getBlock({ blockTag: "latest" });
      const chainNow = block.timestamp;
      const mfg = dateInputToUnix(form.mfgDate);
      const exp = dateInputToUnix(form.expiryDate);
      if (mfg === 0n || exp === 0n) { setTxError("Pick valid manufacturing and expiry dates."); return; }
      if (mfg > chainNow) { setTxError("Manufacturing date must be today or earlier in UTC."); return; }
      if (exp <= chainNow) { setTxError("Expiry must be strictly after the current on-chain time."); return; }
      const args = [BigInt(form.batchId), form.drugName.trim(), mfg, exp, form.ipfsHash.trim()] as const;
      const estimatedGas = await client.estimateContractGas({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "manufactureUnit", args, account: address });
      await writeContractAsync({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "manufactureUnit", args, gas: (estimatedGas * 12n) / 10n });
    } catch (err) { setTxError(formatContractRevert(err)); }
  };

  return (
    <ManufacturerGate>
      <div className="max-w-lg mx-auto">
        <header className="mb-8">
          <h1 className="font-headline text-[26px] italic">Create New Batch</h1>
          <p className="muted mt-1">Register a new pharmaceutical batch on-chain.</p>
        </header>
        <form className="card card-padded form" onSubmit={onSubmit}>
          <div className="field-label"><span>Batch ID</span><input placeholder="e.g. 1001" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} /></div>
          <div className="field-label"><span>Drug Name</span><input placeholder="e.g. Amoxicillin 500mg" value={form.drugName} onChange={(e) => setForm({ ...form, drugName: e.target.value })} /></div>
          <div className="field-label"><span>Manufacturing Date (UTC)</span><input type="date" max={mfgDateMaxUtc || undefined} value={form.mfgDate} onChange={(e) => setForm({ ...form, mfgDate: e.target.value })} /></div>
          <p className="muted -mt-3">Must be on or before the latest block time.</p>
          <div className="field-label"><span>Expiry Date</span><input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
          <div className="field-label"><span>IPFS Hash</span><input placeholder="Qm..." value={form.ipfsHash} onChange={(e) => setForm({ ...form, ipfsHash: e.target.value })} /></div>
          <button className="btn btn-primary w-full mt-2" disabled={isPending}>
            {isPending ? <><Spinner /> Creating…</> : <><Icon name="add_circle" className="text-lg" /> New Batch</>}
          </button>
          {error && <p className="error-text text-sm">{error.message}</p>}
          {txError && <p className="error-text text-sm">{txError}</p>}
          {isSuccess && <SuccessBanner text="Batch created on-chain." />}
        </form>
      </div>
    </ManufacturerGate>
  );
}

/* ═══════════════════════════════ MY BATCHES ═══════════════════════════════ */

export function MyBatchesPage() {
  const { address } = useAccount();
  const { units } = useAllUnits();
  const mine = useMemo(() => units.filter((u: Unit) => u.currentOwner.toLowerCase() === String(address).toLowerCase()), [units, address]);

  return (
    <ManufacturerGate>
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="font-headline text-[26px] italic">Your Batches</h1>
          <p className="muted mt-1">Oversee pharmaceutical production batches and secure chain-of-custody transfers.</p>
        </div>
        <Link to="/manufacturer/create" className="btn btn-primary">
          <Icon name="add_circle" className="text-lg" /> New Batch
        </Link>
      </header>

      {/* Stats — staggered reveal */}
      <StaggerList className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10" stagger={0.1}>
        <StaggerItem>
          <HoverLift className="stat-card">
            <div className="flex justify-between items-start mb-3">
              <span className="stat-label">Total Batches</span>
              <div className="bg-primary-fixed p-2 rounded-xl text-primary"><Icon name="inventory_2" /></div>
            </div>
            <div className="stat-value">{mine.length}</div>
            <div className="stat-note text-on-surface-variant">Owned by this wallet</div>
          </HoverLift>
        </StaggerItem>
        <StaggerItem>
          <HoverLift className="stat-card">
            <div className="flex justify-between items-start mb-3">
              <span className="stat-label">In Custody</span>
              <div className="bg-secondary-fixed p-2 rounded-xl text-on-secondary-fixed-variant"><Icon name="security" /></div>
            </div>
            <div className="stat-value">{mine.filter((u: Unit) => u.status === 0).length}</div>
            <div className="stat-note text-on-surface-variant">Manufactured, awaiting transfer</div>
          </HoverLift>
        </StaggerItem>
        <StaggerItem>
          <HoverLift className="stat-card">
            <div className="flex justify-between items-start mb-3">
              <span className="stat-label">Transferred</span>
              <div className="bg-tertiary-fixed p-2 rounded-xl text-on-tertiary-fixed-variant"><Icon name="local_shipping" /></div>
            </div>
            <div className="stat-value">{mine.filter((u: Unit) => u.status > 0).length}</div>
            <div className="stat-note text-on-surface-variant">Sent downstream</div>
          </HoverLift>
        </StaggerItem>
      </StaggerList>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-8 py-5 flex items-center justify-between border-b border-surface-c-low">
          <div className="flex items-center gap-3">
            <h2 className="!text-xl !not-italic font-bold font-body">Batch Inventory</h2>
            <span className="badge badge-primary">{mine.length} Total</span>
          </div>
        </div>
        {mine.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">No batches owned by this wallet yet.</div>
        ) : (
          <div className="divide-y divide-surface-c-low">
            {mine.map((u: Unit) => (
              <Link key={String(u.batchId)} to={`/batch/${String(u.batchId)}`} className="list-item flex items-center justify-between hover:bg-surface-c-low/50 group">
                <div className="flex items-center gap-4">
                  <span className="font-label text-sm text-primary">#{String(u.batchId)}</span>
                  <span className="font-semibold">{u.drugName}</span>
                </div>
                <span className={`badge ${u.status === 0 ? "badge-primary" : u.status === 3 ? "badge-success" : "badge-warning"}`}>
                  {statusText(u.status)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ManufacturerGate>
  );
}

/* ═══════════════════════════════ TRANSFER TO DISTRIBUTOR ═══════════════════════════════ */

export function TransferToDistributorPage() {
  const { address } = useAccount();
  const client = usePublicClient();
  const [batchId, setBatchId] = useState("");
  const [distributor, setDistributor] = useState("");
  const [txError, setTxError] = useState("");
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAddress(distributor)) return;
    try {
      setTxError("");
      if (!client || !address) return;
      const args = [BigInt(batchId), distributor] as const;
      const estimatedGas = await client.estimateContractGas({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "transferToDistributor", args, account: address });
      await writeContractAsync({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "transferToDistributor", args, gas: (estimatedGas * 12n) / 10n });
    } catch (err) { setTxError(err instanceof Error ? err.message : "Transaction failed."); }
  };

  return (
    <ManufacturerGate>
      <div className="max-w-lg mx-auto">
        <header className="mb-8">
          <h1 className="font-headline text-[26px] italic">Assign to Distributor</h1>
          <p className="muted mt-1">Transfer batch custody to a verified distributor address.</p>
        </header>
        <form className="card card-padded form" onSubmit={submit}>
          <div className="field-label"><span>Batch ID</span><input placeholder="e.g. 1001" value={batchId} onChange={(e) => setBatchId(e.target.value)} /></div>
          <div className="field-label"><span>Distributor Wallet</span><input placeholder="0x..." value={distributor} onChange={(e) => setDistributor(e.target.value)} /></div>
          <button className="btn btn-primary w-full mt-2" disabled={isPending || !isAddress(distributor)}>
            {isPending ? <><Spinner /> Sending…</> : <>Send <Icon name="arrow_forward" className="text-sm" /></>}
          </button>
          {error && <p className="error-text text-sm">{error.message}</p>}
          {txError && <p className="error-text text-sm">{txError}</p>}
          {isSuccess && <SuccessBanner text="Transferred to distributor." />}
        </form>
      </div>
    </ManufacturerGate>
  );
}

/* ═══════════════════════════════ DISTRIBUTOR ═══════════════════════════════ */

function AssignToPharmacyForm() {
  const { address } = useAccount();
  const client = usePublicClient();
  const [batchId, setBatchId] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [txError, setTxError] = useState("");
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAddress(pharmacy)) return;
    try {
      setTxError("");
      if (!client || !address) return;
      const args = [BigInt(batchId), pharmacy] as const;
      const estimatedGas = await client.estimateContractGas({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "transferToPharmacy", args, account: address });
      await writeContractAsync({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "transferToPharmacy", args, gas: (estimatedGas * 12n) / 10n });
    } catch (err) { setTxError(formatContractRevert(err)); }
  };

  return (
    <form className="card card-padded form" onSubmit={submit}>
      <h2>Assign to Pharmacy</h2>
      <p className="muted">Enter the batch ID and the pharmacy wallet.</p>
      <div className="field-label"><span>Batch ID</span><input placeholder="e.g. 1001" value={batchId} onChange={(e) => setBatchId(e.target.value)} /></div>
      <div className="field-label"><span>Pharmacy Wallet</span><input placeholder="0x..." value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} /></div>
      <button className="btn btn-primary w-full mt-2" disabled={isPending || !isAddress(pharmacy)} type="submit">
        {isPending ? <><Spinner /> Sending…</> : <>Send <Icon name="arrow_forward" className="text-sm" /></>}
      </button>
      {error && <p className="error-text text-sm">{error.message}</p>}
      {txError && <p className="error-text text-sm">{txError}</p>}
      {isSuccess && <SuccessBanner text="Transferred to pharmacy." />}
    </form>
  );
}

export function DistributorDashboardPage() {
  const { address } = useRoleAccess();
  const { units } = useAllUnits();
  const assigned = useMemo(() => units.filter((u: Unit) => u.distributor.toLowerCase() === String(address).toLowerCase()), [units, address]);

  return (
    <DistributorGate>
      <header className="mb-8">
        <h1 className="font-headline text-[26px] italic">Distributor Dashboard</h1>
        <p className="muted mt-1">Manage assigned batches and forward them to pharmacies.</p>
      </header>
      <div className="grid gap-8">
        <AssignToPharmacyForm />
        <div className="card overflow-hidden">
          <div className="px-8 py-5 flex items-center gap-3 border-b border-surface-c-low">
            <h2 className="!text-xl !not-italic font-bold font-body">Assigned Batches</h2>
            <span className="badge badge-primary">{assigned.length}</span>
          </div>
          {assigned.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant">No assigned batches yet.</div>
          ) : (
            <div className="divide-y divide-surface-c-low">
              {assigned.map((u: Unit) => (
                <Link key={String(u.batchId)} to={`/batch/${String(u.batchId)}`} className="list-item flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-label text-sm text-primary">#{String(u.batchId)}</span>
                    <span className="font-semibold">{u.drugName}</span>
                  </div>
                  <code className="font-label text-xs text-outline bg-surface-c-low px-3 py-1 rounded-lg">{shortAddress(u.currentOwner)}</code>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </DistributorGate>
  );
}

export function TransferToPharmacyPage() {
  return <DistributorGate><AssignToPharmacyForm /></DistributorGate>;
}

/* ═══════════════════════════════ PHARMACY ═══════════════════════════════ */

function MarkAsSoldForm() {
  const { address } = useAccount();
  const client = usePublicClient();
  const [batchId, setBatchId] = useState("");
  const [txError, setTxError] = useState("");
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setTxError("");
      if (!client || !address) return;
      const args = [BigInt(batchId)] as const;
      const estimatedGas = await client.estimateContractGas({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "markAsSold", args, account: address });
      await writeContractAsync({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "markAsSold", args, gas: (estimatedGas * 12n) / 10n });
    } catch (err) { setTxError(formatContractRevert(err)); }
  };

  return (
    <form className="card card-padded form" onSubmit={submit}>
      <h2>Mark as Sold</h2>
      <p className="muted">Enter the batch ID you are dispensing.</p>
      <div className="field-label"><span>Batch ID</span><input placeholder="e.g. 1001" value={batchId} onChange={(e) => setBatchId(e.target.value)} /></div>
      <button className="btn btn-primary w-full mt-2" disabled={isPending} type="submit">
        {isPending ? <><Spinner /> Processing…</> : "Mark Sold"}
      </button>
      {error && <p className="error-text text-sm">{error.message}</p>}
      {txError && <p className="error-text text-sm">{txError}</p>}
      {isSuccess && <SuccessBanner text="Batch marked as sold." />}
    </form>
  );
}

export function PharmacyDashboardPage() {
  const { address } = useRoleAccess();
  const { units } = useAllUnits();
  const owned = useMemo(() => units.filter((u: Unit) => u.pharmacy.toLowerCase() === String(address).toLowerCase()), [units, address]);

  return (
    <PharmacyGate>
      <header className="mb-8">
        <h1 className="font-headline text-[26px] italic">Pharmacy Dashboard</h1>
        <p className="muted mt-1">Manage assigned batches and record sales.</p>
      </header>
      <div className="grid gap-8">
        <MarkAsSoldForm />
        <div className="card overflow-hidden">
          <div className="px-8 py-5 flex items-center gap-3 border-b border-surface-c-low">
            <h2 className="!text-xl !not-italic font-bold font-body">Assigned Batches</h2>
            <span className="badge badge-primary">{owned.length}</span>
          </div>
          {owned.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant">No pharmacy batches yet.</div>
          ) : (
            <div className="divide-y divide-surface-c-low">
              {owned.map((u: Unit) => (
                <Link key={String(u.batchId)} to={`/batch/${String(u.batchId)}`} className="list-item flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-label text-sm text-primary">#{String(u.batchId)}</span>
                    <span className="font-semibold">{u.drugName}</span>
                  </div>
                  <span className={`badge ${u.status === 3 ? "badge-success" : "badge-primary"}`}>{statusText(u.status)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PharmacyGate>
  );
}

export function MarkAsSoldPage() {
  return <PharmacyGate><MarkAsSoldForm /></PharmacyGate>;
}

/* ═══════════════════════════════ TIMELINE LOOKUP ═══════════════════════════════ */

export function BatchTimelineLookupPage({ context }: { context: "distributor" | "pharmacy" }) {
  const navigate = useNavigate();
  const [batchId, setBatchId] = useState("");
  const Gate = context === "distributor" ? DistributorGate : PharmacyGate;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!batchId.trim()) return;
    navigate(`/batch/${batchId.trim()}`);
  };

  return (
    <Gate>
      <div className="max-w-lg mx-auto">
        <header className="mb-8">
          <h1 className="font-headline text-[26px] italic">View Batch Timeline</h1>
          <p className="muted mt-1">Enter the batch ID to open the transfer timeline.</p>
        </header>
        <form className="card card-padded form" onSubmit={submit}>
          <div className="field-label"><span>Batch ID</span><input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="e.g. 1001" /></div>
          <button className="btn btn-primary w-full mt-2" type="submit">Open Timeline</button>
        </form>
      </div>
    </Gate>
  );
}

/* ═══════════════════════════════ BATCH DETAIL ═══════════════════════════════ */

const statusBadgeVariant = (s: number) => s === 0 ? "badge-primary" : s === 3 ? "badge-success" : s === 2 ? "badge-warning" : "badge-primary";

export function BatchDetailPage() {
  const { address, effectiveRole, isOwner } = useRoleAccess();
  const params = useParams();
  const batchId = params.batchId ? BigInt(params.batchId) : undefined;
  const client = usePublicClient();
  const { data: unit } = useReadContract({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "getUnit", args: batchId ? [batchId] : undefined, query: { enabled: !!batchId } });
  const { data: history } = useReadContract({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "getUnitHistory", args: batchId ? [batchId] : undefined, query: { enabled: !!batchId } });
  const [meta, setMeta] = useState<null | { size?: number; exists: boolean }>(null);

  const loadIpfsMeta = async () => {
    if (!unit?.ipfsHash || !client) return;
    const res = await fetch(`https://ipfs.io/ipfs/${unit.ipfsHash}`);
    setMeta({ exists: res.ok, size: Number(res.headers.get("content-length") ?? 0) || undefined });
  };

  const unitExists = unit && unit.manufacturingDate !== 0n;
  const canViewBatch = unitExists && address && (() => {
    const a = address.toLowerCase();
    if (effectiveRole === "consumer") return false;
    if (effectiveRole === "manufacturer" && isOwner) return unit.currentOwner.toLowerCase() === a;
    if (effectiveRole === "distributor") return unit.distributor.toLowerCase() === a;
    if (effectiveRole === "pharmacy") return unit.pharmacy.toLowerCase() === a;
    return false;
  })();

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="#" onClick={() => window.history.back()} className="inline-flex items-center gap-2 mb-8 text-sm text-slate-400 hover:text-primary transition-colors group">
        <Icon name="arrow_back" className="text-base group-hover:-translate-x-1 transition-transform" /> Back
      </Link>

      {!unit && (
        <div className="flex items-center justify-center gap-3 py-20 text-on-surface-variant"><Spinner /> Loading…</div>
      )}

      {unit && !unitExists && (
        <div className="card card-padded text-center py-16 text-on-surface-variant">No batch found for this ID.</div>
      )}

      {unitExists && !canViewBatch && (
        <div className="bg-error-container/30 rounded-xl p-6 ring-1 ring-error/20">
          <p className="text-sm text-error">You do not have access to this batch for your current role. Use an assigned batch ID or switch role on the Join page.</p>
        </div>
      )}

      {unitExists && canViewBatch && (
        <div className="space-y-8 animate-fade-in">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] font-label text-outline mb-1">Batch #{String(unit.batchId)}</p>
              <h1 className="text-2xl font-bold flex items-center gap-4 flex-wrap">
                {unit.drugName}
                <span className={`badge ${statusBadgeVariant(Number(unit.status))}`}>{statusText(Number(unit.status))}</span>
              </h1>
            </div>
          </header>

          {/* Detail bento grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <div className="card overflow-hidden">
                <div className="bg-surface-c-low/50 px-8 py-5 border-b border-outline-variant/10">
                  <h2 className="!text-xl">Pharmaceutical Specifications</h2>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  <div className="detail-field"><span className="detail-label">Drug Name</span><p className="detail-value">{unit.drugName}</p></div>
                  <div className="detail-field"><span className="detail-label">Batch ID</span><p className="detail-value font-label">{String(unit.batchId)}</p></div>
                  <div className="detail-field"><span className="detail-label">Manufactured</span><p className="detail-value">{toDate(unit.manufacturingDate)}</p></div>
                  <div className="detail-field"><span className="detail-label">Expiry</span><p className="detail-value">{toDate(unit.expiryDate)}</p></div>
                  <div className="detail-field"><span className="detail-label">Distributor</span><p className="detail-value font-label">{unit.distributor === ZERO_ADDRESS ? "—" : shortAddress(unit.distributor)}</p></div>
                  <div className="detail-field"><span className="detail-label">Pharmacy</span><p className="detail-value font-label">{unit.pharmacy === ZERO_ADDRESS ? "—" : shortAddress(unit.pharmacy)}</p></div>
                  <div className="detail-field col-span-full"><span className="detail-label">Current Owner</span><p className="detail-value font-label text-primary">{shortAddress(unit.currentOwner)}</p></div>
                </div>
              </div>
            </div>

            {/* IPFS sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <div className="card card-padded space-y-4">
                <h3>IPFS Document</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-surface-c-high rounded-lg flex items-center justify-center">
                    <Icon name="description" className="text-primary" />
                  </div>
                  <code className="font-label text-[11px] text-outline break-all">{unit.ipfsHash}</code>
                </div>
                <button className="btn btn-secondary w-full text-xs" onClick={loadIpfsMeta}>
                  Check Availability <Icon name="arrow_right_alt" className="text-base" />
                </button>
                {meta && (
                  <p className={`text-sm ${meta.exists ? "text-secondary" : "text-error"}`}>
                    {meta.exists ? `File available${meta.size ? ` (${meta.size} bytes)` : ""}` : "File not reachable"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card card-padded">
            <h2 className="mb-6">Chain of Custody</h2>
            {(!history || history.length === 0) && <p className="text-sm text-on-surface-variant">No transfer history yet.</p>}
            <div>
              {history?.map((h: { from: string; to: string; status: number; timestamp: bigint }, i: number) => (
                <div key={i} className="timeline-item">
                  <div className={`timeline-dot ${Number(h.status) === 3 ? "timeline-dot-active" : ""}`}>
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className={`badge ${statusBadgeVariant(Number(h.status))}`}>{statusText(Number(h.status))}</span>
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <code className="font-label text-xs text-on-surface-variant">{shortAddress(h.from)}</code>
                        <Icon name="arrow_forward" className="text-xs text-outline" />
                        <code className="font-label text-xs text-on-surface-variant">{shortAddress(h.to)}</code>
                      </div>
                    </div>
                    <span className="font-label text-xs text-outline">{toDate(h.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
