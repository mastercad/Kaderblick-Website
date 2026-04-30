import { apiJson, apiRequest } from '../utils/api';
import type {
  CreatePostPayload,
  KnowledgeBaseCategory,
  KnowledgeBaseCategoryListResponse,
  KnowledgeBaseComment,
  KnowledgeBaseCommentListResponse,
  KnowledgeBasePostCard,
  KnowledgeBasePostDetail,
  KnowledgeBasePostListResponse,
  KnowledgeBaseTag,
  UpdatePostPayload,
} from '../types/knowledgeBase';

export type {
  CreatePostPayload,
  KnowledgeBaseCategory,
  KnowledgeBaseCategoryListResponse,
  KnowledgeBaseComment,
  KnowledgeBaseCommentListResponse,
  KnowledgeBaseMedia,
  KnowledgeBasePostCard,
  KnowledgeBasePostDetail,
  KnowledgeBasePostListResponse,
  KnowledgeBaseTag,
  UpdatePostPayload,
} from '../types/knowledgeBase';

// ─── Categories ───────────────────────────────────────────────────────────────

export async function fetchCategories(teamId: number): Promise<KnowledgeBaseCategoryListResponse> {
  return apiJson(`/knowledge-base/categories?teamId=${teamId}`);
}

export async function createCategory(data: {
  teamId?: number;
  name: string;
  icon?: string;
  sortOrder?: number;
}): Promise<KnowledgeBaseCategory> {
  return apiJson('/knowledge-base/categories', { method: 'POST', body: data });
}

export async function deleteCategory(id: number): Promise<void> {
  await apiRequest(`/knowledge-base/categories/${id}`, { method: 'DELETE' });
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function fetchTags(teamId: number): Promise<{ tags: KnowledgeBaseTag[] }> {
  return apiJson(`/knowledge-base/tags?teamId=${teamId}`);
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function fetchPosts(
  teamId: number,
  categoryId?: number,
  search?: string,
  tag?: string,
): Promise<KnowledgeBasePostListResponse> {
  const params = new URLSearchParams({ teamId: String(teamId) });
  if (categoryId) params.set('categoryId', String(categoryId));
  if (search) params.set('search', search);
  if (tag) params.set('tag', tag);
  return apiJson(`/knowledge-base?${params.toString()}`);
}

export async function fetchPost(id: number): Promise<KnowledgeBasePostDetail> {
  return apiJson(`/knowledge-base/${id}`);
}

export async function createPost(data: CreatePostPayload): Promise<KnowledgeBasePostDetail> {
  return apiJson('/knowledge-base', { method: 'POST', body: data });
}

export async function updatePost(id: number, data: UpdatePostPayload): Promise<KnowledgeBasePostDetail> {
  return apiJson(`/knowledge-base/${id}`, { method: 'PUT', body: data });
}

export async function deletePost(id: number): Promise<void> {
  await apiRequest(`/knowledge-base/${id}`, { method: 'DELETE' });
}

export async function togglePin(id: number): Promise<{ isPinned: boolean }> {
  return apiJson(`/knowledge-base/${id}/pin`, { method: 'POST' });
}

export async function toggleLike(id: number): Promise<{ liked: boolean; likeCount: number }> {
  return apiJson(`/knowledge-base/${id}/like`, { method: 'POST' });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function fetchComments(postId: number): Promise<KnowledgeBaseCommentListResponse> {
  return apiJson(`/knowledge-base/${postId}/comments`);
}

export async function addComment(postId: number, content: string): Promise<KnowledgeBaseComment> {
  return apiJson(`/knowledge-base/${postId}/comments`, { method: 'POST', body: { content } });
}

export async function deleteComment(id: number): Promise<void> {
  await apiRequest(`/knowledge-base/comments/${id}`, { method: 'DELETE' });
}
