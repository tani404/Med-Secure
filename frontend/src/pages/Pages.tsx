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

function WalletGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  if (!isConnected)
    return (
      <div className="card flex flex-col items-center justify-center gap-2 py-14 text-center">
        <p className="text-base text-slate-600">Connect your wallet to continue.</p>
        <p className="text-sm text-slate-500">Use the button in the header to connect.</p>
      </div>
    );
  return <>{children}</>;
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
    if (!address) {
      setSelectedRole(null);
      return;
    }
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

  return {
    address,
    isConnected,
    isOwner,
    selectedRole,
    effectiveRole,
    chooseRole,
    isRoleAllowed,
    isAssignedDistributor,
    isAssignedPharmacy
  };
}

function AccessNotice({ text }: { text: string }) {
  return (
    <section className="card max-w-lg">
      <h2>Access required</h2>
      <p className="mt-2 text-slate-600">{text}</p>
      <div className="actions mt-6">
        <Link className="btn secondary" to="/portal">
          Choose role
        </Link>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <div className="grid gap-5 sm:gap-6 lg:gap-8">
      <section className="card hero">
        <p className="relative mb-2 inline-block rounded-full bg-brand-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-800">
          Supply chain integrity
        </p>
        <h1 className="text-balance">MedSecure — anti-counterfeit medicine verification</h1>
        <p className="relative mt-2 max-w-2xl text-slate-600">
          Track batches from manufacturer to pharmacy on-chain. Consumers verify authenticity in seconds with a batch ID or QR
          payload.
        </p>
        <div className="actions">
          <Link to="/portal" className="btn">
            Join by role
          </Link>
          <Link to="/verify" className="btn secondary">
            Verify as consumer
          </Link>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        <section className="card">
          <h3>How it works</h3>
          <ul>
            <li>Manufacturer registers each batch on-chain.</li>
            <li>Custody moves: manufacturer → distributor → pharmacy.</li>
            <li>Pharmacy records the sale when medicine is dispensed.</li>
            <li>Anyone can verify a batch ID without a wallet.</li>
          </ul>
        </section>
        <section className="card border-brand-100 bg-gradient-to-br from-white to-brand-50/30">
          <h3>Role-based access</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
            Connect your wallet, choose your role on the join page, and the app shows only what that role is allowed to do—
            aligned with on-chain assignments.
          </p>
        </section>
      </div>
    </div>
  );
}

export function RolePortalPage() {
  const navigate = useNavigate();
  const { isConnected, isOwner, chooseRole, isAssignedDistributor, isAssignedPharmacy } = useRoleAccess();

  if (!isConnected)
    return (
      <div className="card flex flex-col items-center justify-center gap-2 py-14 text-center">
        <p className="text-base text-slate-600">Connect your wallet to choose a role.</p>
      </div>
    );

  const pick = (role: UserRole) => {
    chooseRole(role);
    if (role === "consumer") navigate("/verify");
    else if (role === "manufacturer") navigate("/manufacturer/create");
    else if (role === "distributor") navigate("/distributor");
    else navigate("/pharmacy");
  };

  return (
    <section className="card max-w-2xl">
      <h2>Join MedSecure</h2>
      <p className="mt-2 text-slate-600">Pick how you want to use the app. Some roles require an on-chain assignment first.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {isOwner && (
          <button type="button" className="btn" onClick={() => pick("manufacturer")}>
            Manufacturer (owner)
          </button>
        )}
        <button type="button" className="btn secondary" disabled={!isAssignedDistributor} onClick={() => pick("distributor")}>
          Distributor
        </button>
        <button type="button" className="btn secondary" disabled={!isAssignedPharmacy} onClick={() => pick("pharmacy")}>
          Pharmacy
        </button>
        <button type="button" className="btn secondary" onClick={() => pick("consumer")}>
          Consumer
        </button>
      </div>
      {(!isAssignedDistributor || !isAssignedPharmacy) && (
        <div className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-500">
          {!isAssignedDistributor && <p>Distributor: unlocks after a manufacturer assigns a batch to your wallet.</p>}
          {!isAssignedPharmacy && <p>Pharmacy: unlocks after a distributor assigns a batch to your wallet.</p>}
        </div>
      )}
    </section>
  );
}

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
  return (
    <section className="card max-w-xl">
      <h2>Verify medicine</h2>
      <p className="mt-2 text-slate-600">Enter the batch ID from the label or QR code. No wallet required.</p>
      <label className="field-label mt-6">
        Batch ID
        <input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="e.g. 1001" inputMode="numeric" autoComplete="off" />
      </label>
      {isLoading && <p className="mt-4 text-sm text-slate-500">Checking on-chain data…</p>}
      {error && <p className="error mt-4">{error.message}</p>}
      {data && (
        <div className="result mt-4">
          <p><strong>Drug:</strong> {data[0]}</p>
          <p><strong>Expiry:</strong> {toDate(data[1])}</p>
          <p><strong>Status:</strong> {statusText(Number(data[4]))}</p>
          <p><strong>Owner:</strong> {shortAddress(data[3])}</p>
          <p><strong>IPFS:</strong> {data[2]}</p>
          <p><strong>Expired:</strong> {String(data[5])}</p>
          <p><strong>Already Sold:</strong> {String(data[6])}</p>
          <p><strong>Authentic:</strong> <span className={data[7] ? "ok" : "bad"}>{String(data[7])}</span></p>
        </div>
      )}
    </section>
  );
}

