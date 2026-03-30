/**
 * Claude Code DingTalk Bot - 独立运行模式
 * 收到钉钉消息后，通过 claude -p CLI 调用 Claude Code 处理，并将回复发回钉钉
 * 支持多轮会话：每个 conversationId 维护独立的 session_id
 */

import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { DingTalkClient } from "./dingtalk.js";
import type {
  AICardInstance,
  DingTalkChannelConfig,
  DingTalkInboundCallback,
  ProfileConfig,
  StreamChunk,
  CallClaudeOptions,
} from "./types.js";

export interface StartBotOptions {
  clientId: string;
  clientSecret: string;
  workDir: string;
  profile?: string;
  systemPrompt?: string;
  // SubAgent 相关配置
  subagentEnabled?: boolean;
  subagentModel?: string;
  subagentPermissions?: any;
  // 卡片流式输出配置
  messageType?: "markdown" | "card";
  cardTemplateId?: string;
  cardTemplateKey?: string;
}

// ========== 日志 ==========
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.error(line);
}

// ========== 会话持久化 ==========
// 将 session 映射持久化到文件，重启后可恢复多轮对话
// key 格式: conversationId + '|' + workDir（区分不同工作目录的 session）
const SESSION_DIR = join(homedir(), ".claudetalk");
const SESSION_FILE = join(SESSION_DIR, "sessions.json");

// session value 结构（兼容旧格式的纯字符串）
interface SessionEntry {
  sessionId: string;
  lastActiveAt: number; // 时间戳，用于找最近活跃会话
  isGroup: boolean; // 是否群聊，发通知时需要
  conversationId: string;
  userId: string; // 私聊时的发送者 userId，用于主动发消息
  subagentEnabled: boolean; // 记录创建时的配置，用于检测配置变化
}

/**
 * 将旧格式（纯字符串 sessionId）或新格式统一解析为 SessionEntry
 */
function parseSessionEntry(value: unknown, key: string): SessionEntry | null {
  if (typeof value === "string") {
    // 兼容旧格式：value 是纯 sessionId 字符串
    const conversationId = key.split("|")[0] || "";
    return {
      sessionId: value,
      lastActiveAt: 0,
      isGroup: false,
      conversationId,
      userId: "",
      subagentEnabled: false,
    };
  }
  if (value && typeof value === "object" && "sessionId" in value) {
    const entry = value as SessionEntry;
    // 兼容没有 userId 字段的旧新格式
    if (!entry.userId) entry.userId = "";
    // 兼容没有 subagentEnabled 字段的旧格式
    if (entry.subagentEnabled === undefined) entry.subagentEnabled = false;
    return entry;
  }
  return null;
}

function loadSessionMap(): Map<string, SessionEntry> {
  if (!existsSync(SESSION_FILE)) {
    return new Map();
  }
  try {
    const content = readFileSync(SESSION_FILE, "utf-8");
    const raw = JSON.parse(content) as Record<string, unknown>;
    const entries = new Map<string, SessionEntry>();
    for (const [key, value] of Object.entries(raw)) {
      const entry = parseSessionEntry(value, key);
      if (entry) {
        entries.set(key, entry);
      }
    }
    log(`[session] Loaded ${entries.size} sessions from ${SESSION_FILE}`);
    return entries;
  } catch (error) {
    log(`[session] Failed to load sessions: ${error}`);
    return new Map();
  }
}

function saveSessionMap(): void {
  try {
    if (!existsSync(SESSION_DIR)) {
      mkdirSync(SESSION_DIR, { recursive: true });
    }
    const entries = Object.fromEntries(sessionMap);
    writeFileSync(
      SESSION_FILE,
      JSON.stringify(entries, null, 2) + "\n",
      "utf-8",
    );
    log(`[session] Saved ${sessionMap.size} sessions to ${SESSION_FILE}`);
  } catch (error) {
    log(`[session] Failed to save sessions: ${error}`);
  }
}

// 每个 conversationId + workDir 维护一个 Claude Code session_id，实现多轮对话
// 不同工作目录的 session 不会互相干扰
const sessionMap = loadSessionMap();

// 生成 session key（包含工作目录和角色，不同角色的 session 互不干扰）
function getSessionKey(
  conversationId: string,
  workDir: string,
  profile?: string,
): string {
  return profile
    ? `${conversationId}|${workDir}|${profile}`
    : `${conversationId}|${workDir}`;
}

