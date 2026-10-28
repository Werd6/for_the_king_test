import { PrimaryButton, SecondaryButton } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { hasStudyContent } from '@/lib/content';
import { useContent } from '@/lib/ContentContext';
import { readJson, writeJson } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

const SEEN_KEY = 'ftk.leaderTourSeen';

type MaterialSymbol = NonNullable<
  Extract<ComponentProps<typeof SymbolView>['name'], object>['android']
>;

type TourStep = { title: string; body: string[]; ios: SFSymbol; material: MaterialSymbol };

const LeaderTourContext = createContext<{ openTour: () => void }>({ openTour: () => {} });

export function useLeaderTour() {
  return useContext(LeaderTourContext);
}

/**
 * Shows the leader tour once per huddle (on this device) while the huddle is on week 1,
 * and lets screens replay it with `useLeaderTour().openTour()`.
 */
export function LeaderTourProvider({ children }: { children: ReactNode }) {
  const { huddle, isLeader } = useAuth();
  const { pathway } = useContent();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!huddle || !isLeader || !pathway || huddle.current_week !== 1) return;
    let cancelled = false;
    readJson<string[]>(SEEN_KEY, []).then((seen) => {
      if (!cancelled && !seen.includes(huddle.id)) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [huddle, isLeader, pathway]);

  const close = useCallback(async () => {
    setOpen(false);
    if (!huddle) return;
    const seen = await readJson<string[]>(SEEN_KEY, []);
    if (!seen.includes(huddle.id)) await writeJson(SEEN_KEY, [...seen, huddle.id]);
  }, [huddle]);

  const value = useMemo(() => ({ openTour: () => setOpen(true) }), []);

  return (
    <LeaderTourContext.Provider value={value}>
      {children}
      {huddle && isLeader ? <LeaderTourModal visible={open} onClose={close} /> : null}
    </LeaderTourContext.Provider>
  );
}

function LeaderTourModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, radii, spacing, typography } = useTheme();
  const { huddle } = useAuth();
  const { pathway } = useContent();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const steps = useMemo<TourStep[]>(() => {
    const leaderExtras = [
      pathway?.leaderGuide ? 'Leader Guide' : null,
      pathway?.challengePool ? 'Challenge Pool' : null,
    ].filter(Boolean);
    const hasStudy = pathway?.weeks.some((w) => hasStudyContent(w, pathway.resources)) ?? false;
    return [
      {
        title: 'Welcome, leader',
        ios: 'crown',
        material: 'workspace_premium',
        body: [
          `You’re leading ${huddle?.name ?? 'your huddle'}${pathway ? ` through ${pathway.name}` : ''}.`,
          'Here’s a one-minute look at the tools you have as the leader.',
        ],
      },
      {
        title: 'Invite your group',
        ios: 'person.badge.plus',
        material: 'person_add',
        body: [
          `Your invite code is ${huddle?.invite_code ?? '—'}.`,
          'Share it from Settings → Invite. Members sign up, tap Join Huddle, and enter the code.',
        ],
      },
      {
        title: 'This Week',
        ios: 'calendar',
        material: 'calendar_today',
        body: [
          'Everyone sees the same week and checks off challenges as they go. Daily challenges have a box for each day.',
          'Tap Leader Materials at the top for your meeting plan: discussion questions, prayer, and what to cover.',
          ...(hasStudy ? ['Weeks with a reading also get a Study tab.'] : []),
          'On group challenge weeks, you pick the activity at the meeting.',
        ],
      },
      {
        title: 'Progress',
        ios: 'checkmark.circle',
        material: 'task_alt',
        body: [
          'See how each member is doing this week. Tap a name to see item by item.',
          `The Leader section at the bottom has View progress for past weeks${
            leaderExtras.length ? `, plus the ${leaderExtras.join(' and ')}` : ''
          }.`,
        ],
      },
      {
        title: 'Advance the week',
        ios: 'forward.end',
        material: 'skip_next',
        body: [
          'The huddle doesn’t move on by itself. After your meeting, go to Progress → Leader → Advance to next week.',
          'Everyone moves to the new week together. Advanced by mistake? Use Progress → Leader → Change week to go back.',
        ],
      },
      {
        title: 'Meetings & settings',
        ios: 'gearshape',
        material: 'settings',
        body: [
          'Set your meeting time and place in Settings → Meetings so everyone can add it to their calendar.',
          'Under Journal notes, choose whether notes are optional or required, and private or shared with the huddle.',
        ],
      },
      {
        title: 'You’re all set',
        ios: 'checkmark.seal',
        material: 'verified',
        body: ['Replay this tour any time from Settings → Leader tour.'],
      },
    ];
  }, [huddle?.name, huddle?.invite_code, pathway]);

  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 460,
            maxHeight: '90%',
            borderRadius: radii.lg,
            backgroundColor: colors.bg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
            }}
          >
            <Text style={{ ...typography.label, color: colors.mutedText, flex: 1 }}>
              Leader tour · {index + 1} of {steps.length}
            </Text>
            {!last ? (
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
                <Text style={{ ...typography.label, color: colors.primary }}>Skip</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SymbolView
                name={{ ios: step.ios, android: step.material, web: step.material }}
                tintColor={colors.primary}
                size={28}
              />
            </View>
            <Text style={{ ...typography.title, color: colors.ink }} accessibilityRole="header">
              {step.title}
            </Text>
            {step.body.map((p) => (
              <Text key={p} style={{ ...typography.body, color: colors.ink }}>
                {p}
              </Text>
            ))}
          </ScrollView>

          <View style={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}>
            <View
              style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {steps.map((s, i) => (
                <View
                  key={s.title}
                  style={{
                    width: i === index ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === index ? colors.primary : colors.muted,
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {index > 0 ? (
                <View style={{ flex: 1 }}>
                  <SecondaryButton title="Back" onPress={() => setIndex((i) => i - 1)} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title={last ? 'Get started' : 'Next'}
                  onPress={last ? onClose : () => setIndex((i) => i + 1)}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
