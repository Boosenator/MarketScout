export interface Market {
  id: string;
  name: string;
  searchAngles: string[];
}

export interface Signal {
  market_id: string;
  title: string;
  source: string;
  relevance_note: string;
}

export interface RawIdea {
  market_id: string;
  title: string;
  description: string;
  target_audience: string;
  monetization: string;
  why_now: string;
  signals_used: string[];
}

export interface ScoredIdea extends RawIdea {
  killed_at_pass: 1 | 2 | null;
  kill_reason: string | null;
  urgency_score: number | null;
  timing_score: number | null;
  advantage_score: number | null;
  monetization_score: number | null;
  competition_score: number | null;
  mvp_speed_score: number | null;
  total_score: number | null;
}

export interface DeepDive {
  analogues: string[];
  entry_bootstrap: string;
  entry_vc: string;
  entry_lifestyle: string;
  main_risks: string[];
  risk_mitigations: string[];
  first_validation_step: string;
  team_fit_score: number;
}

export interface IdeaRecord extends ScoredIdea {
  id: string;
  session_id: string;
  deep_dive: DeepDive | null;
  telegram_message_id: number | null;
  created_at: string;
}

export interface ScoutSession {
  id: string;
  date: string;
  markets_scanned: number;
  ideas_generated: number;
  ideas_killed_p1: number;
  ideas_killed_p2: number;
  survivors: number;
  status: "running" | "done" | "failed";
  created_at: string;
}

export interface PipelineSummary {
  sessionId: string;
  marketsScanned: number;
  ideasGenerated: number;
  killedPass1: number;
  killedPass2: number;
  survivors: number;
  posted: number;
}