/**
 * 找当前 workDir 下最近活跃的会话，用于连接成功后发上线通知
 */
function findLastActiveSession(workDir: string): SessionEntry | null {
  let latestEntry: SessionEntry | null = null;
  for (const [key, entry] of sessionMap) {
    // key 格式: conversationId|workDir 或 conversationId|workDir|profile
    // 用 split('|') 取第二段来匹配 workDir，避免 profile 存在时匹配失败
    const parts = key.split("|");
    if (parts[1] !== workDir) continue;
    if (!latestEntry || entry.lastActiveAt > latestEntry.lastActiveAt) {
      latestEntry = entry;
    }
  }
  return latestEntry;
}

interface ClaudeResponse {
  type: string;
  subtype: string;
  is_error: boolean;
  result: string;
  session_id: string;
  duration_ms: number;
  stop_reason: string;
}

/**
 * 从 assistant 快照事件中提取当前完整文本
 */
function extractAssistantSnapshotText(event: StreamChunk): string {
  if (event.type !== "assistant") {
    return "";
  }

  const messageContent = event.message?.content;
  if (typeof messageContent === "string") {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((block) => {
        if (!block || typeof block !== "object") {
          return "";
        }
        if (typeof block.text === "string") {
          return block.text;
        }
        return "";
      })
      .join("");
  }

  if (typeof event.text === "string") {
    return event.text;
  }

  return "";
}

/**
 * 归一化流式事件：解包 stream_event 包装层
 * Claude CLI 的 stream-json 输出可能将真实事件包裹在 stream_event.event 中
 * 此函数统一返回实际需要处理的事件
 */
function normalizeStreamEvent(raw: StreamChunk): StreamChunk {
  if (raw.type === "stream_event" && raw.event) {
    return raw.event;
  }
  return raw;
}

/**
 * 从流式事件中提取用户可见的文本增量
 * 仅接受 content_block_delta 且 delta.type === "text_delta" 的增量
 */
function extractStreamTextDelta(event: StreamChunk): string {
  if (event.type !== "content_block_delta") {
    return "";
  }

  // delta 是字符串时直接作为文本增量（兼容旧行为）
  if (typeof event.delta === "string") {
    return event.delta;
  }

  // delta 是对象时，仅接受 text_delta 类型
  if (
    event.delta &&
    typeof event.delta === "object" &&
    event.delta.type === "text_delta" &&
    typeof event.delta.text === "string"
  ) {
    return event.delta.text;
  }

  // thinking_delta、input_json_delta 等非用户可见增量一律忽略
  return "";
}

/**
 * 判断事件是否为非用户可见的系统/元数据事件，应排除在正文累积之外
 */
function isNonTextEvent(event: StreamChunk): boolean {
  return (
    event.type === "system" ||
    event.type === "content_block_start" ||
    event.type === "content_block_stop" ||
    event.type === "message_start" ||
    event.type === "message_delta" ||
    event.type === "message_stop" ||
    event.type === "tool_use" ||
    event.type === "tool_result"
  );
}

/**
 * 加载配置文件
 */
function loadConfigFromFile(filePath: string, profile?: string): any | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    const raw = JSON.parse(content);

    // 指定了 profile 但该 profile 不存在时，直接返回 null
    if (profile && !raw.profiles?.[profile]) {
      return null;
    }

    // 合并顶层配置和指定 profile 的配置（profile 字段优先）
    const profileOverride = profile ? (raw.profiles?.[profile] ?? {}) : {};
    const merged = {
      ...raw,
      ...profileOverride,
      profiles: raw.profiles,
    };

    return merged;
  } catch {
    return null;
  }
}

/**
 * 按优先级加载配置
 */
function loadConfig(workDir: string, profile?: string): any | null {
  const GLOBAL_CONFIG_DIR = join(homedir(), ".claudetalk");
  const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, "claudetalk.json");
  const LOCAL_CONFIG_FILENAME = ".claudetalk.json";

  // 优先级 1：工作目录本地配置
  const localConfigFile = join(workDir, LOCAL_CONFIG_FILENAME);
  const localConfig = loadConfigFromFile(localConfigFile, profile);
  if (localConfig) {
    return localConfig;
  }

  // 优先级 2：全局配置
  const globalConfig = loadConfigFromFile(GLOBAL_CONFIG_FILE, profile);
  if (globalConfig) {
    return globalConfig;
  }

  return null;
}
/**
 * 根据 profile 配置构建 --agents 参数的 JSON 字符串
 * Claude Code 通过 --agents 参数接收 SubAgent 定义，格式为 JSON 对象
 * 参考：https://code.claude.com/docs/en/sub-agents#cli-defined-subagents
 */
