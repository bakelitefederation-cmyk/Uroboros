export const SOURCES = [
  { id: "vkok_avatar", label: "Аватары VK и OK" },
  { id: "vkokn_avatar", label: "Новые аватары VK и OK" },
  { id: "vk_wall", label: "Фото со стен VK" },
  { id: "tt_avatar", label: "Аватары TikTok" },
  { id: "ch_avatar", label: "Аватары Clubhouse" },
  { id: "sb_photo", label: "База sb_photo" },
] as const;

export type SourceId = (typeof SOURCES)[number]["id"];

export function sourceLabel(id: string) {
  return SOURCES.find((s) => s.id === id)?.label ?? id;
}

export type Face = {
  x: number;
  y: number;
  width: number;
  height: number;
  lm1_x: number;
  lm1_y: number;
  lm2_x: number;
  lm2_y: number;
  lm3_x: number;
  lm3_y: number;
  lm4_x: number;
  lm4_y: number;
  lm5_x: number;
  lm5_y: number;
};

export type Profile = {
  score: number;
  face: string;
  profile: string;
  photo: string;
  sourceImage: string;
  age: number | null;
  firstName: string;
  lastName: string;
  maidenName: string;
  city: string;
  country: string;
  database: SourceId;
};

export type MergedProfile = Profile & { databases: SourceId[]; matches: number };

export type SourceResult = {
  source: SourceId;
  ok: boolean;
  error?: string;
  profiles: Profile[];
};

export type Limit = {
  limit: number;
  remaining: number;
  enddate: string;
  speed: number;
} | null;
