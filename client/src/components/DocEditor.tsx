import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import {
  X, Share2, MoreHorizontal, Star, ChevronRight, ChevronDown,
  FileText, Plus, Trash2, Settings, Tag, Lock, Globe, Users,
  Copy, Archive, Bookmark, History, Shield, Maximize2,
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Image,
  Link2, Download, Info, Check, FolderIcon, Code, Quote, Minus, Strikethrough,
  Grid3X3, Rows3, Columns3, Palette, ArrowUpDown, GripVertical, Paintbrush,
  AtSign, LayoutGrid, Tablet, ListTodo, ToggleLeft, Type, Sparkles, Search,
  Globe2, Video, FileText as FileTextIcon, Wand2, Highlighter
} from 'lucide-react';
import { toast } from 'sonner';
import { docsApi, docPagesApi, membersApi, spacesApi, foldersApi, type Member } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Doc, DocPage, Space, Folder } from '../types';

interface DocEditorProps {
  doc: Doc;
  onClose: () => void;
  initialShowShare?: boolean;
  readOnly?: boolean;
  minimalMode?: boolean;
  inline?: boolean;
}

export default function DocEditor({ doc, onClose, initialShowShare = false, readOnly = false, minimalMode = false, inline = false }: DocEditorProps) {
  const queryClient = useQueryClient();
  const { member: currentMember } = useAuth();

  // Edit state
  const [title, setTitle] = useState(doc.name);
  const contentRef = useRef<HTMLDivElement>(null);
  const contentValue = useRef(doc.content || '');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // UI state
  const [showShareDialog, setShowShareDialog] = useState(initialShowShare);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  const [showPagesSidebar, setShowPagesSidebar] = useState(true);
  const [showToolbar, setShowToolbar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Page editing state
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  const pageTitleRef = useRef('');
  const pageContentRef = useRef('');

  // Tag state
  const [newTag, setNewTag] = useState('');
  const [docTags, setDocTags] = useState<string[]>(doc.tags || []);

  // Location state - track dynamically so badge updates after moving
  const [currentSpaceId, setCurrentSpaceId] = useState(doc.space_id);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(doc.folder_id || null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [expandedLocationSpaces, setExpandedLocationSpaces] = useState<Record<string, boolean>>({});

  // Sharing state
  const [sharing, setSharing] = useState(doc.sharing);
  const [inviteSearch, setInviteSearch] = useState('');
  const [sharedMembers, setSharedMembers] = useState<string[]>([]); // member IDs with access
  const [externalGuests, setExternalGuests] = useState<string[]>([]); // emails not in workspace
  const [memberPermissions, setMemberPermissions] = useState<Record<string, 'editor' | 'viewer'>>({});
  const [externalPermissions, setExternalPermissions] = useState<Record<string, 'editor' | 'viewer'>>({});
  const [permissionDropdownId, setPermissionDropdownId] = useState<string | null>(null);
  const [shareLinkEnabled, setShareLinkEnabled] = useState(sharing === 'public');
  const [linkRole, setLinkRole] = useState<'viewer' | 'editor'>(doc.link_role === 'editor' ? 'editor' : 'viewer');
  const [shareDialogMode, setShareDialogMode] = useState<'clickup' | 'google'>('google');

  // Slash command state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const slashCommandAnchorRef = useRef<{ node: Text; slashPos: number } | null>(null);

  // Table editing state
  const [showTableToolbar, setShowTableToolbar] = useState(false);
  const [tableToolbarPosition, setTableToolbarPosition] = useState({ top: 0, left: 0 });
  const [activeTable, setActiveTable] = useState<HTMLTableElement | null>(null);
  const [activeCell, setActiveCell] = useState<HTMLTableCellElement | null>(null);
  const [showTableOptions, setShowTableOptions] = useState(false);
  const [showCellColorPicker, setShowCellColorPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeColumnIndex, setResizeColumnIndex] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const resizeTableRef = useRef<HTMLTableElement | null>(null);

  // Cell color palette
  const cellColors = [
    { name: 'Default', color: 'transparent', bg: 'bg-transparent' },
    { name: 'Gray', color: '#374151', bg: 'bg-gray-700' },
    { name: 'Red', color: '#991b1b', bg: 'bg-red-800' },
    { name: 'Orange', color: '#9a3412', bg: 'bg-orange-800' },
    { name: 'Yellow', color: '#854d0e', bg: 'bg-yellow-800' },
    { name: 'Green', color: '#166534', bg: 'bg-green-800' },
    { name: 'Teal', color: '#115e59', bg: 'bg-teal-800' },
    { name: 'Blue', color: '#1e40af', bg: 'bg-blue-800' },
    { name: 'Purple', color: '#5b21b6', bg: 'bg-purple-800' },
    { name: 'Pink', color: '#9d174d', bg: 'bg-pink-800' },
  ];

  const insertBlockHTML = (html: string) => {
    insertHTML(`${html}<p><br /></p>`);
  };

  const wrapSelection = (html: string) => {
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    if (text) {
      insertHTML(html.replace('{{text}}', text));
    } else {
      insertHTML(html.replace('{{text}}', 'Text'));
    }
  };

  const insertEmbed = (label: string) => {
    const url = prompt(`Enter ${label} URL:`);
    if (!url) return;
    insertBlockHTML(
      `<div class="doc-embed"><iframe src="${url}" class="doc-embed-iframe" allowfullscreen></iframe></div>`
    );
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const applyInlineMarkdown = (text: string) => {
    let out = text;
    out = out.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" class="text-blue-400 hover:underline" target="_blank">$2</a>');
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded my-2" />');
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:underline" target="_blank">$1</a>');
    out = out.replace(/`([^`]+)`/g, '<code class="doc-inline-code">$1</code>');
    out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>');
    return out;
  };

  const markdownToHtml = (markdown: string) => {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let inUl = false;
    let inOl = false;
    let inCode = false;
    let codeLang = '';
    let codeBuffer: string[] = [];

    const closeLists = () => {
      if (inUl) {
        html += '</ul>';
        inUl = false;
      }
      if (inOl) {
        html += '</ol>';
        inOl = false;
      }
    };

    const parseTableRow = (row: string) => {
      const rawCells = row.trim();
      const trimmed = rawCells.startsWith('|') ? rawCells.slice(1) : rawCells;
      const clean = trimmed.endsWith('|') ? trimmed.slice(0, -1) : trimmed;
      return clean.split('|').map(cell => cell.trim());
    };

    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i];
      const line = raw.trimEnd();

      if (line.startsWith('```')) {
        if (!inCode) {
          inCode = true;
          codeLang = line.replace('```', '').trim();
          codeBuffer = [];
        } else {
          inCode = false;
          const code = escapeHtml(codeBuffer.join('\n'));
          html += `<pre class="bg-slate-900 rounded-lg p-4 my-2 overflow-x-auto"><code class="text-sm font-mono text-slate-300" data-lang="${codeLang}">${code}</code></pre>`;
          codeLang = '';
        }
        continue;
      }

      if (inCode) {
        codeBuffer.push(raw);
        continue;
      }

      // Table
      if (line.includes('|') && i + 1 < lines.length) {
        const separator = lines[i + 1].trim();
        if (/^\s*\|?\s*:?[-]+:?\s*(\|\s*:?[-]+:?\s*)+\|?\s*$/.test(separator)) {
          closeLists();
          const headerCells = parseTableRow(line);
          const rows: string[][] = [];
          i += 2;
          while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
            rows.push(parseTableRow(lines[i]));
            i += 1;
          }
          i -= 1;
          html += '<table><thead><tr>';
          headerCells.forEach(cell => {
            html += `<th>${applyInlineMarkdown(escapeHtml(cell || ''))}</th>`;
          });
          html += '</tr></thead><tbody>';
          rows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
              html += `<td>${applyInlineMarkdown(escapeHtml(cell || ''))}</td>`;
            });
            html += '</tr>';
          });
          html += '</tbody></table>';
          continue;
        }
      }

      if (!line.trim()) {
        closeLists();
        html += '<p><br /></p>';
        continue;
      }

      const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headerMatch) {
        closeLists();
        const level = headerMatch[1].length;
        html += `<h${level}>${applyInlineMarkdown(escapeHtml(headerMatch[2]))}</h${level}>`;
        continue;
      }

      if (/^>\s?/.test(line)) {
        closeLists();
        const content = line.replace(/^>\s?/, '');
        html += `<blockquote class="border-l-4 border-slate-500 pl-4 italic text-slate-400">${applyInlineMarkdown(escapeHtml(content))}</blockquote>`;
        continue;
      }

      if (/^(-\s\[\s\]\s|-\s\[x\]\s)/i.test(line)) {
        closeLists();
        const checked = /^-\s\[x\]\s/i.test(line);
        const content = line.replace(/^-\s\[(?:\s|x)\]\s/i, '');
        html += `<div class="flex items-start gap-2 my-1"><input type="checkbox" ${checked ? 'checked' : ''} class="mt-1 accent-violet-500" /><span>${applyInlineMarkdown(escapeHtml(content))}</span></div>`;
        continue;
      }

      if (/^[-*+]\s+/.test(line)) {
        if (!inUl) {
          closeLists();
          inUl = true;
          html += '<ul>';
        }
        const content = line.replace(/^[-*+]\s+/, '');
        html += `<li>${applyInlineMarkdown(escapeHtml(content))}</li>`;
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        if (!inOl) {
          closeLists();
          inOl = true;
          html += '<ol>';
        }
        const content = line.replace(/^\d+\.\s+/, '');
        html += `<li>${applyInlineMarkdown(escapeHtml(content))}</li>`;
        continue;
      }

      if (/^(---|\*\*\*)$/.test(line.trim())) {
        closeLists();
        html += '<hr class="border-slate-600 my-4" />';
        continue;
      }

      closeLists();
      html += `<p>${applyInlineMarkdown(escapeHtml(line))}</p>`;
    }

    closeLists();
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li',
                     'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
                     'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr', 'del', 'span', 'div', 'input'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'class', 'data-lang', 'checked', 'type'],
      ALLOW_DATA_ATTR: true
    });
  };

  const isLikelyMarkdown = (text: string) => {
    return /(^#{1,6}\s)|(^[-*+]\s)|(^\d+\.\s)|(```)|(\*\*.+\*\*)|(\[.+\]\(.+\))|(^>\s)|(\|.+\|)|(https?:\/\/)/m.test(text);
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    insertHTML(`<a href="${url}" class="doc-attachment" target="_blank" rel="noopener noreferrer">${file.name}</a>`);
    e.target.value = '';
  };

  const insertMention = (type: 'person' | 'task' | 'page' | 'whiteboard') => {
    if (type === 'person') {
      const name = prompt('Mention person (name):', members[0]?.name || 'User');
      if (name) {
        insertHTML(`<span class="doc-mention">@${name}</span>&nbsp;`);
      }
      return;
    }
    if (type === 'task') {
      const name = prompt('Mention task (name):', 'Task');
      if (name) {
        insertHTML(`<span class="doc-mention">@${name}</span>&nbsp;`);
      }
      return;
    }
    if (type === 'page') {
      const name = prompt('Mention page (name):', pages[0]?.title || 'Page');
      if (name) {
        insertHTML(`<span class="doc-mention">@${name}</span>&nbsp;`);
      }
      return;
    }
    const name = prompt('Mention whiteboard (name):', 'Whiteboard');
    if (name) {
      insertHTML(`<span class="doc-mention">@${name}</span>&nbsp;`);
    }
  };

  const applyTextColor = (color: string) => {
    document.execCommand('foreColor', false, color);
    contentRef.current?.focus();
    handleContentInput();
  };

  const applyHighlight = (color: string) => {
    document.execCommand('hiliteColor', false, color);
    contentRef.current?.focus();
    handleContentInput();
  };

  const insertBadge = (label: string, className: string) => {
    insertHTML(`<span class="doc-badge ${className}">${label}</span>&nbsp;`);
  };

  const insertStandup = () => {
    insertBlockHTML(
      `<div class="doc-standup">
        <p><strong>Standup</strong></p>
        <ul>
          <li><strong>Yesterday:</strong> </li>
          <li><strong>Today:</strong> </li>
          <li><strong>Blockers:</strong> </li>
        </ul>
      </div>`
    );
  };

  const insertTemplate = () => {
    insertBlockHTML(
      `<div class="doc-template">
        <h2>Project Overview</h2>
        <p>Goals, scope, and timeline.</p>
        <h3>Milestones</h3>
        <ul><li>Milestone 1</li><li>Milestone 2</li></ul>
        <h3>Risks</h3>
        <p>List risks and mitigations.</p>
      </div>`
    );
  };

  const insertColumns = () => {
    insertBlockHTML(
      `<div class="doc-columns">
        <div class="doc-column"><p><strong>Column 1</strong></p><p>Content...</p></div>
        <div class="doc-column"><p><strong>Column 2</strong></p><p>Content...</p></div>
      </div>`
    );
  };

  const insertToggle = () => {
    insertBlockHTML(
      `<details class="doc-toggle">
        <summary>Toggle</summary>
        <div class="doc-toggle-content"><p>Hidden content...</p></div>
      </details>`
    );
  };

  const insertClickUpList = (type: 'table' | 'board' | 'list') => {
    insertBlockHTML(
      `<div class="doc-clickup-view">
        <div class="doc-clickup-view-title">ClickUp List (${type.charAt(0).toUpperCase() + type.slice(1)})</div>
        <div class="doc-clickup-view-body">View placeholder</div>
      </div>`
    );
  };

  const insertTableOfContents = (sticky = false) => {
    if (!contentRef.current) return;
    const headings = Array.from(contentRef.current.querySelectorAll('h1, h2, h3')) as HTMLElement[];
    const items = headings.map(h => `<li>${h.textContent || 'Heading'}</li>`).join('');
    const className = sticky ? 'doc-toc doc-toc-sticky' : 'doc-toc';
    insertBlockHTML(`<div class="${className}"><p><strong>Table of contents</strong></p><ul>${items || '<li>No headings</li>'}</ul></div>`);
  };

  const applyAIAction = (action: string) => {
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    const source = text || 'Your content';
    const insert = (result: string) => {
      if (text) {
        insertHTML(result);
      } else {
        insertBlockHTML(`<p>${result}</p>`);
      }
    };

    switch (action) {
      case 'summarize':
        insert(source.split('.').slice(0, 1).join('.').trim() || source);
        break;
      case 'continue':
        insert(`${source} ...continued`);
        break;
      case 'explain':
        insert(`Explanation: ${source}`);
        break;
      case 'improve':
        insert(source.charAt(0).toUpperCase() + source.slice(1));
        break;
      case 'actions':
        insertBlockHTML(`<ul><li>Action item 1</li><li>Action item 2</li></ul>`);
        break;
      case 'simplify':
        insert(source.split(' ').slice(0, 8).join(' ') || source);
        break;
      case 'shorter':
        insert(source.split(' ').slice(0, Math.max(5, Math.floor(source.split(' ').length / 2))).join(' '));
        break;
      case 'longer':
        insert(`${source} (expanded with more details)`);
        break;
      case 'translate': {
        const lang = prompt('Translate to:', 'Spanish');
        insert(`[Translated to ${lang || 'target language'}] ${source}`);
        break;
      }
      default:
        insert(source);
    }
  };

  const createAndOpenPage = (isSubpage: boolean) => {
    createPageMutation.mutate(
      {
        doc_id: doc.id,
        title: 'Untitled',
        parent_page_id: isSubpage ? selectedPageId || undefined : undefined
      },
      {
        onSuccess: (page) => {
          setSelectedPageId(page.id);
          pageTitleRef.current = page.title;
          pageContentRef.current = page.content || '';
          setTitle(page.title);
          if (contentRef.current) {
            contentRef.current.innerHTML = page.content || '';
          }
        }
      }
    );
  };

  type SlashCommand = {
    id: string;
    label: string;
    section: string;
    icon: JSX.Element;
    keywords?: string;
    action: () => void;
  };

  const slashCommands: SlashCommand[] = [
    { id: 'write-ai', label: 'Write with AI', section: 'Suggestions', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => applyAIAction('continue') },
    { id: 'new-subpage', label: 'New Subpage', section: 'Suggestions', icon: <FileTextIcon className="w-3.5 h-3.5" />, action: () => createAndOpenPage(true) },
    { id: 'banners', label: 'Banners', section: 'Suggestions', icon: <Info className="w-3.5 h-3.5" />, action: () => insertBlockHTML('<div class="doc-banner doc-banner-info">Banner</div>') },
    { id: 'checklist', label: 'Checklist', section: 'Suggestions', icon: <ListTodo className="w-3.5 h-3.5" />, action: () => insertHTML('<div class="flex items-start gap-2 my-1"><input type="checkbox" class="mt-1 accent-violet-500" /><span>Task item</span></div>') },
    { id: 'columns', label: 'Columns', section: 'Suggestions', icon: <Columns3 className="w-3.5 h-3.5" />, action: insertColumns },
    { id: 'new-page', label: 'New Page', section: 'Suggestions', icon: <Plus className="w-3.5 h-3.5" />, action: () => createAndOpenPage(false) },
    { id: 'template', label: 'Template', section: 'Suggestions', icon: <LayoutGrid className="w-3.5 h-3.5" />, action: insertTemplate },
    { id: 'clickup-table', label: 'ClickUp List (Table)', section: 'Suggestions', icon: <Grid3X3 className="w-3.5 h-3.5" />, action: () => insertClickUpList('table') },
    { id: 'toggle-list', label: 'Toggle list', section: 'Suggestions', icon: <ToggleLeft className="w-3.5 h-3.5" />, action: insertToggle },
    { id: 'button', label: 'Button', section: 'Suggestions', icon: <Tablet className="w-3.5 h-3.5" />, action: () => insertHTML('<span class="doc-button">Button</span>&nbsp;') },
    { id: 'whiteboard', label: 'Create Whiteboard', section: 'Suggestions', icon: <Paintbrush className="w-3.5 h-3.5" />, action: () => insertBlockHTML('<div class="doc-whiteboard">Whiteboard placeholder</div>') },
    { id: 'standup', label: 'Write StandUp', section: 'Suggestions', icon: <Wand2 className="w-3.5 h-3.5" />, action: insertStandup },

    { id: 'text-normal', label: 'Normal text', section: 'Text', icon: <Type className="w-3.5 h-3.5" />, action: () => execCommand('formatBlock', 'p') },
    { id: 'text-h1', label: 'Heading 1', section: 'Text', icon: <Heading1 className="w-3.5 h-3.5" />, action: () => execCommand('formatBlock', 'h1') },
    { id: 'text-h2', label: 'Heading 2', section: 'Text', icon: <Heading2 className="w-3.5 h-3.5" />, action: () => execCommand('formatBlock', 'h2') },
    { id: 'text-h3', label: 'Heading 3', section: 'Text', icon: <Heading3 className="w-3.5 h-3.5" />, action: () => execCommand('formatBlock', 'h3') },
    { id: 'text-h4', label: 'Heading 4', section: 'Text', icon: <Heading3 className="w-3.5 h-3.5" />, action: () => execCommand('formatBlock', 'h4') },
    { id: 'text-checklist', label: 'Checklist', section: 'Text', icon: <ListTodo className="w-3.5 h-3.5" />, action: () => insertHTML('<div class="flex items-start gap-2 my-1"><input type="checkbox" class="mt-1 accent-violet-500" /><span>Task item</span></div>') },
    { id: 'text-bulleted', label: 'Bulleted list', section: 'Text', icon: <List className="w-3.5 h-3.5" />, action: () => execCommand('insertUnorderedList') },
    { id: 'text-numbered', label: 'Numbered list', section: 'Text', icon: <ListOrdered className="w-3.5 h-3.5" />, action: () => execCommand('insertOrderedList') },
    { id: 'text-toggle', label: 'Toggle list', section: 'Text', icon: <ToggleLeft className="w-3.5 h-3.5" />, action: insertToggle },
    { id: 'text-banners', label: 'Banners', section: 'Text', icon: <Info className="w-3.5 h-3.5" />, action: () => insertBlockHTML('<div class="doc-banner doc-banner-info">Banner</div>') },
    { id: 'text-code', label: 'Code block', section: 'Text', icon: <Code className="w-3.5 h-3.5" />, action: () => insertBlockHTML('<pre class="bg-slate-900 rounded-lg p-4 my-2 overflow-x-auto"><code class="text-sm font-mono text-slate-300">// code block</code></pre>') },
    { id: 'text-quote', label: 'Block quote', section: 'Text', icon: <Quote className="w-3.5 h-3.5" />, action: () => insertBlockHTML('<blockquote class="border-l-4 border-slate-500 pl-4 italic text-slate-400">Quote text</blockquote>') },
    { id: 'text-pull', label: 'Pull quote', section: 'Text', icon: <Quote className="w-3.5 h-3.5" />, action: () => insertBlockHTML('<blockquote class="doc-pull-quote">Pull quote</blockquote>') },

    { id: 'inline-mention-person', label: 'Mention a Person', section: 'Inline', icon: <AtSign className="w-3.5 h-3.5" />, action: () => insertMention('person') },
    { id: 'inline-mention-task', label: 'Mention a Task', section: 'Inline', icon: <AtSign className="w-3.5 h-3.5" />, action: () => insertMention('task') },
    { id: 'inline-mention-page', label: 'Mention a Page', section: 'Inline', icon: <AtSign className="w-3.5 h-3.5" />, action: () => insertMention('page') },
    { id: 'inline-mention-whiteboard', label: 'Mention a Whiteboard', section: 'Inline', icon: <AtSign className="w-3.5 h-3.5" />, action: () => insertMention('whiteboard') },

    { id: 'views-table', label: 'ClickUp List (Table)', section: 'Views', icon: <Grid3X3 className="w-3.5 h-3.5" />, action: () => insertClickUpList('table') },
    { id: 'views-board', label: 'ClickUp List (Board)', section: 'Views', icon: <LayoutGrid className="w-3.5 h-3.5" />, action: () => insertClickUpList('board') },
    { id: 'views-list', label: 'ClickUp List (List)', section: 'Views', icon: <List className="w-3.5 h-3.5" />, action: () => insertClickUpList('list') },

    { id: 'embed-website', label: 'Embed website', section: 'Embeds', icon: <Globe2 className="w-3.5 h-3.5" />, action: () => insertEmbed('website') },
    { id: 'embed-cloudapp', label: 'CloudApp', section: 'Embeds', icon: <Globe2 className="w-3.5 h-3.5" />, action: () => insertEmbed('CloudApp') },
    { id: 'embed-youtube', label: 'YouTube', section: 'Embeds', icon: <Video className="w-3.5 h-3.5" />, action: () => insertEmbed('YouTube') },
    { id: 'embed-vimeo', label: 'Vimeo', section: 'Embeds', icon: <Video className="w-3.5 h-3.5" />, action: () => insertEmbed('Vimeo') },
    { id: 'embed-figma', label: 'Figma', section: 'Embeds', icon: <Globe2 className="w-3.5 h-3.5" />, action: () => insertEmbed('Figma') },
    { id: 'embed-loom', label: 'Loom', section: 'Embeds', icon: <Video className="w-3.5 h-3.5" />, action: () => insertEmbed('Loom') },
    { id: 'embed-miro', label: 'Miro', section: 'Embeds', icon: <Globe2 className="w-3.5 h-3.5" />, action: () => insertEmbed('Miro') },
    { id: 'embed-giphy', label: 'GIPHY', section: 'Embeds', icon: <Image className="w-3.5 h-3.5" />, action: () => insertEmbed('GIPHY') },
    { id: 'embed-drive', label: 'Google Drive', section: 'Embeds', icon: <Globe2 className="w-3.5 h-3.5" />, action: () => insertEmbed('Google Drive') },
    { id: 'embed-slides', label: 'Google Slides', section: 'Embeds', icon: <Globe2 className="w-3.5 h-3.5" />, action: () => insertEmbed('Google Slides') },
    { id: 'embed-docs', label: 'Google Docs', section: 'Embeds', icon: <Globe2 className="w-3.5 h-3.5" />, action: () => insertEmbed('Google Docs') },
    { id: 'embed-sheets', label: 'Google Sheets', section: 'Embeds', icon: <Globe2 className="w-3.5 h-3.5" />, action: () => insertEmbed('Google Sheets') },

    { id: 'attachment', label: 'Attachment', section: 'Attachment', icon: <Download className="w-3.5 h-3.5" />, action: () => fileInputRef.current?.click() },

    { id: 'format-clear', label: 'Clear format', section: 'Formatting', icon: <Minus className="w-3.5 h-3.5" />, action: () => execCommand('removeFormat') },
    { id: 'format-bold', label: 'Bold', section: 'Formatting', icon: <Bold className="w-3.5 h-3.5" />, action: () => execCommand('bold') },
    { id: 'format-italic', label: 'Italic', section: 'Formatting', icon: <Italic className="w-3.5 h-3.5" />, action: () => execCommand('italic') },
    { id: 'format-strike', label: 'Strikethrough', section: 'Formatting', icon: <Strikethrough className="w-3.5 h-3.5" />, action: () => execCommand('strikeThrough') },
    { id: 'format-inline-code', label: 'Inline code', section: 'Formatting', icon: <Code className="w-3.5 h-3.5" />, action: () => wrapSelection('<code class="doc-inline-code">{{text}}</code>') },
    { id: 'format-link', label: 'Website Link', section: 'Formatting', icon: <Link2 className="w-3.5 h-3.5" />, action: () => { const url = prompt('Enter URL:'); if (url) execCommand('createLink', url); } },

    { id: 'advanced-columns', label: 'Columns', section: 'Advanced Blocks', icon: <Columns3 className="w-3.5 h-3.5" />, action: insertColumns },
    { id: 'advanced-divider', label: 'Divider', section: 'Advanced Blocks', icon: <Minus className="w-3.5 h-3.5" />, action: () => insertHTML('<hr class="border-slate-600 my-4" />') },
    { id: 'advanced-newpage', label: 'New Page', section: 'Advanced Blocks', icon: <Plus className="w-3.5 h-3.5" />, action: () => createAndOpenPage(false) },
    { id: 'advanced-button', label: 'Button', section: 'Advanced Blocks', icon: <Tablet className="w-3.5 h-3.5" />, action: () => insertHTML('<span class="doc-button">Button</span>&nbsp;') },
    { id: 'advanced-toc', label: 'Table of contents', section: 'Advanced Blocks', icon: <List className="w-3.5 h-3.5" />, action: () => insertTableOfContents(false) },
    { id: 'advanced-table', label: 'Table', section: 'Advanced Blocks', icon: <Grid3X3 className="w-3.5 h-3.5" />, action: () => insertHTML('<table class="border-collapse border border-slate-600 my-2 w-full"><tr><th class="border border-slate-600 p-2 bg-slate-800">Header 1</th><th class="border border-slate-600 p-2 bg-slate-800">Header 2</th></tr><tr><td class="border border-slate-600 p-2">Cell 1</td><td class="border border-slate-600 p-2">Cell 2</td></tr></table>') },
    { id: 'advanced-template', label: 'Template', section: 'Advanced Blocks', icon: <LayoutGrid className="w-3.5 h-3.5" />, action: insertTemplate },
    { id: 'advanced-subpage', label: 'New Subpage', section: 'Advanced Blocks', icon: <FileTextIcon className="w-3.5 h-3.5" />, action: () => createAndOpenPage(true) },

    { id: 'markdown', label: 'Markdown', section: 'Markdown', icon: <Code className="w-3.5 h-3.5" />, action: () => insertBlockHTML('<pre class="doc-markdown-block" contenteditable="true"># Heading\n- Item\n**Bold** and `inline code`</pre>') },
    { id: 'markdown-sticky-toc', label: 'Sticky table of contents', section: 'Markdown', icon: <List className="w-3.5 h-3.5" />, action: () => insertTableOfContents(true) },

    { id: 'ai-write', label: 'Write with AI', section: 'ClickUp AI', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => applyAIAction('continue') },
    { id: 'ai-summarize', label: 'Summarize', section: 'ClickUp AI', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => applyAIAction('summarize') },
    { id: 'ai-continue', label: 'Continue writing', section: 'ClickUp AI', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => applyAIAction('continue') },
    { id: 'ai-explain', label: 'Explain', section: 'ClickUp AI', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => applyAIAction('explain') },
    { id: 'ai-improve', label: 'Improve writing', section: 'ClickUp AI', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => applyAIAction('improve') },
    { id: 'ai-actions', label: 'Generate action items', section: 'ClickUp AI', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => applyAIAction('actions') },
    { id: 'ai-simplify', label: 'Simplify writing', section: 'ClickUp AI', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => applyAIAction('simplify') },
    { id: 'ai-shorter', label: 'Make shorter', section: 'ClickUp AI', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => applyAIAction('shorter') },
    { id: 'ai-longer', label: 'Make longer', section: 'ClickUp AI', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => applyAIAction('longer') },
    { id: 'ai-translate', label: 'Translate', section: 'ClickUp AI', icon: <Sparkles className="w-3.5 h-3.5" />, action: () => applyAIAction('translate') },

    { id: 'color-default', label: 'Default', section: 'Text Colors', icon: <Palette className="w-3.5 h-3.5" />, action: () => applyTextColor('#e5e7eb') },
    { id: 'color-red', label: 'Red', section: 'Text Colors', icon: <Palette className="w-3.5 h-3.5 text-red-400" />, action: () => applyTextColor('#f87171') },
    { id: 'color-orange', label: 'Orange', section: 'Text Colors', icon: <Palette className="w-3.5 h-3.5 text-orange-400" />, action: () => applyTextColor('#fb923c') },
    { id: 'color-yellow', label: 'Yellow', section: 'Text Colors', icon: <Palette className="w-3.5 h-3.5 text-yellow-400" />, action: () => applyTextColor('#facc15') },
    { id: 'color-blue', label: 'Blue', section: 'Text Colors', icon: <Palette className="w-3.5 h-3.5 text-blue-400" />, action: () => applyTextColor('#60a5fa') },
    { id: 'color-purple', label: 'Purple', section: 'Text Colors', icon: <Palette className="w-3.5 h-3.5 text-purple-400" />, action: () => applyTextColor('#c084fc') },
    { id: 'color-pink', label: 'Pink', section: 'Text Colors', icon: <Palette className="w-3.5 h-3.5 text-pink-400" />, action: () => applyTextColor('#f472b6') },
    { id: 'color-green', label: 'Green', section: 'Text Colors', icon: <Palette className="w-3.5 h-3.5 text-green-400" />, action: () => applyTextColor('#4ade80') },
    { id: 'color-grey', label: 'Grey', section: 'Text Colors', icon: <Palette className="w-3.5 h-3.5 text-gray-400" />, action: () => applyTextColor('#9ca3af') },

    { id: 'highlight-remove', label: 'Remove highlight', section: 'Highlights', icon: <Highlighter className="w-3.5 h-3.5" />, action: () => applyHighlight('transparent') },
    { id: 'highlight-red', label: 'Red highlight', section: 'Highlights', icon: <Highlighter className="w-3.5 h-3.5 text-red-400" />, action: () => applyHighlight('rgba(248, 113, 113, 0.35)') },
    { id: 'highlight-orange', label: 'Orange highlight', section: 'Highlights', icon: <Highlighter className="w-3.5 h-3.5 text-orange-400" />, action: () => applyHighlight('rgba(251, 146, 60, 0.35)') },
    { id: 'highlight-yellow', label: 'Yellow highlight', section: 'Highlights', icon: <Highlighter className="w-3.5 h-3.5 text-yellow-400" />, action: () => applyHighlight('rgba(250, 204, 21, 0.35)') },
    { id: 'highlight-blue', label: 'Blue highlight', section: 'Highlights', icon: <Highlighter className="w-3.5 h-3.5 text-blue-400" />, action: () => applyHighlight('rgba(96, 165, 250, 0.35)') },
    { id: 'highlight-purple', label: 'Purple highlight', section: 'Highlights', icon: <Highlighter className="w-3.5 h-3.5 text-purple-400" />, action: () => applyHighlight('rgba(192, 132, 252, 0.35)') },
    { id: 'highlight-pink', label: 'Pink highlight', section: 'Highlights', icon: <Highlighter className="w-3.5 h-3.5 text-pink-400" />, action: () => applyHighlight('rgba(244, 114, 182, 0.35)') },
    { id: 'highlight-green', label: 'Green highlight', section: 'Highlights', icon: <Highlighter className="w-3.5 h-3.5 text-green-400" />, action: () => applyHighlight('rgba(74, 222, 128, 0.35)') },
    { id: 'highlight-grey', label: 'Grey highlight', section: 'Highlights', icon: <Highlighter className="w-3.5 h-3.5 text-gray-400" />, action: () => applyHighlight('rgba(156, 163, 175, 0.35)') },

    { id: 'badge-remove', label: 'Remove badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5" />, action: () => wrapSelection('{{text}}') },
    { id: 'badge-strong-red', label: 'Strong red badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-red-400" />, action: () => insertBadge('Strong red badge', 'badge-strong-red') },
    { id: 'badge-strong-orange', label: 'Strong orange badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-orange-400" />, action: () => insertBadge('Strong orange badge', 'badge-strong-orange') },
    { id: 'badge-strong-yellow', label: 'Strong yellow badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-yellow-400" />, action: () => insertBadge('Strong yellow badge', 'badge-strong-yellow') },
    { id: 'badge-strong-blue', label: 'Strong blue badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-blue-400" />, action: () => insertBadge('Strong blue badge', 'badge-strong-blue') },
    { id: 'badge-strong-purple', label: 'Strong purple badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-purple-400" />, action: () => insertBadge('Strong purple badge', 'badge-strong-purple') },
    { id: 'badge-strong-pink', label: 'Strong pink badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-pink-400" />, action: () => insertBadge('Strong pink badge', 'badge-strong-pink') },
    { id: 'badge-strong-green', label: 'Strong green badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-green-400" />, action: () => insertBadge('Strong green badge', 'badge-strong-green') },
    { id: 'badge-strong-grey', label: 'Strong grey badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-gray-400" />, action: () => insertBadge('Strong grey badge', 'badge-strong-grey') },
    { id: 'badge-red', label: 'Red badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-red-400" />, action: () => insertBadge('Red badge', 'badge-red') },
    { id: 'badge-orange', label: 'Orange badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-orange-400" />, action: () => insertBadge('Orange badge', 'badge-orange') },
    { id: 'badge-yellow', label: 'Yellow badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-yellow-400" />, action: () => insertBadge('Yellow badge', 'badge-yellow') },
    { id: 'badge-blue', label: 'Blue badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-blue-400" />, action: () => insertBadge('Blue badge', 'badge-blue') },
    { id: 'badge-purple', label: 'Purple badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-purple-400" />, action: () => insertBadge('Purple badge', 'badge-purple') },
    { id: 'badge-pink', label: 'Pink badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-pink-400" />, action: () => insertBadge('Pink badge', 'badge-pink') },
    { id: 'badge-green', label: 'Green badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-green-400" />, action: () => insertBadge('Green badge', 'badge-green') },
    { id: 'badge-grey', label: 'Grey badge', section: 'Badges', icon: <Tag className="w-3.5 h-3.5 text-gray-400" />, action: () => insertBadge('Grey badge', 'badge-grey') },
  ];

  const normalizeCommandKey = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[()]/g, '')
      .trim();

  const filteredSlashCommands = slashCommands
    .filter(cmd => {
      if (!slashFilter.trim()) return true;
      const q = slashFilter.toLowerCase();
      return cmd.label.toLowerCase().includes(q) || cmd.section.toLowerCase().includes(q) || (cmd.keywords || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (!slashFilter.trim()) return 0;
      const q = normalizeCommandKey(slashFilter);
      const aLabel = normalizeCommandKey(a.label);
      const bLabel = normalizeCommandKey(b.label);
      const aExact = aLabel === q ? 1 : 0;
      const bExact = bLabel === q ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      const aStarts = aLabel.startsWith(q) ? 1 : 0;
      const bStarts = bLabel.startsWith(q) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
      return 0;
    });

  const sectionOrder = [
    'Suggestions',
    'Text',
    'Inline',
    'Views',
    'Embeds',
    'Attachment',
    'Formatting',
    'Advanced Blocks',
    'Markdown',
    'ClickUp AI',
    'Text Colors',
    'Highlights',
    'Badges'
  ];

  const groupedSlashCommands = sectionOrder
    .map(section => ({
      section,
      items: filteredSlashCommands.filter(cmd => cmd.section === section)
    }))
    .filter(group => group.items.length > 0);

  const slashAliasMap: Record<string, string> = {
    table: 'advanced-table',
    checklist: 'text-checklist',
    'bulleted list': 'text-bulleted',
    'bullet list': 'text-bulleted',
    'numbered list': 'text-numbered',
    'toggle list': 'text-toggle',
    toggle: 'text-toggle',
    'heading 1': 'text-h1',
    h1: 'text-h1',
    'heading 2': 'text-h2',
    h2: 'text-h2',
    'heading 3': 'text-h3',
    h3: 'text-h3',
    'heading 4': 'text-h4',
    h4: 'text-h4',
    quote: 'text-quote',
    'block quote': 'text-quote',
    'code block': 'text-code',
    divider: 'advanced-divider',
    columns: 'advanced-columns',
    toc: 'advanced-toc',
    'table of contents': 'advanced-toc'
  };

  const findSlashCommand = (token: string) => {
    const normalized = normalizeCommandKey(token);
    const alias = slashAliasMap[normalized];
    if (alias) return slashCommands.find(cmd => cmd.id === alias) || null;
    const direct = slashCommands.find(cmd => normalizeCommandKey(cmd.label) === normalized);
    if (direct) return direct;
    return null;
  };

  useEffect(() => {
    if (selectedSlashIndex >= filteredSlashCommands.length) {
      setSelectedSlashIndex(0);
    } else if (slashFilter.trim()) {
      const q = normalizeCommandKey(slashFilter);
      const exactIndex = filteredSlashCommands.findIndex(cmd => normalizeCommandKey(cmd.label) === q);
      if (exactIndex >= 0 && exactIndex !== selectedSlashIndex) {
        setSelectedSlashIndex(exactIndex);
      }
    }
  }, [filteredSlashCommands, selectedSlashIndex, slashFilter]);

  // Queries
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: membersApi.getAll
  });

  const { data: spaces = [] } = useQuery<Space[]>({
    queryKey: ['spaces'],
    queryFn: spacesApi.getAll
  });

  const { data: allFolders = [] } = useQuery<Folder[]>({
    queryKey: ['folders'],
    queryFn: foldersApi.getAll
  });

  const docSpace = spaces.find(s => s.id === currentSpaceId);
  const docFolder = currentFolderId ? allFolders.find(f => f.id === currentFolderId) : null;

  const { data: pages = [] } = useQuery<DocPage[]>({
    queryKey: ['doc-pages', doc.id],
    queryFn: () => docPagesApi.getByDoc(doc.id)
  });

  useEffect(() => {
    const shared = doc.shared_with || [];
    const workspaceIds: string[] = [];
    const externalEmails: string[] = [];
    const perms: Record<string, 'editor' | 'viewer'> = {};
    const externalPerms: Record<string, 'editor' | 'viewer'> = {};
    shared.forEach(entry => {
      const role: 'editor' | 'viewer' = entry.role === 'editor' ? 'editor' : 'viewer';
      if (entry.member_id) {
        workspaceIds.push(entry.member_id);
        perms[entry.member_id] = role;
      } else if (entry.email) {
        externalEmails.push(entry.email);
        externalPerms[entry.email] = role;
      }
    });
    setSharedMembers(workspaceIds);
    setExternalGuests(externalEmails);
    setMemberPermissions(perms);
    setExternalPermissions(externalPerms);
    setLinkRole((doc.link_role as any) || 'viewer');
    setShareLinkEnabled(doc.sharing === 'public');
  }, [doc.id, doc.shared_with, doc.link_role, doc.sharing]);

  const syncSharing = (
    nextSharedMembers = sharedMembers,
    nextExternalGuests = externalGuests,
    nextMemberPermissions = memberPermissions,
    nextExternalPermissions = externalPermissions,
    nextLinkRole = linkRole,
    nextSharing = sharing
  ) => {
    const sharedWith = [
      ...nextSharedMembers.map(id => ({
        member_id: id,
        email: members.find(m => m.id === id)?.email || '',
        role: nextMemberPermissions[id] || 'viewer'
      })),
      ...nextExternalGuests.map(email => ({
        email,
        role: nextExternalPermissions[email] || 'viewer'
      }))
    ].filter(entry => entry.email);
    updateDocMutation.mutate({
      id: doc.id,
      data: { shared_with: sharedWith, link_role: nextLinkRole, sharing: nextSharing } as any
    });
  };

  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  // Mutations
  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Doc> }) => docsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      queryClient.invalidateQueries({ queryKey: ['doc', doc.id] });
      queryClient.invalidateQueries({ queryKey: ['public-doc', doc.id] });
      setIsSaving(false);
    },
    onError: () => setIsSaving(false)
  });

  const createPageMutation = useMutation({
    mutationFn: docPagesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doc-pages', doc.id] });
      toast.success('Page added');
    }
  });

  const updatePageMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DocPage> }) => docPagesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doc-pages', doc.id] });
      queryClient.invalidateQueries({ queryKey: ['doc', doc.id] });
      queryClient.invalidateQueries({ queryKey: ['public-doc', doc.id] });
    }
  });

  const deletePageMutation = useMutation({
    mutationFn: docPagesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doc-pages', doc.id] });
      if (selectedPageId) setSelectedPageId(null);
      toast.success('Page deleted');
    }
  });

  // Initialize content
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.innerHTML = doc.content || '';
    }
    contentValue.current = doc.content || '';
  }, [doc.id]);

  // Ensure the editor is focused when opening or switching pages
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.focus();
    }
  }, [doc.id, selectedPageId]);

  // Update last_viewed_at when opening
  useEffect(() => {
    docsApi.update(doc.id, { last_viewed_at: new Date().toISOString() } as any);
  }, [doc.id]);

  // Auto-save
  const triggerAutoSave = useCallback(() => {
    if (readOnly) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(true);
      if (selectedPageId) {
        updatePageMutation.mutate({
          id: selectedPageId,
          data: { title: pageTitleRef.current, content: pageContentRef.current }
        }, { onSettled: () => setIsSaving(false) });
      } else {
        updateDocMutation.mutate({
          id: doc.id,
          data: { name: title, content: contentValue.current }
        });
      }
    }, 1500);
  }, [title, doc.id, selectedPageId]);

  // Manual save (for explicit Save button)
  const handleManualSave = useCallback(() => {
    if (readOnly) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);
    if (selectedPageId) {
      updatePageMutation.mutate({
        id: selectedPageId,
        data: { title: pageTitleRef.current, content: pageContentRef.current }
      }, {
        onSuccess: () => { setIsSaving(false); toast.success('Document saved'); },
        onError: () => { setIsSaving(false); toast.error('Failed to save'); }
      });
    } else {
      updateDocMutation.mutate({
        id: doc.id,
        data: { name: title, content: contentValue.current }
      }, {
        onSuccess: () => { setIsSaving(false); toast.success('Document saved'); },
        onError: () => { setIsSaving(false); toast.error('Failed to save'); }
      });
    }
  }, [title, doc.id, selectedPageId, readOnly]);

  // Save and close
  const handleClose = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (readOnly) {
      onClose();
      return;
    }
    if (selectedPageId) {
      updatePageMutation.mutate({
        id: selectedPageId,
        data: { title: pageTitleRef.current, content: pageContentRef.current }
      });
    } else {
      updateDocMutation.mutate({
        id: doc.id,
        data: { name: title, content: contentValue.current }
      });
    }
    onClose();
  };

  const ensureHeadingToggles = () => {
    if (!contentRef.current) return;
    const headings = contentRef.current.querySelectorAll('h1, h2, h3');
    headings.forEach((heading) => {
      const isTopLevel = heading.parentElement === contentRef.current;
      if (!isTopLevel) {
        heading.classList.remove('doc-heading');
        const existing = heading.querySelector(':scope > .doc-heading-toggle');
        if (existing) {
          existing.remove();
        }
        return;
      }
      if (!heading.textContent || !heading.textContent.trim()) {
        return;
      }
      heading.classList.add('doc-heading');
      const first = heading.firstChild;
      if (!(first instanceof HTMLElement) || !first.classList.contains('doc-heading-toggle')) {
        const toggle = document.createElement('span');
        toggle.className = 'doc-heading-toggle';
        toggle.setAttribute('contenteditable', 'false');
        toggle.setAttribute('aria-hidden', 'true');
        heading.insertBefore(toggle, heading.firstChild);
      }
    });
  };

  const handleContentInput = () => {
    if (readOnly) return;
    if (contentRef.current) {
      ensureHeadingToggles();
      if (selectedPageId) {
        pageContentRef.current = contentRef.current.innerHTML;
      } else {
        contentValue.current = contentRef.current.innerHTML;
      }
      triggerAutoSave();
    }
  };

  // Switch to page
  const selectPage = (page: DocPage) => {
    // Save current content first
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (readOnly) {
      setSelectedPageId(page.id);
      pageTitleRef.current = page.title;
      pageContentRef.current = page.content;
      setTitle(page.title);
      if (contentRef.current) {
        contentRef.current.innerHTML = page.content || '';
      }
      return;
    }
    if (selectedPageId) {
      updatePageMutation.mutate({
        id: selectedPageId,
        data: { title: pageTitleRef.current, content: pageContentRef.current }
      });
    } else {
      updateDocMutation.mutate({
        id: doc.id,
        data: { name: title, content: contentValue.current }
      });
    }

    setSelectedPageId(page.id);
    pageTitleRef.current = page.title;
    pageContentRef.current = page.content;
    setTitle(page.title);
    if (contentRef.current) {
      contentRef.current.innerHTML = page.content || '';
    }
  };

  // Switch back to doc
  const selectDoc = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (readOnly) {
      setSelectedPageId(null);
      setTitle(doc.name);
      if (contentRef.current) {
        contentRef.current.innerHTML = contentValue.current || '';
      }
      return;
    }
    if (selectedPageId) {
      updatePageMutation.mutate({
        id: selectedPageId,
        data: { title: pageTitleRef.current, content: pageContentRef.current }
      });
    }
    setSelectedPageId(null);
    setTitle(doc.name);
    if (contentRef.current) {
      contentRef.current.innerHTML = contentValue.current || '';
    }
  };

  const handleTitleChange = (newTitle: string) => {
    if (readOnly) return;
    setTitle(newTitle);
    if (selectedPageId) {
      pageTitleRef.current = newTitle;
    }
    triggerAutoSave();
  };

  // Format commands
  const execCommand = (command: string, value?: string) => {
    if (readOnly) return;
    document.execCommand(command, false, value);
    contentRef.current?.focus();
    handleContentInput();
  };

  // Insert HTML at cursor position
  const insertHTML = (html: string) => {
    if (readOnly) return;
    document.execCommand('insertHTML', false, html);
    contentRef.current?.focus();
    handleContentInput();
  };

  // Handle paste - sanitize content from ClickUp and other sources
  const handlePaste = (e: React.ClipboardEvent) => {
    if (readOnly) return;
    e.preventDefault();

    // Try to get HTML content first
    const html = e.clipboardData.getData('text/html');
    const plainText = e.clipboardData.getData('text/plain');

    if (html) {
      // First, sanitize with DOMPurify to prevent XSS
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li',
                       'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
                       'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr', 'del', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'target'],
        ALLOW_DATA_ATTR: false,
      });

      // Create a temporary element to parse and clean HTML
      const temp = document.createElement('div');
      temp.innerHTML = sanitizedHtml;

      // COMPLETELY remove ALL style attributes from ALL elements
      const allElements = temp.querySelectorAll('*');
      allElements.forEach((el) => {
        if (el instanceof HTMLElement) {
          // Remove ALL inline styles completely
          el.removeAttribute('style');
          // Remove ALL classes
          el.removeAttribute('class');
          // Remove data attributes
          Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
              el.removeAttribute(attr.name);
            }
          });
        }
      });

      // Convert divs inside list items to just their content (but preserve nested lists)
      const liDivs = temp.querySelectorAll('li > div');
      liDivs.forEach((div) => {
        const parent = div.parentElement;
        if (parent) {
          while (div.firstChild) {
            parent.insertBefore(div.firstChild, div);
          }
          div.remove();
        }
      });

      // Convert spans to their text content (remove span wrappers)
      const spans = temp.querySelectorAll('span');
      spans.forEach((span) => {
        const parent = span.parentNode;
        if (parent) {
          while (span.firstChild) {
            parent.insertBefore(span.firstChild, span);
          }
          span.remove();
        }
      });

      // Remove empty elements (but not empty li which might have nested ul)
      const emptyElements = temp.querySelectorAll('div:empty, span:empty, p:empty');
      emptyElements.forEach(el => el.remove());

      // Convert remaining divs to paragraphs for proper text flow
      const divs = temp.querySelectorAll('div');
      divs.forEach((div) => {
        // Don't convert if it contains block elements
        const hasBlockChildren = div.querySelector('p, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, pre, table');
        if (!hasBlockChildren && div.textContent?.trim()) {
          const p = document.createElement('p');
          p.innerHTML = div.innerHTML;
          div.parentNode?.replaceChild(p, div);
        }
      });

      // Normalize the HTML
      let cleanedHtml = temp.innerHTML
        // Remove zero-width spaces
        .replace(/\u200B/g, '')
        // Convert double br to paragraph breaks
        .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '</p><p>')
        // Clean up empty paragraphs
        .replace(/<p>\s*<\/p>/gi, '')
        // Clean excessive whitespace
        .replace(/\s+/g, ' ')
        .trim();

      // Insert the cleaned HTML
      document.execCommand('insertHTML', false, cleanedHtml);
    } else if (plainText) {
      // Fallback to plain text - sanitize to prevent XSS
      const sanitizedText = DOMPurify.sanitize(plainText, { ALLOWED_TAGS: [] });
      if (isLikelyMarkdown(sanitizedText)) {
        const converted = markdownToHtml(sanitizedText);
        document.execCommand('insertHTML', false, converted);
      } else {
        // Convert line breaks to proper HTML
        const htmlContent = sanitizedText
          .split('\n\n')
          .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
          .join('');
        document.execCommand('insertHTML', false, htmlContent);
      }
    }

    contentRef.current?.focus();
    handleContentInput();
  };

  // Table editing functions
  const getTableFromSelection = (): { table: HTMLTableElement | null; cell: HTMLTableCellElement | null } => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return { table: null, cell: null };

    let node: Node | null = selection.anchorNode;
    let cell: HTMLTableCellElement | null = null;
    let table: HTMLTableElement | null = null;

    while (node && node !== contentRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        cell = node as HTMLTableCellElement;
      }
      if (node.nodeName === 'TABLE') {
        table = node as HTMLTableElement;
        break;
      }
      node = node.parentNode;
    }

    return { table, cell };
  };

  const handleTableClick = (e: React.MouseEvent) => {
    // First try to get table from click target (more reliable)
    let target = e.target as HTMLElement;
    let cell: HTMLTableCellElement | null = null;
    let table: HTMLTableElement | null = null;

    while (target && target !== contentRef.current) {
      if (target.tagName === 'TD' || target.tagName === 'TH') {
        cell = target as HTMLTableCellElement;
      }
      if (target.tagName === 'TABLE') {
        table = target as HTMLTableElement;
        break;
      }
      target = target.parentElement as HTMLElement;
    }

    // Fallback to selection-based detection
    if (!table || !cell) {
      const result = getTableFromSelection();
      table = result.table;
      cell = result.cell;
    }

    if (table && cell) {
      setActiveTable(table);
      setActiveCell(cell);
      // Close any open dropdowns when clicking a different cell
      setShowTableOptions(false);
      setShowCellColorPicker(false);
      const rect = table.getBoundingClientRect();
      const editorRect = contentRef.current?.getBoundingClientRect();
      if (editorRect) {
        // Calculate position relative to content area, ensure toolbar is visible
        let top = rect.top - editorRect.top - 40;
        // If toolbar would go above the content area, show it just above the table
        if (top < 0) top = 0;
        setTableToolbarPosition({
          top,
          left: Math.max(0, rect.left - editorRect.left)
        });
        setShowTableToolbar(true);
      }
    } else {
      setShowTableToolbar(false);
      setShowTableOptions(false);
      setShowCellColorPicker(false);
      setActiveTable(null);
      setActiveCell(null);
    }
  };

  const getHeadingLevel = (el: HTMLElement) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1') return 1;
    if (tag === 'h2') return 2;
    if (tag === 'h3') return 3;
    return 0;
  };

  const toggleHeadingCollapse = (heading: HTMLElement) => {
    if (!contentRef.current) return;
    const level = getHeadingLevel(heading);
    if (!level) return;

    const isCollapsed = heading.dataset.collapsed === 'true';
    const nextState = !isCollapsed;
    heading.dataset.collapsed = nextState ? 'true' : 'false';

    // Hide/show all nodes until the next heading of same or higher level
    let node = heading.nextElementSibling;
    while (node) {
      if (node instanceof HTMLElement) {
        const nodeLevel = getHeadingLevel(node);
        if (nodeLevel && nodeLevel <= level) {
          break;
        }
        if (nextState) {
          node.classList.add('doc-collapsed-content');
        } else {
          node.classList.remove('doc-collapsed-content');
        }
      }
      node = node.nextElementSibling;
    }
  };

  const handleHeadingToggle = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!contentRef.current) return;
    if (target.classList.contains('doc-heading-toggle')) {
      const heading = target.parentElement as HTMLElement | null;
      if (heading) {
        e.preventDefault();
        e.stopPropagation();
        toggleHeadingCollapse(heading);
      }
    }
  };

  const addTableRow = (position: 'above' | 'below') => {
    if (!activeTable || !activeCell) return;
    const row = activeCell.parentElement as HTMLTableRowElement;
    if (!row) return;

    const newRow = document.createElement('tr');
    const cellCount = row.cells.length;
    for (let i = 0; i < cellCount; i++) {
      const newCell = document.createElement('td');
      newCell.className = 'border border-slate-600 p-2';
      newCell.textContent = '';
      newRow.appendChild(newCell);
    }

    if (position === 'above') {
      row.parentNode?.insertBefore(newRow, row);
    } else {
      row.parentNode?.insertBefore(newRow, row.nextSibling);
    }
    handleContentInput();
  };

  const addTableColumn = (position: 'left' | 'right') => {
    if (!activeTable || !activeCell) return;
    const cellIndex = activeCell.cellIndex;
    const rows = activeTable.rows;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const isHeader = i === 0;
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      newCell.className = isHeader
        ? 'border border-slate-600 p-2 bg-slate-800'
        : 'border border-slate-600 p-2';
      newCell.textContent = isHeader ? 'Header' : '';

      const refCell = row.cells[position === 'left' ? cellIndex : cellIndex + 1];
      if (refCell) {
        row.insertBefore(newCell, refCell);
      } else {
        row.appendChild(newCell);
      }
    }
    handleContentInput();
  };

  const deleteTableRow = () => {
    if (!activeCell) return;
    const row = activeCell.parentElement as HTMLTableRowElement;
    if (!row) return;

    const table = row.parentElement?.parentElement as HTMLTableElement;
    if (table && table.rows.length > 1) {
      row.remove();
      handleContentInput();
      setShowTableToolbar(false);
    } else {
      toast.error('Cannot delete the last row');
    }
  };

  const deleteTableColumn = () => {
    if (!activeTable || !activeCell) return;
    const cellIndex = activeCell.cellIndex;
    const rows = activeTable.rows;

    if (rows[0] && rows[0].cells.length > 1) {
      for (let i = 0; i < rows.length; i++) {
        const cell = rows[i].cells[cellIndex];
        if (cell) cell.remove();
      }
      handleContentInput();
      setShowTableToolbar(false);
    } else {
      toast.error('Cannot delete the last column');
    }
  };

  const deleteTable = () => {
    if (!activeTable) return;
    activeTable.remove();
    handleContentInput();
    setShowTableToolbar(false);
    setActiveTable(null);
    setActiveCell(null);
  };

  const setCellColor = (color: string) => {
    if (!activeCell) return;
    if (color === 'transparent') {
      activeCell.style.backgroundColor = '';
    } else {
      activeCell.style.backgroundColor = color;
    }
    handleContentInput();
    setShowCellColorPicker(false);
  };

  const setColumnColor = (color: string) => {
    if (!activeTable || !activeCell) return;
    const cellIndex = activeCell.cellIndex;
    const rows = activeTable.rows;
    for (let i = 0; i < rows.length; i++) {
      const cell = rows[i].cells[cellIndex];
      if (cell) {
        if (color === 'transparent') {
          cell.style.backgroundColor = '';
        } else {
          cell.style.backgroundColor = color;
        }
      }
    }
    handleContentInput();
    setShowCellColorPicker(false);
  };

  // Column resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent, table: HTMLTableElement, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = table.rows[0]?.cells[colIndex];
    if (!cell) return;

    setIsResizing(true);
    setResizeColumnIndex(colIndex);
    setResizeStartX(e.clientX);
    setResizeStartWidth(cell.offsetWidth);
    resizeTableRef.current = table;
  };

  // Global mouse move/up for resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || resizeColumnIndex === null || !resizeTableRef.current) return;

      const diff = e.clientX - resizeStartX;
      const newWidth = Math.max(50, resizeStartWidth + diff); // Minimum 50px width

      // Update all cells in this column
      const rows = resizeTableRef.current.rows;
      for (let i = 0; i < rows.length; i++) {
        const cell = rows[i].cells[resizeColumnIndex];
        if (cell) {
          cell.style.width = `${newWidth}px`;
          cell.style.minWidth = `${newWidth}px`;
        }
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        setResizeColumnIndex(null);
        resizeTableRef.current = null;
        handleContentInput();
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeColumnIndex, resizeStartX, resizeStartWidth]);

  // Add resize handles to tables when content changes or toolbar appears
  useEffect(() => {
    const addResizeHandles = () => {
      if (!contentRef.current) return;

      const tables = contentRef.current.querySelectorAll('table');
      tables.forEach((table) => {
        // Remove existing resize handles
        table.querySelectorAll('.col-resize-handle').forEach(h => h.remove());

        // Make table layout fixed for resizing
        (table as HTMLTableElement).style.tableLayout = 'fixed';

        const headerRow = table.rows[0];
        if (!headerRow) return;

        for (let i = 0; i < headerRow.cells.length; i++) {
          const cell = headerRow.cells[i];
          cell.style.position = 'relative';

          // Add resize handle to the right edge of each cell (except last)
          if (i < headerRow.cells.length - 1) {
            const handle = document.createElement('div');
            handle.className = 'col-resize-handle';
            handle.style.cssText = `
              position: absolute;
              right: -3px;
              top: 0;
              bottom: 0;
              width: 6px;
              cursor: col-resize;
              background: transparent;
              z-index: 10;
            `;
            handle.onmouseenter = () => { handle.style.background = 'rgba(139, 92, 246, 0.5)'; };
            handle.onmouseleave = () => { if (!isResizing) handle.style.background = 'transparent'; };
            handle.onmousedown = (e) => handleResizeMouseDown(e as unknown as React.MouseEvent, table as HTMLTableElement, i);
            cell.appendChild(handle);
          }
        }
      });
    };

    // Add handles after a short delay to ensure DOM is updated
    const timeout = setTimeout(addResizeHandles, 100);
    return () => clearTimeout(timeout);
  }, [showTableToolbar, isResizing]);

  // Keyboard shortcuts handler
  const captureSlashAnchor = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      node = selection.anchorNode || node;
    }
    if (node.nodeType !== Node.TEXT_NODE || !(node as Text).textContent) return;
    const textNode = node as Text;
    const text = textNode.textContent || '';
    const cursorPos = range.startOffset;
    const slashPos = text.lastIndexOf('/', cursorPos);
    if (slashPos >= 0) {
      slashCommandAnchorRef.current = { node: textNode, slashPos };
    }
  };

  const removeSlashCommandText = () => {
    const anchor = slashCommandAnchorRef.current;
    if (anchor && anchor.node.isConnected && contentRef.current) {
      const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT);
      walker.currentNode = anchor.node;
      const startNode = anchor.node;
      const startOffset = Math.max(0, Math.min(anchor.slashPos, startNode.textContent?.length || 0));
      let endNode: Text = startNode;
      let endOffset = startOffset;
      let node: Text | null = startNode;
      let foundEnd = false;

      while (node && !foundEnd) {
        const text = node.textContent || '';
        let i = node === startNode ? startOffset : 0;
        while (i < text.length) {
          if (/\s/.test(text[i])) {
            endNode = node;
            endOffset = i;
            foundEnd = true;
            break;
          }
          i += 1;
        }
        if (!foundEnd) {
          const next = walker.nextNode() as Text | null;
          if (!next) {
            endNode = node;
            endOffset = text.length;
            foundEnd = true;
            break;
          }
          node = next;
        }
      }

      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      range.deleteContents();
      slashCommandAnchorRef.current = null;
      return;
    }
    // Fallback to current selection if anchor is missing
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      node = selection.anchorNode || node;
    }
    if (node.nodeType !== Node.TEXT_NODE || !(node as Text).textContent) return;
    const textNode = node as Text;
    const text = textNode.textContent || '';
    const cursorPos = range.startOffset;
    const slashPos = text.lastIndexOf('/', cursorPos);
    if (slashPos < 0) return;
    let end = slashPos + 1;
    while (end < text.length && !/\s/.test(text[end])) {
      end += 1;
    }
    range.setStart(textNode, slashPos);
    range.setEnd(textNode, end);
    range.deleteContents();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (readOnly) return;

    const getTextNodeAtCursor = () => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return null;
      let node = selection.anchorNode;
      let offset = selection.anchorOffset;
      if (!node) return null;
      if (node.nodeType === Node.TEXT_NODE) {
        return { node: node as Text, offset };
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const candidate = el.childNodes[offset - 1] || el.childNodes[offset] || el.lastChild;
        const findTextNode = (n: Node | null): Text | null => {
          if (!n) return null;
          if (n.nodeType === Node.TEXT_NODE) return n as Text;
          let cur: Node | null = n.lastChild;
          while (cur) {
            if (cur.nodeType === Node.TEXT_NODE) return cur as Text;
            cur = cur.lastChild;
          }
          return null;
        };
        const textNode = findTextNode(candidate);
        if (!textNode) return null;
        const textLen = textNode.textContent?.length ?? 0;
        return { node: textNode, offset: Math.min(textLen, textLen) };
      }
      return null;
    };

    const tryInlineMarkdown = () => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return false;
      const resolved = getTextNodeAtCursor();
      if (!resolved) return false;
      const { node: container, offset: cursorPos } = resolved;

      const rawText = container.textContent || '';
      const text = rawText.replace(/\u00A0/g, ' ').replace(/\u200B/g, '');
      const beforeCursor = text.substring(0, cursorPos);

      // Bold: **text**
      const boldMatch = beforeCursor.match(/\*\*\s*([^*]+?)\s*\*\*$/);
      if (boldMatch) {
        const start = cursorPos - boldMatch[0].length;
        const range = selection.getRangeAt(0);
        range.setStart(container, start);
        range.setEnd(container, cursorPos);
        range.deleteContents();
        insertHTML(`<strong>${boldMatch[1].trim()}</strong>&nbsp;`);
        return true;
      }

      // Italic: *text* or _text_
      const italicMatch =
        beforeCursor.match(/(?:^|[^*])\*\s*([^*]+?)\s*\*$/) ||
        beforeCursor.match(/_\s*([^_]+?)\s*_$/);
      if (italicMatch) {
        const fullMatch = italicMatch[0].startsWith('*') || italicMatch[0].startsWith('_') ? italicMatch[0] : italicMatch[0].slice(1);
        const start = cursorPos - fullMatch.length;
        const range = selection.getRangeAt(0);
        range.setStart(container, start);
        range.setEnd(container, cursorPos);
        range.deleteContents();
        insertHTML(`<em>${italicMatch[1].trim()}</em>&nbsp;`);
        return true;
      }

      // Strikethrough: ~~text~~
      const strikeMatch = beforeCursor.match(/~~\s*([^~]+?)\s*~~$/);
      if (strikeMatch) {
        const start = cursorPos - strikeMatch[0].length;
        const range = selection.getRangeAt(0);
        range.setStart(container, start);
        range.setEnd(container, cursorPos);
        range.deleteContents();
        insertHTML(`<del>${strikeMatch[1].trim()}</del>&nbsp;`);
        return true;
      }

      // Inline code: `text`
      const codeMatch = beforeCursor.match(/`\s*([^`]+?)\s*`$/);
      if (codeMatch) {
        const start = cursorPos - codeMatch[0].length;
        const range = selection.getRangeAt(0);
        range.setStart(container, start);
        range.setEnd(container, cursorPos);
        range.deleteContents();
        insertHTML(`<code class="bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-pink-400">${codeMatch[1].trim()}</code>&nbsp;`);
        return true;
      }

      // Link: [text](url)
      const linkMatch = beforeCursor.match(/\[\s*([^\]]+?)\s*\]\(\s*([^)]+?)\s*\)$/);
      if (linkMatch) {
        const start = cursorPos - linkMatch[0].length;
        const range = selection.getRangeAt(0);
        range.setStart(container, start);
        range.setEnd(container, cursorPos);
        range.deleteContents();
        insertHTML(`<a href="${linkMatch[2].trim()}" class="text-blue-400 hover:underline" target="_blank">${linkMatch[1].trim()}</a>&nbsp;`);
        return true;
      }

      // Image: ![alt](url)
      const imageMatch = beforeCursor.match(/!\[\s*([^\]]*?)\s*\]\(\s*([^)]+?)\s*\)$/);
      if (imageMatch) {
        const start = cursorPos - imageMatch[0].length;
        const range = selection.getRangeAt(0);
        range.setStart(container, start);
        range.setEnd(container, cursorPos);
        range.deleteContents();
        insertHTML(`<img src="${imageMatch[2].trim()}" alt="${imageMatch[1].trim()}" class="max-w-full h-auto rounded my-2" />&nbsp;`);
        return true;
      }

      // Bold italic: ***text***
      const boldItalicMatch = beforeCursor.match(/\*\*\*\s*([^*]+?)\s*\*\*\*$/);
      if (boldItalicMatch) {
        const start = cursorPos - boldItalicMatch[0].length;
        const range = selection.getRangeAt(0);
        range.setStart(container, start);
        range.setEnd(container, cursorPos);
        range.deleteContents();
        insertHTML(`<strong><em>${boldItalicMatch[1].trim()}</em></strong>&nbsp;`);
        return true;
      }

      return false;
    };

    // Handle slash menu navigation (do not block normal typing)
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex(i => Math.min(i + 1, filteredSlashCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSlashCommands[selectedSlashIndex]) {
          removeSlashCommandText();
          filteredSlashCommands[selectedSlashIndex].action();
          setShowSlashMenu(false);
          setSlashFilter('');
          setSelectedSlashIndex(0);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        setSlashFilter('');
        setSelectedSlashIndex(0);
        slashCommandAnchorRef.current = null;
        return;
      }
      if (e.key === 'Backspace') {
        // Allow native backspace to delete text in the editor
        if (slashFilter.length === 0) {
          setShowSlashMenu(false);
          slashCommandAnchorRef.current = null;
        } else {
          setSlashFilter(f => f.slice(0, -1));
          setTimeout(captureSlashAnchor, 0);
        }
        return;
      }
      if (e.key === ' ') {
        // Space closes the slash menu (commands don't have spaces)
        setShowSlashMenu(false);
        setSlashFilter('');
        setSelectedSlashIndex(0);
        slashCommandAnchorRef.current = null;
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // Let the character be typed into the editor and just update filter
        const nextFilter = slashFilter + e.key;
        setSlashFilter(nextFilter);
        setSelectedSlashIndex(0);
        setTimeout(captureSlashAnchor, 0);
        // Auto-close if filter is long and no commands match
        if (nextFilter.length > 3) {
          const q = nextFilter.toLowerCase();
          const hasMatch = slashCommands.some(cmd =>
            cmd.label.toLowerCase().includes(q) || cmd.section.toLowerCase().includes(q)
          );
          if (!hasMatch) {
            setShowSlashMenu(false);
            setSlashFilter('');
            setSelectedSlashIndex(0);
            slashCommandAnchorRef.current = null;
          }
        }
        return;
      }
    }

    // Detect / to open slash menu
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      try {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const editorEl = contentRef.current;
        if (!editorEl || !editorEl.contains(range.startContainer)) return;
        const editorRect = editorEl.getBoundingClientRect();
        if (!editorRect) return;
        const rects = range.getClientRects();
        const caretRect = rects && rects.length > 0 ? rects[0] : range.getBoundingClientRect();
        const menuWidth = 360;
        const menuHeight = 420;
        const desiredLeft = caretRect.left - editorRect.left;
        const desiredTop = caretRect.bottom - editorRect.top + 10;
        const clampedLeft = Math.max(8, Math.min(desiredLeft, editorRect.width - menuWidth - 8));
        const clampedTop = Math.max(8, Math.min(desiredTop, editorRect.height - menuHeight - 8));
        setSlashMenuPosition({
          top: Number.isFinite(clampedTop) ? clampedTop : 8,
          left: Number.isFinite(clampedLeft) ? clampedLeft : 8
        });
        setTimeout(() => {
          setShowSlashMenu(true);
          setSlashFilter('');
          setSelectedSlashIndex(0);
          captureSlashAnchor();
        }, 10);
      } catch (err) {
        console.error('Failed to open slash menu:', err);
        setShowSlashMenu(false);
        setSlashFilter('');
        setSelectedSlashIndex(0);
        slashCommandAnchorRef.current = null;
      }
    }

    // Ctrl/Cmd + B = Bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      execCommand('bold');
      return;
    }
    // Ctrl/Cmd + I = Italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      execCommand('italic');
      return;
    }
    // Ctrl/Cmd + U = Underline
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      execCommand('underline');
      return;
    }
    // Ctrl/Cmd + Shift + S = Strikethrough
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
      e.preventDefault();
      execCommand('strikeThrough');
      return;
    }
    // Ctrl/Cmd + Shift + C = Code
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'c') {
      e.preventDefault();
      const selection = window.getSelection();
      if (selection && selection.toString()) {
        insertHTML(`<code class="bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-pink-400">${selection.toString()}</code>`);
      }
      return;
    }
    // Ctrl/Cmd + K = Link
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const url = prompt('Enter URL:');
      if (url) {
        execCommand('createLink', url);
      }
      return;
    }

    // Handle Tab / Shift+Tab for list indentation (sub-points)
    if (e.key === 'Tab') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount) {
        const node = selection.anchorNode;
        // Check if cursor is inside a list item
        let el: Node | null = node;
        let insideList = false;
        while (el && el !== contentRef.current) {
          if (el.nodeName === 'LI') {
            insideList = true;
            break;
          }
          el = el.parentNode;
        }
        if (insideList) {
          e.preventDefault();
          if (e.shiftKey) {
            execCommand('outdent');
          } else {
            execCommand('indent');
          }
          return;
        }
      }
    }

    // Handle Enter key for slash commands + markdown line conversions
    if (e.key === 'Enter' && !e.shiftKey) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      // If cursor is inside a list item, let the browser handle Enter naturally
      // (it will create a new <li> at the same nesting level)
      let cursorNode: Node | null = selection.anchorNode;
      let insideListItem = false;
      while (cursorNode && cursorNode !== contentRef.current) {
        if (cursorNode.nodeName === 'LI') {
          insideListItem = true;
          break;
        }
        cursorNode = cursorNode.parentNode;
      }
      if (insideListItem) {
        // Let browser handle it — creates new <li> in same list
        return;
      }

      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      const textNode = container.nodeType === Node.TEXT_NODE ? container : null;

      if (textNode && textNode.textContent) {
        const text = textNode.textContent;
        const cursorPos = range.startOffset;
        const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
        const lineText = text.substring(lineStart, cursorPos);

        // Slash command without opening menu (e.g., /table + Enter)
        if (lineText.trim().startsWith('/')) {
          const token = lineText.trim().slice(1);
          const cmd = findSlashCommand(token);
          if (cmd) {
            e.preventDefault();
            range.setStart(textNode, lineStart);
            range.setEnd(textNode, cursorPos);
            range.deleteContents();
            cmd.action();
            setShowSlashMenu(false);
            setSlashFilter('');
            setSelectedSlashIndex(0);
            return;
          }
        }

        // Helper: find the closest previous sibling element (skipping text nodes)
        const findPreviousElement = (node: Node): Element | null => {
          // Walk up to find the block-level parent of this text node
          let block: Node | null = node.parentNode;
          while (block && block !== contentRef.current) {
            if (block.nodeType === Node.ELEMENT_NODE) {
              const el = block as Element;
              const tag = el.tagName;
              if (['P', 'DIV', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE'].includes(tag)) {
                break;
              }
            }
            block = block.parentNode;
          }
          // Now look at previousSibling of the text node itself (or its block parent)
          let target: Node | null = (block && block !== contentRef.current) ? block : node;
          let prev = target.previousSibling;
          while (prev) {
            if (prev.nodeType === Node.ELEMENT_NODE) return prev as Element;
            prev = prev.previousSibling;
          }
          return null;
        };

        // Check for markdown patterns at line start
        let replacement: { html: string; deleteChars: number } | null = null;
        let appendToList: { tag: 'UL' | 'OL'; content: string } | null = null;

        // Headers: # ## ### #### ##### ######
        if (/^#{1,6}\s/.test(lineText)) {
          const level = lineText.match(/^(#{1,6})/)?.[1].length || 1;
          const content = lineText.replace(/^#{1,6}\s/, '');
          const tag = `h${level}`;
          replacement = { html: `<${tag}>${content}</${tag}>`, deleteChars: lineText.length };
        }
        // Checkbox unchecked: - [ ]
        else if (/^-\s\[\s\]\s/.test(lineText)) {
          const content = lineText.replace(/^-\s\[\s\]\s/, '');
          replacement = { html: `<div class="flex items-start gap-2 my-1"><input type="checkbox" class="mt-1 accent-violet-500" /><span>${content}</span></div>`, deleteChars: lineText.length };
        }
        // Checkbox checked: - [x]
        else if (/^-\s\[x\]\s/i.test(lineText)) {
          const content = lineText.replace(/^-\s\[x\]\s/i, '');
          replacement = { html: `<div class="flex items-start gap-2 my-1"><input type="checkbox" checked class="mt-1 accent-violet-500" /><span class="line-through text-slate-500">${content}</span></div>`, deleteChars: lineText.length };
        }
        // Bullet list: - or *
        else if (/^[-*]\s/.test(lineText)) {
          const content = lineText.replace(/^[-*]\s/, '');
          // Check if previous element is a <ul> — append to it
          const prevEl = findPreviousElement(textNode);
          if (prevEl && prevEl.tagName === 'UL') {
            appendToList = { tag: 'UL', content };
          } else {
            replacement = { html: `<ul><li>${content}</li></ul>`, deleteChars: lineText.length };
          }
        }
        // Numbered list: 1. 2. etc
        else if (/^\d+\.\s/.test(lineText)) {
          const content = lineText.replace(/^\d+\.\s/, '');
          // Check if previous element is an <ol> — append to it
          const prevEl = findPreviousElement(textNode);
          if (prevEl && prevEl.tagName === 'OL') {
            appendToList = { tag: 'OL', content };
          } else {
            replacement = { html: `<ol><li>${content}</li></ol>`, deleteChars: lineText.length };
          }
        }
        // Blockquote: >
        else if (/^>\s/.test(lineText)) {
          const content = lineText.replace(/^>\s/, '');
          replacement = { html: `<blockquote class="border-l-4 border-slate-500 pl-4 italic text-slate-400">${content}</blockquote>`, deleteChars: lineText.length };
        }
        // Horizontal rule: --- or ***
        else if (/^(---|\*\*\*)$/.test(lineText.trim())) {
          replacement = { html: '<hr class="border-slate-600 my-4" />', deleteChars: lineText.length };
        }
        // Code block: ```
        else if (/^```/.test(lineText)) {
          e.preventDefault();
          const lang = lineText.replace(/^```/, '').trim();
          replacement = {
            html: `<pre class="bg-slate-900 rounded-lg p-4 my-2 overflow-x-auto"><code class="text-sm font-mono text-slate-300" data-lang="${lang}"></code></pre>`,
            deleteChars: lineText.length
          };
        }

        // Append to existing list
        if (appendToList) {
          e.preventDefault();
          const prevEl = findPreviousElement(textNode);
          if (prevEl) {
            // Delete the markdown text
            range.setStart(textNode, lineStart);
            range.setEnd(textNode, cursorPos);
            range.deleteContents();
            // Remove leftover empty text node
            if (textNode.textContent === '') {
              textNode.parentNode?.removeChild(textNode);
            }
            // Append new <li> to the existing list
            const newLi = document.createElement('li');
            newLi.textContent = appendToList.content;
            prevEl.appendChild(newLi);
            // Place cursor at end of new <li>
            const newRange = document.createRange();
            newRange.selectNodeContents(newLi);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
          return;
        }

        if (replacement) {
          e.preventDefault();
          // Delete the markdown syntax and insert formatted HTML
          range.setStart(textNode, lineStart);
          range.setEnd(textNode, cursorPos);
          range.deleteContents();
          insertHTML(replacement.html);
          return;
        }
      }

      // Inline markdown on Enter (convert and then insert a newline)
      if (tryInlineMarkdown()) {
        e.preventDefault();
        insertHTML('<br />');
        return;
      }
    }

    // Handle Space key for inline markdown
    if (e.key === ' ') {
      if (tryInlineMarkdown()) {
        e.preventDefault();
        return;
      }
    }
  };

  // Tags
  const addTag = () => {
    if (!newTag.trim() || docTags.includes(newTag.trim())) return;
    const updated = [...docTags, newTag.trim()];
    setDocTags(updated);
    setNewTag('');
    updateDocMutation.mutate({ id: doc.id, data: { tags: updated } as any });
  };

  const removeTag = (tag: string) => {
    const updated = docTags.filter(t => t !== tag);
    setDocTags(updated);
    updateDocMutation.mutate({ id: doc.id, data: { tags: updated } as any });
  };

  // Sharing
  const updateSharing = (newSharing: 'public' | 'private' | 'workspace') => {
    setSharing(newSharing);
    updateDocMutation.mutate({ id: doc.id, data: { sharing: newSharing } as any });
    toast.success(`Doc is now ${newSharing}`);
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall back to execCommand below
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  // Toggle wiki
  const toggleWiki = () => {
    updateDocMutation.mutate({ id: doc.id, data: { is_wiki: !doc.is_wiki } as any });
    toast.success(doc.is_wiki ? 'Removed wiki status' : 'Marked as wiki');
  };

  // Toggle favorite
  const toggleFavorite = () => {
    updateDocMutation.mutate({ id: doc.id, data: { is_favorited: !doc.is_favorited } as any });
  };

  // Archive
  const archiveDoc = () => {
    updateDocMutation.mutate({ id: doc.id, data: { is_archived: true } as any });
    toast.success('Doc archived');
    onClose();
  };

  const rootPages = pages.filter(p => !p.parent_page_id);
  const getChildPages = (parentId: string) => pages.filter(p => p.parent_page_id === parentId);

  return (
    <div className={inline ? 'contents' : 'fixed inset-0 z-[200]'}>
      {/* Backdrop */}
      {inline ? (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={handleClose} />
      ) : (
        !minimalMode && <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      )}

      {/* Editor */}
      <div className={`${inline ? 'fixed inset-0 z-50 shadow-2xl animate-in slide-in-from-right duration-200' : minimalMode ? 'absolute inset-0' : 'absolute inset-6 lg:inset-10 rounded-2xl shadow-2xl z-10'} bg-gray-100 dark:bg-[#14151a] flex flex-col overflow-hidden`}>
        {/* Top toolbar */}
        <div className={`flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-[#1f2229] bg-gray-50 dark:bg-[#0f1012] ${minimalMode ? 'sticky top-0 z-10' : ''}`}>
          <div className="flex items-center gap-3">
            {!minimalMode && (
              <button onClick={() => setShowPagesSidebar(!showPagesSidebar)} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700">
                <FileText className="w-4 h-4" />
              </button>
            )}
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {selectedPageId ? (
                <span className="flex items-center gap-1">
                  <button onClick={selectDoc} className="hover:text-gray-900 dark:hover:text-white">{doc.name}</button>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-gray-900 dark:text-white">{title}</span>
                </span>
              ) : (
                <span className="text-gray-900 dark:text-white">{title || 'Untitled'}</span>
              )}
            </span>
            {isSaving && <span className="text-xs text-gray-500 dark:text-slate-500">Saving...</span>}
          </div>
          <div className="flex items-center gap-1">
            {/* Save button for shared edit mode */}
            {minimalMode && !readOnly && (
              <button
                onClick={handleManualSave}
                disabled={isSaving}
                className="px-3 py-1 bg-violet-600 text-white text-xs font-medium rounded hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save
                  </>
                )}
              </button>
            )}
            {!minimalMode && !readOnly && (
              <button
                onClick={() => setShowTagsDropdown(!showTagsDropdown)}
                className="px-2 py-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-1"
              >
                <Tag className="w-3.5 h-3.5" />
              </button>
            )}
            {!minimalMode && (
              <button
                onClick={() => {
                  const badge = sharing === 'private' ? 'Private' : sharing === 'public' ? 'Public' : 'Workspace';
                  setShowShareDialog(!showShareDialog);
                }}
                className="px-2.5 py-1 text-xs bg-gray-200 dark:bg-[#15161a] text-gray-600 dark:text-slate-300 rounded flex items-center gap-1"
              >
                {sharing === 'private' ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                {sharing === 'private' ? 'Private' : sharing === 'public' ? 'Public' : 'Workspace'}
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>
            )}
            {!minimalMode && (
              <button
                onClick={() => setShowShareDialog(!showShareDialog)}
                className="px-3 py-1 bg-violet-600 text-white text-xs font-medium rounded hover:bg-violet-700"
              >
                Share
              </button>
            )}
            {!minimalMode && (
              <button onClick={() => setShowSettingsMenu(!showSettingsMenu)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )}
            {!minimalMode && (
              <button onClick={toggleFavorite} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 ${doc.is_favorited ? 'text-yellow-400' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                <Star className="w-4 h-4" fill={doc.is_favorited ? 'currentColor' : 'none'} />
              </button>
            )}
            <button onClick={handleClose} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Format toolbar */}
        {!readOnly && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-gray-200 dark:border-[#1f2229] bg-gray-50/50 dark:bg-[#0f1012]/50">
          <button onClick={() => execCommand('bold')} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded" title="Bold (Ctrl+B)">
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => execCommand('italic')} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded" title="Italic (Ctrl+I)">
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => execCommand('underline')} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded" title="Underline (Ctrl+U)">
            <span className="text-xs font-medium underline">U</span>
          </button>
          <button onClick={() => execCommand('strikeThrough')} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded" title="Strikethrough (Ctrl+Shift+S)">
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#15161a] mx-1" />
          <button onClick={() => execCommand('formatBlock', 'h1')} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded" title="Heading 1 (# + space)">
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => execCommand('formatBlock', 'h2')} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded" title="Heading 2 (## + space)">
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => execCommand('formatBlock', 'h3')} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded" title="Heading 3 (### + space)">
            <Heading3 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#15161a] mx-1" />
          <button onClick={() => execCommand('insertUnorderedList')} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded" title="Bullet List (- + space)">
            <List className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => execCommand('insertOrderedList')} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded" title="Numbered List (1. + space)">
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#15161a] mx-1" />
          <button
            onClick={() => {
              const selection = window.getSelection();
              if (selection && selection.toString()) {
                insertHTML(`<code class="bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-pink-400">${selection.toString()}</code>`);
              } else {
                insertHTML('<code class="bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-pink-400">code</code>');
              }
            }}
            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
            title="Inline Code (`code`)"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertHTML('<pre class="bg-slate-900 rounded-lg p-4 my-2 overflow-x-auto"><code class="text-sm font-mono text-slate-300">// code block</code></pre>')}
            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
            title="Code Block (``` + enter)"
          >
            <span className="text-[10px] font-mono">{'{}'}</span>
          </button>
          <button
            onClick={() => insertHTML('<blockquote class="border-l-4 border-slate-500 pl-4 italic text-slate-400">quote</blockquote>')}
            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
            title="Blockquote (> + space)"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertHTML('<hr class="border-slate-600 my-4" />')}
            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
            title="Horizontal Rule (---)"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#15161a] mx-1" />
          <button
            onClick={() => {
              const url = prompt('Enter link URL:');
              if (url) execCommand('createLink', url);
            }}
            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
            title="Insert Link (Ctrl+K or [text](url))"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              const url = prompt('Enter image URL:');
              if (url) insertHTML(`<img src="${url}" alt="image" class="max-w-full h-auto rounded my-2" />`);
            }}
            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
            title="Insert Image (![alt](url))"
          >
            <Image className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1" />
          <span className="text-[10px] text-gray-500 dark:text-slate-500">Type / for commands</span>
        </div>
        )}

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Pages sidebar */}
          {!minimalMode && showPagesSidebar && (
            <div className="w-56 border-r border-gray-200 dark:border-[#1f2229] bg-gray-50 dark:bg-[#0f1012] flex flex-col">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {doc.name}
              </div>
              <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                {/* Doc root entry */}
                <button
                  onClick={selectDoc}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                    !selectedPageId ? 'bg-violet-600/20 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="truncate">{doc.name}</span>
                </button>

                {/* Pages */}
                {rootPages.map(page => {
                  const children = getChildPages(page.id);
                  const isExpanded = expandedPages[page.id];
                  return (
                    <div key={page.id}>
                      <div className={`flex items-center group ${
                        selectedPageId === page.id ? 'bg-violet-600/20 rounded' : ''
                      }`}>
                        {children.length > 0 && (
                          <button
                            onClick={() => setExpandedPages(prev => ({ ...prev, [page.id]: !prev[page.id] }))}
                            className="p-0.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                          >
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </button>
                        )}
                        <button
                          onClick={() => selectPage(page)}
                          className={`flex-1 text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                            selectedPageId === page.id ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{page.title}</span>
                        </button>
                        <button
                          onClick={() => deletePageMutation.mutate(page.id)}
                          className="p-1 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      {isExpanded && children.map(child => (
                        <div key={child.id} className="ml-4 flex items-center group">
                          <button
                            onClick={() => selectPage(child)}
                            className={`flex-1 text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${
                              selectedPageId === child.id ? 'bg-violet-600/20 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="truncate">{child.title}</span>
                          </button>
                          <button
                            onClick={() => deletePageMutation.mutate(child.id)}
                            className="p-1 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => createPageMutation.mutate({ doc_id: doc.id, title: 'Untitled' })}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700/50 border-t border-gray-200 dark:border-[#1f2229]"
              >
                <Plus className="w-3.5 h-3.5" /> Add page
              </button>
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 overflow-y-auto bg-white text-gray-900 dark:bg-[#111827] dark:text-white">
            {/* Cover image */}
            {doc.cover_image && !selectedPageId && (
              <div className="h-48 w-full overflow-hidden">
                <img src={doc.cover_image} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            <div className={`${minimalMode ? 'max-w-[900px]' : 'max-w-[720px]'} mx-auto px-8 py-6 relative`}>
              {/* Location badge - small top left */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setShowLocationPicker(true)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-[#14151a] hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-xs transition-colors group"
                >
                  {docSpace ? (
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center text-[8px] text-white font-bold flex-shrink-0"
                      style={{ backgroundColor: docSpace.color || '#6366f1' }}
                    >
                      {docSpace.name.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <FolderIcon className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                  )}
                  <span className="text-gray-600 dark:text-slate-400">
                    {docSpace?.name || 'No space'}{docFolder ? ` / ${docFolder.name}` : ''}
                  </span>
                </button>
              </div>

              {/* Action links - ClickUp style */}
              <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500 mb-3">
                <button className="hover:text-gray-600 dark:hover:text-slate-300 flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> Link Task or Doc
                </button>
                <button onClick={toggleWiki} className={`hover:text-gray-600 dark:hover:text-slate-300 flex items-center gap-1 ${doc.is_wiki ? 'text-green-400' : ''}`}>
                  <Bookmark className="w-3 h-3" /> Mark Wiki
                </button>
                <button className="hover:text-gray-600 dark:hover:text-slate-300 flex items-center gap-1">
                  <Image className="w-3 h-3" /> Add cover
                </button>
                <button onClick={() => setShowSettingsMenu(true)} className="hover:text-gray-600 dark:hover:text-slate-300 flex items-center gap-1">
                  <Settings className="w-3 h-3" /> Settings
                </button>
              </div>

              {/* Title - ClickUp style large */}
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full text-2xl font-semibold text-gray-900 dark:text-white bg-transparent border-none outline-none placeholder-gray-400 dark:placeholder-slate-600 mb-2"
                placeholder="Untitled"
                readOnly={readOnly}
              />

              {/* Meta info - ClickUp style inline */}
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 mb-6 pb-4 border-b border-gray-100 dark:border-[#1f2229]/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-[8px] text-white font-medium">👤</span>
                  </div>
                  <span>Owners: {doc.owner_name || (doc.owner_id ? (members.find(m => m.id === doc.owner_id)?.name || currentMember?.name || 'Unknown') : (currentMember?.name || 'Unknown'))}</span>
                </div>
                <span className="text-gray-300 dark:text-slate-600">•</span>
                <span>
                  Last Updated: {doc.updated_at ? new Date(doc.updated_at).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : 'Just now'} at {doc.updated_at ? new Date(doc.updated_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase() : ''}
                </span>
              </div>

              {/* Content editor wrapper with relative positioning for toolbar */}
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleAttachmentChange}
                />
                <div
                  ref={contentRef}
                  contentEditable={!readOnly}
                  onInput={handleContentInput}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onFocus={() => setShowToolbar(true)}
                  onBlur={() => setShowToolbar(false)}
                  onClick={(e) => {
                    handleTableClick(e);
                    handleHeadingToggle(e);
                    // Close slash menu when clicking in the editor
                    if (showSlashMenu) {
                      const target = e.target as HTMLElement;
                      if (!target.closest('[data-slash-menu]')) {
                        setShowSlashMenu(false);
                        setSlashFilter('');
                        setSelectedSlashIndex(0);
                        slashCommandAnchorRef.current = null;
                      }
                    }
                  }}
                  onMouseDown={() => {
                    if (contentRef.current) {
                      contentRef.current.focus();
                    }
                  }}
                  className="clickup-doc-content min-h-[400px] outline-none max-w-none"
                  suppressContentEditableWarning
                  data-placeholder="Write or type '/' for commands..."
                  tabIndex={0}
                />

              {/* Table Editing Toolbar - ClickUp/Notion Style */}
              {showTableToolbar && activeTable && (
                <div
                  className="absolute bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-md shadow-2xl flex items-center gap-0.5 p-1"
                  style={{ top: tableToolbarPosition.top, left: tableToolbarPosition.left, zIndex: 100 }}
                >
                  {/* Add Row */}
                  <button
                    onClick={() => addTableRow('below')}
                    className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                    title="Add row below"
                  >
                    <Rows3 className="w-4 h-4" />
                  </button>

                  {/* Add Column */}
                  <button
                    onClick={() => addTableColumn('right')}
                    className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                    title="Add column right"
                  >
                    <Columns3 className="w-4 h-4" />
                  </button>

                  {/* Table Options Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowTableOptions(!showTableOptions); setShowCellColorPicker(false); }}
                      className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-0.5"
                      title="Table options"
                    >
                      <Grid3X3 className="w-4 h-4" />
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showTableOptions && (
                      <div className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
                        <button
                          onClick={() => { addTableRow('above'); setShowTableOptions(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add row above
                        </button>
                        <button
                          onClick={() => { addTableRow('below'); setShowTableOptions(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add row below
                        </button>
                        <button
                          onClick={() => { addTableColumn('left'); setShowTableOptions(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add column left
                        </button>
                        <button
                          onClick={() => { addTableColumn('right'); setShowTableOptions(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add column right
                        </button>
                        <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                        <button
                          onClick={() => { deleteTableRow(); setShowTableOptions(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Delete row
                        </button>
                        <button
                          onClick={() => { deleteTableColumn(); setShowTableOptions(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Delete column
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Color Picker */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowCellColorPicker(!showCellColorPicker); setShowTableOptions(false); }}
                      className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-0.5"
                      title="Cell color"
                    >
                      <Paintbrush className="w-4 h-4" />
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showCellColorPicker && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 p-2">
                        <div className="text-xs text-gray-500 dark:text-slate-500 mb-2 px-1">Cell color</div>
                        <div className="grid grid-cols-5 gap-1 mb-3">
                          {cellColors.map((c) => (
                            <button
                              key={c.name}
                              onClick={() => setCellColor(c.color)}
                              className="w-7 h-7 rounded border border-gray-300 dark:border-[#1f2229] hover:border-gray-900 dark:hover:border-white transition-colors flex items-center justify-center"
                              style={{ backgroundColor: c.color === 'transparent' ? 'transparent' : c.color }}
                              title={c.name}
                            >
                              {c.color === 'transparent' && <X className="w-3 h-3 text-gray-500 dark:text-slate-500" />}
                            </button>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-500 mb-2 px-1">Column color</div>
                        <div className="grid grid-cols-5 gap-1">
                          {cellColors.map((c) => (
                            <button
                              key={`col-${c.name}`}
                              onClick={() => setColumnColor(c.color)}
                              className="w-7 h-7 rounded border border-gray-300 dark:border-[#1f2229] hover:border-gray-900 dark:hover:border-white transition-colors flex items-center justify-center"
                              style={{ backgroundColor: c.color === 'transparent' ? 'transparent' : c.color }}
                              title={`${c.name} (column)`}
                            >
                              {c.color === 'transparent' && <X className="w-3 h-3 text-gray-500 dark:text-slate-500" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sort Column */}
                  <button
                    onClick={() => toast.info('Sort feature coming soon')}
                    className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                    title="Sort column"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>

                  {/* Delete Table */}
                  <button
                    onClick={deleteTable}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
                    title="Delete table"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              {/* Placeholder style and table interaction styles */}
              <style>{`
                [data-placeholder]:empty::before {
                  content: attr(data-placeholder);
                  color: #4a5568;
                  cursor: text;
                }
                /* Table hover and selection styles */
                [contenteditable] table {
                  cursor: pointer;
                }
                [contenteditable] table td:hover,
                [contenteditable] table th:hover {
                  background-color: rgba(139, 92, 246, 0.1) !important;
                  outline: 1px solid rgba(139, 92, 246, 0.3);
                }
                [contenteditable] table:focus-within {
                  outline: 2px solid rgba(139, 92, 246, 0.5);
                  outline-offset: 2px;
                }
              `}</style>

              {/* Slash command menu */}
              {!readOnly && showSlashMenu && (
                <div
                  data-slash-menu
                  className="absolute bg-white dark:bg-[#0f1012] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-2xl z-50 w-[360px] max-h-[420px] overflow-y-auto"
                  style={{ top: slashMenuPosition.top, left: slashMenuPosition.left }}
                >
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#0f1012] sticky top-0 z-10">
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-md px-2 py-1.5">
                      <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400" />
                      <input
                        value={slashFilter}
                        onChange={(e) => { setSlashFilter(e.target.value); setSelectedSlashIndex(0); }}
                        placeholder="Search"
                        className="flex-1 bg-transparent text-xs text-gray-700 dark:text-slate-200 outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="py-2 px-2">
                    {groupedSlashCommands.length > 0 ? (
                      (() => {
                        let itemIndex = -1;
                        return groupedSlashCommands.map(group => (
                          <Fragment key={group.section}>
                            <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                              {group.section}
                            </div>
                            <div className="grid grid-cols-2 gap-1 px-1 pb-2">
                              {group.items.map(cmd => {
                                itemIndex += 1;
                                const isSelected = itemIndex === selectedSlashIndex;
                                return (
                                  <button
                                    key={cmd.id}
                                    onClick={() => {
                                      removeSlashCommandText();
                                      cmd.action();
                                      setShowSlashMenu(false);
                                      setSlashFilter('');
                                      setSelectedSlashIndex(0);
                                    }}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                                      isSelected ? 'bg-violet-600/20 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1a1b20]'
                                    }`}
                                  >
                                    <span className="w-6 h-6 rounded bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] flex items-center justify-center text-gray-500 dark:text-slate-300">
                                      {cmd.icon}
                                    </span>
                                    <span className="truncate">{cmd.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </Fragment>
                        ));
                      })()
                    ) : (
                      <div className="px-3 py-4 text-sm text-gray-400 dark:text-slate-500 text-center">No commands found</div>
                    )}
                  </div>
                </div>
              )}
              </div> {/* Close relative wrapper for content editor */}
            </div>
          </div>
        </div>
      </div>

      {/* Settings dropdown */}
      {showSettingsMenu && (
        <>
          <div className="fixed inset-0 z-[201]" onClick={() => setShowSettingsMenu(false)} />
          <div className="fixed right-20 top-20 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-[202] w-64 py-2">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Doc Settings</div>
            <button onClick={() => { setShowSettingsMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3">
              <FileText className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Rename
            </button>
            <button
              onClick={() => {
                copyToClipboard(`${window.location.origin}/docs?open=${doc.id}`).then((ok) => {
                  if (ok) toast.success('Link copied');
                  else toast.error('Failed to copy link');
                  setShowSettingsMenu(false);
                });
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
            >
              <Copy className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Copy link
            </button>
            <button onClick={() => { toggleFavorite(); setShowSettingsMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3">
              <Star className="w-4 h-4 text-gray-500 dark:text-slate-400" /> {doc.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
            </button>
            <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
            <button onClick={() => { toggleWiki(); setShowSettingsMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-3"><Bookmark className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Mark Doc as wiki</span>
              <div className={`w-8 h-4 rounded-full transition-colors ${doc.is_wiki ? 'bg-violet-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mt-[1px] ${doc.is_wiki ? 'translate-x-4' : 'translate-x-[1px]'}`} />
              </div>
            </button>
            <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
            <button onClick={() => { archiveDoc(); setShowSettingsMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3">
              <Archive className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Archive
            </button>
            <button onClick={() => { docsApi.delete(doc.id).then(() => { queryClient.invalidateQueries({ queryKey: ['docs'] }); toast.success('Doc deleted'); onClose(); }); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-slate-300 flex items-center gap-3"><Shield className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Protect this page</span>
              <div className="w-8 h-4 rounded-full bg-gray-300 dark:bg-slate-600">
                <div className="w-3.5 h-3.5 rounded-full bg-white shadow translate-x-[1px] mt-[1px]" />
              </div>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-slate-300 flex items-center gap-3"><Globe className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Public sharing</span>
              <button
                onClick={() => updateSharing(sharing === 'public' ? 'workspace' : 'public')}
                className={`w-8 h-4 rounded-full transition-colors ${sharing === 'public' ? 'bg-violet-600' : 'bg-gray-300 dark:bg-slate-600'}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mt-[1px] ${sharing === 'public' ? 'translate-x-4' : 'translate-x-[1px]'}`} />
              </button>
            </div>
            <div className="px-4 pt-2 pb-3">
              <button
                onClick={() => { setShowSettingsMenu(false); setShowShareDialog(true); }}
                className="w-full py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
              >
                Sharing & Permissions
              </button>
            </div>
          </div>
        </>
      )}

      {/* Share dialog */}
      {showShareDialog && (
        <div className="fixed inset-0 z-[201] flex items-center justify-center">
          <div className="absolute inset-0" onClick={() => { setShowShareDialog(false); setPermissionDropdownId(null); }} />
          <div className="relative bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl w-full max-w-lg z-10 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#1f2229] flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Share this Doc</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                  Sharing as a single view
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-200 dark:bg-[#15161a] rounded text-[10px] text-gray-600 dark:text-slate-300">
                    <FileText className="w-3 h-3" /> Doc
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShareDialogMode(prev => (prev === 'google' ? 'clickup' : 'google'))}
                  className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 bg-gray-200 dark:bg-[#15161a] rounded hover:bg-gray-300 dark:hover:bg-slate-600"
                >
                  {shareDialogMode === 'google' ? 'ClickUp Style' : 'Google Style'}
                </button>
                <button onClick={() => { setShowShareDialog(false); setPermissionDropdownId(null); }} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {shareDialogMode === 'google' ? (
              <div className="p-5 space-y-4">
                {/* Invite input */}
                <div className="relative">
                  <input
                    type="text"
                    value={inviteSearch}
                    onChange={(e) => setInviteSearch(e.target.value)}
                    placeholder="Add people, groups, spaces, and calendar events"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#14151a] border border-gray-300 dark:border-[#1f2229] rounded-md text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && inviteSearch.trim()) {
                        const value = inviteSearch.trim();
                        const match = members.find(m => m.email.toLowerCase() === value.toLowerCase() || m.name.toLowerCase().includes(value.toLowerCase()));
                        if (match) {
                          if (!sharedMembers.includes(match.id)) {
                            const nextMembers = [...sharedMembers, match.id];
                            const nextPerms = { ...memberPermissions, [match.id]: memberPermissions[match.id] || 'viewer' };
                            setSharedMembers(nextMembers);
                            setMemberPermissions(nextPerms);
                            syncSharing(nextMembers, externalGuests, nextPerms, externalPermissions);
                          }
                        } else if (isEmail(value)) {
                          if (!externalGuests.includes(value)) {
                            const nextGuests = [...externalGuests, value];
                            const nextPerms = { ...externalPermissions, [value]: externalPermissions[value] || 'viewer' };
                            setExternalGuests(nextGuests);
                            setExternalPermissions(nextPerms);
                            syncSharing(sharedMembers, nextGuests, memberPermissions, nextPerms);
                          }
                        }
                        setInviteSearch('');
                      }
                    }}
                  />

                  {inviteSearch.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl max-h-52 overflow-y-auto z-10">
                      {members
                        .filter(m =>
                          (m.name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
                           m.email.toLowerCase().includes(inviteSearch.toLowerCase())) &&
                          !sharedMembers.includes(m.id)
                        )
                        .map(m => (
                          <button
                            key={m.id}
                            onClick={() => {
                              const nextMembers = [...sharedMembers, m.id];
                              const nextPerms = { ...memberPermissions, [m.id]: memberPermissions[m.id] || 'viewer' };
                              setSharedMembers(nextMembers);
                              setMemberPermissions(nextPerms);
                              syncSharing(nextMembers, externalGuests, nextPerms, externalPermissions);
                              setInviteSearch('');
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
                          >
                            <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-[11px] text-white font-medium flex-shrink-0">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm text-gray-900 dark:text-white truncate">{m.name}</div>
                              <div className="text-xs text-gray-500 dark:text-slate-500 truncate">{m.email}</div>
                            </div>
                          </button>
                        ))}
                      {isEmail(inviteSearch) && !externalGuests.includes(inviteSearch) && !members.some(m => m.email.toLowerCase() === inviteSearch.toLowerCase()) && (
                        <button
                          onClick={() => {
                            const nextGuests = [...externalGuests, inviteSearch];
                            const nextPerms = { ...externalPermissions, [inviteSearch]: externalPermissions[inviteSearch] || 'viewer' };
                            setExternalGuests(nextGuests);
                            setExternalPermissions(nextPerms);
                            syncSharing(sharedMembers, nextGuests, memberPermissions, nextPerms);
                            setInviteSearch('');
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-sm text-gray-700 dark:text-slate-300"
                        >
                          Invite "{inviteSearch}"
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* People with access */}
                <div>
                  <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">People with access</div>
                  <div className="space-y-2">
                    {currentMember && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[11px] text-white font-medium">
                            {currentMember.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="text-sm text-gray-900 dark:text-white">{currentMember.name} (you)</div>
                            <div className="text-xs text-gray-500 dark:text-slate-500">{currentMember.email}</div>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-slate-500">Owner</span>
                      </div>
                    )}

                    {sharedMembers.map(mId => {
                      const m = members.find(mem => mem.id === mId);
                      if (!m) return null;
                      const perm = memberPermissions[m.id] || 'viewer';
                      return (
                        <div key={m.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-[11px] text-white font-medium">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm text-gray-900 dark:text-white">{m.name}</div>
                              <div className="text-xs text-gray-500 dark:text-slate-500">{m.email}</div>
                            </div>
                          </div>
                          <div className="relative">
                            <button
                              onClick={() => setPermissionDropdownId(permissionDropdownId === m.id ? null : m.id)}
                              className="px-2 py-1 text-xs text-gray-500 dark:text-slate-400 border border-gray-300 dark:border-[#1f2229] rounded hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-1"
                            >
                              {perm === 'editor' ? 'Editor' : 'Viewer'}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            {permissionDropdownId === m.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-20 w-44 py-1">
                                {(['viewer', 'editor'] as const).map(p => (
                                  <button
                                    key={p}
                                    onClick={() => {
                                      const nextPerms = { ...memberPermissions, [m.id]: p };
                                      setMemberPermissions(nextPerms);
                                      syncSharing(sharedMembers, externalGuests, nextPerms, externalPermissions);
                                      setPermissionDropdownId(null);
                                      toast.success(`${m.name}'s permission changed to ${p === 'editor' ? 'Editor' : 'Viewer'}`);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700"
                                  >
                                    {p === 'editor' ? 'Editor' : 'Viewer'}
                                  </button>
                                ))}
                                <div className="border-t border-gray-200 dark:border-[#1f2229] mt-1">
                                  <button
                                    onClick={() => {
                                      const nextMembers = sharedMembers.filter(id => id !== m.id);
                                      setSharedMembers(nextMembers);
                                      setPermissionDropdownId(null);
                                      syncSharing(nextMembers, externalGuests, memberPermissions, externalPermissions);
                                      toast.success(`${m.name} has been removed from sharing`);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {externalGuests.map(email => {
                      const perm = externalPermissions[email] || 'viewer';
                      return (
                        <div key={email} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-slate-500 flex items-center justify-center text-[11px] text-white font-medium">
                              {email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm text-gray-900 dark:text-white">{email}</div>
                              <div className="text-xs text-gray-500 dark:text-slate-500">Guest</div>
                            </div>
                          </div>
                          <div className="relative">
                            <button
                              onClick={() => setPermissionDropdownId(permissionDropdownId === email ? null : email)}
                              className="px-2 py-1 text-xs text-gray-500 dark:text-slate-400 border border-gray-300 dark:border-[#1f2229] rounded hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-1"
                            >
                              {perm === 'editor' ? 'Editor' : 'Viewer'}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            {permissionDropdownId === email && (
                              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-20 w-44 py-1">
                                {(['viewer', 'editor'] as const).map(p => (
                                  <button
                                    key={p}
                                    onClick={() => {
                                      const nextPerms = { ...externalPermissions, [email]: p };
                                      setExternalPermissions(nextPerms);
                                      syncSharing(sharedMembers, externalGuests, memberPermissions, nextPerms);
                                      setPermissionDropdownId(null);
                                      toast.success(`${email}'s permission changed to ${p === 'editor' ? 'Editor' : 'Viewer'}`);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700"
                                  >
                                    {p === 'editor' ? 'Editor' : 'Viewer'}
                                  </button>
                                ))}
                                <div className="border-t border-gray-200 dark:border-[#1f2229] mt-1">
                                  <button
                                    onClick={() => {
                                      const nextGuests = externalGuests.filter(e => e !== email);
                                      setExternalGuests(nextGuests);
                                      setPermissionDropdownId(null);
                                      syncSharing(sharedMembers, nextGuests, memberPermissions, externalPermissions);
                                      toast.success(`${email} has been removed from sharing`);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* General access */}
                <div>
                  <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">General access</div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229]">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${sharing === 'public' ? 'bg-green-600/20' : 'bg-gray-300 dark:bg-slate-700'}`}>
                        {sharing === 'public' ? <Globe className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-gray-500 dark:text-slate-400" />}
                      </div>
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {sharing === 'public' ? 'Anyone with the link' : 'Restricted'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-500">
                          {sharing === 'public' ? (linkRole === 'editor' ? 'Anyone on the internet with the link can edit' : 'Anyone on the internet with the link can view') : 'Only people with access can open with the link'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          onClick={() => setPermissionDropdownId(permissionDropdownId === 'general' ? null : 'general')}
                          className="px-2 py-1 text-xs text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-[#1f2229] rounded hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-1"
                        >
                          {linkRole === 'editor' ? 'Editor' : 'Viewer'}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {permissionDropdownId === 'general' && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-20 w-40 py-1">
                            {(['viewer', 'editor'] as const).map(p => (
                              <button
                                key={p}
                                onClick={() => {
                                  setLinkRole(p);
                                  const nextSharing = p === 'editor' ? 'public' : sharing;
                                  if (p === 'editor' && sharing !== 'public') {
                                    setShareLinkEnabled(true);
                                    updateSharing('public');
                                  }
                                  syncSharing(sharedMembers, externalGuests, memberPermissions, externalPermissions, p, nextSharing);
                                  setPermissionDropdownId(null);
                                  toast.success(`General access changed to ${p === 'editor' ? 'Editor — anyone with the link can edit' : 'Viewer — anyone with the link can view'}`);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700"
                              >
                                {p === 'editor' ? 'Editor' : 'Viewer'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                      onClick={() => {
                        const nextSharing = sharing === 'public' ? 'private' : 'public';
                        setShareLinkEnabled(nextSharing === 'public');
                        updateSharing(nextSharing);
                        syncSharing(sharedMembers, externalGuests, memberPermissions, externalPermissions, linkRole, nextSharing);
                      }}
                        className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 bg-gray-200 dark:bg-[#15161a] rounded hover:bg-gray-300 dark:hover:bg-slate-600"
                      >
                        {sharing === 'public' ? 'Restricted' : 'Anyone with link'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => {
                      const nextSharing = linkRole === 'editor' ? 'public' : sharing;
                      if (linkRole === 'editor' && sharing !== 'public') {
                        setShareLinkEnabled(true);
                        updateSharing('public');
                        syncSharing(sharedMembers, externalGuests, memberPermissions, externalPermissions, linkRole, 'public');
                      }
                      const link = nextSharing === 'public'
                        ? `${window.location.origin}/docs/public/${doc.id}`
                        : `${window.location.origin}/docs?open=${doc.id}`;
                      copyToClipboard(link).then((ok) => {
                        if (ok) toast.success('Link copied');
                        else toast.error('Failed to copy link');
                      });
                    }}
                    className="px-4 py-2 text-xs font-medium text-blue-600 border border-blue-200 rounded-full hover:bg-blue-50 dark:border-[#1f2229] dark:text-blue-400"
                  >
                    Copy link
                  </button>
                  <button
                    onClick={() => { setShowShareDialog(false); setPermissionDropdownId(null); }}
                    className="px-5 py-2 text-xs font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
              ) : (
              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 dark:text-slate-400">Add Guest</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inviteSearch}
                      onChange={(e) => setInviteSearch(e.target.value)}
                      placeholder="Search guests by name or email"
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-300 dark:border-[#1f2229] rounded-md text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && inviteSearch.trim()) {
                          const value = inviteSearch.trim();
                          const match = members.find(m => m.email.toLowerCase() === value.toLowerCase() || m.name.toLowerCase().includes(value.toLowerCase()));
                          if (match) {
                            if (!sharedMembers.includes(match.id)) {
                              const nextMembers = [...sharedMembers, match.id];
                              const nextPerms = { ...memberPermissions, [match.id]: memberPermissions[match.id] || 'viewer' };
                              setSharedMembers(nextMembers);
                              setMemberPermissions(nextPerms);
                              syncSharing(nextMembers, externalGuests, nextPerms, externalPermissions);
                            }
                          } else if (isEmail(value)) {
                            if (!externalGuests.includes(value)) {
                              const nextGuests = [...externalGuests, value];
                              const nextPerms = { ...externalPermissions, [value]: externalPermissions[value] || 'viewer' };
                              setExternalGuests(nextGuests);
                              setExternalPermissions(nextPerms);
                              syncSharing(sharedMembers, nextGuests, memberPermissions, nextPerms);
                            }
                          }
                          setInviteSearch('');
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const value = inviteSearch.trim();
                        if (!value) return;
                        const match = members.find(m => m.email.toLowerCase() === value.toLowerCase() || m.name.toLowerCase().includes(value.toLowerCase()));
                        if (match) {
                          if (!sharedMembers.includes(match.id)) {
                            const nextMembers = [...sharedMembers, match.id];
                            const nextPerms = { ...memberPermissions, [match.id]: memberPermissions[match.id] || 'viewer' };
                            setSharedMembers(nextMembers);
                            setMemberPermissions(nextPerms);
                            syncSharing(nextMembers, externalGuests, nextPerms, externalPermissions);
                          }
                        } else if (isEmail(value)) {
                          if (!externalGuests.includes(value)) {
                            const nextGuests = [...externalGuests, value];
                            const nextPerms = { ...externalPermissions, [value]: externalPermissions[value] || 'viewer' };
                            setExternalGuests(nextGuests);
                            setExternalPermissions(nextPerms);
                            syncSharing(sharedMembers, nextGuests, memberPermissions, nextPerms);
                          }
                        } else {
                          toast.error('Enter a valid email or workspace member');
                        }
                        setInviteSearch('');
                      }}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 text-sm text-gray-600 dark:text-slate-300">
                  <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Share link with anyone</span>
                  <button
                    onClick={() => {
                      const next = sharing === 'public' ? 'private' : 'public';
                      setShareLinkEnabled(next === 'public');
                      updateSharing(next);
                      syncSharing(sharedMembers, externalGuests, memberPermissions, externalPermissions, linkRole, next);
                    }}
                    className={`w-9 h-5 rounded-full transition-colors relative ${sharing === 'public' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${sharing === 'public' ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 text-sm text-gray-600 dark:text-slate-300">
                  <span className="flex items-center gap-2"><Link2 className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Private link</span>
                  <button
                    onClick={() => {
                      copyToClipboard(`${window.location.origin}/docs?open=${doc.id}`).then((ok) => {
                        if (ok) toast.success('Private link copied to clipboard');
                        else toast.error('Failed to copy link');
                      });
                    }}
                    className="text-xs font-medium text-gray-600 dark:text-slate-300"
                  >
                    Copy link
                  </button>
                </div>

                {sharing === 'public' && (
                  <div className="flex items-center justify-between py-2 text-sm text-gray-600 dark:text-slate-300">
                    <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Public link</span>
                  <button
                    onClick={() => {
                      copyToClipboard(`${window.location.origin}/docs/public/${doc.id}`).then((ok) => {
                        if (ok) toast.success('Public link copied');
                        else toast.error('Failed to copy link');
                      });
                    }}
                    className="text-xs font-medium text-gray-600 dark:text-slate-300"
                  >
                    Copy link
                  </button>
                </div>
                )}

                <div className="flex items-center justify-between py-2 text-sm text-gray-600 dark:text-slate-300">
                  <span className="flex items-center gap-2"><Download className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Export Doc</span>
                  <button
                    onClick={() => {
                      const content = `# ${doc.name}\n\n${doc.content || ''}`;
                      const blob = new Blob([content], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${doc.name || 'Untitled'}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Doc exported');
                    }}
                    className="text-xs font-medium text-gray-600 dark:text-slate-300"
                  >
                    Export
                  </button>
                </div>

                <div className="border-t border-gray-200 dark:border-[#1f2229]" />
                <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Guest Access</div>
                {sharedMembers.length === 0 && externalGuests.length === 0 ? (
                  <div className="text-center py-4 text-sm text-gray-500 dark:text-slate-500">
                    No guests added. Use the invite field above to add guests.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sharedMembers.map(mId => {
                      const m = members.find(mem => mem.id === mId);
                      if (!m) return null;
                      return (
                        <div key={m.id} className="flex items-center justify-between text-sm text-gray-600 dark:text-slate-300">
                          <span className="truncate">{m.name}</span>
                          <span className="text-xs">{memberPermissions[m.id] || 'viewer'}</span>
                        </div>
                      );
                    })}
                    {externalGuests.map(email => (
                      <div key={email} className="flex items-center justify-between text-sm text-gray-600 dark:text-slate-300">
                        <span className="truncate">{email}</span>
                        <span className="text-xs">{externalPermissions[email] || 'viewer'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tags dropdown */}
      {showTagsDropdown && (
        <>
          <div className="fixed inset-0 z-[201]" onClick={() => setShowTagsDropdown(false)} />
          <div className="fixed left-1/2 top-16 -translate-x-1/2 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-[202] w-72 py-3">
            <div className="px-4 pb-2 border-b border-gray-200 dark:border-[#1f2229]">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Tags</h3>
              <div className="flex gap-2 mb-2">
                <button className="text-xs text-violet-400 border-b-2 border-violet-400 pb-1 px-1">All</button>
                <button className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white pb-1 px-1">Workspace</button>
                <button className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white pb-1 px-1">Private</button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addTag(); }}
                  placeholder="Search or create tags..."
                  className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-[#14151a] border border-gray-300 dark:border-[#1f2229] rounded text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-4 pt-2 flex flex-wrap gap-1.5">
              {docTags.map(tag => (
                <span
                  key={tag}
                  className="px-2.5 py-1 bg-red-600/80 text-white text-xs rounded cursor-pointer hover:bg-red-500"
                  onClick={() => removeTag(tag)}
                >
                  {tag}
                </span>
              ))}
              {docTags.length === 0 && (
                <span className="text-xs text-gray-500 dark:text-slate-500">No tags yet. Type above to create one.</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Location Picker */}
      {showLocationPicker && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLocationPicker(false)} />
          <div className="relative bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl w-full max-w-sm z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#1f2229]">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Choose Location</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Select where this doc should live</p>
              </div>
              <button onClick={() => setShowLocationPicker(false)} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Instructional note */}
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-blue-600/10 border border-blue-500/20 rounded-lg">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300/90 leading-relaxed">
                  Choose a space or folder to organize this doc. Click on a space to place it at the top level, or expand a space to select a specific folder.
                </p>
              </div>
              <div className="bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {spaces.map(space => {
                  const spaceFolders = allFolders.filter(f => f.space_id === space.id);
                  const isExpanded = expandedLocationSpaces[space.id];
                  const isCurrent = currentSpaceId === space.id && !currentFolderId;
                  return (
                    <div key={space.id}>
                      <div
                        className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700/50 transition-colors ${isCurrent ? 'bg-blue-600/15' : ''}`}
                        onClick={() => {
                          setCurrentSpaceId(space.id);
                          setCurrentFolderId(null);
                          updateDocMutation.mutate({
                            id: doc.id,
                            data: { space_id: space.id, folder_id: null } as any
                          });
                          setShowLocationPicker(false);
                          toast.success(`Moved to ${space.name}`);
                        }}
                      >
                        {spaceFolders.length > 0 ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedLocationSpaces(prev => ({ ...prev, [space.id]: !prev[space.id] })); }}
                            className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-0.5"
                          >
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                        ) : (
                          <div className="w-[18px]" />
                        )}
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center text-[11px] text-white font-bold flex-shrink-0"
                          style={{ backgroundColor: space.color || '#6366f1' }}
                        >
                          {space.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-900 dark:text-white font-medium truncate">{space.name}</span>
                        {isCurrent && <span className="text-[10px] text-blue-400 bg-blue-600/20 px-1.5 py-0.5 rounded ml-auto flex-shrink-0">Current</span>}
                      </div>
                      {isExpanded && spaceFolders.map(folder => {
                        const isFolderCurrent = currentFolderId === folder.id;
                        return (
                          <div
                            key={folder.id}
                            className={`flex items-center gap-2.5 pl-12 pr-3 py-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700/50 transition-colors ${isFolderCurrent ? 'bg-blue-600/15' : ''}`}
                            onClick={() => {
                              setCurrentSpaceId(space.id);
                              setCurrentFolderId(folder.id);
                              updateDocMutation.mutate({
                                id: doc.id,
                                data: { space_id: space.id, folder_id: folder.id } as any
                              });
                              setShowLocationPicker(false);
                              toast.success(`Moved to ${space.name} / ${folder.name}`);
                            }}
                          >
                            <FolderIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                            <span className="text-sm text-gray-600 dark:text-slate-300 truncate">{folder.name}</span>
                            {isFolderCurrent && <span className="text-[10px] text-blue-400 bg-blue-600/20 px-1.5 py-0.5 rounded ml-auto flex-shrink-0">Current</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
