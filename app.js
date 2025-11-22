// 设置 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM 元素
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const toolbar = document.getElementById('toolbar');
const fileCount = document.getElementById('fileCount');
const filesContainer = document.getElementById('filesContainer');
const filesList = document.getElementById('filesList');
const analysisContainer = document.getElementById('analysisContainer');
const analysisTableBody = document.getElementById('analysisTableBody');
const listViewBtn = document.getElementById('listViewBtn');
const gridViewBtn = document.getElementById('gridViewBtn');
const tableViewBtn = document.getElementById('tableViewBtn');
const settingsBtn = document.getElementById('settingsBtn');
const analyzeAllBtn = document.getElementById('analyzeAllBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const previewModal = document.getElementById('previewModal');
const modalTitle = document.getElementById('modalTitle');
const closeModal = document.getElementById('closeModal');
const pdfCanvas = document.getElementById('pdfCanvas');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const currentPageInput = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomLevelSpan = document.getElementById('zoomLevel');
const loading = document.getElementById('loading');

// 状态变量
let pdfFiles = [];
let currentViewMode = 'list';
let currentPreviewPdf = null;
let currentPreviewFile = null;
let currentPage = 1;
let scale = 1.5;

// API 配置（内置）
const API_CONFIG = {
    apiKey: 'AIzaSyB_5mC6cTIcmNROQWwloG3EMOnWAg8s6jg',
    model: 'gemini-2.5-flash'
};

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 生成唯一ID
function generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9);
}

// 显示/隐藏加载状态
function showLoading() {
    loading.style.display = 'block';
}

function hideLoading() {
    loading.style.display = 'none';
}

// 生成PDF缩略图
async function generateThumbnail(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);

        const canvas = document.createElement('canvas');
        const viewport = page.getViewport({ scale: 0.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const ctx = canvas.getContext('2d');
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;

        return canvas;
    } catch (error) {
        console.error('生成缩略图失败:', error);
        return null;
    }
}

// 提取PDF文本内容
async function extractPdfText(file, maxPages = 10) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        const pagesToExtract = Math.min(pdf.numPages, maxPages);

        for (let i = 1; i <= pagesToExtract; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }

        return fullText;
    } catch (error) {
        console.error('提取PDF文本失败:', error);
        return '';
    }
}

