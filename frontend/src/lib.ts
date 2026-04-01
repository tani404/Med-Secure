export const statusText = (status: number) => {
  switch (status) {
    case 0:
      return "Manufactured";
    case 1:
      return "At Distributor";
    case 2:
      return "At Pharmacy";
    case 3:
      return "Sold";
    default:
      return "Unknown";
  }
};

export const shortAddress = (addr?: string) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "-";

export const toDate = (seconds: bigint | number) => {
  const sec = typeof seconds === "bigint" ? Number(seconds) : seconds;
  return new Date(sec * 1000).toLocaleDateString();
};

export const dateInputToUnix = (value: string) => {
  if (!value) return 0n;
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ms)) return 0n;
  return BigInt(Math.floor(ms / 1000));
};
