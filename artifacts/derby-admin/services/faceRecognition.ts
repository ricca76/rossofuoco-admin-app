import { getBaseUrl } from "./derbyApi";

export interface FaceDescriptorEntry {
  employeeId: number;
  employeeName: string;
  descriptor: number[];
}

export interface FaceMatchResult {
  matched: boolean;
  employeeId?: number;
  employeeName?: string;
  distance?: number;
}

const MATCH_THRESHOLD = 0.5;

export async function fetchFaceDescriptors(): Promise<FaceDescriptorEntry[]> {
  const base = getBaseUrl();
  if (!base) throw new Error("Server non configurato.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${base}/api/attendance/face-descriptors`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.faces)) {
      throw new Error("Risposta non valida dal server.");
    }
    return data.faces as FaceDescriptorEntry[];
  } finally {
    clearTimeout(timer);
  }
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function matchDescriptor(
  queryDescriptor: number[],
  knownFaces: FaceDescriptorEntry[]
): FaceMatchResult {
  if (knownFaces.length === 0) return { matched: false };

  let bestMatch: FaceDescriptorEntry | null = null;
  let bestDist = Infinity;

  for (const face of knownFaces) {
    if (!Array.isArray(face.descriptor) || face.descriptor.length !== 128) continue;
    const dist = euclideanDistance(queryDescriptor, face.descriptor);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = face;
    }
  }

  if (!bestMatch || bestDist > MATCH_THRESHOLD) {
    return { matched: false, distance: bestDist };
  }

  return {
    matched: true,
    employeeId: bestMatch.employeeId,
    employeeName: bestMatch.employeeName,
    distance: bestDist,
  };
}