// 从文本中提取论文信息
function extractThesisInfo(text, fileName) {
    const info = {
        title: '',
        author: '',
        advisor: '',
        reviewer: '',
        score: '',
        summary: ''
    };

    // 清理文本
    const cleanText = text.replace(/\s+/g, ' ').trim();

    // 提取标题 - 尝试多种模式
    const titlePatterns = [
        /论文题目[：:]\s*(.+?)(?=\s*(?:学生|作者|姓名|专业|学院|摘要))/i,
        /题\s*目[：:]\s*(.+?)(?=\s*(?:学生|作者|姓名|专业|学院|摘要))/i,
        /毕业论文[：:]\s*(.+?)(?=\s*(?:学生|作者|姓名|专业))/i,
        /^(.{10,50}?)(?=\s*(?:摘要|Abstract|目录))/im
    ];

    for (const pattern of titlePatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
            info.title = match[1].trim().substring(0, 100);
            break;
        }
    }

    // 如果没有提取到标题，使用文件名
    if (!info.title) {
        info.title = fileName.replace('.pdf', '').substring(0, 50);
    }

    // 提取作者
    const authorPatterns = [
        /(?:作者|学生|学生姓名|姓名)[：:\s]*([^\s,，;；\d]{2,10})/i,
        /(?:撰写人|完成人)[：:\s]*([^\s,，;；\d]{2,10})/i,
        /学\s*生[：:\s]*([^\s,，;；\d]{2,10})/i
    ];

    for (const pattern of authorPatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
            info.author = match[1].trim();
            break;
        }
    }

    // 提取导师
    const advisorPatterns = [
        /(?:指导教师|导师|指导老师)[：:\s]*([^\s,，;；\d]{2,10})/i,
        /(?:指导人|指导者)[：:\s]*([^\s,，;；\d]{2,10})/i,
        /导\s*师[：:\s]*([^\s,，;；\d]{2,10})/i
    ];

    for (const pattern of advisorPatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
            info.advisor = match[1].trim();
            break;
        }
    }

    // 提取评阅人/批改人
    const reviewerPatterns = [
        /(?:评阅人|评阅教师|批改人|审阅人)[：:\s]*([^\s,，;；\d]{2,10})/i,
        /(?:评审人|答辩委员)[：:\s]*([^\s,，;；\d]{2,10})/i
    ];

    for (const pattern of reviewerPatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
            info.reviewer = match[1].trim();
            break;
        }
    }

    // 提取分数/成绩
    const scorePatterns = [
        /(?:成绩|分数|评分|得分)[：:\s]*([优良中及格不及格ABCDEF]|[0-9]{1,3}分?)/i,
        /(?:总评|总分|最终成绩)[：:\s]*([优良中及格不及格ABCDEF]|[0-9]{1,3}分?)/i,
        /([0-9]{2,3})\s*分/
    ];

    for (const pattern of scorePatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
            info.score = match[1].trim();
            break;
        }
    }

    // 提取摘要
    const abstractPatterns = [
        /摘\s*要[：:\s]*(.{50,500}?)(?=\s*(?:关键词|Keywords|Abstract|目录|引言|绑定|第一章))/is,
        /Abstract[：:\s]*(.{50,500}?)(?=\s*(?:Keywords|关键词|目录|Introduction))/is
    ];

    for (const pattern of abstractPatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
            info.summary = match[1].trim().substring(0, 200) + '...';
            break;
        }
    }

    // 如果没有摘要，取前200个字符作为概括
    if (!info.summary) {
        info.summary = cleanText.substring(0, 200).trim() + '...';
    }

    return info;
}

// 分析所有文件
async function analyzeAllFiles() {
    const pendingFiles = pdfFiles.filter(f => f.analysisStatus !== 'done');

    if (pendingFiles.length === 0) {
        alert('所有文件已分析完成');
        return;
    }

    showLoading();

    for (const fileObj of pendingFiles) {
        await analyzeFile(fileObj);
    }

    hideLoading();
    alert(`分析完成！共分析 ${pendingFiles.length} 个文件`);

    // 自动切换到表格视图
    switchView('table');
}

