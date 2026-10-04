export type AiFailure =
  | "not_configured"
  | "credentials"
  | "model_access"
  | "rate_limit"
  | "timeout"
  | "invalid_response"
  | "provider_error";
export type Explanation = {
  summary: string;
  nextSteps: string[];
  uncertainties: string[];
  mode: "openai" | "rules";
  notice: string;
  model: string | null;
  responseId: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
  failureCode: AiFailure | null;
};
export type SavedExplanation = Explanation & {
  id: string;
  listingId: string;
  supplierId: string;
  recipientId: string;
  requestedModel: string | null;
  createdAt: string;
  cached: boolean;
};
export type BackendHealth = {
  status: "ready";
  storage: "local-sqlite";
  authentication: "demo-workspaces";
  ai: {
    configured: boolean;
    model: string | null;
    quota: { used: number; limit: number; remaining: number; resetAt: string };
    lastAttempt: Pick<
      SavedExplanation,
      "mode" | "model" | "requestedModel" | "failureCode" | "createdAt"
    > | null;
  };
  supabase: { connected: false; schemaPrepared: true };
};
