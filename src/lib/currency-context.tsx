import { createContext, useContext } from "react";
export const CurrencyContext = createContext<string>("INR");

export function useGymCurrency() {
  return useContext(CurrencyContext);
}
