export type PathwayWeekType = 'standard' | 'groupChallenge';

export type ChallengeItem = {
  id: string;
  text: string;
  /** Member writes something down for this item; huddles can require a note before checking it off. */
  requiresNote?: boolean;
  /** Follow-up steps shown under the item (e.g. journaling prompts for a challenge option). */
  details?: StudyBlock[];
};

/** Paragraph text may use **bold**. */
export type StudyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'quote'; text: string; source?: string };

/** Material the huddle reads together (Study tab). */
export type WeekStudy = {
  /** Shown above the week's material, e.g. the core value a new section begins with. */
  preface?: { title: string; blocks: StudyBlock[] };
  definition?: string;
  quotes?: { text: string; source: string }[];
  article?: StudyBlock[];
};

/** Pathway-wide pages every member can open from the Study tab (How to SOAP, etc.). */
export type PathwayResource = {
  id: string;
  title: string;
  blocks: StudyBlock[];
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
  talkingToGod?: string[];
  journaling?: ChallengeItem[];
  /** Passages to study with the SOAP method; each is a checkable item. */
  soap?: ChallengeItem[];
  challenges: ChallengeItem[];
  /** `chooseOne`: completing any one challenge completes the challenge. Default `all`. */
  challengeMode?: 'all' | 'chooseOne';
  /** Leader prompts for reviewing last week's challenge at the meeting. */
  challengeReview?: string[];
  careForTheBody?: ChallengeItem;
  study?: WeekStudy;
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
  resources?: PathwayResource[];
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
  settings: HuddleSettings;
  created_at: string;
};

export type NotesVisibility = 'private' | 'shared';

/** Leader-controlled huddle options. */
export type HuddleSettings = {
  /** Tagged items can't be checked off without a note. */
  requireNotes: boolean;
  /** Applied to each note when it's saved: only the author, or everyone in the huddle. */
  notesVisibility: NotesVisibility;
};

export type JournalNote = {
  id: string;
  huddle_id: string;
  user_id: string;
  week: number;
  item_id: string;
  body: string;
  visibility: NotesVisibility;
  created_at: string;
  updated_at: string;
};

export type JournalPhoto = {
  id: string;
  note_id: string;
  user_id: string;
  /** Storage path in the `journal` bucket; a data URL in local mode. */
  path: string;
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
