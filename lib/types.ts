export type PathwayWeekType = 'standard' | 'groupChallenge';

export type ChallengeItem = {
  id: string;
  text: string;
};

export type StandardWeek = {
  weekNumber: number;
  title: string;
  movement: string;
  type: 'standard';
  /** Meeting / leader materials — not shown on personal week home */
  intro: string;
  reading: string;
  discuss: string[];
  talkingToGod: string[];
  journaling: ChallengeItem[];
  challenges: ChallengeItem[];
  careForTheBody: ChallengeItem;
};

export type GroupChallengeWeek = {
  weekNumber: number;
  title: string;
  movement: string;
  type: 'groupChallenge';
  intro: string;
  options: ChallengeItem[];
  beforeYouGo: string[];
  closeInPrayer: string;
  celebrate: string | null;
  guardrails: string;
};

export type PathwayWeek = StandardWeek | GroupChallengeWeek;

export type Pathway = {
  id: string;
  name: string;
  description: string;
  totalWeeks: number;
  weeks: PathwayWeek[];
};

export type MeetingInfo = {
  /** Typical meeting datetime (ISO). Used for time-of-day / next occurrence display. */
  time: string | null;
  /** Address or meeting link (Zoom, maps URL, etc.). */
  location: string | null;
};

export type Profile = {
  id: string;
  display_name: string;
  email: string | null;
  created_at: string;
};

export type Huddle = {
  id: string;
  name: string;
  invite_code: string;
  leader_id: string;
  pathway_id: string;
  pathway_version_id: string;
  current_week: number;
  meetings: MeetingInfo;
  created_at: string;
};

export type Membership = {
  id: string;
  huddle_id: string;
  user_id: string;
  joined_at: string;
};

export type ProgressRow = {
  id: string;
  huddle_id: string;
  user_id: string;
  week: number;
  item_id: string;
  completed_at: string;
};

export type WeekPick = {
  huddle_id: string;
  week: number;
  option_id: string;
  picked_by: string;
  picked_at: string;
};

export type MemberProgressSummary = {
  userId: string;
  displayName: string;
  completed: number;
  total: number;
  itemIds: string[];
};