// 导出CSV
function exportToCsv() {
    const analyzedFiles = pdfFiles.filter(f => f.analysisStatus === 'done');

    if (analyzedFiles.length === 0) {
        alert('没有已分析的文件可导出');
        return;
    }

    // CSV 头部
    const headers = ['序号', '文件名', '论文标题', '作者', '导师', '批改人/评阅人', '分数/成绩', '摘要概括'];

    // CSV 内容
    const rows = analyzedFiles.map((f, index) => [
        index + 1,
        f.name,
        f.analysis.title || '',
        f.analysis.author || '',
        f.analysis.advisor || '',
        f.analysis.reviewer || '',
        f.analysis.score || '',
        (f.analysis.summary || '').replace(/"/g, '""')
    ]);

    // 生成 CSV 字符串
    let csvContent = '\uFEFF'; // BOM for UTF-8
    csvContent += headers.map(h => `"${h}"`).join(',') + '\n';
    csvContent += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // 下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `论文分析结果_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 添加文件
async function addFiles(files) {
    const validFiles = Array.from(files).filter(file => file.type === 'application/pdf');

    if (validFiles.length === 0) {
        alert('请选择有效的PDF文件');
        return;
    }

    showLoading();

    for (const file of validFiles) {
        const exists = pdfFiles.some(f => f.name === file.name && f.size === file.size);
        if (exists) continue;

        const fileObj = {
            id: generateId(),
            name: file.name,
            size: file.size,
            file: file,
            thumbnail: await generateThumbnail(file),
            analysisStatus: 'pending',
            analysis: null
        };

        pdfFiles.push(fileObj);
    }

    hideLoading();
    updateUI();
}

// 删除文件
function deleteFile(id) {
    pdfFiles = pdfFiles.filter(f => f.id !== id);
    updateUI();
}

// 清空所有文件
function clearAllFiles() {
    if (pdfFiles.length === 0) return;
    if (confirm('确定要清空所有文件吗?')) {
        pdfFiles = [];
        updateUI();
    }
}

// 下载文件
function downloadFile(id) {
    const fileObj = pdfFiles.find(f => f.id === id);
    if (!fileObj) return;

    const url = URL.createObjectURL(fileObj.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileObj.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 预览文件
async function previewFile(id) {
    const fileObj = pdfFiles.find(f => f.id === id);
    if (!fileObj) return;

    showLoading();

    try {
        const arrayBuffer = await fileObj.file.arrayBuffer();
        currentPreviewPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        currentPreviewFile = fileObj;

        modalTitle.textContent = fileObj.name;
        totalPagesSpan.textContent = currentPreviewPdf.numPages;
        currentPageInput.max = currentPreviewPdf.numPages;

        currentPage = 1;
        scale = 1.5;
        updateZoomLevel();

        await renderPage(1);
        previewModal.classList.add('active');
    } catch (error) {
        console.error('预览失败:', error);
        alert('预览失败，请重试');
    }

    hideLoading();
}

// 关闭预览
function closePreview() {
    previewModal.classList.remove('active');
    currentPreviewPdf = null;
    currentPreviewFile = null;
}

// 渲染PDF页面
async function renderPage(pageNum) {
    if (!currentPreviewPdf) return;

    showLoading();

    try {
        const page = await currentPreviewPdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;

        const ctx = pdfCanvas.getContext('2d');
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;

        currentPage = pageNum;
        currentPageInput.value = pageNum;

        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= currentPreviewPdf.numPages;
    } catch (error) {
        console.error('渲染失败:', error);
    }

    hideLoading();
}

// 更新缩放级别显示
function updateZoomLevel() {
    const percentage = Math.round((scale / 1.5) * 100);
    zoomLevelSpan.textContent = percentage + '%';
}

// 切换视图模式
function switchView(mode) {
    currentViewMode = mode;

    listViewBtn.classList.remove('active');
    gridViewBtn.classList.remove('active');
    tableViewBtn.classList.remove('active');

    if (mode === 'list') {
        listViewBtn.classList.add('active');
        filesList.classList.remove('grid-view');
        filesList.classList.add('list-view');
        filesContainer.style.display = 'block';
        analysisContainer.style.display = 'none';
    } else if (mode === 'grid') {
        gridViewBtn.classList.add('active');
        filesList.classList.remove('list-view');
        filesList.classList.add('grid-view');
        filesContainer.style.display = 'block';
        analysisContainer.style.display = 'none';
    } else if (mode === 'table') {
        tableViewBtn.classList.add('active');
        filesContainer.style.display = 'none';
        analysisContainer.style.display = 'block';
        renderAnalysisTable();
    }
}

// 渲染分析表格
function renderAnalysisTable() {
    analysisTableBody.innerHTML = '';

    pdfFiles.forEach((fileObj, index) => {
        const row = document.createElement('tr');

        const statusClass = {
            'pending': 'status-pending',
            'analyzing': 'status-analyzing',
            'done': 'status-done',
            'error': 'status-error'
        }[fileObj.analysisStatus] || 'status-pending';

        const statusText = {
            'pending': '待分析',
            'analyzing': '分析中',
            'done': '已完成',
            'error': '失败'
        }[fileObj.analysisStatus] || '待分析';

        const analysis = fileObj.analysis || {};

        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="filename-cell" title="${fileObj.name}">${fileObj.name}</td>
            <td title="${analysis.title || '-'}">${analysis.title || '-'}</td>
            <td>${analysis.author || '-'}</td>
            <td>${analysis.advisor || '-'}</td>
            <td>${analysis.reviewer || '-'}</td>
            <td>${analysis.score || '-'}</td>
            <td class="summary-cell" title="${analysis.summary || '-'}">${analysis.summary || '-'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="table-actions">
                    ${fileObj.analysisStatus !== 'done' ?
                        `<button class="analyze-single-btn" onclick="analyzeSingleFile('${fileObj.id}')">分析</button>` : ''}
                    <button class="view-btn-small" onclick="previewFile('${fileObj.id}')">预览</button>
                </div>
            </td>
        `;

        analysisTableBody.appendChild(row);
    });
}

// 分析单个文件（从表格按钮调用）
async function analyzeSingleFile(id) {
    const fileObj = pdfFiles.find(f => f.id === id);
    if (!fileObj) return;

    showLoading();
    await analyzeFile(fileObj);
    hideLoading();
}

// 创建文件卡片
function createFileCard(fileObj) {
    const card = document.createElement('div');
    card.className = 'file-card';

    const preview = document.createElement('div');
    preview.className = 'file-preview';

    if (fileObj.thumbnail) {
        preview.appendChild(fileObj.thumbnail.cloneNode(true));
    } else {
        preview.innerHTML = '<div class="pdf-icon">📄</div>';
    }

    const statusText = fileObj.analysisStatus === 'done' ? '✓ 已分析' : '未分析';
    const statusClass = fileObj.analysisStatus === 'done' ? 'analyzed' : '';

    const info = document.createElement('div');
    info.className = 'file-info';
    info.innerHTML = `
        <h4>${fileObj.name}</h4>
        <div class="file-meta">
            <span>📦 ${formatFileSize(fileObj.size)}</span>
        </div>
        <div class="analysis-status ${statusClass}">${statusText}</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'file-actions';
    actions.innerHTML = `
        <button class="preview-btn" onclick="previewFile('${fileObj.id}')">预览</button>
        <button class="download-btn" onclick="downloadFile('${fileObj.id}')">下载</button>
        <button class="delete-btn" onclick="deleteFile('${fileObj.id}')">删除</button>
    `;

    card.appendChild(preview);
    card.appendChild(info);
    card.appendChild(actions);

    return card;
}

// 更新UI
function updateUI() {
    fileCount.textContent = pdfFiles.length;

    if (pdfFiles.length === 0) {
        toolbar.style.display = 'none';
        filesContainer.style.display = 'none';
        analysisContainer.style.display = 'none';
        document.querySelector('.upload-section').style.display = 'block';
    } else {
        toolbar.style.display = 'flex';
        document.querySelector('.upload-section').style.display = 'block';

        if (currentViewMode === 'table') {
            filesContainer.style.display = 'none';
            analysisContainer.style.display = 'block';
            renderAnalysisTable();
        } else {
            filesContainer.style.display = 'block';
            analysisContainer.style.display = 'none';
        }
    }

    // 渲染文件列表
    filesList.innerHTML = '';
    pdfFiles.forEach(fileObj => {
        const card = createFileCard(fileObj);
        filesList.appendChild(card);
    });
}

// 事件监听器
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = '';
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
    }
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

listViewBtn.addEventListener('click', () => switchView('list'));
gridViewBtn.addEventListener('click', () => switchView('grid'));
tableViewBtn.addEventListener('click', () => switchView('table'));

analyzeAllBtn.addEventListener('click', analyzeAllFiles);
exportCsvBtn.addEventListener('click', exportToCsv);
clearAllBtn.addEventListener('click', clearAllFiles);

closeModal.addEventListener('click', closePreview);
previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) closePreview();
});

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) renderPage(currentPage - 1);
});