function ManufacturerGate({ children }: { children: React.ReactNode }) {
  const { isRoleAllowed } = useRoleAccess();
  if (!isRoleAllowed("manufacturer")) {
    return <AccessNotice text="Only the contract owner can use manufacturer tools. Join as Manufacturer on the role page." />;
  }
  return <WalletGate>{children}</WalletGate>;
}

function formatContractRevert(err: unknown): string {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => (e instanceof ContractFunctionRevertedError ? e : false));
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName) {
      const { errorName, args: errArgs } = reverted.data;
      const tail =
        Array.isArray(errArgs) && errArgs.length > 0 ? ` — args: ${JSON.stringify(errArgs)}` : "";
      return `Contract reverted: ${errorName}()${tail}`;
    }
    return err.shortMessage ?? err.message;
  }
  return err instanceof Error ? err.message : "Transaction failed.";
}

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
    return () => {
      cancelled = true;
    };
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
      if (mfg === 0n || exp === 0n) {
        setTxError("Pick valid manufacturing and expiry dates.");
        return;
      }
      if (mfg > chainNow) {
        setTxError(
          "Manufacturing date must be today or earlier in UTC (on-chain rule: it cannot be after the current block time). Choose a past date or today."
        );
        return;
      }
      if (exp <= chainNow) {
        setTxError("Expiry must be strictly after the current on-chain time.");
        return;
      }
      const args = [BigInt(form.batchId), form.drugName.trim(), mfg, exp, form.ipfsHash.trim()] as const;
      const estimatedGas = await client.estimateContractGas({
        address: CONTRACT_ADDRESS,
        abi: medicineSupplyChainAbi,
        functionName: "manufactureUnit",
        args,
        account: address
      });
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: medicineSupplyChainAbi,
        functionName: "manufactureUnit",
        args,
        gas: (estimatedGas * 12n) / 10n
      });
    } catch (err) {
      setTxError(formatContractRevert(err));
    }
  };
  return (
    <ManufacturerGate>
      <form className="card form" onSubmit={onSubmit}>
        <h2>Create Batch</h2>
        <input placeholder="Batch ID" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} />
        <input placeholder="Drug Name" value={form.drugName} onChange={(e) => setForm({ ...form, drugName: e.target.value })} />
        <label className="field-label">
          Manufacturing date (UTC)
          <input
            type="date"
            max={mfgDateMaxUtc || undefined}
            value={form.mfgDate}
            onChange={(e) => setForm({ ...form, mfgDate: e.target.value })}
          />
        </label>
        <p className="muted">Must be on or before the latest block time. The contract reverts with InvalidManufacturingDate if this is in the future.</p>
        <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
        <input placeholder="IPFS Hash" value={form.ipfsHash} onChange={(e) => setForm({ ...form, ipfsHash: e.target.value })} />
        <button className="btn" disabled={isPending}>Create</button>
        {error && <p className="error">{error.message}</p>}
        {txError && <p className="error">{txError}</p>}
        {isSuccess && <p className="ok">Batch created on-chain.</p>}
      </form>
    </ManufacturerGate>
  );
}

export function MyBatchesPage() {
  const { address } = useAccount();
  const { units } = useAllUnits();
  const mine = useMemo(() => units.filter((u: Unit) => u.currentOwner.toLowerCase() === String(address).toLowerCase()), [units, address]);
  return (
    <ManufacturerGate>
      <section className="card">
        <h2>My Batches</h2>
        {mine.length === 0 && <p>No batches owned by this wallet.</p>}
        {mine.map((u: Unit) => (
          <Link className="list-item" key={String(u.batchId)} to={`/batch/${String(u.batchId)}`}>
            <strong>Batch #{String(u.batchId)}</strong> - {u.drugName} - {statusText(u.status)}
          </Link>
        ))}
      </section>
    </ManufacturerGate>
  );
}

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
      const estimatedGas = await client.estimateContractGas({
        address: CONTRACT_ADDRESS,
        abi: medicineSupplyChainAbi,
        functionName: "transferToDistributor",
        args,
        account: address
      });
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: medicineSupplyChainAbi,
        functionName: "transferToDistributor",
        args,
        gas: (estimatedGas * 12n) / 10n
      });
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Transaction failed.");
    }
  };
  return (
    <ManufacturerGate>
      <form className="card form" onSubmit={submit}>
        <h2>Assign to Distributor</h2>
        <input placeholder="Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
        <input placeholder="Distributor wallet (0x...)" value={distributor} onChange={(e) => setDistributor(e.target.value)} />
        <button className="btn" disabled={isPending || !isAddress(distributor)}>Transfer</button>
        {error && <p className="error">{error.message}</p>}
        {txError && <p className="error">{txError}</p>}
        {isSuccess && <p className="ok">Transferred to distributor.</p>}
      </form>
    </ManufacturerGate>
  );
}

