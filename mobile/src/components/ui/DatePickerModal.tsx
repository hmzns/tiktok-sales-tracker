import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { UI } from "../../constants/ui";

type DateParts = { year: number; month: number; day: number };

type DatePickerModalProps = {
  visible: boolean;
  value: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (value: number) => String(value).padStart(2, "0");

export const parseBusinessDate = (value: string): DateParts | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    return null;
  }

  return { year, month, day };
};

export const formatBusinessDate = ({ year, month, day }: DateParts) =>
  `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;

export const toBusinessDateIso = (value: string) => {
  const parts = parseBusinessDate(value);
  return parts ? `${formatBusinessDate(parts)}T00:00:00.000Z` : null;
};

export const formatBusinessDateLabel = (value: string) => {
  const parts = parseBusinessDate(value);
  if (!parts) return "Select a date";

  return new Intl.DateTimeFormat("en-MY", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
};

const getTodayParts = (): DateParts => {
  const today = new Date();
  return {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
};

export function DatePickerModal({
  visible,
  value,
  onCancel,
  onConfirm,
}: DatePickerModalProps) {
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState<DateParts>(() => parseBusinessDate(value) ?? getTodayParts());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initial = parseBusinessDate(value) ?? getTodayParts();
    return { year: initial.year, month: initial.month };
  });

  useEffect(() => {
    if (!visible) return;
    const initial = parseBusinessDate(value) ?? getTodayParts();
    setDraft(initial);
    setVisibleMonth({ year: initial.year, month: initial.month });
  }, [value, visible]);

  const calendarDays = useMemo(() => {
    const firstWeekday = new Date(
      Date.UTC(visibleMonth.year, visibleMonth.month - 1, 1)
    ).getUTCDay();
    const daysInMonth = new Date(
      Date.UTC(visibleMonth.year, visibleMonth.month, 0)
    ).getUTCDate();

    return Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
      index < firstWeekday ? null : index - firstWeekday + 1
    );
  }, [visibleMonth]);

  const changeMonth = (amount: -1 | 1) => {
    setVisibleMonth((current) => {
      const zeroBased = current.month - 1 + amount;
      const next = new Date(Date.UTC(current.year, zeroBased, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel date selection"
        />
        <View
          style={[styles.panel, { maxHeight: Math.max(360, height - 48) }]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Select expense date</Text>
            <Pressable style={styles.closeButton} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close date picker">
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.monthHeader}>
              <Pressable style={styles.monthButton} onPress={() => changeMonth(-1)} accessibilityRole="button" accessibilityLabel="Previous month">
                <Text style={styles.monthButtonText}>‹</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{MONTHS[visibleMonth.month - 1]} {visibleMonth.year}</Text>
              <Pressable style={styles.monthButton} onPress={() => changeMonth(1)} accessibilityRole="button" accessibilityLabel="Next month">
                <Text style={styles.monthButtonText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.calendarGrid}>
              {WEEKDAYS.map((weekday) => (
                <View key={weekday} style={styles.dayCell}>
                  <Text style={styles.weekday}>{weekday}</Text>
                </View>
              ))}
              {calendarDays.map((day, index) => {
                const selected = day !== null && draft.year === visibleMonth.year && draft.month === visibleMonth.month && draft.day === day;
                return (
                  <View key={`${visibleMonth.year}-${visibleMonth.month}-${index}`} style={styles.dayCell}>
                    {day === null ? null : (
                      <Pressable
                        style={[styles.dayButton, selected && styles.selectedDayButton]}
                        onPress={() => setDraft({ ...visibleMonth, day })}
                        accessibilityRole="button"
                        accessibilityLabel={`${MONTHS[visibleMonth.month - 1]} ${day}, ${visibleMonth.year}`}
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.dayText, selected && styles.selectedDayText]}>{day}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={onCancel} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.confirmButton]} onPress={() => onConfirm(formatBusinessDate(draft))} accessibilityRole="button">
              <Text style={styles.confirmText}>Use date</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#10182899", padding: 16 },
  panel: { width: "100%", maxWidth: 420, overflow: "hidden", backgroundColor: UI.colors.surface, borderRadius: UI.radius.large, ...UI.shadow },
  header: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 18, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: UI.colors.border },
  title: { color: UI.colors.ink, fontSize: 16, fontWeight: "800" },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: UI.radius.pill },
  closeText: { color: UI.colors.ink, fontSize: 28, lineHeight: 30 },
  content: { padding: 16 },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  monthButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: UI.radius.pill, backgroundColor: UI.colors.surfaceMuted },
  monthButtonText: { color: UI.colors.ink, fontSize: 28, lineHeight: 30 },
  monthTitle: { color: UI.colors.ink, fontSize: 15, fontWeight: "800", textAlign: "center" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.285714%", minHeight: 42, alignItems: "center", justifyContent: "center" },
  weekday: { color: UI.colors.inkMuted, fontSize: 10, fontWeight: "800" },
  dayButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  selectedDayButton: { backgroundColor: UI.colors.primary },
  dayText: { color: UI.colors.ink, fontSize: 13, fontWeight: "700" },
  selectedDayText: { color: "#FFFFFF", fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: UI.colors.border },
  actionButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: UI.radius.small },
  cancelButton: { backgroundColor: UI.colors.surface, borderWidth: 1, borderColor: UI.colors.border },
  confirmButton: { backgroundColor: UI.colors.primary },
  cancelText: { color: UI.colors.ink, fontSize: 13, fontWeight: "800" },
  confirmText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});
