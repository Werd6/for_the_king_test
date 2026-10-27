export const TAB_TITLES = {
  index: 'This Week',
  study: 'Study',
  progress: 'Progress',
  settings: 'Settings',
} as const;

/** Header title for a tab route segment; the group's index route is "This Week". */
export function tabTitle(segment: string | undefined): string {
  return segment && segment in TAB_TITLES
    ? TAB_TITLES[segment as keyof typeof TAB_TITLES]
    : TAB_TITLES.index;
}