function DistributorGate({ children }: { children: React.ReactNode }) {
  const { isRoleAllowed } = useRoleAccess();
  if (!isRoleAllowed("distributor")) {
    return (
      <AccessNotice text="Join as Distributor on the role page. Your wallet must be assigned on-chain by the manufacturer." />
    );
  }
  return <WalletGate>{children}</WalletGate>;
}

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
      const estimatedGas = await client.estimateContractGas({
        address: CONTRACT_ADDRESS,
        abi: medicineSupplyChainAbi,
        functionName: "transferToPharmacy",
        args,
        account: address
      });
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: medicineSupplyChainAbi,
        functionName: "transferToPharmacy",
        args,
        gas: (estimatedGas * 12n) / 10n
      });
    } catch (err) {
      setTxError(formatContractRevert(err));
    }
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h2>Assign to pharmacy</h2>
      <p className="muted">Enter the batch ID and the pharmacy wallet (calls transferToPharmacy on-chain).</p>
      <input placeholder="Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
      <input placeholder="Pharmacy wallet (0x...)" value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} />
      <button className="btn" disabled={isPending || !isAddress(pharmacy)} type="submit">
        Transfer to pharmacy
      </button>
      {error && <p className="error">{error.message}</p>}
      {txError && <p className="error">{txError}</p>}
      {isSuccess && <p className="ok">Transferred to pharmacy.</p>}
    </form>
  );
}

export function DistributorDashboardPage() {
  const { address } = useRoleAccess();
  const { units } = useAllUnits();
  const assigned = useMemo(() => units.filter((u: Unit) => u.distributor.toLowerCase() === String(address).toLowerCase()), [units, address]);
  return (
    <DistributorGate>
      <div className="grid gap-5 sm:gap-6 lg:gap-8">
        <AssignToPharmacyForm />
        <section className="card">
          <h2>Assigned batches</h2>
          <p className="muted">Tap a batch to open detail and the full timeline.</p>
          {assigned.length === 0 && <p>No assigned batches yet.</p>}
          {assigned.map((u: Unit) => (
            <Link className="list-item" key={String(u.batchId)} to={`/batch/${String(u.batchId)}`}>
              <strong>Batch #{String(u.batchId)}</strong> - {u.drugName} - owner: {shortAddress(u.currentOwner)}
            </Link>
          ))}
        </section>
      </div>
    </DistributorGate>
  );
}

export function TransferToPharmacyPage() {
  return (
    <DistributorGate>
      <AssignToPharmacyForm />
    </DistributorGate>
  );
}

function PharmacyGate({ children }: { children: React.ReactNode }) {
  const { isRoleAllowed } = useRoleAccess();
  if (!isRoleAllowed("pharmacy")) {
    return (
      <AccessNotice text="Join as Pharmacy on the role page. Your wallet must be assigned on-chain by the distributor." />
    );
  }
  return <WalletGate>{children}</WalletGate>;
}

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
      const estimatedGas = await client.estimateContractGas({
        address: CONTRACT_ADDRESS,
        abi: medicineSupplyChainAbi,
        functionName: "markAsSold",
        args,
        account: address
      });
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: medicineSupplyChainAbi,
        functionName: "markAsSold",
        args,
        gas: (estimatedGas * 12n) / 10n
      });
    } catch (err) {
      setTxError(formatContractRevert(err));
    }
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h2>Mark as sold</h2>
      <p className="muted">Enter the batch ID you are selling (calls markAsSold on-chain).</p>
      <input placeholder="Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
      <button className="btn" disabled={isPending} type="submit">
        Mark sold
      </button>
      {error && <p className="error">{error.message}</p>}
      {txError && <p className="error">{txError}</p>}
      {isSuccess && <p className="ok">Batch marked as sold.</p>}
    </form>
  );
}

