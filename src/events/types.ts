export type EventRound = {
  label: string;
  badge: string;
  color: string;
  badgeTextColor?: string;
  title: string;
  subheading: string;
  bullets: string[];
  advance?: string;
};

export type EventConfig = {
  route: string;
  slug: string;
  name: string;
  badge: string;
  titleTop: string;
  titleAccent: string;
  subtitle: string;
  date: string;
  time: string;
  venue: string;
  teamLabel: string;
  feeLabel: string;
  heroFeeLabel: string;
  fee: number;
  minMembers: number;
  maxMembers: number;
  accent: string;
  accentDark: string;
  glow: string;
  heroImage: string;
  qrNote: string;
  snippets: string[];
  processSubtext: string;
  rounds: EventRound[];
  rules: string[];
  firstPlaceTitle: string;
};
