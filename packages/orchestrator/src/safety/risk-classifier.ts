import { IntentType, ModeId, RiskTier } from '@driftcode/shared';
import type { InternalParsedIntent } from '../helpers/factories.js';

export interface LocalRiskClassification {
  riskTier: RiskTier;
  blocked: boolean;
  blockReason?: string;
  confirmationRequired: boolean;
  matchedPattern?: string;
}

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string; tier: RiskTier }> = [
  { pattern: /\brm\s+-rf\b/i, reason: 'Recursive delete blocked', tier: RiskTier.Blocked },
  { pattern: /\bshutdown\b/i, reason: 'System shutdown blocked', tier: RiskTier.Blocked },
  { pattern: /\bgit\s+push\s+--force\b/i, reason: 'Force push blocked', tier: RiskTier.Blocked },
  { pattern: /\.env\b/i, reason: 'Env file access requires confirmation', tier: RiskTier.Medium },
];

export class RiskClassifier {
  classify(intent: InternalParsedIntent, actionText?: string): LocalRiskClassification {
    const text = actionText ?? intent.literalPayload ?? JSON.stringify(intent.slots);

    for (const blocked of BLOCKED_PATTERNS) {
      if (blocked.pattern.test(text)) {
        return {
          riskTier: blocked.tier,
          blocked: blocked.tier === RiskTier.Blocked || blocked.tier === RiskTier.Dangerous,
          blockReason: blocked.reason,
          confirmationRequired: blocked.tier === RiskTier.Medium,
          matchedPattern: blocked.pattern.source,
        };
      }
    }

    if (intent.intentType === IntentType.EmergencyStop) {
      return { riskTier: RiskTier.Safe, blocked: false, confirmationRequired: false };
    }

    if (intent.intentType === IntentType.TerminalRun) {
      return { riskTier: RiskTier.Medium, blocked: false, confirmationRequired: true };
    }

    if (intent.intentType === IntentType.ModeSwitch && intent.slots.modeId === ModeId.VibeCoding) {
      return { riskTier: RiskTier.Medium, blocked: false, confirmationRequired: true };
    }

    return { riskTier: RiskTier.Safe, blocked: false, confirmationRequired: false };
  }
}