function buildAgentJson(profileName: string, config: any): string | null {
  if (!config) return null;

  const agentDef: Record<string, unknown> = {
    description: config.systemPrompt
      ? `${profileName} 角色助手。${config.systemPrompt}`
      : `${profileName} 角色助手，负责相关工作。`,
    prompt: config.systemPrompt || `你是 ${profileName} 角色，负责相关工作。`,
  };

  if (config.subagentModel) {
    agentDef.model = config.subagentModel;
  }

  if (config.subagentPermissions?.allow || config.subagentPermissions?.deny) {
    agentDef.tools = config.subagentPermissions.allow ?? [];
    if (config.subagentPermissions.deny?.length) {
      agentDef.disallowedTools = config.subagentPermissions.deny;
    }
  }

  try {
    return JSON.stringify({ [profileName]: agentDef });
  } catch {
    return null;
  }
}

/**
 * 调用 claude -p CLI 处理消息
 * 如果有已存在的 session_id，则用 --resume 继续会话
 * 当 CallClaudeOptions.onChunk 存在时，使用 stream-json 流式模式
 */
async function callClaude(
  message: string,
  conversationId: string,
  workDir: string,
  isGroup: boolean = false,
  userId: string = "",
  profile?: string,
  systemPrompt?: string,
  claudeOptions?: CallClaudeOptions,
): Promise<string> {
  const sessionKey = getSessionKey(conversationId, workDir, profile);
  const existingEntry = sessionMap.get(sessionKey);
  const existingSessionId = existingEntry?.sessionId;

  // 每次都重新读取最新配置，确保配置变化实时生效
  const currentConfig = loadConfig(workDir, profile);
  const currentSubagentEnabled = currentConfig?.subagentEnabled ?? false;
  const currentSystemPrompt = currentConfig?.systemPrompt;

  const isStreaming = !!claudeOptions?.onChunk;
  const outputFormat = isStreaming ? "stream-json" : "json";

  const args = [
    "-p",
    "--output-format",
    outputFormat,
    "--dangerously-skip-permissions",
  ];

  if (isStreaming) {
    args.push("--verbose");
    args.push("--include-partial-messages");
  }

  if (existingSessionId && existingEntry) {
    // 检查配置是否变化（subagentEnabled 变化时需要重建 session）
    if (existingEntry.subagentEnabled !== currentSubagentEnabled) {
      log(
        `[session] Config changed for profile=${profile} (subagentEnabled: ${existingEntry.subagentEnabled} -> ${currentSubagentEnabled}), clearing old session`,
      );
      sessionMap.delete(sessionKey);
      saveSessionMap();
      // 递归调用，以新配置重建 session
      return callClaude(
        message,
        conversationId,
        workDir,
        isGroup,
        userId,
        profile,
        systemPrompt,
      );
    }

    // 配置未变化，恢复已有 session
    // 恢复 session 时也需要传入 --agents，否则 Claude Code 找不到对应的 SubAgent 定义
    if (profile && currentSubagentEnabled) {
      const agentJson = buildAgentJson(profile, currentConfig);
      if (agentJson) {
        args.push("--agents", agentJson);
      }
    }
    args.push("--resume", existingSessionId);
  } else {
    // 新建 session：
    // - 有 profile 且启用 SubAgent：通过 --agents 传入 SubAgent 定义，Claude Code 自动委托给对应 SubAgent
    // - 有 profile 但未启用 SubAgent：通过 --append-system-prompt 传入角色信息
    // - 无 profile（默认角色）：使用自动委托，不传任何额外参数
    if (profile && currentSubagentEnabled) {
      const agentJson = buildAgentJson(profile, currentConfig);
      if (agentJson) {
        args.push("--agents", agentJson);
      }
    } else if (profile && !currentSubagentEnabled && currentSystemPrompt) {
      args.push("--append-system-prompt", currentSystemPrompt);
    }
  }

  if (existingSessionId) {
    log(`[claude] Resuming session: claude ${args.join(" ")}, cwd=${workDir}`);
  } else {
    const fullCommand = `claude ${args.join(" ")}`;
    log(`[claude] New session: ${fullCommand}, cwd=${workDir}`);
  }

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: workDir,
      env: { ...process.env },
      shell: process.platform === "win32",
    });

    let stdout = "";
    let stderr = "";
    let accumulatedText = ""; // 流式模式下累积的文本
    let lineBuffer = ""; // 流式模式下未完成的行

    child.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;

      // 流式模式：逐行解析 NDJSON
      if (isStreaming && claudeOptions?.onChunk) {
        lineBuffer += chunk;
        const lines = lineBuffer.split("\n");
        // 最后一行可能不完整，保留在 buffer 中
        lineBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("{")) continue;
          try {
            const raw = JSON.parse(trimmed) as StreamChunk;

            // 0. 解包 stream_event 包装层
            const event = normalizeStreamEvent(raw);
            if (raw.type === "stream_event") {
              log(
                `[claude] [stream] Unwrapped stream_event -> inner type=${event.type}`,
              );
            }

            // 1. 跳过系统/元数据事件
            if (isNonTextEvent(event)) {
              log(
                `[claude] [stream] Skipped non-text event: type=${event.type}${event.subtype ? `, subtype=${event.subtype}` : ""}`,
              );
              continue;
            }

            // 2. 处理 content_block_delta 文本增量事件（仅 text_delta）
            if (event.type === "content_block_delta") {
              const deltaType =
                event.delta && typeof event.delta === "object"
                  ? (event.delta as any).type || "unknown"
                  : typeof event.delta === "string"
                    ? "string"
                    : "none";
              log(
                `[claude] [stream] content_block_delta: delta.type=${deltaType}`,
              );
            }
            const textDelta = extractStreamTextDelta(event);
            if (textDelta) {
              log(
                `[claude] [stream] text_delta extracted: len=${textDelta.length}, accumulated=${accumulatedText.length + textDelta.length}`,
              );
              accumulatedText += textDelta;
              claudeOptions.onChunk(accumulatedText, false);
              continue;
            }

            // 3. 处理 assistant 快照事件（通常来自 --include-partial-messages）
            const snapshotText = extractAssistantSnapshotText(event);
            if (snapshotText) {
              log(
                `[claude] [stream] onChunk(false) via assistant snapshot: len=${snapshotText.length}`,
              );
              accumulatedText = snapshotText;
              claudeOptions.onChunk(accumulatedText, false);
              continue;
            }

            // 4. 处理结果事件
            if (event.type === "result") {
              if (event.session_id) {
                sessionMap.set(sessionKey, {
                  sessionId: event.session_id,
                  lastActiveAt: Date.now(),
                  isGroup,
                  conversationId,
                  userId,
                  subagentEnabled: currentSubagentEnabled,
                });
                saveSessionMap();
                log(
                  `[claude] Saved session_id=${event.session_id} for sessionKey=${sessionKey}`,
                );
              }
              // 优先使用 result 文本，其次使用累积正文
              const finalText = event.result || accumulatedText;
              claudeOptions.onChunk(finalText, true);
              continue;
            }

            // 5. 未知事件类型：仅日志，不参与正文累积
            log(
              `[claude] [stream] Unhandled event type: ${event.type}${raw.type === "stream_event" ? ` (from stream_event)` : ""}`,
            );
          } catch {
            // 忽略无法解析的行
          }
        }
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // 将消息写入 stdin
    const actualMessage =
      profile && currentSubagentEnabled
        ? `Use the ${profile} agent to handle this: ${message}`
        : message;
    child.stdin.write(actualMessage);
    child.stdin.end();

    child.on("close", (code: number | null) => {
      log(`[claude] Process exited with code ${code}`);
      if (stdout) {
        log(`[claude] stdout (first 500 chars): ${stdout.substring(0, 500)}`);
      }
      if (stderr) {
        log(`[claude] stderr (full): ${stderr}`);
      }

      // 流式模式下异常退出：用已累积内容兜底
      if (
        code !== 0 &&
        isStreaming &&
        claudeOptions?.onChunk &&
        accumulatedText
      ) {
        log(
          `[claude] Streaming process exited with error, finalizing with partial content`,
        );
        claudeOptions.onChunk(accumulatedText, true);
        resolve(accumulatedText);
        return;
      }

      if (code !== 0) {
        log(`[claude] Non-zero exit code detected, classifying error...`);

        // 错误分类 1：session 无效，自动降级为新建会话
        const isSessionInvalid =
          stderr.includes("No conversation found") ||
          stderr.includes("session ID") ||
          stderr.includes("Invalid session") ||
          stderr.includes("Session not found") ||
          stderr.includes("--resume");
        if (isSessionInvalid) {
          log(
            `[claude] [ERROR_TYPE: SESSION_INVALID] Session ${existingSessionId} is invalid, clearing and retrying without resume`,
          );
          sessionMap.delete(sessionKey);
          saveSessionMap();
          callClaude(message, conversationId, workDir, isGroup, userId)
            .then(resolve)
            .catch(reject);
          return;
        }

        // 错误分类 2：权限错误
        const isPermissionError =
          stderr.includes("Permission denied") ||
          stderr.includes("EACCES") ||
          stderr.includes("not permitted");
        if (isPermissionError) {
          log(`[claude] [ERROR_TYPE: PERMISSION_ERROR] Permission denied`);
          reject(new Error(`Claude CLI 权限错误: ${stderr}`));
          return;
        }

        // 错误分类 3：命令不存在
        const isCommandNotFound =
          stderr.includes("command not found") ||
          stderr.includes("not recognized") ||
          stderr.includes("ENOENT");
        if (isCommandNotFound) {
          log(`[claude] [ERROR_TYPE: COMMAND_NOT_FOUND] Claude CLI not found`);
          reject(new Error(`Claude CLI 未找到，请确认已安装: ${stderr}`));
          return;
        }

        // 错误分类 4：其他未知错误
        log(
          `[claude] [ERROR_TYPE: UNKNOWN] Unclassified error, exit code=${code}`,
        );
        log(`[claude] stdout: ${stdout}`);
        reject(
          new Error(
            `claude exited with code ${code}. stderr: ${stderr || "(empty)"}, stdout: ${stdout.substring(0, 200) || "(empty)"}`,
          ),
        );
        return;
      }

      // 非流式模式：解析完整 JSON 输出
      if (!isStreaming) {
        try {
          const lines = stdout.trim().split("\n");
          const lastJsonLine = lines
            .filter((line) => line.startsWith("{"))
            .pop();
          if (!lastJsonLine) {
            resolve(stdout.trim());
            return;
          }

          const response = JSON.parse(lastJsonLine) as ClaudeResponse;
          log(
            `[claude] Response: session_id=${response.session_id}, duration=${response.duration_ms}ms, stop_reason=${response.stop_reason}`,
          );

          if (response.session_id) {
            sessionMap.set(sessionKey, {
              sessionId: response.session_id,
              lastActiveAt: Date.now(),
              isGroup,
              conversationId,
              userId,
              subagentEnabled: currentSubagentEnabled,
            });
            saveSessionMap();
            log(
              `[claude] Saved session_id=${response.session_id} for sessionKey=${sessionKey}`,
            );
          }

          if (response.is_error) {
            reject(new Error(`Claude error: ${response.result}`));
            return;
          }

          resolve(response.result || stdout.trim());
        } catch (parseError) {
          log(
            `[claude] Failed to parse JSON, returning raw output: ${parseError}`,
          );
          resolve(stdout.trim());
        }
      } else {
        // 流式模式：result 事件已在 stdout handler 中处理
        // 如果没有收到 result 事件，仅使用累积文本，不回退到原始 stdout
        resolve(accumulatedText);
      }
    });

    child.on("error", (error: Error) => {
      log(`[claude] Spawn error: ${error.message}`);
      reject(error);
    });
  });
}

