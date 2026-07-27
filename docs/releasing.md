# OpenDomain Release Runbook

本文档是 OpenDomain 的项目专属发布清单。它适用于当前 npm alpha
发布流程，不替代未来的 Trusted Publishing 或稳定版发布策略。

## 发布边界

- 只从公开仓库已合并并通过 CI 的 `main` 发布。
- npm alpha 版本使用 `alpha` dist-tag；不得隐式移动 `latest`。
- npm 包不得包含私有 OpenSpec、Codex 配置、token、生成索引或本地缓存。
- 本地 token 只能通过仓库外文件注入环境变量，不得写入 Git。
- 当前使用本地 token 发布，因此显式关闭 provenance。启用 npm Trusted
  Publishing 后再调整这一约束。

## 1. 发布前状态

1. 确认功能 PR 已合并，`main` 与 `origin/main` 对齐且工作树干净。
2. 从 `main` 创建独立的 `codex/release-<version>` 分支。
3. 将 `package.json` 和 `package-lock.json` 更新为同一版本。
4. 将 `CHANGELOG.md` 的 Unreleased 内容固化到带日期的版本章节。
5. 确认 README、使用说明、Schema、示例和 CLI 帮助反映本次能力。

## 2. 本地验证

使用支持的最低 Node.js 主版本执行：

```bash
volta run --node 20 npm test
volta run --node 20 npm run opendomain -- validate
volta run --node 20 npm run smoke:package
npm audit --json
npm pack --dry-run --json --ignore-scripts \
  --cache /tmp/opendomain-npm-cache
```

检查打包清单，确认：

- 版本正确；
- 公开 Schema、运行时代码、示例和必要文档存在；
- `.npmrc`、OpenSpec、`.codex`、token 和生成内容不存在。

## 3. 发布提交

1. 检查 staged diff，只包含版本、Changelog 和发布治理内容。
2. 提交并推送发布分支。
3. 创建发布 PR，等待 CI 全部通过。
4. 合并后重新同步本地 `main`，再次确认工作树干净。

## 4. npm 发布

项目级 `.npmrc` 必须保持 Git ignored，并通过 `${NPM_TOKEN}` 读取凭据。
从仓库外的私有文件加载 token，不在命令输出或日志中打印：

```bash
export NPM_TOKEN="$(cat /path/outside/repository/npm-token)"
npm whoami --userconfig .npmrc
npm publish --tag alpha --provenance=false --userconfig .npmrc
unset NPM_TOKEN
```

发布后确认：

```bash
npm view @echopath-labs/opendomain@<version> version
npm view @echopath-labs/opendomain dist-tags --json
```

`alpha` 必须指向新版本；`latest` 必须保持发布前的值，除非另有经过审查的
稳定版发布决策。

## 5. Registry Consumer Smoke

在新的临时目录中从 npm registry 安装精确版本，并至少验证：

```bash
npx --yes @echopath-labs/opendomain@<version> --help
```

对于改变初始化、校验、grounding 或 Profile Runtime 的版本，还必须执行对应
的安装后端到端 smoke，不能只依赖仓库源码测试。

## 6. Git Tag 和 GitHub Release

Registry 验证通过后：

1. 在发布来源 `main` 提交上创建 annotated tag `v<version>`。
2. 推送该 tag，不得移动或复用已有 tag。
3. 创建 GitHub prerelease，并使用 Changelog 版本章节作为发布说明基础。
4. 核对 GitHub Release、Git tag、npm 版本和来源提交一致。

## 7. 失败与回滚

- npm 发布前失败：不要创建或推送发布 tag；修复后重新验证。
- npm 发布后发现问题：不得覆盖已发布版本或强制移动 tag。
- 将 `alpha` dist-tag 恢复到上一个已验证版本。
- 对错误版本执行 `npm deprecate`，说明问题和替代版本。
- 在 GitHub Release 中记录状态，并通过新的 prerelease 版本前向修复。
- `latest` 不参与 alpha 回滚，除非它曾被明确移动。

## 8. 收尾记录

发布完成后记录：

- 版本、日期、来源提交、PR、tag、GitHub Release 和 npm URL；
- 测试、校验、打包和 registry smoke 证据；
- dist-tag 状态；
- 已知风险、未覆盖平台和明确延期范围；
- 公开仓库与私有 OpenSpec 的最终分支和工作树状态。
