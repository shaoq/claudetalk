/**
 * Claude Code DingTalk Channel - Type Definitions
 */

// 钉钉 Channel 配置
export interface DingTalkChannelConfig {
  /** 应用的 AppKey (Client ID) */
  clientId: string;
  /** 应用的 AppSecret (Client Secret) */
  clientSecret: string;
  /** 机器人代码，通常与 clientId 相同 */
  robotCode?: string;
  /** 企业 ID */
  corpId?: string;
  /** 应用 ID */
  agentId?: string;
  /** 私聊策略: open | pairing | allowlist */
  dmPolicy?: "open" | "pairing" | "allowlist";
  /** 群聊策略: open | allowlist | disabled */
  groupPolicy?: "open" | "allowlist" | "disabled";
  /** 允许的发送者 ID 列表 */
  allowFrom?: string[];
  /** 群聊发送者白名单 */
  groupAllowFrom?: string[];
  /** 消息类型: markdown | card */
  messageType?: "markdown" | "card";
  /** AI 卡片模板 ID */
  cardTemplateId?: string;
  /** 卡片内容字段键 */
  cardTemplateKey?: string;
  /** 调试模式 */
  debug?: boolean;
}

// 钉钉 Stream 消息
export interface DingTalkStreamMessage {
  /** 消息类型 */
  msgtype: string;
  /** 消息内容 */
  text?: {
    content: string;
  };
  /** 富文本内容 */
  richText?: string;
  /** 图片内容 */
  image?: {
    downloadCode: string;
    photoSize?: {
      width: number;
      height: number;
    };
  };
  /** 语音内容 */
  voice?: {
    downloadCode: string;
    duration: number;
    recognition?: string;
  };
  /** 视频内容 */
  video?: {
    downloadCode: string;
    duration: number;
    videoSize?: {
      width: number;
      height: number;
    };
  };
  /** 文件内容 */
  file?: {
    downloadCode: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  };
  /** 引用消息 */
  quotedMsg?: {
    msgId: string;
    msgtype: string;
    content: string;
    createdAt: number;
  };
  /** 被引用的消息详情 */
  repliedMsg?: {
    msgId: string;
    msgtype: string;
    content: unknown;
    createdAt: number;
  };
}

// 钉钉入站消息回调
export interface DingTalkInboundCallback {
  /** 消息 ID */
  msgId: string;
  /** 会话类型: 1=单聊, 2=群聊 */
  conversationType: "1" | "2";
  /** 文本消息内容 */
  text?: {
    content: string;
  };
  /** 会话 ID */
  conversationId: string;
  /** 发送者 ID */
  senderId: string;
  /** 发送者企业员工 ID */
  senderCorpId?: string;
  /** 发送者员工 ID */
  senderStaffId?: string;
  /** 消息内容 */
  content: string;
  /** 消息创建时间 */
  createTime: number;
  /** 消息类型 */
  msgtype: string;
  /** @人员列表 */
  atUserIds?: string[];
  /** @机器人标记 */
  isInAtList?: boolean;
  /** 引用消息 ID */
  originalMsgId?: string;
  /** 会话 Webhook (用于回复) */
  sessionWebhook?: string;
  /** 会话 Webhook 过期时间 */
  sessionWebhookExpiredTime?: number;
}

// 钉钉 API Token 响应
export interface DingTalkTokenResponse {
  errcode: number;
  errmsg: string;
  accessToken: string;
  expiresIn: number;
}

// 钉钉消息发送响应
export interface DingTalkSendResponse {
  errcode: number;
  errmsg: string;
  processQueryKeys?: string[];
}

// AI 卡片实例
export interface AICardInstance {
  outTrackId: string;
  cardInstanceId?: string;
  carrierId?: string;
  conversationId: string;
  conversationType: "1" | "2";
  openSpaceId: string;
  targetUserId?: string;
  targetUserIdType?: number;
  processQueryKey: string;
  templateId: string;
}

// AI 卡片投放上下文
export interface CardDeliveryContext {
  /** 会话类型: 1=单聊, 2=群聊 */
  conversationType: "1" | "2";
  /** 会话 ID */
  conversationId: string;
  /** 发送者 ID（某些参考实现直接用此字段作为目标 userId） */
  senderId?: string;
  /** 发送者员工 ID（私聊优先作为 userId / openSpaceId 目标） */
  senderStaffId?: string;
}

// AI 卡片创建请求（字段与钉钉 createAndDeliver 接口保持一致）
export interface AICardCreateRequest {
  cardTemplateId: string;
  outTrackId: string;
  callbackType?: "STREAM" | "HTTP";
  userId?: string;
  userIdType?: number;
  /** 场域标识，格式: dtv1.card//IM_ROBOT.<userId> 或 dtv1.card//IM_GROUP.<conversationId> */
  openSpaceId: string;
  imRobotOpenSpaceModel?: {
    supportForward?: boolean;
  };
  imRobotOpenDeliverModel?: {
    spaceType: "IM_ROBOT";
  };
  imGroupOpenSpaceModel?: {
    supportForward?: boolean;
  };
  imGroupOpenDeliverModel?: {
    robotCode: string;
    atUserIds?: Record<string, string>;
    recipients?: string[];
  };
  cardData: {
    cardParamMap: {
      [key: string]: string;
    };
  };
}

