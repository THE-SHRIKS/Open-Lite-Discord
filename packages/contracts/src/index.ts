import { z } from 'zod';

// ─── Roles ────────────────────────────────────────────────────────────────────
export const Role = z.enum(['owner', 'admin', 'member']);
export type Role = z.infer<typeof Role>;

export const ChannelVisibility = z.enum(['public', 'private']);
export type ChannelVisibility = z.infer<typeof ChannelVisibility>;

// ─── Auth DTOs ────────────────────────────────────────────────────────────────
export const RegisterSchema = z.object({
  username: z.string().min(2).max(32).regex(/^[a-z0-9_-]+$/, 'Lowercase alphanumeric, underscore, hyphen only'),
  displayName: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});
export type RegisterDTO = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginDTO = z.infer<typeof LoginSchema>;

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(64),
});
export type UpdateProfileDTO = z.infer<typeof UpdateProfileSchema>;

export const UserDTO = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  avatarColor: z.string(),
  createdAt: z.string(),
});
export type UserDTO = z.infer<typeof UserDTO>;

// ─── Space DTOs ───────────────────────────────────────────────────────────────
export const CreateSpaceSchema = z.object({
  name: z.string().min(1).max(64),
  iconText: z.string().max(4).optional(),
});
export type CreateSpaceDTO = z.infer<typeof CreateSpaceSchema>;

export const SpaceDTO = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  iconText: z.string(),
  ownerId: z.string().uuid(),
  createdAt: z.string(),
  role: Role.optional(),
});
export type SpaceDTO = z.infer<typeof SpaceDTO>;

// ─── Channel DTOs ─────────────────────────────────────────────────────────────
export const CreateChannelSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/, 'Lowercase alphanumeric, underscore, hyphen only'),
  topic: z.string().max(256).optional(),
  visibility: ChannelVisibility.default('public'),
});
export type CreateChannelDTO = z.infer<typeof CreateChannelSchema>;

export const UpdateChannelSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  topic: z.string().max(256).optional(),
  archivedAt: z.string().nullable().optional(),
});
export type UpdateChannelDTO = z.infer<typeof UpdateChannelSchema>;

export const ChannelDTO = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid(),
  name: z.string(),
  topic: z.string().nullable(),
  visibility: ChannelVisibility,
  channelOrder: z.number(),
  lastSequence: z.number(),
  archivedAt: z.string().nullable(),
  unreadCount: z.number().optional(),
});
export type ChannelDTO = z.infer<typeof ChannelDTO>;

// ─── Attachment DTOs ──────────────────────────────────────────────────────────
export const AttachmentDTO = z.object({
  id: z.string().uuid(),
  originalFilename: z.string(),
  mime: z.string(),
  byteLength: z.number(),
});
export type AttachmentDTO = z.infer<typeof AttachmentDTO>;

// ─── Message DTOs ─────────────────────────────────────────────────────────────
export const CreateMessageSchema = z.object({
  body: z.string().min(1).max(8000),
  clientNonce: z.string().uuid(),
  attachmentIds: z.array(z.string().uuid()).optional(),
});
export type CreateMessageDTO = z.infer<typeof CreateMessageSchema>;

export const UpdateMessageSchema = z.object({
  body: z.string().min(1).max(8000),
});
export type UpdateMessageDTO = z.infer<typeof UpdateMessageSchema>;

export const MessageDTO = z.object({
  id: z.string().uuid(),
  channelId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorUsername: z.string(),
  authorDisplayName: z.string(),
  authorAvatarColor: z.string(),
  body: z.string().nullable(),
  sequence: z.number(),
  clientNonce: z.string().nullable(),
  editedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  attachments: z.array(AttachmentDTO).optional(),
});
export type MessageDTO = z.infer<typeof MessageDTO>;

// ─── Member DTOs ──────────────────────────────────────────────────────────────
export const MemberDTO = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  avatarColor: z.string(),
  role: Role,
  joinedAt: z.string(),
  isOnline: z.boolean().optional(),
});
export type MemberDTO = z.infer<typeof MemberDTO>;

// ─── Invite DTOs ──────────────────────────────────────────────────────────────
export const CreateInviteSchema = z.object({
  expiresInHours: z.number().int().min(1).max(168).default(24),
  maxUses: z.number().int().min(1).max(100).default(10),
});
export type CreateInviteDTO = z.infer<typeof CreateInviteSchema>;

export const InviteDTO = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid(),
  token: z.string(),
  expiresAt: z.string(),
  usesRemaining: z.number(),
  createdAt: z.string(),
});
export type InviteDTO = z.infer<typeof InviteDTO>;

export const RedeemInviteSchema = z.object({
  token: z.string().min(1),
});
export type RedeemInviteDTO = z.infer<typeof RedeemInviteSchema>;

// ─── Search ───────────────────────────────────────────────────────────────────
export const SearchResultDTO = z.object({
  messageId: z.string().uuid(),
  channelId: z.string().uuid(),
  channelName: z.string(),
  authorDisplayName: z.string(),
  body: z.string(),
  sequence: z.number(),
  createdAt: z.string(),
  highlight: z.string().optional(),
});
export type SearchResultDTO = z.infer<typeof SearchResultDTO>;

// ─── Read cursors ─────────────────────────────────────────────────────────────
export const ReadCursorSchema = z.object({
  lastReadSequence: z.number().int().min(0),
});
export type ReadCursorDTO = z.infer<typeof ReadCursorSchema>;

// ─── Audit Events ─────────────────────────────────────────────────────────────
export const AuditEventDTO = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid().nullable(),
  actorId: z.string().uuid().nullable(),
  actorUsername: z.string().nullable().optional(),
  action: z.string(),
  targetId: z.string().nullable(),
  metadataJson: z.string().nullable(),
  createdAt: z.string(),
});
export type AuditEventDTO = z.infer<typeof AuditEventDTO>;

// ─── Error envelope ───────────────────────────────────────────────────────────
export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

export const ApiSuccess = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ data: schema });

export * from './events.js';
