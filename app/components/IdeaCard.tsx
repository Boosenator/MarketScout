import { getMarketName } from "@/lib/scout/markets";
import type { IdeaRecord } from "@/lib/scout/types";
import PostToTelegramButton from "./PostToTelegramButton";
import VoteCounts from "./VoteCounts";

type VoteCounts = Record<"fire" | "maybe" | "skip", number>;

interface Props {
  idea: IdeaRecord;
  votes: VoteCounts;
  compact?: boolean;
}

export default function IdeaCard({ idea, votes, compact = false }: Props) {
  const score = idea.total_score ?? 0;
  const dd = idea.deep_dive;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{getMarketName(idea.market_id)}</span>
        </div>
        <ScoreBadge score={score} />
      </div>

      {/* Title */}
      <h3 className="font-semibold text-base leading-snug">{idea.title}</h3>

      {/* Description */}
      {idea.description && (
        <p className="text-sm text-gray-600 leading-relaxed">{idea.description}</p>
      )}

      {/* Key fields */}
      {!compact && (
        <dl className="grid grid-cols-1 gap-1 text-sm">
          {idea.target_audience && (
            <div className="flex gap-2">
              <dt className="text-gray-400 shrink-0">👥</dt>
              <dd className="text-gray-700">{idea.target_audience}</dd>
            </div>
          )}
          {idea.monetization && (
            <div className="flex gap-2">
              <dt className="text-gray-400 shrink-0">💰</dt>
              <dd className="text-gray-700">{idea.monetization}</dd>
            </div>
          )}
          {idea.why_now && (
            <div className="flex gap-2">
              <dt className="text-gray-400 shrink-0">⚡</dt>
              <dd className="text-gray-700">{idea.why_now}</dd>
            </div>
          )}
        </dl>
      )}

      {/* Deep dive */}
      {dd && !compact && (
        <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
          {dd.analogues.length > 0 && (
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0">🏆</span>
              <span className="text-gray-700">{dd.analogues.slice(0, 3).join(" · ")}</span>
            </div>
          )}
          {dd.first_validation_step && (
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0">🚀</span>
              <span className="text-gray-700">{dd.first_validation_step}</span>
            </div>
          )}
          {dd.main_risks[0] && (
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0">⚠️</span>
              <span className="text-gray-700">{dd.main_risks[0]}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-gray-400 shrink-0">👥</span>
            <span className="text-gray-700">Team fit: {dd.team_fit_score}/10</span>
          </div>
        </div>
      )}

      {/* Votes + actions */}
      <div className="flex items-center gap-4 text-sm pt-1">
        <VoteCounts ideaId={idea.id} initial={votes} />
        <div className="ml-auto flex items-center gap-3">
          {idea.telegram_message_id ? (
            <span className="text-xs text-gray-400">✓ в каналі</span>
          ) : (
            <PostToTelegramButton ideaId={idea.id} />
          )}
          <span className="text-xs text-gray-400">
            {new Date(idea.created_at).toLocaleDateString("uk-UA")}
          </span>
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 75
      ? "bg-green-100 text-green-800"
      : score >= 65
        ? "bg-yellow-100 text-yellow-800"
        : "bg-gray-100 text-gray-600";

  return <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full shrink-0 ${cls}`}>{score}/100</span>;
}

