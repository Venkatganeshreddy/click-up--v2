import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FileText, Search, Trash2, X, Star, Clock,
  BookOpen, LayoutTemplate, Bookmark, Eye,
  MoreHorizontal, Filter, Copy, Link2, Edit2,
  Shield, Folder as FolderIcon, ChevronDown,
  Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { docsApi, spacesApi, foldersApi, spaceMembersApi, membersApi, type Member } from '../services/api';
import type { Doc, Space, Folder } from '../types';
import DocEditor from '../components/DocEditor';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const tabs = ['All', 'My Docs', 'Shared', 'Private', 'Workspace', 'Assigned', 'Archived'];

// Template definitions
const templates = [
  {
    id: 'project-overview',
    name: 'Project Overview',
    icon: '📋',
    color: 'from-blue-600 to-blue-800',
    description: 'Plan and track project goals, timelines, and deliverables',
    content: '<h1>Project Overview</h1><h2>Goals</h2><p>Define your project goals here...</p><h2>Timeline</h2><p>Key milestones and dates...</p><h2>Team</h2><p>Team members and roles...</p><h2>Deliverables</h2><ul><li>Deliverable 1</li><li>Deliverable 2</li><li>Deliverable 3</li></ul>'
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    icon: '📝',
    color: 'from-purple-600 to-purple-800',
    description: 'Capture action items and decisions from meetings',
    content: '<h1>Meeting Notes</h1><h2>Date</h2><p>' + new Date().toLocaleDateString() + '</p><h2>Attendees</h2><ul><li></li></ul><h2>Agenda</h2><ol><li></li></ol><h2>Discussion</h2><p></p><h2>Action Items</h2><ul><li></li></ul><h2>Next Steps</h2><p></p>'
  },
  {
    id: 'wiki',
    name: 'Wiki',
    icon: '📖',
    color: 'from-green-600 to-green-800',
    description: 'Create a knowledge base for your team',
    content: '<h1>Wiki</h1><h2>Overview</h2><p>Add your documentation here...</p><h2>Getting Started</h2><p>Instructions for new team members...</p><h2>Guidelines</h2><p>Best practices and standards...</p><h2>Resources</h2><ul><li>Link 1</li><li>Link 2</li></ul>'
  }
];

