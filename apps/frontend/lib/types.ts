export type ApiTag = {
  tag: string;
  trust?: number | null;
};

export type ApiPostStats = {
  views: number;
  watchSeconds: number;
  bookmarks: number;
  follows: number;
  popularity: number;
};

export type ApiPostPreview = {
  seconds: number;
};

export type ApiAuthorProfile = {
  handle: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  tagline: string | null;
};

export type ApiComment = {
  id: string;
  body: string;
  createdAt: string;
  author?: ApiAuthorProfile | null;
};

export type ApiPost = {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  resolution: string;
  storageKey: string;
  createdAt: string;
  sensitive: boolean;
  aiScore?: number | null;
  aiTags: ApiTag[];
  tags: string[];
  postStats?: ApiPostStats;
  popularity?: number;
  previewSeconds?: number;
  author?: ApiAuthorProfile | null;
  authorHandle?: string | null;
  authorDisplay?: string | null;
  authorAvatar?: string | null;
  comments?: ApiComment[];
};

export type FeedResponse = {
  posts: ApiPost[];
  tag?: string;
};
