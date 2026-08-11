import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  TikTokSyncErrorCategory,
  TikTokSyncHistory,
  TikTokSyncRun,
} from "../api/orders";
import { UI } from "../constants/ui";
import { formatLocalDateTime } from "../utils/formatLocalDateTime";
import { StatusBadge as StatusBadgeBase } from "./ui/StatusBadge";

type TikTokSyncStatusCardProps = {
  data: TikTokSyncHistory | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
};

const syncErrorMessages: Record<TikTokSyncErrorCategory, string> = {
  NOT_CONNECTED: "TikTok Shop is not connected.",
  SHOP_METADATA_MISSING: "TikTok Shop details need to be synchronized.",
  TOKEN_REFRESH_FAILED: "TikTok Shop authorization needs attention.",
  TIKTOK_UNAVAILABLE: "TikTok Shop was temporarily unavailable.",
  DATABASE_ERROR: "The synchronization could not be recorded correctly.",
  VALIDATION_ERROR: "The synchronization request was invalid.",
  UNKNOWN: "The synchronization failed unexpectedly.",
};

export const getTikTokSyncCategoryMessage = (
  category: TikTokSyncErrorCategory | null
) =>
  (category ? syncErrorMessages[category] : undefined) ??
  syncErrorMessages.UNKNOWN;

const getSourceLabel = (source: TikTokSyncRun["source"]) =>
  source === "MANUAL" ? "Manual" : "Scheduled";

const getStatusLabel = (status: TikTokSyncRun["status"]) =>
  status === "SUCCESS" ? "Success" : "Failed";

const formatDuration = (durationMs: number | null) => {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) {
    return null;
  }

  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }

  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
};

function StatusBadge({ status }: { status: TikTokSyncRun["status"] }) {
  return (
    <StatusBadgeBase
      label={getStatusLabel(status)}
      tone={status === "SUCCESS" ? "success" : "danger"}
    />
  );
}

function AttemptCounts({ run }: { run: TikTokSyncRun }) {
  return (
    <View style={styles.countRow}>
      <View style={styles.countItem}>
        <Text style={styles.countLabel}>New</Text>
        <Text style={styles.countValue}>{run.created}</Text>
      </View>
      <View style={styles.countItem}>
        <Text style={styles.countLabel}>Existing</Text>
        <Text style={styles.countValue}>{run.existing}</Text>
      </View>
      <View style={styles.countItem}>
        <Text style={styles.countLabel}>Failed</Text>
        <Text
          style={[
            styles.countValue,
            run.failed > 0 && styles.failedCountValue,
          ]}
        >
          {run.failed}
        </Text>
      </View>
    </View>
  );
}

function HistoryItem({ run }: { run: TikTokSyncRun }) {
  return (
    <View style={styles.historyItem}>
      <View style={styles.historyItemHeader}>
        <StatusBadge status={run.status} />
        <Text style={styles.historySource}>{getSourceLabel(run.source)}</Text>
      </View>
      <Text style={styles.historyDate}>
        {formatLocalDateTime(run.completedAt)} · {run.days} day
        {run.days === 1 ? "" : "s"}
      </Text>
      <Text style={styles.historyCounts}>
        New {run.created} · Existing {run.existing} · Failed {run.failed}
      </Text>
    </View>
  );
}