export function PharmacyDashboardPage() {
  const { address } = useRoleAccess();
  const { units } = useAllUnits();
  const owned = useMemo(
    () => units.filter((u: Unit) => u.pharmacy.toLowerCase() === String(address).toLowerCase()),
    [units, address]
  );
  return (
    <PharmacyGate>
      <div className="grid gap-5 sm:gap-6 lg:gap-8">
        <MarkAsSoldForm />
        <section className="card">
          <h2>Assigned batches</h2>
          <p className="muted">Open a batch for detail and timeline.</p>
          {owned.length === 0 && <p>No pharmacy batches yet.</p>}
          {owned.map((u: Unit) => (
            <Link className="list-item" key={String(u.batchId)} to={`/batch/${String(u.batchId)}`}>
              <strong>Batch #{String(u.batchId)}</strong> - {u.drugName} - {statusText(u.status)}
            </Link>
          ))}
        </section>
      </div>
    </PharmacyGate>
  );
}

export function MarkAsSoldPage() {
  return (
    <PharmacyGate>
      <MarkAsSoldForm />
    </PharmacyGate>
  );
}

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
      <form className="card form" onSubmit={submit}>
        <h2>View batch timeline</h2>
        <p className="muted">Enter the batch ID from the label or QR payload to open the timeline.</p>
        <input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="Batch ID" />
        <button className="btn" type="submit">
          Open timeline
        </button>
      </form>
    </Gate>
  );
}

export function BatchDetailPage() {
  const { address, effectiveRole, isOwner } = useRoleAccess();
  const params = useParams();
  const batchId = params.batchId ? BigInt(params.batchId) : undefined;
  const client = usePublicClient();
  const { data: unit } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: medicineSupplyChainAbi,
    functionName: "getUnit",
    args: batchId ? [batchId] : undefined,
    query: { enabled: !!batchId }
  });
  const { data: history } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: medicineSupplyChainAbi,
    functionName: "getUnitHistory",
    args: batchId ? [batchId] : undefined,
    query: { enabled: !!batchId }
  });
  const [meta, setMeta] = useState<null | { size?: number; exists: boolean }>(null);
  const loadIpfsMeta = async () => {
    if (!unit?.ipfsHash || !client) return;
    const res = await fetch(`https://ipfs.io/ipfs/${unit.ipfsHash}`);
    setMeta({ exists: res.ok, size: Number(res.headers.get("content-length") ?? 0) || undefined });
  };

  const unitExists = unit && unit.manufacturingDate !== 0n;

  const canViewBatch =
    unitExists &&
    address &&
    (() => {
      const a = address.toLowerCase();
      if (effectiveRole === "consumer") return false;
      if (effectiveRole === "manufacturer" && isOwner) {
        return unit.currentOwner.toLowerCase() === a;
      }
      if (effectiveRole === "distributor") {
        return unit.distributor.toLowerCase() === a;
      }
      if (effectiveRole === "pharmacy") {
        return unit.pharmacy.toLowerCase() === a;
      }
      return false;
    })();

  return (
    <section className="card">
      <h2>Batch detail &amp; timeline</h2>
      {!unit && <p>Loading…</p>}
      {unit && !unitExists && <p>No batch found for this ID.</p>}
      {unitExists && !canViewBatch && (
        <p className="error">You do not have access to this batch for your current role. Use an assigned batch ID or switch role on the Join page.</p>
      )}
      {unitExists && canViewBatch && (
        <>
          <p><strong>Batch ID:</strong> {String(unit.batchId)}</p>
          <p><strong>Drug:</strong> {unit.drugName}</p>
          <p><strong>Status:</strong> {statusText(Number(unit.status))}</p>
          <p><strong>Manufacturer Date:</strong> {toDate(unit.manufacturingDate)}</p>
          <p><strong>Expiry Date:</strong> {toDate(unit.expiryDate)}</p>
          <p><strong>Distributor:</strong> {unit.distributor === ZERO_ADDRESS ? "-" : shortAddress(unit.distributor)}</p>
          <p><strong>Pharmacy:</strong> {unit.pharmacy === ZERO_ADDRESS ? "-" : shortAddress(unit.pharmacy)}</p>
          <p><strong>Current Owner:</strong> {shortAddress(unit.currentOwner)}</p>
          <p><strong>IPFS Hash:</strong> {unit.ipfsHash}</p>
          <div className="actions">
            <button className="btn secondary" onClick={loadIpfsMeta}>Check IPFS</button>
          </div>
          {meta && <p>{meta.exists ? `IPFS file available${meta.size ? ` (${meta.size} bytes)` : ""}` : "IPFS file not reachable"}</p>}
          <h3>Timeline</h3>
          {(!history || history.length === 0) && <p>No transfer history yet.</p>}
          {history?.map((h: { from: string; to: string; status: number; timestamp: bigint }, i: number) => (
            <div key={i} className="timeline-item">
              <span>{toDate(h.timestamp)}</span>
              <span>{shortAddress(h.from)} {"->"} {shortAddress(h.to)}</span>
              <span>{statusText(Number(h.status))}</span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
