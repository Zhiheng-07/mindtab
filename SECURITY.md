# 安全策略

## 报告安全漏洞

如果你发现了 MindTab 的安全漏洞，**请不要公开提交 Issue**。请通过以下方式私下报告：

- 发送邮件至项目维护者的 GitHub 关联邮箱（通过 GitHub Profile 查看）
- 或通过 GitHub 的 Security Advisory 功能（推荐）：

  1. 打开 https://github.com/Zhiheng-07/mindtab/security/advisories
  2. 点击"New advisory"
  3. 填写漏洞详情

我们承诺在收到报告后的 **48 小时内**回复确认，并及时修复。

## 安全注意事项

- MindTab 采用 BYOK（Bring Your Own Key）模式，API Key 仅存储在本地 `chrome.storage.local`
- 书签数据全部存储在本地 IndexedDB，不上传任何服务器
- 扩展未使用任何第三方 CDN 资源，所有代码均打包在扩展中