nextPageBtn.addEventListener('click', () => {
    if (currentPreviewPdf && currentPage < currentPreviewPdf.numPages) {
        renderPage(currentPage + 1);
    }
});

currentPageInput.addEventListener('change', (e) => {
    let page = parseInt(e.target.value);
    if (currentPreviewPdf) {
        if (page < 1) page = 1;
        if (page > currentPreviewPdf.numPages) page = currentPreviewPdf.numPages;
        renderPage(page);
    }
});

zoomInBtn.addEventListener('click', () => {
    if (scale < 3) {
        scale += 0.25;
        updateZoomLevel();
        renderPage(currentPage);
    }
});

zoomOutBtn.addEventListener('click', () => {
    if (scale > 0.5) {
        scale -= 0.25;
        updateZoomLevel();
        renderPage(currentPage);
    }
});

document.addEventListener('keydown', (e) => {
    if (!previewModal.classList.contains('active')) return;

    switch (e.key) {
        case 'Escape':
            closePreview();
            break;
        case 'ArrowLeft':
            if (currentPage > 1) renderPage(currentPage - 1);
            break;
        case 'ArrowRight':
            if (currentPreviewPdf && currentPage < currentPreviewPdf.numPages) {
                renderPage(currentPage + 1);
            }
            break;
        case '+':
        case '=':
            if (scale < 3) {
                scale += 0.25;
                updateZoomLevel();
                renderPage(currentPage);
            }
            break;
        case '-':
            if (scale > 0.5) {
                scale -= 0.25;
                updateZoomLevel();
                renderPage(currentPage);
            }
            break;
    }
});