export function TikTokSyncStatusCard({
  data,
  loading,
  error,
  onRetry,
}: TikTokSyncStatusCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const lastAttempt = data?.lastAttempt ?? null;
  const duration = lastAttempt ? formatDuration(lastAttempt.durationMs) : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync Status</Text>
      </View>

      {loading && !data ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={UI.colors.primary} />
          <Text style={styles.loadingText}>Loading sync status...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>
            Unable to load TikTok sync status.
          </Text>
          <Pressable
            onPress={onRetry}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Retry loading TikTok sync status"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && !lastAttempt ? (
        <Text style={styles.emptyText}>
          No TikTok synchronization has been recorded yet.
        </Text>
      ) : null}

      {lastAttempt ? (
        <>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Last successful</Text>
            <Text style={styles.detailValue}>
              {data?.lastSuccessful
                ? formatLocalDateTime(data.lastSuccessful.completedAt)
                : "No successful synchronization yet."}
            </Text>
          </View>

          <View style={styles.latestHeader}>
            <View>
              <Text style={styles.detailLabel}>Latest attempt</Text>
              <Text style={styles.latestMeta}>
                {getSourceLabel(lastAttempt.source)}
                {duration ? ` · ${duration}` : ""}
              </Text>
            </View>
            <StatusBadge status={lastAttempt.status} />
          </View>

          {lastAttempt.status === "FAILED" ? (
            <Text style={styles.failureMessage}>
              {getTikTokSyncCategoryMessage(lastAttempt.errorCategory)}
            </Text>
          ) : null}

          <AttemptCounts run={lastAttempt} />

          {data && data.history.length > 0 ? (
            <>
              <Pressable
                style={styles.historyToggle}
                onPress={() => setShowHistory((current) => !current)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showHistory }}
              >
                <Text style={styles.historyToggleText}>
                  {showHistory ? "Hide history" : "Show recent history"}
                </Text>
                <Text style={styles.historyToggleIcon}>
                  {showHistory ? "−" : "+"}
                </Text>
              </Pressable>

              {showHistory ? (
                <View style={styles.historyList}>
                  {data.history.map((run) => (
                    <HistoryItem key={run.id} run={run} />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: UI.colors.surface,
    borderRadius: UI.radius.large,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: UI.colors.border,
    ...UI.shadow,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  title: {
    color: UI.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: UI.radius.pill,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "800",
  },
  successBadge: {
    backgroundColor: UI.colors.successSoft,
    color: UI.colors.success,
  },
  failedBadge: {
    backgroundColor: UI.colors.dangerSoft,
    color: UI.colors.danger,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    color: UI.colors.inkMuted,
    fontSize: 13,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: UI.radius.small,
    backgroundColor: UI.colors.dangerSoft,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    color: UI.colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  retryButton: {
    minHeight: UI.control.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: UI.radius.small,
    backgroundColor: UI.colors.surface,
  },
  retryButtonText: {
    color: UI.colors.danger,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyText: {
    color: UI.colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  detailBlock: {
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
    paddingTop: 12,
    marginBottom: 14,
  },
  detailLabel: {
    color: UI.colors.inkMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  detailValue: {
    color: UI.colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 5,
  },
  latestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  latestMeta: {
    color: UI.colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },
  failureMessage: {
    color: UI.colors.danger,
    backgroundColor: UI.colors.dangerSoft,
    borderRadius: UI.radius.small,
    fontSize: 12,
    lineHeight: 18,
    padding: 10,
    marginTop: 12,
  },
  countRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  countItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: UI.colors.surfaceMuted,
    borderRadius: UI.radius.small,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  countLabel: {
    color: UI.colors.inkMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  countValue: {
    color: UI.colors.ink,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 3,
  },
  failedCountValue: {
    color: UI.colors.danger,
  },
  historyToggle: {
    minHeight: UI.control.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
    marginTop: 14,
    paddingTop: 12,
  },
  historyToggleText: {
    color: UI.colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  historyToggleIcon: {
    color: UI.colors.primary,
    fontSize: 18,
    fontWeight: "700",
  },
  historyList: {
    borderTopWidth: 1,
    borderTopColor: UI.colors.border,
  },
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: UI.colors.border,
  },
  historyItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historySource: {
    color: UI.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  historyDate: {
    color: UI.colors.inkMuted,
    fontSize: 11,
    marginTop: 7,
  },
  historyCounts: {
    color: UI.colors.ink,
    fontSize: 11,
    marginTop: 5,
  },
});
