import AsyncStorage from "@react-native-async-storage/async-storage";

export interface TipConfig {
  /** Percentuale Sala (es. 40) */
  salaPct: number;
  /** Percentuale Cucina (es. 30) */
  cucinaPct: number;
  /** Percentuale Bar (es. 20) */
  barPct: number;
  /** Percentuale Fondo Ristorante (es. 10) */
  fondoPct: number;
  /** Tassazione mance elettroniche (default 30%) */
  electronicTipTaxPct: number;
}

export interface DayTipData {
  date: string; // YYYY-MM-DD
  /** Mance in contanti totali ricevute dai clienti */
  cashTips: number;
  /** Mance su carta/POS totali ricevute dai clienti */
  cardTips: number;
  /** Note libere */
  notes: string;
  /** Timestamp ultima modifica */
  updatedAt: number;
}

export interface TipDistribution {
  /** Importo mance nette (dopo tassazione elettronica) */
  netTotal: number;
  /** Netto mance contanti */
  netCash: number;
  /** Netto mance carta (dopo tassa) */
  netCard: number;
  /** Tassa trattenuta su mance elettroniche */
  taxDeducted: number;
  /** Quota Sala */
  sala: number;
  /** Quota Cucina */
  cucina: number;
  /** Quota Bar */
  bar: number;
  /** Quota Fondo */
  fondo: number;
}

const KEYS = {
  TIP_CONFIG: "@derby_tip_config",
  TIP_DATA_PREFIX: "@derby_tip_data_",
};

const DEFAULT_CONFIG: TipConfig = {
  salaPct: 40,
  cucinaPct: 30,
  barPct: 20,
  fondoPct: 10,
  electronicTipTaxPct: 30,
};

export async function loadTipConfig(): Promise<TipConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.TIP_CONFIG);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveTipConfig(config: TipConfig): Promise<void> {
  await AsyncStorage.setItem(KEYS.TIP_CONFIG, JSON.stringify(config));
}

export async function loadDayTipData(date: string): Promise<DayTipData> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.TIP_DATA_PREFIX + date);
    if (!raw) return { date, cashTips: 0, cardTips: 0, notes: "", updatedAt: 0 };
    return JSON.parse(raw) as DayTipData;
  } catch {
    return { date, cashTips: 0, cardTips: 0, notes: "", updatedAt: 0 };
  }
}

export async function saveDayTipData(data: DayTipData): Promise<void> {
  await AsyncStorage.setItem(
    KEYS.TIP_DATA_PREFIX + data.date,
    JSON.stringify({ ...data, updatedAt: Date.now() })
  );
}

export function calculateDistribution(
  tipData: DayTipData,
  config: TipConfig
): TipDistribution {
  const taxRate = (config.electronicTipTaxPct ?? 30) / 100;
  const taxDeducted = tipData.cardTips * taxRate;
  const netCard = tipData.cardTips - taxDeducted;
  const netCash = tipData.cashTips;
  const netTotal = netCard + netCash;

  const totalPct =
    config.salaPct + config.cucinaPct + config.barPct + config.fondoPct;
  const safePct = totalPct > 0 ? totalPct : 100;

  return {
    netTotal,
    netCash,
    netCard,
    taxDeducted,
    sala: (netTotal * config.salaPct) / safePct,
    cucina: (netTotal * config.cucinaPct) / safePct,
    bar: (netTotal * config.barPct) / safePct,
    fondo: (netTotal * config.fondoPct) / safePct,
  };
}

/** Genera testo ricevuta mance conforme legge polacca */
export function buildTipReceiptText(params: {
  employeeName: string;
  department: string;
  amount: number;
  date: string;
  restaurantName?: string;
}): string {
  const { employeeName, department, amount, date, restaurantName } = params;
  const amountStr = amount.toLocaleString("pl-PL", {
    style: "currency",
    currency: "PLN",
  });
  // Formatted date in Polish format
  const [y, m, d] = date.split("-");
  const dateLabel = `${d}.${m}.${y}`;

  return [
    "=================================",
    "    POTWIERDZENIE WYPŁATY NAPIWKU",
    "     RICEVUTA MANCIA",
    "=================================",
    `Restauracja: ${restaurantName ?? "Rosso Fuoco"}`,
    `Data / Data: ${dateLabel}`,
    "",
    `Pracownik / Dipendente:`,
    `  ${employeeName}`,
    `Dział / Reparto: ${department}`,
    "",
    `Kwota napiwku / Importo mancia:`,
    `  ${amountStr}`,
    "",
    "Podstawa prawna:",
    "Art. 12 ustawy z dn. 26.07.1991 r.",
    "o podatku dochodowym od osób fizycznych",
    "",
    "Oświadczam, że otrzymałem/am",
    "powyższy napiwek w gotówce.",
    "",
    "Podpis / Firma:",
    "_____________________________",
    `${employeeName}`,
    "",
    `Luogo / Miejsce: ____________`,
    `Data / Data: ${dateLabel}`,
    "=================================",
  ].join("\n");
}

/** Genera report fine giornata per la stampante */
export function buildEndOfDayReport(params: {
  date: string;
  totalCard: number;
  totalCash: number;
  totalGc: number;
  tipData: DayTipData;
  distribution: TipDistribution;
  config: TipConfig;
  managerName: string;
  restaurantName?: string;
}): string {
  const {
    date,
    totalCard,
    totalCash,
    totalGc,
    tipData,
    distribution,
    config,
    managerName,
    restaurantName,
  } = params;

  const fmt = (n: number) =>
    n.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });

  const [y, m, d] = date.split("-");
  const dateLabel = `${d}.${m}.${y}`;

  const lines = [
    "=================================",
    "   RAPORT KOŃCA DNIA",
    "   RESOCONTO FINE GIORNATA",
    "=================================",
    `Restauracja: ${restaurantName ?? "Rosso Fuoco"}`,
    `Data: ${dateLabel}`,
    `Manager: ${managerName}`,
    "",
    "--- INCASSI / PRZYCHODY ----------",
    `Carte/Karty:      ${fmt(totalCard)}`,
    `Contanti/Gotówka: ${fmt(totalCash)}`,
    totalGc > 0 ? `Gift Card:        ${fmt(totalGc)}` : null,
    `TOTALE:           ${fmt(totalCard + totalCash + totalGc)}`,
    "",
    "--- MANCE / NAPIWKI --------------",
    `Mance contanti:   ${fmt(tipData.cashTips)}`,
    `Mance carta:      ${fmt(tipData.cardTips)}`,
    `Tassa ${config.electronicTipTaxPct}% (carte): -${fmt(distribution.taxDeducted)}`,
    `Netto distribuibile: ${fmt(distribution.netTotal)}`,
    "",
    "--- DISTRIBUZIONE MANCE ----------",
    `Sala (${config.salaPct}%):    ${fmt(distribution.sala)}`,
    `Cucina (${config.cucinaPct}%): ${fmt(distribution.cucina)}`,
    `Bar (${config.barPct}%):     ${fmt(distribution.bar)}`,
    `Fondo (${config.fondoPct}%): ${fmt(distribution.fondo)}`,
    "",
    "--- CONFORMITÀ --------------------",
    "Napiwki rozliczone zgodnie z",
    "art. 12 ustawy z 26.07.1991 r.",
    "o p.d.o.f.",
    "",
    `Data: ${dateLabel}`,
    `Manager: ${managerName}`,
    "",
    "Podpis Managera / Firma Manager:",
    "_____________________________",
    "=================================",
  ]
    .filter((l) => l !== null)
    .join("\n");

  return lines;
}