// ==================== AI 功能 ====================

// 使用 Gemini API 分析文本
async function analyzeWithAi(text, fileName) {
    const prompt = `请分析以下毕业论文的 PDF 文本内容，并提取关键信息。请严格按照以下 JSON 格式返回，不要添加任何额外的说明文字：

{
  "title": "论文标题",
  "author": "作者姓名",
  "advisor": "指导教师姓名",
  "reviewer": "评阅人/批改人姓名",
  "score": "分数或成绩",
  "summary": "摘要概括（200字以内）"
}

注意事项：
1. 如果某个字段无法从文本中找到，请填写 "未找到"
2. 论文标题通常在文档开头
3. 作者、导师、评阅人等信息通常在封面或评审表中
4. 分数可能是数字分数（如85分）或等级（如优秀、良好）
5. 摘要请用简洁的语言概括论文主要内容

PDF文本内容：
${text.substring(0, 4000)}`;

    // Gemini API 端点
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${API_CONFIG.model}:generateContent?key=${API_CONFIG.apiKey}`;

    const body = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048
        }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`分析失败: ${response.status}`);
        }

        const data = await response.json();

        // 提取 Gemini 响应内容
        const content = data.candidates[0].content.parts[0].text;

        // 解析 JSON 响应
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return {
                title: result.title || fileName,
                author: result.author || '未找到',
                advisor: result.advisor || '未找到',
                reviewer: result.reviewer || '未找到',
                score: result.score || '未找到',
                summary: result.summary || '未找到'
            };
        } else {
            throw new Error('解析结果失败');
        }
    } catch (error) {
        console.error('分析失败:', error);
        throw error;
    }
}

// 分析文件（使用 AI）
async function analyzeFile(fileObj) {
    fileObj.analysisStatus = 'analyzing';
    updateUI();

    try {
        const text = await extractPdfText(fileObj.file);
        const info = await analyzeWithAi(text, fileObj.name);

        fileObj.analysis = info;
        fileObj.analysisStatus = 'done';
    } catch (error) {
        console.error('分析文件失败:', error);
        fileObj.analysisStatus = 'error';
        fileObj.analysis = {
            title: fileObj.name,
            author: '提取失败',
            advisor: '提取失败',
            reviewer: '提取失败',
            score: '-',
            summary: '分析失败，请稍后重试'
        };
    }

    updateUI();
}

// ==================== 全局函数 ====================

window.previewFile = previewFile;
window.downloadFile = downloadFile;
window.deleteFile = deleteFile;
window.analyzeSingleFile = analyzeSingleFile;

// 初始化
switchView('list');
