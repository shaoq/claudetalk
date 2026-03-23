#!/usr/bin/env node
/**
 * ClaudeTalk CLI - 钉钉机器人接入 Claude Code
 * 通过 claudetalk 命令启动，自动管理配置文件
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { createInterface } from 'readline'

// ========== 配置文件管理 ==========
const GLOBAL_CONFIG_DIR = join(homedir(), '.claudetalk')
const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, 'claudetalk.json')
// 兼容旧路径
const CONFIG_DIR = GLOBAL_CONFIG_DIR
const CONFIG_FILE = GLOBAL_CONFIG_FILE

// 工作目录下的本地配置文件名
const LOCAL_CONFIG_FILENAME = '.claudetalk.json'

interface ClaudeTalkConfig {
  DINGTALK_CLIENT_ID: string
  DINGTALK_CLIENT_SECRET: string
}

/**
 * 从指定路径加载配置文件，返回有效配置或 null
 */
function loadConfigFromFile(filePath: string): ClaudeTalkConfig | null {
  if (!existsSync(filePath)) {
    return null
  }
  try {
    const content = readFileSync(filePath, 'utf-8')
    const config = JSON.parse(content) as ClaudeTalkConfig
    if (config.DINGTALK_CLIENT_ID && config.DINGTALK_CLIENT_SECRET) {
      return config
    }
    return null
  } catch {
    return null
  }
}

/**
 * 按优先级加载配置：
 * 1. 工作目录下的 .claudetalk.json（最高优先级，支持多目录不同机器人）
 * 2. 全局 ~/.claudetalk/claudetalk.json
 * 返回配置内容和来源路径，方便启动时展示
 */
function loadConfig(workDir: string): { config: ClaudeTalkConfig; source: string } | null {
  // 优先级 1：工作目录本地配置
  const localConfigFile = join(workDir, LOCAL_CONFIG_FILENAME)
  const localConfig = loadConfigFromFile(localConfigFile)
  if (localConfig) {
    return { config: localConfig, source: localConfigFile }
  }

  // 优先级 2：全局配置
  const globalConfig = loadConfigFromFile(GLOBAL_CONFIG_FILE)
  if (globalConfig) {
    return { config: globalConfig, source: GLOBAL_CONFIG_FILE }
  }

  return null
}

/**
 * 保存配置到指定路径
 */
function saveConfigToFile(config: ClaudeTalkConfig, filePath: string, dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true })
  }
  writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

function saveConfig(config: ClaudeTalkConfig): void {
  saveConfigToFile(config, GLOBAL_CONFIG_FILE, GLOBAL_CONFIG_DIR)
}

function promptInput(question: string): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    readline.question(question, (answer) => {
      readline.close()
      resolve(answer.trim())
    })
  })
}

/**
 * 交互式配置向导
 * @param saveToLocal 是否保存到工作目录（true）还是全局目录（false）
 * @param workDir 当前工作目录（saveToLocal 为 true 时使用）
 */
async function interactiveSetup(saveToLocal: boolean, workDir: string): Promise<ClaudeTalkConfig> {
  const targetFile = saveToLocal
    ? join(workDir, LOCAL_CONFIG_FILENAME)
    : GLOBAL_CONFIG_FILE
  const targetDir = saveToLocal ? workDir : GLOBAL_CONFIG_DIR

  console.log('')
  console.log('🤖 ClaudeTalk 配置向导')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  if (saveToLocal) {
    console.log(`📁 配置将保存到当前工作目录: ${targetFile}`)
    console.log('   （此配置仅对当前目录生效，优先级高于全局配置）')
  } else {
    console.log(`🌐 配置将保存到全局目录: ${targetFile}`)
    console.log('   （此配置对所有未设置本地配置的目录生效）')
  }
  console.log('')
  console.log('请提供钉钉机器人的 AppKey 和 AppSecret。')
  console.log('你可以在钉钉开放平台 (https://open-dev.dingtalk.com) 创建应用并获取。')
  console.log('')

  const clientId = await promptInput('请输入 DINGTALK_CLIENT_ID (AppKey): ')
  if (!clientId) {
    console.error('❌ DINGTALK_CLIENT_ID 不能为空')
    process.exit(1)
  }

  const clientSecret = await promptInput('请输入 DINGTALK_CLIENT_SECRET (AppSecret): ')
  if (!clientSecret) {
    console.error('❌ DINGTALK_CLIENT_SECRET 不能为空')
    process.exit(1)
  }

  const config: ClaudeTalkConfig = {
    DINGTALK_CLIENT_ID: clientId,
    DINGTALK_CLIENT_SECRET: clientSecret,
  }

  saveConfigToFile(config, targetFile, targetDir)
  console.log('')
  console.log(`✅ 配置已保存到 ${targetFile}`)
  console.log('')

  return config
}

