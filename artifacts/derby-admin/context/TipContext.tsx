import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  TipConfig,
  DayTipData,
  TipDistribution,
  calculateDistribution,
  loadDayTipData,
  loadTipConfig,
  saveDayTipData,
  saveTipConfig,
} from "@/services/tipStorage";

interface TipContextValue {
  config: TipConfig;
  tipData: DayTipData;
  distribution: TipDistribution;
  isLoading: boolean;
  currentDate: string;
  setDate: (date: string) => void;
  updateTipData: (partial: Partial<Pick<DayTipData, "cashTips" | "cardTips" | "notes">>) => Promise<void>;
  updateConfig: (partial: Partial<TipConfig>) => Promise<void>;
  reload: () => Promise<void>;
}

const TipContext = createContext<TipContextValue | null>(null);

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyDistribution(): TipDistribution {
  return { netTotal: 0, netCash: 0, netCard: 0, taxDeducted: 0, sala: 0, cucina: 0, bar: 0, fondo: 0 };
}

export function TipProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<TipConfig>({
    salaPct: 40,
    cucinaPct: 30,
    barPct: 20,
    fondoPct: 10,
    electronicTipTaxPct: 30,
    cassaMode: "singolo",
  });
  const [currentDate, setCurrentDate] = useState(todayStr());
  const [tipData, setTipData] = useState<DayTipData>({
    date: currentDate,
    cashTips: 0,
    cardTips: 0,
    notes: "",
    updatedAt: 0,
  });
  const [distribution, setDistribution] = useState<TipDistribution>(emptyDistribution());
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cfg, data] = await Promise.all([loadTipConfig(), loadDayTipData(currentDate)]);
      setConfig(cfg);
      setTipData(data);
      setDistribution(calculateDistribution(data, cfg));
    } finally {
      setIsLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setDate = useCallback((date: string) => {
    setCurrentDate(date);
  }, []);

  const updateTipData = useCallback(
    async (partial: Partial<Pick<DayTipData, "cashTips" | "cardTips" | "notes">>) => {
      const updated: DayTipData = { ...tipData, ...partial, date: currentDate };
      setTipData(updated);
      const dist = calculateDistribution(updated, config);
      setDistribution(dist);
      await saveDayTipData(updated);
    },
    [tipData, config, currentDate]
  );

  const updateConfig = useCallback(
    async (partial: Partial<TipConfig>) => {
      const updated: TipConfig = { ...config, ...partial };
      setConfig(updated);
      setDistribution(calculateDistribution(tipData, updated));
      await saveTipConfig(updated);
    },
    [config, tipData]
  );

  return (
    <TipContext.Provider
      value={{
        config,
        tipData,
        distribution,
        isLoading,
        currentDate,
        setDate,
        updateTipData,
        updateConfig,
        reload,
      }}
    >
      {children}
    </TipContext.Provider>
  );
}

export function useTip() {
  const ctx = useContext(TipContext);
  if (!ctx) throw new Error("useTip must be used within TipProvider");
  return ctx;
}
