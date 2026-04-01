import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { shortAddress, statusText, toDate } from "../lib";

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

function useAllUnits() {
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
  if (!isConnected) return <p className="card">Connect wallet to continue.</p>;
  return <>{children}</>;
}

export function LandingPage() {
  return (
    <div className="grid">
      <section className="card hero">
        <h1>MedSecure: Blockchain Anti-Counterfeit Medicine Detector</h1>
        <p>Track every medicine batch from manufacturer to pharmacy and let consumers verify authenticity instantly.</p>
        <div className="actions">
          <Link to="/verify" className="btn">Verify a Medicine</Link>
          <Link to="/manufacturer" className="btn secondary">Open Dashboard</Link>
        </div>
      </section>
      <section className="card">
        <h3>How it works</h3>
        <ul>
          <li>Manufacturer creates batch data on-chain with `manufactureUnit()`.</li>
          <li>Ownership moves from manufacturer to distributor to pharmacy.</li>
          <li>Pharmacy marks final sale with `markAsSold()`.</li>
          <li>Consumers scan QR and call `verifyUnit()` for authenticity status.</li>
        </ul>
      </section>
    </div>
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
    <section className="card">
      <h2>Verify / Scan</h2>
      <p>Enter scanned batch ID from QR code.</p>
      <input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="Batch ID (e.g. 1001)" />
      {isLoading && <p>Verifying...</p>}
      {error && <p className="error">{error.message}</p>}
      {data && (
        <div className="result">
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

export function ManufacturerDashboardPage() {
  const { address } = useAccount();
  const { data: owner } = useReadContract({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "owner" });
  const { data: totalUnits } = useReadContract({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "totalUnits" });
  const { data: isPaused } = useReadContract({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "paused" });
  const { ids } = useAllUnits();
  const isManufacturer = !!address && address.toLowerCase() === String(owner).toLowerCase();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  const pauseToggle = () =>
    writeContract({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: isPaused ? "unpause" : "pause" });
  return (
    <WalletGate>
      <section className="card">
        <h2>Manufacturer Dashboard</h2>
        <p><strong>Contract owner:</strong> {shortAddress(String(owner))}</p>
        <p><strong>Your wallet:</strong> {shortAddress(address)}</p>
        <p><strong>Total units:</strong> {String(totalUnits ?? 0n)}</p>
        <p><strong>Known batches:</strong> {ids.length}</p>
        <p><strong>Paused:</strong> {String(isPaused)}</p>
        {!isManufacturer && <p className="error">Only owner wallet can use manufacturer actions.</p>}
        <div className="actions">
          <Link to="/manufacturer/create" className="btn">Create Batch</Link>
          <Link to="/manufacturer/batches" className="btn secondary">My Batches</Link>
          <Link to="/manufacturer/assign" className="btn secondary">Assign Distributor</Link>
          {isManufacturer && <button className="btn secondary" disabled={isPending} onClick={pauseToggle}>{isPaused ? "Unpause" : "Pause"}</button>}
        </div>
        {error && <p className="error">{error.message}</p>}
        {isSuccess && <p className="ok">Transaction confirmed.</p>}
      </section>
    </WalletGate>
  );
}

export function CreateBatchPage() {
  const [form, setForm] = useState({ batchId: "", drugName: "", mfgDate: "", expiryDate: "", ipfsHash: "" });
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: medicineSupplyChainAbi,
      functionName: "manufactureUnit",
      args: [BigInt(form.batchId), form.drugName, BigInt(form.mfgDate), BigInt(form.expiryDate), form.ipfsHash]
    });
  };
  return (
    <WalletGate>
      <form className="card form" onSubmit={onSubmit}>
        <h2>Create Batch</h2>
        <input placeholder="Batch ID" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} />
        <input placeholder="Drug Name" value={form.drugName} onChange={(e) => setForm({ ...form, drugName: e.target.value })} />
        <input placeholder="Manufacturing Date (unix)" value={form.mfgDate} onChange={(e) => setForm({ ...form, mfgDate: e.target.value })} />
        <input placeholder="Expiry Date (unix)" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
        <input placeholder="IPFS Hash" value={form.ipfsHash} onChange={(e) => setForm({ ...form, ipfsHash: e.target.value })} />
        <button className="btn" disabled={isPending}>Create</button>
        {error && <p className="error">{error.message}</p>}
        {isSuccess && <p className="ok">Batch created on-chain.</p>}
      </form>
    </WalletGate>
  );
}

