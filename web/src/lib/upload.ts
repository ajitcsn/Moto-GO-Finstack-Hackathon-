import { create } from "zustand";
import { api, ApiError } from "@/api/client";
import type { Doc } from "@/api/types";

export const MAX_BYTES = 10 * 1024 * 1024;

export async function sha256Hex(file: Blob): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type UploadPhase = "hashing" | "uploading" | "processing" | "verified" | "needs_attention" | "rejected" | "error";
export interface UploadItem {
  key: string; name: string; phase: UploadPhase; progress: number; docId?: string; reason?: string | null; retry?: () => void;
}

/** Upload queue holds file metadata and status only: never file contents, never in localStorage. */
export const useUploads = create<{
  items: Record<string, UploadItem>;
  set: (key: string, patch: Partial<UploadItem>) => void;
  clear: (key: string) => void;
}>((set) => ({
  items: {},
  set: (key, patch) => set((s) => {
    const base: UploadItem = s.items[key] ?? { key, name: "", phase: "hashing", progress: 0 };
    return { items: { ...s.items, [key]: { ...base, ...patch } } };
  }),
  clear: (key) => set((s) => { const n = { ...s.items }; delete n[key]; return { items: n }; }),
}));

export const isBusy = (i?: UploadItem) => !!i && ["hashing", "uploading", "processing"].includes(i.phase);

function put(url: string, file: File, headers: Record<string, string>, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    Object.entries(headers).forEach(([k, v]) => x.setRequestHeader(k, v));
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => (x.status < 300 ? resolve() : reject(new ApiError(x.status, { message: "The upload didn't go through.", retryable: true })));
    x.onerror = () => reject(new ApiError(0, { message: "Connection lost during the upload.", retryable: true }));
    x.send(file);
  });
}

export interface UploadParams {
  key: string; file: File; kind: string; applicationId?: string; requirementId?: string; vehicleId?: string;
  onDoc?: (doc: Doc) => void;
}

/** Client check -> presign -> direct PUT (one automatic retry via re-presign) -> complete -> poll result. */
export async function runUpload(p: UploadParams): Promise<Doc | null> {
  const { set } = useUploads.getState();
  set(p.key, { name: p.file.name, phase: "hashing", progress: 0, reason: null, docId: undefined });
  try {
    const sha = await sha256Hex(p.file);
    let docId = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      set(p.key, { phase: "uploading", progress: 0 });
      const pre = await api<{ document_id: string; upload: { url: string; headers: Record<string, string> } }>("/documents/presign", {
        body: { kind: p.kind, mime: p.file.type, size: p.file.size, sha256: sha, filename: p.file.name,
          application_id: p.applicationId ?? null, requirement_id: p.requirementId ?? null, vehicle_id: p.vehicleId ?? null },
      });
      docId = pre.document_id;
      try {
        await put(pre.upload.url, p.file, pre.upload.headers, (pr) => set(p.key, { progress: pr }));
        break;
      } catch (e) {
        if (attempt === 1) throw e;
      }
    }
    set(p.key, { phase: "processing", progress: 1, docId });
    await api(`/documents/${docId}/complete`, { method: "POST", body: {} });
    for (let i = 0; i < 90; i++) {
      const d = await api<Doc>(`/documents/${docId}`);
      if (d.status !== "processing" && d.status !== "uploading") {
        set(p.key, { phase: d.status as UploadPhase, reason: d.reason, docId });
        p.onDoc?.(d);
        return d;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    set(p.key, { phase: "error", reason: "Processing is taking longer than usual. It will finish in the background." });
    return null;
  } catch (e) {
    set(p.key, { phase: "error", reason: e instanceof Error ? e.message : "Upload failed", retry: () => void runUpload(p) });
    return null;
  }
}

export function validateFile(file: File, allowed: string[]): string | null {
  if (file.size > MAX_BYTES) return "Files can be at most 10 MB.";
  if (!allowed.includes(file.type)) return `Use one of: ${allowed.map((m) => m.split("/")[1].toUpperCase()).join(", ")}.`;
  return null;
}

export const KIND_MIMES: Record<string, string[]> = {
  rc: ["application/pdf", "image/jpeg", "image/png"], loan_statement: ["application/pdf", "image/jpeg", "image/png"],
  care_bill: ["application/pdf", "image/jpeg", "image/png"], pan_card: ["application/pdf", "image/jpeg", "image/png"],
  address_proof: ["application/pdf", "image/jpeg", "image/png"], selfie: ["image/jpeg", "image/png", "image/heic"],
  bank_statement: ["application/pdf"], salary_slip: ["application/pdf", "image/jpeg", "image/png"],
  dealer_quote: ["application/pdf", "image/jpeg", "image/png"],
};
export const KIND_LABEL: Record<string, string> = {
  rc: "Registration certificate", loan_statement: "Loan statement", care_bill: "Service bill", pan_card: "PAN card",
  address_proof: "Address proof", selfie: "Selfie", bank_statement: "Bank statement", salary_slip: "Salary slip", dealer_quote: "Dealer quote",
};
