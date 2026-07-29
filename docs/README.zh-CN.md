# Wardrail

> 为 vibecoding 应用和 AI Agent 项目准备的提交前安全检查。

Wardrail 在代码运行或进入 GitHub 之前，发现 API Key 泄露、前端密钥暴露、
危险 Agent 指令和高风险 MCP 命令。

它特别适合使用 Cursor、Claude Code、Codex 和 MCP 工具的 vibecoding
新手：所有扫描都在本地完成，每个问题都有通俗解释，源代码不会上传。

[English README](../README.md) ·
[新手密钥安全指南](vibe-coding-safety.md) ·
[开发路线图](roadmap.md)

## 为什么 vibecoding 新手需要它？

AI 可以帮助没有完整工程经验的开发者快速完成产品，但也很容易生成下面这样的代码：

```env
OPENAI_API_KEY=sk-...
VITE_PAYMENT_SECRET=...
DATABASE_URL=postgres://user:***@host/app
```

常见误区包括：

- 认为把密钥放进 `.env` 就一定安全；
- 不知道 `VITE_*`、`NEXT_PUBLIC_*` 会进入浏览器代码；
- 调试时把 Token 打进日志；
- 把包含密钥的文件提交到 GitHub；
- 只删除代码，却没有撤销已经泄露的密钥；
- 直接运行 AI 推荐的 MCP、Skill 或远程安装命令。

Wardrail 不会只说“有风险”，还会告诉用户风险位置、原因和修复方式，并在输出前
自动隐藏完整密钥。

## 一分钟保护项目

进入任意项目目录即可扫描，无需注册账号或编写配置：

```bash
npx wardrail scan
npx wardrail scan --history
```

需要持续保护时，再安装提交前检查：

```bash
npm install --save-dev wardrail
npx wardrail hook install
```

参与开发或在本地运行当前仓库：

```bash
npm install
npm run dev -- scan examples/vibecoding-api-leak
```

安装 Hook 后，提交过程变为：

```text
git commit
    ↓
只扫描 Git 暂存区
    ↓
安全 → 正常提交
风险 → 停止提交并给出修复方法
```

## 当前可以发现什么？

- OpenAI、Anthropic、AWS、GitHub、Google、Stripe、Slack 等密钥格式；
- 通用硬编码 API Key、Token、密码和私钥；
- 删除后仍留在 Git 历史中的已知和通用密钥；
- `.env` 包含敏感值但未加入 `.gitignore`；
- `VITE_*`、`NEXT_PUBLIC_*`、`REACT_APP_*` 前端密钥暴露；
- 日志、Authorization Header、数据库 URL 和 Docker 中的密钥；
- 敏感环境变量经过局部变量传递后进入外部网络请求；
- Agent 读取 SSH、云服务、浏览器或系统凭据；
- `curl | sh`、危险删除、编码 PowerShell；
- 绕过用户确认、安全规则和不可见 Unicode 指令；
- `latest`、`main` 等未固定供应链来源。

目前包含 `WR-001`～`WR-017` 共 17 条规则：

```bash
npx wardrail rules list
npx wardrail explain WR-007
```

## 不上传代码

Wardrail默认：

- 只在本地读取文件；
- 不运行扫描目标；
- 不访问网络；
- 不依赖云服务或大模型；
- 不跟随符号链接；
- 输出前自动脱敏疑似密钥。

## 接入开发流程

扫描 Git 暂存区：

```bash
npx wardrail scan --staged
```

检查已经提交、后来又从当前文件删除的密钥：

```bash
npx wardrail scan --history
```

默认同时扫描当前文件和最近 100 个提交。整个过程只读取 Git 对象，不切换版本，
也不执行历史代码。需要扩大范围时：

```bash
npx wardrail scan --history --history-limit 1000
```

报告会显示对应提交哈希，但不会输出完整密钥。如果发现真实密钥，应先撤销或轮换；
仅重写 Git 历史不能让已经泄露的密钥重新变安全。

生成 GitHub Code Scanning 使用的 SARIF：

```bash
npx wardrail scan --format sarif --output wardrail.sarif
```

为已有项目建立历史问题基线：

```bash
npx wardrail baseline create
npx wardrail scan
```

基线只抑制指纹未变化的问题，新问题和位置发生变化的问题仍然会报告。

## 如果密钥已经泄露

仅删除代码并不够：

1. 立即到服务商后台撤销或轮换密钥；
2. 改为服务端环境变量或 Secret Manager；
3. 检查 Git 历史、CI 日志、部署日志和前端构建文件；
4. 检查 API 使用记录和账单；
5. 安装提交前检查，避免再次发生。

## 帮助更多新手安全地发布第一个项目

欢迎贡献：

- 删除真实密钥后的误报案例；
- 新服务商的危险和安全测试样例；
- 更容易理解的中文修复说明；
- 新 Agent 或 MCP 配置格式；
- 新手安全指南翻译。

如果 Wardrail 能帮你避免一次密钥泄露，欢迎给项目一个 Star。Star 会让更多第一次
发布项目的开发者，在误提交密钥之前看到这道安全检查。
