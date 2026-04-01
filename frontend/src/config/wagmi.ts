import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { sepolia } from "viem/chains";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo-project-id";
const rpcUrl = import.meta.env.VITE_RPC_URL;

export const config = getDefaultConfig({
  appName: "MedSecure",
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: rpcUrl ? http(rpcUrl) : http()
  }
});
