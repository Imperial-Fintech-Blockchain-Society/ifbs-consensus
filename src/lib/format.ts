export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(n) < 1 && n !== 0 ? 6 : 2,
  }).format(n);
export const percent = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
export const date = (d: string | Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
export function timeLeft(d: string | Date) {
  const hours = Math.ceil((new Date(d).getTime() - Date.now()) / 3600000);
  return hours <= 0
    ? "Awaiting resolution"
    : hours < 24
      ? `${hours}h left`
      : `${Math.ceil(hours / 24)}d left`;
}