export default function Docs() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, member, needsSpaceAccess, canEdit, canEditInSpace } = useAuth();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [docName, setDocName] = useState('');
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);
  const [openShareOnEdit, setOpenShareOnEdit] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ docId: string; x: number; y: number } | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    location: true,
    tags: true,
    owner: false,
    dateViewed: true,
    dateCreated: false,
    dateUpdated: true,
    contributors: false,
    sharing: true,
  });

  const { data: allDocs = [] } = useQuery<Doc[]>({
    queryKey: ['docs'],
    queryFn: docsApi.getAll
  });

  const { data: spaces = [] } = useQuery<Space[]>({
    queryKey: ['spaces'],
    queryFn: spacesApi.getAll
  });

  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ['folders'],
    queryFn: foldersApi.getAll
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: membersApi.getAll
  });

  // Build a lookup map for member names by ID
  const memberMap = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach(m => map.set(m.id, m));
    return map;
  }, [members]);

  // Fetch accessible spaces for guests/limited members
  const { data: memberSpaceAccess = [] } = useQuery({
    queryKey: ['memberSpaceAccess', member?.id],
    queryFn: () => member?.id ? spaceMembersApi.getByMember(member.id) : Promise.resolve([]),
    enabled: needsSpaceAccess && !!member?.id,
  });

  // Filter docs for guests: only docs in accessible spaces OR explicitly shared with them
  const docs = useMemo(() => {
    if (!needsSpaceAccess) return allDocs;
    const accessibleSpaceIds = new Set(memberSpaceAccess.map((sa: { space_id: string }) => sa.space_id));
    // Also get folder space_ids for docs in folders
    const folderSpaceMap = new Map(folders.map(f => [f.id, f.space_id]));
    return allDocs.filter(d => {
      // Doc is in an accessible space
      if (d.space_id && accessibleSpaceIds.has(d.space_id)) return true;
      // Doc is in a folder whose space is accessible
      if (d.folder_id) {
        const folderSpaceId = folderSpaceMap.get(d.folder_id);
        if (folderSpaceId && accessibleSpaceIds.has(folderSpaceId)) return true;
      }
      // Doc is explicitly shared with this member
      if (d.shared_with?.some(s => s.member_id === member?.id || s.email === member?.email)) return true;
      return false;
    });
  }, [allDocs, needsSpaceAccess, memberSpaceAccess, folders, member]);

  const createDocMutation = useMutation({
    mutationFn: (input: Parameters<typeof docsApi.create>[0]) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      return docsApi.create(input);
    },
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      setShowCreateModal(false);
      setDocName('');
      setEditingDoc(newDoc);
      toast.success('Doc created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create doc')
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      return docsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      toast.success('Doc deleted');
    }
  });

  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Doc> }) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      return docsApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs'] });
    }
  });

  const handleCreate = () => {
    if (!canEdit) return;
    if (!docName.trim()) return;
    const spaceId = spaces[0]?.id;
    if (!spaceId) {
      toast.error('Create a space first');
      return;
    }
    createDocMutation.mutate({
      name: docName.trim(),
      space_id: spaceId,
      owner_id: user?.id,
    } as any);
  };

  const handleCreateFromTemplate = (template: typeof templates[0]) => {
    if (!canEdit) return;
    const firstSpace = spaces[0];
    if (!firstSpace) {
      toast.error('Create a space first');
      return;
    }
    createDocMutation.mutate({
      name: template.name,
      space_id: firstSpace.id,
      content: template.content,
      is_wiki: template.id === 'wiki',
      owner_id: user?.id,
    });
  };

  const handleCreateNew = () => {
    if (!canEdit) return;
    const firstSpace = spaces[0];
    if (!firstSpace) {
      toast.error('Create a space first');
      return;
    }
    createDocMutation.mutate({ name: 'Untitled', space_id: firstSpace.id, owner_id: user?.id });
  };

  // Focus rename input when renaming
  useEffect(() => {
    if (renamingDocId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingDocId]);

  const handleRename = (docId: string) => {
    if (!canEdit) return;
    if (!renameValue.trim()) return;
    updateDocMutation.mutate({ id: docId, data: { name: renameValue.trim() } as any });
    setRenamingDocId(null);
    setRenameValue('');
    toast.success('Doc renamed');
  };

  const handleDuplicate = (doc: Doc) => {
    if (!canEdit) return;
    const firstSpace = spaces[0];
    if (!firstSpace) return;
    createDocMutation.mutate({
      name: `${doc.name} (copy)`,
      space_id: doc.space_id || firstSpace.id,
      folder_id: doc.folder_id || undefined,
      content: doc.content,
      is_wiki: doc.is_wiki,
      owner_id: user?.id,
    } as any);
    toast.success('Doc duplicated');
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

  const handleCopyLink = async (docId: string) => {
    const url = `${window.location.origin}/docs?open=${docId}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      toast.success('Link copied to clipboard');
    } else {
      toast.error('Failed to copy link');
    }
  };

  const filteredDocs = useMemo(() => {
    let result = docs.filter(d => !d.is_archived);

    if (activeTab === 'Private') result = result.filter(d => d.sharing === 'private');
    else if (activeTab === 'Workspace') result = result.filter(d => d.sharing === 'workspace');
    else if (activeTab === 'Shared') result = result.filter(d => d.sharing === 'public');
    else if (activeTab === 'Archived') result = docs.filter(d => d.is_archived);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => d.name.toLowerCase().includes(q));
    }
    return result;
  }, [docs, activeTab, searchQuery]);

  // Open doc from query param: /docs?open=<docId>
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('open');
    if (!openId) return;
    const target = docs.find(d => d.id === openId);
    if (target && (!editingDoc || editingDoc.id !== openId)) {
      setEditingDoc(target);
      params.delete('open');
      const nextSearch = params.toString();
      navigate(nextSearch ? `/docs?${nextSearch}` : '/docs', { replace: true });
    }
  }, [location.search, docs, editingDoc, navigate]);

  const recentDocs = useMemo(() => {
    return [...docs]
      .filter(d => !d.is_archived)
      .sort((a, b) => new Date(b.last_viewed_at || b.updated_at || b.created_at).getTime() - new Date(a.last_viewed_at || a.updated_at || a.created_at).getTime())
      .slice(0, 5);
  }, [docs]);

  const favoriteDocs = useMemo(() => {
    return docs.filter(d => d.is_favorited && !d.is_archived);
  }, [docs]);

  const createdByMeDocs = useMemo(() => {
    if (!member?.id) return [];
    return docs.filter(d => d.owner_id === member.id && !d.is_archived);
  }, [docs, member]);

  const sharedDocs = useMemo(() => {
    if (!member?.id) return [];
    return docs.filter(d => d.sharing === 'public' && d.owner_id !== member.id && !d.is_archived);
  }, [docs, member]);

  const wikiDocs = useMemo(() => {
    return docs.filter(d => d.is_wiki && !d.is_archived);
  }, [docs]);

  const getLocation = (doc: Doc) => {
    if (doc.folder_id) {
      const folder = folders.find(f => f.id === doc.folder_id);
      if (folder) {
        const space = spaces.find(s => s.id === folder.space_id);
        return `${space?.name || 'Unknown'} / ${folder.name}`;
      }
    }
    const space = spaces.find(s => s.id === doc.space_id);
    return space?.name || 'Unknown';
  };

  const getSharingBadge = (sharing: string) => {
    switch (sharing) {
      case 'public': return <span className="px-2 py-0.5 rounded text-xs bg-green-600/20 text-green-400">Public</span>;
      case 'private': return <span className="px-2 py-0.5 rounded text-xs bg-red-600/20 text-red-400">Private</span>;
      default: return <span className="px-2 py-0.5 rounded text-xs bg-blue-600/20 text-blue-400">Workspace</span>;
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const toggleFavorite = (doc: Doc, e: React.MouseEvent) => {
    e.stopPropagation();
    updateDocMutation.mutate({ id: doc.id, data: { is_favorited: !doc.is_favorited } as any });
  };

  // DocCard for sections
  const DocCard = ({ doc, compact }: { doc: Doc; compact?: boolean }) => (
    <button
      onClick={() => setEditingDoc(doc)}
      className={`w-full text-left rounded-lg border border-gray-200 dark:border-[#1f2229]/60 hover:border-gray-300 dark:hover:border-slate-700 transition-all group ${
        compact
          ? 'p-2.5 bg-gray-100 dark:bg-[#15161a] hover:bg-gray-200/70 dark:hover:bg-[#1b1c24]'
          : 'p-3 bg-gray-100 dark:bg-[#14151a] hover:bg-gray-100 dark:hover:bg-slate-700/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0 ${compact ? 'w-7 h-7 mt-0.5' : 'w-8 h-8 mt-0.5'}`}>
          <FileText className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-blue-400`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-gray-900 dark:text-white font-medium truncate ${compact ? 'text-xs' : 'text-sm'}`}>{doc.name}</span>
            {doc.is_wiki && (
              <Bookmark className="w-3 h-3 text-green-400 flex-shrink-0" />
            )}
          </div>
          {compact ? (
            <div className="mt-0.5 text-[11px] text-gray-400 dark:text-slate-500 truncate">
              {getLocation(doc)}
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400 dark:text-slate-500">{getLocation(doc)}</span>
              <span className="text-xs text-gray-300 dark:text-slate-600">·</span>
              <span className="text-xs text-gray-400 dark:text-slate-500">{formatDate(doc.updated_at || doc.created_at)}</span>
            </div>
          )}
        </div>
        <button
          onClick={(e) => toggleFavorite(doc, e)}
          className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${doc.is_favorited ? 'opacity-100 text-yellow-400' : 'text-gray-400 dark:text-slate-500 hover:text-yellow-400'}`}
        >
          <Star className="w-3.5 h-3.5" fill={doc.is_favorited ? 'currentColor' : 'none'} />
        </button>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] text-gray-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-[#1f2229] px-8 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-blue-600/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Docs</h1>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Write and collaborate on docs with your team</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Docs"
                className="w-full pl-9 pr-3 py-1.5 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#242730] rounded-md text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#242730] rounded-md hover:bg-gray-200 dark:hover:bg-[#1d1f26]">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>
            {canEdit && (
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                New Doc
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-4 text-xs">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-gray-900 dark:text-white font-semibold'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-[1600px] mx-auto">

        {/* Templates Section */}
        {canEdit && showTemplates && !searchQuery && activeTab === 'All' && (
          <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white/70 dark:bg-[#14151a] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                <h2 className="text-xs font-semibold text-gray-700 dark:text-slate-300">Start with a template</h2>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300">Browse Templates</button>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300"
                >
                  Hide
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleCreateFromTemplate(template)}
                  className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-[#1f2229] hover:border-gray-300 dark:hover:border-[#2a2d36] transition-all text-left bg-white dark:bg-[#14151a]"
                >
                  <div className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-[#1a1c22] flex items-center justify-center text-lg">
                      {template.icon}
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-900 dark:text-white">{template.name}</h3>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">{template.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Three-column sections: Recent, Favorites, Created by Me */}
        {!searchQuery && activeTab === 'All' && docs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Recent */}
            <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white/70 dark:bg-[#14151a] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                  <h2 className="text-xs font-semibold text-gray-700 dark:text-slate-300">Recent</h2>
                </div>
                <button className="text-[11px] text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300">See all</button>
              </div>
              <div className="space-y-1.5">
                {recentDocs.length > 0 ? (
                  recentDocs.map(doc => <DocCard key={doc.id} doc={doc} compact />)
                ) : (
                  <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">
                    No recent docs
                  </div>
                )}
              </div>
            </div>

            {/* Favorites */}
            <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white/70 dark:bg-[#14151a] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-3.5 h-3.5 text-yellow-400" />
                <h2 className="text-xs font-semibold text-gray-700 dark:text-slate-300">Favorites</h2>
              </div>
              <div className="space-y-2">
                {favoriteDocs.length > 0 ? (
                  favoriteDocs.map(doc => <DocCard key={doc.id} doc={doc} compact />)
                ) : (
                  <div className="text-center py-8 rounded-lg border border-dashed border-gray-200 dark:border-[#1f2229]">
                    <Star className="w-6 h-6 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 dark:text-slate-500">Your favorited Docs will show here.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Created by Me */}
            <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white/70 dark:bg-[#14151a] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-green-400" />
                  <h2 className="text-xs font-semibold text-gray-700 dark:text-slate-300">Created by Me</h2>
                </div>
                <button className="text-[11px] text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300">See all</button>
              </div>
              <div className="space-y-2">
                {createdByMeDocs.length > 0 ? (
                  createdByMeDocs.map(doc => <DocCard key={doc.id} doc={doc} compact />)
                ) : (
                  <div className="text-center py-8 rounded-lg border border-dashed border-gray-200 dark:border-[#1f2229]">
                    <p className="text-xs text-gray-400 dark:text-slate-500">Your docs will show here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Shared Section */}
        {!searchQuery && activeTab === 'All' && (
          <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white/70 dark:bg-[#14151a] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Share2 className="w-3.5 h-3.5 text-blue-400" />
                <h2 className="text-xs font-semibold text-gray-700 dark:text-slate-300">Shared</h2>
              </div>
              <button className="text-[11px] text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300">See all</button>
            </div>
            <div className="space-y-2">
              {sharedDocs.length > 0 ? (
                sharedDocs.map(doc => <DocCard key={doc.id} doc={doc} compact />)
              ) : (
                <div className="text-xs text-gray-400 dark:text-slate-500">No shared docs yet</div>
              )}
            </div>
          </div>
        )}

        {/* Wiki Section */}
        {!searchQuery && activeTab === 'All' && (
          <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white/70 dark:bg-[#14151a] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-green-400" />
                <h2 className="text-xs font-semibold text-gray-700 dark:text-slate-300">Wiki</h2>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-slate-500">
                <button className="hover:text-gray-700 dark:hover:text-slate-300">Import</button>
                <button className="hover:text-gray-700 dark:hover:text-slate-300">+</button>
              </div>
            </div>
            <div className="space-y-2">
              {wikiDocs.length > 0 ? (
                wikiDocs.map(doc => <DocCard key={doc.id} doc={doc} compact />)
              ) : (
                <div className="text-xs text-gray-400 dark:text-slate-500">No wiki docs yet</div>
              )}
            </div>
          </div>
        )}

        {/* All Docs Table */}
        <div>
          {!searchQuery && activeTab === 'All' && docs.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              <h2 className="text-xs font-semibold text-gray-700 dark:text-slate-300">All Docs</h2>
              <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">({filteredDocs.length})</span>
            </div>
          )}
          <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] overflow-hidden bg-white/70 dark:bg-[#14151a]">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100/60 dark:bg-[#14151a] border-b border-gray-200 dark:border-[#1f2229]">
                  {visibleColumns.name && (
                    <th className="py-2 px-4 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400">Name</th>
                  )}
                  {visibleColumns.location && (
                    <th className="py-2 px-4 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400">Location</th>
                  )}
                  {visibleColumns.tags && (
                    <th className="py-2 px-4 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400">Tags</th>
                  )}
                  {visibleColumns.owner && (
                    <th className="py-2 px-4 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400">Owner</th>
                  )}
                  {visibleColumns.dateUpdated && (
                    <th className="py-2 px-4 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400">Date updated</th>
                  )}
                  {visibleColumns.dateViewed && (
                    <th className="py-2 px-4 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        Date viewed
                        <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[8px] text-white font-bold flex-shrink-0">+</span>
                      </span>
                    </th>
                  )}
                  {visibleColumns.dateCreated && (
                    <th className="py-2 px-4 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400">Date created</th>
                  )}
                  {visibleColumns.contributors && (
                    <th className="py-2 px-4 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400">Contributors</th>
                  )}
                  {visibleColumns.sharing && (
                    <th className="py-2 px-4 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400">Sharing</th>
                  )}
                  <th className="py-2.5 px-2 text-center w-10 relative">
                    <button
                      onClick={() => setShowColumnSettings(!showColumnSettings)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                      title="Column settings"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {/* Column settings dropdown */}
                    {showColumnSettings && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowColumnSettings(false)} />
                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50 w-56 py-3">
                          <div className="px-4 pb-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-left">Columns</div>
                          {([
                            { key: 'name', label: 'Name' },
                            { key: 'location', label: 'Location' },
                            { key: 'tags', label: 'Tags' },
                            { key: 'owner', label: 'Owner' },
                            { key: 'dateViewed', label: 'Date viewed' },
                            { key: 'dateCreated', label: 'Date created' },
                            { key: 'dateUpdated', label: 'Date updated' },
                            { key: 'contributors', label: 'Contributors' },
                            { key: 'sharing', label: 'Sharing' },
                          ] as { key: keyof typeof visibleColumns; label: string }[]).map(col => (
                            <button
                              key={col.key}
                              onClick={(e) => {
                                e.stopPropagation();
                                setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }));
                              }}
                              className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700/50 text-left"
                            >
                              <span className="text-sm text-gray-700 dark:text-slate-300">{col.label}</span>
                              <div className={`w-8 h-[18px] rounded-full transition-colors relative ${visibleColumns[col.key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                                <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-[1px] transition-all ${visibleColumns[col.key] ? 'left-[17px]' : 'left-[1px]'}`} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map(doc => (
                  <tr
                    key={doc.id}
                    onClick={() => { if (renamingDocId !== doc.id) setEditingDoc(doc); }}
                    className="border-b border-gray-200 dark:border-[#1f2229] hover:bg-gray-100/70 dark:hover:bg-[#16171c] group cursor-pointer transition-colors"
                  >
                    {visibleColumns.name && (
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          {/* Checkbox on hover */}
                          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-4 h-4 rounded border border-gray-300 dark:border-slate-500 hover:border-blue-500" />
                          </div>
                          <div className="w-7 h-7 rounded bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            {renamingDocId === doc.id ? (
                              <input
                                ref={renameInputRef}
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRename(doc.id);
                                  if (e.key === 'Escape') { setRenamingDocId(null); setRenameValue(''); }
                                }}
                                onBlur={() => handleRename(doc.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-gray-900 dark:text-white bg-gray-100 dark:bg-[#14151a] border border-blue-500 rounded px-2 py-0.5 outline-none w-48"
                              />
                            ) : (
                              <span className="text-xs text-gray-900 dark:text-white truncate">{doc.name}</span>
                            )}
                            {doc.is_wiki && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-600/20 text-green-400 font-medium flex-shrink-0">Wiki</span>
                            )}
                            {doc.sharing === 'private' && (
                              <Shield className="w-3 h-3 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                            )}
                          </div>
                          {/* Hover action icons */}
                          <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyLink(doc.id); }}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                              title="Copy link"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => toggleFavorite(doc, e)}
                              className={`p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded ${doc.is_favorited ? 'text-yellow-400' : 'text-gray-500 dark:text-slate-400 hover:text-yellow-400'}`}
                              title={doc.is_favorited ? 'Remove favorite' : 'Add to favorites'}
                            >
                              <Star className="w-3.5 h-3.5" fill={doc.is_favorited ? 'currentColor' : 'none'} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenamingDocId(doc.id); setRenameValue(doc.name); }}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                              title="Rename"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.location && (
                      <td className="py-2.5 px-4">
                        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                          <FolderIcon className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                          {getLocation(doc)}
                        </span>
                      </td>
                    )}
                    {visibleColumns.tags && (
                      <td className="py-2.5 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {doc.tags?.length ? (
                            <>
                              {doc.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="px-2 py-0.5 rounded text-xs bg-gray-200 dark:bg-[#15161a] text-gray-700 dark:text-slate-300">{tag}</span>
                              ))}
                              {doc.tags.length > 3 && (
                                <span className="text-xs text-gray-400 dark:text-slate-500">+{doc.tags.length - 3}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-slate-600">&ndash;</span>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.owner && (() => {
                      const owner = doc.owner_id ? memberMap.get(doc.owner_id) : null;
                      const ownerName = owner?.name || 'Unknown';
                      const initial = ownerName.charAt(0).toUpperCase();
                      return (
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-[10px] text-white font-medium">{initial}</div>
                            <span className="text-xs text-gray-500 dark:text-slate-400">{ownerName}</span>
                          </div>
                        </td>
                      );
                    })()}
                    {visibleColumns.dateUpdated && (
                      <td className="py-2.5 px-4 text-xs text-gray-500 dark:text-slate-400">{formatDate(doc.updated_at)}</td>
                    )}
                    {visibleColumns.dateViewed && (
                      <td className="py-2.5 px-4 text-xs text-gray-500 dark:text-slate-400">{formatDate(doc.last_viewed_at)}</td>
                    )}
                    {visibleColumns.dateCreated && (
                      <td className="py-2.5 px-4 text-xs text-gray-500 dark:text-slate-400">{formatDate(doc.created_at)}</td>
                    )}
                    {visibleColumns.contributors && (() => {
                      const owner = doc.owner_id ? memberMap.get(doc.owner_id) : null;
                      const sharedMembers = (doc.shared_with || [])
                        .map(s => s.member_id ? memberMap.get(s.member_id) : null)
                        .filter(Boolean) as Member[];
                      const contributors = owner ? [owner, ...sharedMembers.filter(m => m.id !== owner.id)] : sharedMembers;
                      return (
                      <td className="py-2.5 px-4">
                        <div className="flex -space-x-1">
                          {contributors.length > 0 ? contributors.slice(0, 3).map(c => (
                            <div key={c.id} className="w-6 h-6 rounded-full bg-violet-600 border border-gray-50 dark:border-[#0f1012] flex items-center justify-center text-[10px] text-white font-medium" title={c.name}>
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          )) : (
                            <div className="w-6 h-6 rounded-full bg-violet-600 border border-gray-50 dark:border-[#0f1012] flex items-center justify-center text-[10px] text-white font-medium">?</div>
                          )}
                          {contributors.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-slate-600 border border-gray-50 dark:border-[#0f1012] flex items-center justify-center text-[10px] text-white font-medium">+{contributors.length - 3}</div>
                          )}
                        </div>
                      </td>
                      );
                    })()}
                    {visibleColumns.sharing && (
                      <td className="py-2.5 px-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenShareOnEdit(true);
                            setEditingDoc(doc);
                          }}
                          className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                          title="Sharing & Permissions"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const menuHeight = 360;
                          const menuWidth = 260;
                          let y = rect.bottom + 4;
                          let x = rect.right - menuWidth;
                          const maxY = window.innerHeight - menuHeight - 8;
                          y = Math.max(8, Math.min(y, maxY));
                          if (x < 8) x = 8;
                          setContextMenu({ docId: doc.id, x, y });
                        }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="More options"
                      >
                        <MoreHorizontal className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="py-16 text-center">
                      <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-slate-400 font-medium">
                        {searchQuery ? 'No docs match your search' : 'No docs found'}
                      </p>
                      <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                        {searchQuery ? 'Try a different search term' : 'Create a doc to get started'}
                      </p>
                      {!searchQuery && canEdit && (
                        <button
                          onClick={handleCreateNew}
                          className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> New Doc
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Context menu (three-dots) */}
      {contextMenu && (() => {
        const doc = docs.find(d => d.id === contextMenu.docId);
        if (!doc) return null;
        return (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
            <div
              className="fixed z-50 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl w-64 overflow-hidden"
              style={{ left: contextMenu.x, top: contextMenu.y, maxHeight: 'calc(100vh - 20px)' }}
            >
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 24px)' }}>
                <div className="py-1.5">
                  <button
                    onClick={() => { handleCopyLink(doc.id); setContextMenu(null); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
                  >
                    <Link2 className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Copy link to view
                  </button>
                  <button
                    onClick={async () => {
                      if (doc.sharing !== 'public') {
                        updateDocMutation.mutate({ id: doc.id, data: { sharing: 'public' } as any });
                      }
                      await handleCopyLink(doc.id);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
                  >
                    <Link2 className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Copy public link
                  </button>
                  <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                  {canEdit && (
                    <button
                      onClick={() => {
                        setRenamingDocId(doc.id);
                        setRenameValue(doc.name);
                        setContextMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Rename
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => { handleDuplicate(doc); setContextMenu(null); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
                    >
                      <Copy className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Duplicate
                    </button>
                  )}
                  <button
                    onClick={() => { updateDocMutation.mutate({ id: doc.id, data: { is_favorited: !doc.is_favorited } as any }); setContextMenu(null); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
                  >
                    <Star className="w-4 h-4 text-gray-500 dark:text-slate-400" /> {doc.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => { deleteDocMutation.mutate(doc.id); setContextMenu(null); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                </div>

                {/* Sharing & Permissions button */}
                <div className="border-t border-gray-200 dark:border-[#1f2229] px-3 py-2.5">
                  <button
                    onClick={() => {
                      setOpenShareOnEdit(true);
                      setEditingDoc(doc);
                      setContextMenu(null);
                    }}
                    className="w-full py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
                  >
                    Sharing & Permissions
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-[#14151a] rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1f2229]">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Doc</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Name</label>
              <input
                type="text"
                value={docName}
                onChange={e => setDocName(e.target.value)}
                placeholder="Enter doc name"
                className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-300 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => { if (e.key === 'Enter' && docName.trim()) handleCreate(); }}
                autoFocus
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">You can change the location from inside the doc editor.</p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-2 bg-gray-200 dark:bg-[#15161a] text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!docName.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doc Editor Overlay */}
      {editingDoc && (
        <DocEditor
          doc={editingDoc}
          inline
          initialShowShare={openShareOnEdit}
          onClose={() => {
            setEditingDoc(null);
            setOpenShareOnEdit(false);
            queryClient.invalidateQueries({ queryKey: ['docs'] });
          }}
        />
      )}
    </div>
  );
}