// ========== 启动函数 ==========
export async function startBot(options: StartBotOptions): Promise<void> {
  const config: DingTalkChannelConfig = {
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    robotCode: process.env.DINGTALK_ROBOT_CODE || options.clientId,
    corpId: process.env.DINGTALK_CORP_ID || "",
    agentId: process.env.DINGTALK_AGENT_ID || "",
    dmPolicy:
      (process.env.DINGTALK_DM_POLICY as "open" | "pairing" | "allowlist") ||
      "open",
    groupPolicy:
      (process.env.DINGTALK_GROUP_POLICY as
        | "open"
        | "allowlist"
        | "disabled") || "open",
    allowFrom:
      process.env.DINGTALK_ALLOW_FROM?.split(",").filter(Boolean) || [],
    messageType:
      options.messageType ||
      (process.env.DINGTALK_MESSAGE_TYPE as "markdown" | "card") ||
      "markdown",
    cardTemplateId:
      options.cardTemplateId || process.env.DINGTALK_CARD_TEMPLATE_ID || "",
    cardTemplateKey:
      options.cardTemplateKey ||
      process.env.DINGTALK_CARD_TEMPLATE_KEY ||
      "content",
  };

  // 配置降级：card 模式但缺少 templateId 时降级为 markdown
  if (config.messageType === "card" && !config.cardTemplateId) {
    log(
      `[config] WARNING: messageType is 'card' but cardTemplateId is empty, falling back to markdown`,
    );
    config.messageType = "markdown";
  }

  const dingtalkClient = new DingTalkClient(config);

  const sendMarkdownReply = async (
    callback: DingTalkInboundCallback,
    title: string,
    text: string,
  ): Promise<void> => {
    if (callback.sessionWebhook) {
      const resp = await fetch(callback.sessionWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msgtype: "markdown",
          markdown: { title, text },
        }),
      });

      const result = await resp.json();
      log(`[reply] markdown response: ${JSON.stringify(result)}`);
      return;
    }

    await dingtalkClient.sendMarkdownMessage(
      callback.conversationId,
      text,
      callback.conversationType === "2",
    );
  };

  dingtalkClient.onMessage(async (callback: DingTalkInboundCallback) => {
    const messageText =
      callback.text?.content?.trim() || callback.content || "";
    const isGroup = callback.conversationType === "2";
    const chatId = callback.conversationId;

    log(
      `[onMessage] From ${callback.senderId}, chatId=${chatId}, isGroup=${isGroup}, text="${messageText}"`,
    );

    if (!messageText) {
      log("[onMessage] Empty message, ignoring");
      return;
    }

    // ========== 内置指令处理 ==========
    const command = messageText.toLowerCase();
    if (
      command === "新会话" ||
      command === "清空记忆" ||
      command === "/new" ||
      command === "/reset"
    ) {
      const sessionKey = getSessionKey(
        chatId,
        options.workDir,
        options.profile,
      );
      const hadSession = sessionMap.has(sessionKey);
      if (hadSession) {
        sessionMap.delete(sessionKey);
        saveSessionMap();
        log(`[command] Cleared session for sessionKey=${sessionKey}`);
      }
      const replyContent = hadSession
        ? "🔄 已清空当前会话记忆，下次发消息将开启全新对话。"
        : "💡 当前没有活跃的会话记忆，发消息即可开始新对话。";
      await sendMarkdownReply(callback, "会话", replyContent);
      return;
    }

    if (command === "/help" || command === "帮助") {
      const helpText = [
        "🤖 **ClaudeTalk 指令帮助**",
        "",
        "- **新会话** 或 **/new** — 清空当前会话记忆，开启全新对话",
        "- **清空记忆** 或 **/reset** — 同上",
        "- **帮助** 或 **/help** — 显示本帮助信息",
        "- **/card-experiment** — 🧪 诊断：固定文本卡片创建与更新实验",
        "",
        "发送其他任意消息将由 Claude Code 处理。",
      ].join("\n");
      await sendMarkdownReply(callback, "帮助", helpText);
      return;
    }

    // ========== 🧪 固定文本卡片更新实验（诊断用途，不调用 Claude） ==========
    if (command === "/card-experiment" || command === "卡片实验") {
      log(
        `[experiment] Fixed card update experiment triggered by senderId=${callback.senderId}`,
      );

      // 非卡片模式时提示用户
      if (config.messageType !== "card" || !config.cardTemplateId) {
        await sendMarkdownReply(
          callback,
          "实验",
          "⚠️ 当前未启用卡片模式，无法运行卡片实验。请在配置中设置 messageType 为 card 并提供 cardTemplateId。",
        );
        return;
      }

      try {
        const STAGE_ONE_TEXT = [
          "# 实验阶段一",
          "",
          "卡片创建成功",
          "",
          "- 固定文本",
          "- Markdown 测试",
          "",
          "**阶段一可见**",
        ].join("\n");
        const STAGE_TWO_TEXT = [
          "# 实验阶段二",
          "",
          "卡片更新成功",
          "",
          "1. 固定文本",
          "2. Markdown 测试",
          "",
          "**阶段二可见**",
        ].join("\n");
        const DELAY_MS = 3000;

        // 阶段一：创建卡片
        log(
          `[experiment] Stage 1: creating card with text="${STAGE_ONE_TEXT}"`,
        );
        const card = await dingtalkClient.createAICard(
          {
            conversationType: callback.conversationType,
            conversationId: chatId,
            senderId: callback.senderId,
            senderStaffId: callback.senderStaffId,
          },
          STAGE_ONE_TEXT,
          "2",
        );
        log(
          `[experiment] Stage 1 complete: outTrackId=${card.outTrackId}, cardInstanceId=${card.cardInstanceId || "(none)"}, carrierId=${card.carrierId || "(none)"}`,
        );

        // 等待固定延迟后执行阶段二
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));

        // 阶段二：更新同一张卡片
        log(
          `[experiment] Stage 2: updating card outTrackId=${card.outTrackId} with text="${STAGE_TWO_TEXT}"`,
        );
        await dingtalkClient.streamAICard(card, STAGE_TWO_TEXT, true);
        log(
          `[experiment] Stage 2 complete: outTrackId=${card.outTrackId}, text="${STAGE_TWO_TEXT}"`,
        );
      } catch (experimentError) {
        const errMsg =
          experimentError instanceof Error
            ? experimentError.message
            : String(experimentError);
        log(`[experiment] Error: ${errMsg}`);
        await sendMarkdownReply(
          callback,
          "实验错误",
          `🧪 卡片实验失败: ${errMsg}`,
        ).catch(() => {});
      }
      return;
    }

    try {
      // 判断卡片模式是否可用：messageType 为 card 且有 templateId
      const isCardMode =
        config.messageType === "card" && !!config.cardTemplateId;

      if (isCardMode) {
        // ========== 卡片流式模式 ==========
        let card: AICardInstance;
        try {
          // 创建 AI 卡片：传入完整的投放上下文（会话类型 + 会话 ID + 发送者 staffId）
          card = await dingtalkClient.createAICard(
            {
              conversationType: callback.conversationType,
              conversationId: chatId,
              senderId: callback.senderId,
              senderStaffId: callback.senderStaffId,
            },
            "思考中...",
            "1",
          );
        } catch (cardError) {
          const errorMessage =
            cardError instanceof Error ? cardError.message : String(cardError);
          log(
            `[card] create failed, falling back to markdown: ${errorMessage}`,
          );

          const staffId = callback.senderStaffId || "";
          const replyText = await callClaude(
            messageText,
            chatId,
            options.workDir,
            isGroup,
            staffId,
            options.profile,
            options.systemPrompt,
          );
          await sendMarkdownReply(callback, "Claude Code", replyText);
          return;
        }

        log(
          `[card] Created card: outTrackId=${card.outTrackId}, cardInstanceId=${card.cardInstanceId || "(none)"}, carrierId=${card.carrierId || "(none)"}`,
        );

        // 节流器：200ms 间隔更新卡片
        let lastUpdateTime = 0;
        let updateTimer: ReturnType<typeof setTimeout> | null = null;
        let pendingText = "";
        let latestRenderedText = "";

        const throttledUpdate = (text: string) => {
          pendingText = text;
          latestRenderedText = text;
          const now = Date.now();
          const elapsed = now - lastUpdateTime;
          if (elapsed >= 200) {
            lastUpdateTime = now;
            log(
              `[card] throttled update: sending immediately, len=${text.length}`,
            );
            dingtalkClient
              .streamAICard(card, pendingText, false)
              .catch((e: Error) =>
                log(`[card] stream update error: ${e.message}`),
              );
          } else if (!updateTimer) {
            log(
              `[card] throttled update: deferring ${200 - elapsed}ms, len=${text.length}`,
            );
            updateTimer = setTimeout(() => {
              updateTimer = null;
              lastUpdateTime = Date.now();
              log(
                `[card] throttled update: sending deferred, len=${pendingText.length}`,
              );
              dingtalkClient
                .streamAICard(card, pendingText, false)
                .catch((e: Error) =>
                  log(`[card] stream update error: ${e.message}`),
                );
            }, 200 - elapsed);
          }
        };

        try {
          // 流式调用 Claude
          const staffId = callback.senderStaffId || "";
          const replyText = await callClaude(
            messageText,
            chatId,
            options.workDir,
            isGroup,
            staffId,
            options.profile,
            options.systemPrompt,
            {
              onChunk: (text, isFinal) => {
                latestRenderedText = text;
                if (isFinal) {
                  // 清除待执行的节流更新
                  if (updateTimer) {
                    clearTimeout(updateTimer);
                    updateTimer = null;
                  }
                  // 最终更新：结束卡片
                  dingtalkClient
                    .streamAICard(card, text, true)
                    .catch((e: Error) =>
                      log(`[card] finalize error: ${e.message}`),
                    );
                } else {
                  throttledUpdate(text);
                }
              },
            },
          );
          log(
            `[onMessage] Card mode reply (first 200 chars): "${replyText.substring(0, 200)}"`,
          );
        } catch (streamError) {
          if (updateTimer) {
            clearTimeout(updateTimer);
            updateTimer = null;
          }

          const errorMessage =
            streamError instanceof Error
              ? streamError.message
              : String(streamError);
          log(`[card] streaming failed after card creation: ${errorMessage}`);

          const errorText = latestRenderedText
            ? `${latestRenderedText}\n\n---\n处理失败: ${errorMessage}`
            : `处理失败: ${errorMessage}`;

          await dingtalkClient
            .streamAICard(card, errorText, true, "5")
            .catch((e: Error) =>
              log(`[card] failed to finalize error state: ${e.message}`),
            );
          return;
        }
      } else {
        // ========== Markdown 模式（默认） ==========
        // 调用 Claude Code CLI 处理消息，传入工作目录和会话类型
        const staffId = callback.senderStaffId || "";
        const replyText = await callClaude(
          messageText,
          chatId,
          options.workDir,
          isGroup,
          staffId,
          options.profile,
          options.systemPrompt,
        );
        log(
          `[onMessage] Claude reply (first 200 chars): "${replyText.substring(0, 200)}"`,
        );

        // 优先用 sessionWebhook 回复（最简单可靠）
        await sendMarkdownReply(callback, "Claude Code", replyText);
      }
    } catch (error) {
      log(`[ERROR] ${error}`);

      // 发送错误提示给用户
      await sendMarkdownReply(
        callback,
        "错误",
        `处理消息时出错: ${error instanceof Error ? error.message : String(error)}`,
      ).catch(() => {});
    }
  });

  log("=== DingTalk Bot (CLI Mode) Starting ===");
  log(`Config: clientId=${config.clientId.substring(0, 8)}...`);
  log(`WorkDir: ${options.workDir}`);
  log(`Sessions: ${SESSION_FILE} (${sessionMap.size} loaded)`);

  await dingtalkClient.start();
  log("=== DingTalk Bot Running ===");

  // 连接成功后，找当前 workDir 最近活跃的会话，发送上线通知
  const lastActiveSession = findLastActiveSession(options.workDir);
  if (lastActiveSession) {
    const notifyText = [
      "✅ **ClaudeTalk 已上线**",
      "",
      `📁 工作目录: \`${options.workDir}\``,
    ].join("\n");

    if (!lastActiveSession.isGroup && lastActiveSession.userId) {
      // 仅对私聊发上线通知，使用 staffId 和纯文本格式
      const notifyPlainText = `✅ ClaudeTalk 已上线\n📁 工作目录: ${options.workDir}`;
      log(
        `[notify] Sending online notification to staffId=${lastActiveSession.userId}`,
      );
      dingtalkClient
        .sendPrivateMessage(
          lastActiveSession.userId,
          notifyPlainText,
          "sampleText",
        )
        .then((result) =>
          log(
            `[notify] Online notification sent, response: ${JSON.stringify(result)}`,
          ),
        )
        .catch((error: Error) =>
          log(`[notify] Failed to send online notification: ${error.message}`),
        );
    } else {
      log("[notify] No private session found, skipping online notification");
    }
  } else {
    log("[notify] No previous session found, skipping online notification");
  }
}