// ========== 主流程 ==========
async function main(): Promise<void> {
  const workDir = process.cwd()
  const isSetupLocal = process.argv.includes('--local')

  // 处理 --help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
ClaudeTalk - 钉钉机器人接入 Claude Code

用法:
  claudetalk                    启动钉钉机器人（以当前目录为工作目录）
  claudetalk --setup            配置全局钉钉凭据（~/.claudetalk/claudetalk.json）
  claudetalk --setup --local    配置当前目录的钉钉凭据（./.claudetalk.json）
  claudetalk --help             显示帮助信息

配置文件（优先级从高到低）:
  .claudetalk.json              当前工作目录配置（优先，支持多目录不同机器人）
  ~/.claudetalk/claudetalk.json 全局配置（兜底）

多目录使用示例:
  # 项目 A 使用独立机器人
  cd /path/to/project-a && claudetalk --setup --local && claudetalk

  # 项目 B 使用另一个机器人
  cd /path/to/project-b && claudetalk --setup --local && claudetalk

  # 未配置本地配置的目录自动使用全局配置
  cd /path/to/other-project && claudetalk

环境变量（会被配置文件覆盖，优先级最低）:
  DINGTALK_CLIENT_ID      钉钉应用 AppKey
  DINGTALK_CLIENT_SECRET  钉钉应用 AppSecret
`)
    process.exit(0)
  }

  // 处理 --setup：配置钉钉凭据
  if (process.argv.includes('--setup')) {
    await interactiveSetup(isSetupLocal, workDir)
    console.log('配置完成！运行 claudetalk 启动机器人。')
    process.exit(0)
  }

  // 1. 检查工作目录是否有本地配置
  let clientId = ''
  let clientSecret = ''
  let configSource = '环境变量'

  const localConfigFile = join(workDir, LOCAL_CONFIG_FILENAME)
  const localConfig = loadConfigFromFile(localConfigFile)
  const globalConfig = loadConfigFromFile(GLOBAL_CONFIG_FILE)

  if (localConfig) {
    // 工作目录有本地配置，直接使用
    clientId = localConfig.DINGTALK_CLIENT_ID
    clientSecret = localConfig.DINGTALK_CLIENT_SECRET
    configSource = localConfigFile
  } else if (globalConfig) {
    // 工作目录没有本地配置，静默使用全局配置
    // 如需为当前目录配置专属机器人，运行: claudetalk --setup --local
    clientId = globalConfig.DINGTALK_CLIENT_ID
    clientSecret = globalConfig.DINGTALK_CLIENT_SECRET
    configSource = GLOBAL_CONFIG_FILE
  }

  // 2. 配置文件都没有时，从环境变量读取
  if (!clientId) clientId = process.env.DINGTALK_CLIENT_ID || ''
  if (!clientSecret) clientSecret = process.env.DINGTALK_CLIENT_SECRET || ''

  // 3. 如果都没有，引导用户设置
  if (!clientId || !clientSecret) {
    console.log('⚠️  未找到任何钉钉配置。')
    console.log('')
    console.log('你可以通过以下方式配置：')
    console.log('  1. 运行交互式配置（现在）')
    console.log('  2. 全局配置: claudetalk --setup')
    console.log('  3. 当前目录配置: claudetalk --setup --local')
    console.log('  4. 设置环境变量: export DINGTALK_CLIENT_ID=xxx && export DINGTALK_CLIENT_SECRET=xxx')
    console.log('')

    const answer = await promptInput('是否现在进行交互式配置？(Y/n): ')
    if (answer.toLowerCase() === 'n') {
      process.exit(0)
    }

    const config = await interactiveSetup(false, workDir)
    clientId = config.DINGTALK_CLIENT_ID
    clientSecret = config.DINGTALK_CLIENT_SECRET
    configSource = GLOBAL_CONFIG_FILE
  }

  // 设置环境变量，供后续模块使用
  process.env.DINGTALK_CLIENT_ID = clientId
  process.env.DINGTALK_CLIENT_SECRET = clientSecret

  // 显示启动信息
  console.log('')
  console.log('🚀 ClaudeTalk 启动中...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📁 工作目录: ${workDir}`)
  console.log(`🔑 AppKey: ${clientId.substring(0, 8)}...`)
  console.log(`📄 配置来源: ${configSource}`)
  console.log(`💡 工作目录专属机器人: claudetalk --setup --local`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  // 动态导入并启动 bot
  const { startBot } = await import('./index.js')
  await startBot({
    clientId,
    clientSecret,
    workDir,
  })
}

main().catch((error) => {
  console.error('❌ 启动失败:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
