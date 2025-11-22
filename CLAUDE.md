# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个纯前端的 PDF 在线阅读器系统，主要用于批量上传、预览和智能分析毕业论文 PDF 文件。

## 核心架构

### 技术栈
- **纯前端实现**：无后端依赖，所有功能在浏览器中完成
- **PDF.js (v3.11.174)**：用于 PDF 文件的渲染、文本提取和缩略图生成
- **Gemini API (gemini-2.5-flash)**：用于智能分析论文内容（提取标题、作者、导师、评阅人、分数、摘要）
- **原生 JavaScript**：不使用任何前端框架，直接使用 DOM 操作

### 文件结构
- `index.html`：主页面结构，包含上传区、工具栏、文件列表、分析表格、PDF 预览模态框
- `app.js`：所有业务逻辑（约 815 行）
- `styles.css`：所有样式定义（约 928 行）

### 核心功能模块

1. **文件上传管理**（`addFiles`, `deleteFile`, `clearAllFiles`）
   - 支持拖拽上传和文件选择
   - 自动生成 PDF 缩略图（使用 PDF.js）
   - 文件去重检查（基于文件名和大小）

2. **PDF 预览系统**（`previewFile`, `renderPage`）
   - 模态框形式预览 PDF
   - 翻页控制（上一页/下一页/跳转页码）
   - 缩放控制（0.5x - 3x）
   - 键盘快捷键支持（左右箭头翻页、+/- 缩放、ESC 关闭）

3. **智能分析功能**（`analyzeFile`, `analyzeWithAi`, `extractPdfText`）
   - 提取 PDF 前 10 页文本内容
   - 使用 Gemini API 智能识别：
     - 论文标题
     - 作者姓名
     - 指导教师
     - 评阅人/批改人
     - 分数/成绩
     - 摘要概括（200 字以内）
   - 本地正则表达式备用提取逻辑（`extractThesisInfo`）

4. **视图切换**（`switchView`）
   - 列表视图（list）：横向排列，适合快速浏览
   - 看板视图（grid）：卡片网格，适合视觉预览
   - 分析表格（table）：表格形式展示分析结果

5. **数据导出**（`exportToCsv`）
   - 导出已分析文件为 CSV 格式
   - 包含 UTF-8 BOM 确保中文正确显示
   - 文件名格式：`论文分析结果_YYYY-MM-DD.csv`

## 开发指南

### 本地运行
```bash
python3 -m http.server 8000
```
然后访问 `http://localhost:8000`

### API 配置
Gemini API 密钥硬编码在 `app.js` 第 42-45 行：
```javascript
const API_CONFIG = {
    apiKey: 'AIzaSyB_5mC6cTIcmNROQWwloG3EMOnWAg8s6jg',
    model: 'gemini-2.5-flash'
};
```

### 状态管理
全局状态变量（`app.js` 第 34-39 行）：
- `pdfFiles`：所有已上传文件的数组
- `currentViewMode`：当前视图模式（'list' | 'grid' | 'table'）
- `currentPreviewPdf`：当前预览的 PDF 文档对象
- `currentPreviewFile`：当前预览的文件对象
- `currentPage`：当前预览页码
- `scale`：当前缩放比例

### 文件对象结构
```javascript
{
    id: string,              // 唯一 ID
    name: string,            // 文件名
    size: number,            // 文件大小（字节）
    file: File,              // 原始 File 对象
    thumbnail: Canvas,       // 缩略图 Canvas
    analysisStatus: 'pending' | 'analyzing' | 'done' | 'error',
    analysis: {              // 分析结果
        title: string,
        author: string,
        advisor: string,
        reviewer: string,
        score: string,
        summary: string
    }
}
```

## 重要注意事项

1. **PDF.js Worker 路径**：使用 CDN 提供的 worker，确保版本一致（v3.11.174）

2. **AI 分析限制**：
   - 每次分析提取 PDF 前 10 页（`maxPages = 10`）
   - 发送给 API 的文本限制前 4000 字符
   - API 温度设置为 0.3（确保一致性）
   - 最大输出 token：2048

3. **全局函数暴露**：
   为了在 HTML 中使用 onclick，以下函数暴露到 window 对象：
   - `window.previewFile`
   - `window.downloadFile`
   - `window.deleteFile`
   - `window.analyzeSingleFile`

4. **UI 更新机制**：
   所有数据变更后需调用 `updateUI()` 来同步界面显示

5. **加载状态管理**：
   使用 `showLoading()` 和 `hideLoading()` 包裹异步操作

## 常见修改场景

### 修改 AI 分析逻辑
修改 `analyzeWithAi` 函数（第 703-778 行）中的 prompt 内容

### 增加新的视图模式
1. 在 `switchView` 函数中添加新的 case
2. 在 HTML 中添加对应的容器和切换按钮
3. 实现对应的渲染函数

### 调整 PDF 文本提取页数
修改 `extractPdfText` 函数的 `maxPages` 参数（第 96 行）

### 修改 CSV 导出字段
修改 `exportToCsv` 函数中的 `headers` 和 `rows` 映射（第 266-278 行）
- 项目在github上的地址为：https://github.com/YKS722/Pdf；我的cloudflare网址为：https://dash.cloudflare.com/d72bab876c6e3a87f184f6528f76eea3/home/domains；我自己的域名为：http://wasabi7.dpdns.org/