export function MyBatchesPage() {
  const { address } = useAccount();
  const { units } = useAllUnits();
  const mine = useMemo(() => units.filter((u: Unit) => u.currentOwner.toLowerCase() === String(address).toLowerCase()), [units, address]);
  return (
    <WalletGate>
      <section className="card">
        <h2>My Batches</h2>
        {mine.length === 0 && <p>No batches owned by this wallet.</p>}
        {mine.map((u: Unit) => (
          <Link className="list-item" key={String(u.batchId)} to={`/batch/${String(u.batchId)}`}>
            <strong>Batch #{String(u.batchId)}</strong> - {u.drugName} - {statusText(u.status)}
          </Link>
        ))}
      </section>
    </WalletGate>
  );
}

export function TransferToDistributorPage() {
  const [batchId, setBatchId] = useState("");
  const [distributor, setDistributor] = useState("");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isAddress(distributor)) return;
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: medicineSupplyChainAbi,
      functionName: "transferToDistributor",
      args: [BigInt(batchId), distributor]
    });
  };
  return (
    <WalletGate>
      <form className="card form" onSubmit={submit}>
        <h2>Transfer to Distributor</h2>
        <input placeholder="Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
        <input placeholder="Distributor wallet (0x...)" value={distributor} onChange={(e) => setDistributor(e.target.value)} />
        <button className="btn" disabled={isPending || !isAddress(distributor)}>Transfer</button>
        {error && <p className="error">{error.message}</p>}
        {isSuccess && <p className="ok">Transferred to distributor.</p>}
      </form>
    </WalletGate>
  );
}

export function DistributorDashboardPage() {
  const { address } = useAccount();
  const { units } = useAllUnits();
  const assigned = useMemo(() => units.filter((u: Unit) => u.distributor.toLowerCase() === String(address).toLowerCase()), [units, address]);
  return (
    <WalletGate>
      <section className="card">
        <h2>Distributor Dashboard</h2>
        {assigned.length === 0 && <p>No assigned batches.</p>}
        {assigned.map((u: Unit) => (
          <Link className="list-item" key={String(u.batchId)} to={`/batch/${String(u.batchId)}`}>
            <strong>Batch #{String(u.batchId)}</strong> - {u.drugName} - owner: {shortAddress(u.currentOwner)}
          </Link>
        ))}
      </section>
    </WalletGate>
  );
}

export function TransferToPharmacyPage() {
  const [batchId, setBatchId] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isAddress(pharmacy)) return;
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: medicineSupplyChainAbi,
      functionName: "transferToPharmacy",
      args: [BigInt(batchId), pharmacy]
    });
  };
  return (
    <WalletGate>
      <form className="card form" onSubmit={submit}>
        <h2>Transfer to Pharmacy</h2>
        <input placeholder="Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
        <input placeholder="Pharmacy wallet (0x...)" value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} />
        <button className="btn" disabled={isPending || !isAddress(pharmacy)}>Transfer</button>
        {error && <p className="error">{error.message}</p>}
        {isSuccess && <p className="ok">Transferred to pharmacy.</p>}
      </form>
    </WalletGate>
  );
}

export function PharmacyDashboardPage() {
  const { address } = useAccount();
  const { units } = useAllUnits();
  const owned = useMemo(
    () =>
      units.filter(
        (u: Unit) =>
          u.pharmacy.toLowerCase() === String(address).toLowerCase() || u.currentOwner.toLowerCase() === String(address).toLowerCase()
      ),
    [units, address]
  );
  return (
    <WalletGate>
      <section className="card">
        <h2>Pharmacy Dashboard</h2>
        {owned.length === 0 && <p>No pharmacy batches.</p>}
        {owned.map((u: Unit) => (
          <Link className="list-item" key={String(u.batchId)} to={`/batch/${String(u.batchId)}`}>
            <strong>Batch #{String(u.batchId)}</strong> - {u.drugName} - {statusText(u.status)}
          </Link>
        ))}
      </section>
    </WalletGate>
  );
}

export function MarkAsSoldPage() {
  const [batchId, setBatchId] = useState("");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    writeContract({ address: CONTRACT_ADDRESS, abi: medicineSupplyChainAbi, functionName: "markAsSold", args: [BigInt(batchId)] });
  };
  return (
    <WalletGate>
      <form className="card form" onSubmit={submit}>
        <h2>Mark as Sold</h2>
        <input placeholder="Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
        <button className="btn" disabled={isPending}>Mark Sold</button>
        {error && <p className="error">{error.message}</p>}
        {isSuccess && <p className="ok">Batch marked as sold.</p>}
      </form>
    </WalletGate>
  );
}

export function BatchDetailPage() {
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
  return (
    <section className="card">
      <h2>Batch Detail</h2>
      {!unit && <p>No batch found.</p>}
      {unit && (
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
