export interface KnowledgeBaseCategory {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
  isGlobal: boolean;
  teamId: number | null;
}

export interface KnowledgeBaseTag {
  id: number;
  name: string;
}

export interface KnowledgeBaseMedia {
  id: number;
  url: string;
  mediaType: string;
  externalId: string | null;
  thumbnailUrl: string | null;
  label: string | null;
}

export interface KnowledgeBasePostCard {
  id: number;
  title: string;
  isPinned: boolean;
  categoryId: number;
  category: string;
  tags: KnowledgeBaseTag[];
  likeCount: number;
  commentCount: number;
  liked: boolean;
  createdAt: string;
  createdBy: { id: number; name: string };
  primaryMedia: { url: string; mediaType: string; externalId: string | null; thumbnailUrl: string | null } | null;
}

export interface KnowledgeBasePostDetail extends KnowledgeBasePostCard {
  description: string | null;
  sendNotification: boolean;
  updatedAt: string | null;
  mediaLinks: KnowledgeBaseMedia[];
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
}

export interface KnowledgeBaseComment {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  user: { id: number; name: string };
  canDelete: boolean;
}

export interface KnowledgeBasePostListResponse {
  posts: KnowledgeBasePostCard[];
  canCreate: boolean;
  isSuperAdmin?: boolean;
  likedPostIds: number[];
}

export interface KnowledgeBaseCategoryListResponse {
  categories: KnowledgeBaseCategory[];
  canManageCategories: boolean;
}

export interface KnowledgeBaseCommentListResponse {
  comments: KnowledgeBaseComment[];
  canCreate: boolean;
}

export interface CreatePostPayload {
  teamId?: number;
  categoryId: number;
  title: string;
  description?: string;
  mediaLinks?: { url: string; label?: string }[];
  tags?: string[];
  sendNotification?: boolean;
}

export interface UpdatePostPayload {
  title?: string;
  description?: string | null;
  categoryId?: number;
  mediaLinks?: { url: string; label?: string }[];
  tags?: string[];
}
