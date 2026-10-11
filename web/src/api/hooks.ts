import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./client";
import type {
  Application, Consent, CollectionModel, Doc, GarageHome, Goal, Kfs, Model, Offer, Progress, ScenarioResult,
  StepSpec, TimelineItem, User, Vehicle, CareLog,
} from "./types";

// ---------- session ----------
export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try { return await api<User>("/me"); } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; }
    },
    staleTime: 60_000,
    retry: false,
  });

export const useMeta = () => useQuery({ queryKey: ["meta"], queryFn: () => api<{ demo: boolean; otp_hint: string | null }>("/meta"), staleTime: Infinity });

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api("/auth/logout", { body: {} }), onSuccess: () => { qc.clear(); qc.setQueryData(["me"], null); } });
}

// ---------- garage ----------
export const useGarage = () => useQuery({ queryKey: ["garage"], queryFn: () => api<GarageHome>("/garage") });
export const useVehicle = (id: string) => useQuery({ queryKey: ["vehicle", id], queryFn: () => api<Vehicle>(`/vehicles/${id}`) });
export const useModels = (q: string, type?: string) =>
  useQuery({ queryKey: ["models", q, type], queryFn: () => api<{ items: Model[] }>(`/catalogue/models?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ""}`), placeholderData: (p) => p });

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

// ---------- collection ----------
export interface CollectionData { models: CollectionModel[]; segments: { id: string; label: string }[]; progress: Progress; guest: boolean }
export const useCollection = () => useQuery({ queryKey: ["collection"], queryFn: () => api<CollectionData>("/collection") });
export const usePassport = (id: string) =>
  useQuery({
    queryKey: ["passport", id],
    enabled: !!id,
    queryFn: () => api<{
      model: Model; badges: string[]; fit: { matches_interests: boolean; reason: string };
      ownership_cost: { assumptions: string[]; yearly_running: number | null; yearly_insurance: number };
      credit_note: string;
    }>(`/passport/${id}`),
  });
export const useDream = () => useQuery({ queryKey: ["dream"], queryFn: () => api<{ items: Model[] }>("/dream-garage") });

// ---------- goals ----------
export const useGoals = () => useQuery({ queryKey: ["goals"], queryFn: () => api<{ items: Goal[] }>("/goals") });
export const useScenarios = (goalId: string | undefined, body: Record<string, unknown>) =>
  useQuery({
    queryKey: ["scenarios", goalId, body],
    enabled: !!goalId,
    queryFn: () => api<ScenarioResult>(`/goals/${goalId}/scenarios`, { body }),
    placeholderData: (p) => p,
  });

// ---------- finance ----------
export const useApplications = () => useQuery({ queryKey: ["applications"], queryFn: () => api<{ items: Application[] }>("/applications") });
export const useApplication = (id: string, fresh = false) =>
  useQuery({
    queryKey: ["application", id], enabled: !!id,
    queryFn: () => api<Application>(`/applications/${id}`),
    ...(fresh ? { staleTime: 0, refetchOnMount: "always" as const } : {}),
  });
export const useStepSpec = (id: string, step: string) =>
  useQuery({ queryKey: ["step", id, step], queryFn: () => api<StepSpec>(`/applications/${id}/steps/${step}/schema`), staleTime: 0, gcTime: 0 });
export const useIntakeSpec = () => useQuery({ queryKey: ["intake-spec"], queryFn: () => api<StepSpec>("/applications/intake/schema") });
export const useTimeline = (id: string) => useQuery({ queryKey: ["timeline", id], queryFn: () => api<{ items: TimelineItem[] }>(`/applications/${id}/timeline`) });
export const useOffers = (id: string, enabled = true) =>
  useQuery({ queryKey: ["offers", id], enabled, queryFn: () => api<{ items: Offer[]; accepted_offer_id: string | null }>(`/applications/${id}/offers`) });
export const useKfs = (id: string, offerId: string) =>
  useQuery({ queryKey: ["kfs", id, offerId], queryFn: () => api<Kfs>(`/applications/${id}/offers/${offerId}/kfs`) });
export const useConsents = () => useQuery({ queryKey: ["consents"], queryFn: () => api<{ items: Consent[] }>("/consents") });
export const useDoc = (id: string | undefined) => useQuery({ queryKey: ["doc", id], enabled: !!id, queryFn: () => api<Doc>(`/documents/${id}`) });

/** Live status: SSE pushes state changes; we re-read the application on every event (the API is the source of truth). */
export function useApplicationStream(id: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/v1/applications/${id}/events`, { withCredentials: true });
    const refresh = () => {
      ["application", "timeline", "offers"].forEach((k) => qc.invalidateQueries({ queryKey: [k, id] }));
      qc.invalidateQueries({ queryKey: ["applications"] });
    };
    es.addEventListener("status", refresh);
    es.onerror = () => { /* EventSource retries on its own; polling below covers gaps */ };
    const poll = setInterval(refresh, 8000);
    return () => { es.close(); clearInterval(poll); };
  }, [id, qc]);
}

export type { CareLog };
