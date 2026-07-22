import * as LocalAuthentication from "expo-local-authentication";

export type BiometricType = "faceId" | "fingerprint" | "none";

export async function getBiometricType(): Promise<BiometricType> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return "none";

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) return "none";

  const types =
    await LocalAuthentication.supportedAuthenticationTypesAsync();

  if (
    types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    )
  ) {
    return "faceId";
  }
  if (
    types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
  ) {
    return "fingerprint";
  }
  return "none";
}

export async function authenticateWithBiometrics(
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const type = await getBiometricType();
    if (type === "none") {
      return { success: false, error: "Biometria non disponibile su questo dispositivo." };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Annulla",
      fallbackLabel: "Usa PIN",
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    }

    if (result.error === "user_cancel" || result.error === "system_cancel") {
      return { success: false, error: "Autenticazione annullata." };
    }

    return {
      success: false,
      error: "Autenticazione biometrica fallita. Riprova.",
    };
  } catch {
    return { success: false, error: "Errore biometria." };
  }
}

export function biometricLabel(type: BiometricType): string {
  if (type === "faceId") return "Face ID";
  if (type === "fingerprint") return "Touch ID";
  return "";
}