export interface AICardDeliverResult {
  spaceId?: string;
  spaceType?: string;
  success?: boolean;
  errorCode?: string | number;
  errorMsg?: string;
  carrierId?: string;
  cardInstanceId?: string;
  processQueryKey?: string;
}

export interface AICardCreateResponse {
  success?: boolean;
  errcode?: number;
  errmsg?: string;
  message?: string;
  cardInstanceId?: string;
  processQueryKey?: string;
  result?: {
    outTrackId?: string;
    cardInstanceId?: string;
    processQueryKey?: string;
    deliverResults?: AICardDeliverResult[];
  };
}

// AI 卡片更新请求
export interface AICardStreamingRequest {
  outTrackId: string;
  userIdType?: number;
  cardUpdateOptions?: {
    updateCardDataByKey?: boolean;
  };
  cardData: {
    cardParamMap: {
      [key: string]: string;
    };
  };
}

export interface AICardStreamingResponse {
  success?: boolean;
  errcode?: number;
  errmsg?: string;
  message?: string;
  result?: boolean | { outTrackId?: string; cardInstanceId?: string };
}

// 解析后的消息内容
export interface ParsedMessageContent {
  /** 消息类型 */
  type: "text" | "image" | "voice" | "video" | "file" | "richText";
  /** 文本内容 */
  text?: string;
  /** 媒体下载码 */
  downloadCode?: string;
  /** 文件名 */
  fileName?: string;
  /** 文件大小 */
  fileSize?: number;
  /** 语音识别结果 */
  recognition?: string;
  /** 引用内容 */
  quotedContent?: string;
  /** 额外元数据 */
  meta?: Record<string, unknown>;
}

// Channel 消息元数据
export interface ChannelMessageMeta {
  /** 会话 ID */
  conversationId: string;
  /** 发送者 ID */
  senderId: string;
  /** 会话类型 */
  conversationType: "1" | "2";
  /** 消息 ID */
  msgId: string;
  /** 是否群聊 */
  isGroup: boolean;
  /** @用户列表 */
  atUserIds?: string[];
}

// 发送者白名单存储
export interface SenderAllowlist {
  /** 白名单用户 ID 列表 */
  senders: string[];
  /** 配对码映射 */
  pairingCodes: Map<string, { code: string; expiresAt: number }>;
}

// 持久化状态
export interface ChannelState {
  /** 发送者白名单 */
  allowlist: SenderAllowlist;
  /** Access Token 缓存 */
  tokenCache: {
    accessToken: string;
    expiresAt: number;
  } | null;
  /** 活跃的 AI 卡片 */
  activeCards: Map<string, AICardInstance>;
}

// ClaudeTalk Profile 配置
export interface ProfileConfig {
  DINGTALK_CLIENT_ID?: string;
  DINGTALK_CLIENT_SECRET?: string;
  systemPrompt?: string;
  // SubAgent 相关配置
  subagentEnabled?: boolean;
  subagentModel?: string;
  subagentPermissions?: {
    allow?: string[];
    deny?: string[];
  };
  // 卡片流式输出配置
  messageType?: "markdown" | "card";
  cardTemplateId?: string;
  cardTemplateKey?: string;
}

// Claude CLI stream-json 输出事件类型
export type StreamEventType =
  | "system" // 系统事件：init, hook, retry 等
  | "stream_event" // 顶层包装事件，内含真实事件
  | "assistant" // assistant 消息开始
  | "content_block_start" // 内容块开始
  | "content_block_delta" // 内容块增量（正文文本主要来源）
  | "content_block_stop" // 内容块结束
  | "message_start" // 消息开始
  | "message_delta" // 消息级增量（stop_reason 等）
  | "message_stop" // 消息结束
  | "result" // 最终结果事件
  | "tool_use" // 工具调用
  | "tool_result" // 工具结果
  | string; // 兼容未知事件类型

// content_block_delta 中的 delta 结构
export interface ContentBlockDelta {
  type?: string; // "text_delta" | "thinking_delta" | "input_json_delta" | etc.
  text?: string; // text_delta 时的文本增量
  thinking?: string; // thinking_delta 时的思考内容
  partial_json?: string;
}

export interface AssistantMessageContentBlock {
  type?: string;
  text?: string;
}

// Claude CLI stream-json 输出事件
export interface StreamChunk {
  type: StreamEventType;
  subtype?: string;
  // 文本内容：部分事件直接携带 text 字段
  text?: string;
  // 增量内容：content_block_delta 事件的主要载体
  delta?: string | ContentBlockDelta;
  // 内容块信息
  index?: number;
  content_block?: {
    type?: string;
    text?: string;
    id?: string;
    name?: string;
  };
  // stream_event 包装：内层真实事件
  event?: StreamChunk;
  // 会话信息
  session_id?: string;
  // 结果事件字段
  is_error?: boolean;
  result?: string;
  duration_ms?: number;
  duration_api?: number;
  stop_reason?: string;
  // 消息级字段
  message?: {
    id?: string;
    type?: string;
    role?: string;
    content?: AssistantMessageContentBlock[] | string;
    model?: string;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  cost_usd?: number;
}

// callClaude 流式回调选项
export interface CallClaudeOptions {
  /** 流式文本回调，text 为累积文本，isFinal 为是否结束 */
  onChunk?: (text: string, isFinal: boolean) => void;
}
