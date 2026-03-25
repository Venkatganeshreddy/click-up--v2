import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, X, ChevronRight, ChevronDown, Clock, Star, User,
  MoreHorizontal, ClipboardList, MessageSquare, ShoppingCart, Briefcase, Headphones,
  Link2, Copy, Edit2, Files, Trash2, Share2, Globe, Lock, ExternalLink, Users, HelpCircle, Check, Columns
} from 'lucide-react';
import { toast } from 'sonner';
import { formsApi, spacesApi, foldersApi, taskListsApi, membersApi, spaceMembersApi, type TaskList, type Member } from '../services/api';
import type { Form, Space, Folder } from '../types';
import FormBuilder from '../components/FormBuilder';
import { useAuth } from '../context/AuthContext';

// Form templates
const formTemplates = [
  {
    id: 'feedback',
    name: 'Feedback Form',
    description: 'Survey and collect feedback',
    icon: MessageSquare,
    color: '#06b6d4',
    bgColor: 'from-cyan-600 to-cyan-800',
    fields: [
      { id: '1', label: 'Topic of feedback', type: 'short_text', required: true, placeholder: 'Enter text' },
      { id: '2', label: 'Tell us about your experience.', type: 'long_text', required: true, placeholder: 'Enter text', helpText: 'Share all of the details with us so we can learn from your feedback.' }
    ]
  },
  {
    id: 'project-intake',
    name: 'Project Intake',
    description: 'Streamline new project requests',
    icon: Briefcase,
    color: '#ec4899',
    bgColor: 'from-pink-600 to-pink-800',
    fields: [
      { id: '1', label: 'Project Name', type: 'short_text', required: true, placeholder: 'Example: Data Optimization Project', helpText: 'Tip: use a simple but recognizable and descriptive name for the project.' },
      { id: '2', label: 'Details about the project', type: 'long_text', required: true, placeholder: 'Project goals, scope, task & Doc links', helpText: 'Please include links to any meeting notes, Docs, tasks, or information that will be helpful.' },
      { id: '3', label: 'What is the priority of this project?', type: 'single_select', required: true, helpText: 'Consult with your executive leader for prioritization.' },
      { id: '4', label: 'Attachments', type: 'uploads', required: false, helpText: 'Add any attachments with relevant information and context.' }
    ]
  },
  {
    id: 'order',
    name: 'Order Form',
    description: 'Capture and process client orders',
    icon: ShoppingCart,
    color: '#8b5cf6',
    bgColor: 'from-violet-600 to-violet-800',
    fields: [
      { id: '1', label: 'Customer Name', type: 'short_text', required: true },
      { id: '2', label: 'Email', type: 'contact_info', required: true },
      { id: '3', label: 'Order Details', type: 'long_text', required: true },
      { id: '4', label: 'Quantity', type: 'number', required: true }
    ]
  },
  {
    id: 'job-application',
    name: 'Job Application',
    description: 'Accept and review applications for open roles',
    icon: User,
    color: '#f59e0b',
    bgColor: 'from-amber-600 to-amber-800',
    fields: [
      { id: '1', label: 'Full Name', type: 'short_text', required: true },
      { id: '2', label: 'Email', type: 'contact_info', required: true },
      { id: '3', label: 'Phone', type: 'contact_info', required: false },
      { id: '4', label: 'Resume', type: 'uploads', required: true },
      { id: '5', label: 'Cover Letter', type: 'long_text', required: false }
    ]
  },
  {
    id: 'it-requests',
    name: 'IT Requests',
    description: 'Triage and prioritize IT service requests',
    icon: Headphones,
    color: '#3b82f6',
    bgColor: 'from-blue-600 to-blue-800',
    fields: [
      { id: '1', label: 'Request Type', type: 'single_select', required: true },
      { id: '2', label: 'Description', type: 'long_text', required: true },
      { id: '3', label: 'Priority', type: 'single_select', required: true },
      { id: '4', label: 'Screenshots', type: 'uploads', required: false }
    ]
  }
];

type ViewState = 'dashboard' | 'template-select' | 'location-select' | 'create-list';

export default function Forms() {
  const queryClient = useQueryClient();
  const [viewState, setViewState] = useState<ViewState>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'my-forms'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof formTemplates[0] | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({});
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [editingForm, setEditingForm] = useState<Form | null>(null);

  // Create list modal state
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListPrivate, setNewListPrivate] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // Action menu & share dialog state
  const [actionMenuForm, setActionMenuForm] = useState<Form | null>(null);
  const [shareDialogForm, setShareDialogForm] = useState<Form | null>(null);
  const [renameForm, setRenameForm] = useState<Form | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const { user, member, needsSpaceAccess, canEdit } = useAuth();

  const { data: allForms = [] } = useQuery<Form[]>({
    queryKey: ['forms'],
    queryFn: formsApi.getAll
  });

  const { data: spaces = [] } = useQuery<Space[]>({
    queryKey: ['spaces'],
    queryFn: spacesApi.getAll
  });

  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ['folders'],
    queryFn: foldersApi.getAll
  });

  const { data: lists = [] } = useQuery<TaskList[]>({
    queryKey: ['task-lists'],
    queryFn: taskListsApi.getAll
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: membersApi.getAll
  });

  // Fetch accessible spaces for guests/limited members
  const { data: memberSpaceAccess = [] } = useQuery({
    queryKey: ['memberSpaceAccess', member?.id],
    queryFn: () => member?.id ? spaceMembersApi.getByMember(member.id) : Promise.resolve([]),
    enabled: needsSpaceAccess && !!member?.id,
  });

  // Filter forms for guests: only forms in spaces they have access to
  const forms = useMemo(() => {
    if (!needsSpaceAccess) return allForms;
    const accessibleSpaceIds = new Set(memberSpaceAccess.map((sa: { space_id: string }) => sa.space_id));
    const folderSpaceMap = new Map(folders.map(f => [f.id, f.space_id]));
    const listSpaceMap = new Map(lists.map(l => {
      // lists may be in a folder, get space from folder or direct space_id
      const folderId = (l as any).folder_id;
      if (folderId) {
        const folderSpaceId = folderSpaceMap.get(folderId);
        return [l.id, folderSpaceId || (l as any).space_id];
      }
      return [l.id, (l as any).space_id];
    }));
    return allForms.filter(f => {
      // Form in an accessible space
      if (f.space_id && accessibleSpaceIds.has(f.space_id)) return true;
      // Form in a list whose space is accessible
      if (f.list_id) {
        const listSpaceId = listSpaceMap.get(f.list_id);
        if (listSpaceId && accessibleSpaceIds.has(listSpaceId)) return true;
      }
      return false;
    });
  }, [allForms, needsSpaceAccess, memberSpaceAccess, folders, lists]);

  const createFormMutation = useMutation({
    mutationFn: (input: Parameters<typeof formsApi.create>[0]) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      return formsApi.create(input);
    },
    onSuccess: (newForm) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      setViewState('dashboard');
      setSelectedTemplate(null);
      setSelectedSpaceId(null);
      setSelectedListId(null);
      setEditingForm(newForm);
      toast.success('Form created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create form')
  });

  const createListMutation = useMutation({
    mutationFn: (input: Parameters<typeof taskListsApi.create>[0]) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      return taskListsApi.create(input);
    },
    onSuccess: (newList) => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      setNewListName('');
      setNewListDescription('');
      setSelectedMembers([]);
      setNewListPrivate(false);
      toast.success('List created');

      // Automatically create the form with the new list and open it
      const formData: any = {
        name: selectedTemplate?.name || 'New Form',
        description: selectedTemplate?.description || '',
        space_id: newList.space_id,
        list_id: newList.id,
        template_type: selectedTemplate?.id || 'custom',
        fields: selectedTemplate?.fields || [],
        status: 'active'
      };
      createFormMutation.mutate(formData);
    }
  });

  const deleteFormMutation = useMutation({
    mutationFn: (id: string) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      return formsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form deleted');
    }
  });

  const updateFormMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Form> }) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      return formsApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    }
  });

  const duplicateFormMutation = useMutation({
    mutationFn: async (form: Form) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      const newForm = {
        name: `${form.name} (Copy)`,
        description: form.description,
        space_id: form.space_id,
        folder_id: form.folder_id,
        list_id: form.list_id,
        fields: form.fields,
        template_type: form.template_type,
        settings: form.settings,
        status: 'active'
      };
      return formsApi.create(newForm as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form duplicated');
    }
  });

  const handleSelectTemplate = (template: typeof formTemplates[0] | null) => {
    setSelectedTemplate(template);
    setViewState('location-select');
  };

  const handleSelectLocation = (spaceId: string, listId?: string) => {
    if (!canEdit) return;
    if (!selectedTemplate && !listId) {
      // Custom form needs a list to store responses
      toast.error('Please select a list for storing responses');
      return;
    }

    const formData: any = {
      name: selectedTemplate?.name || 'New Form',
      description: selectedTemplate?.description || '',
      space_id: spaceId,
      list_id: listId || undefined,
      template_type: selectedTemplate?.id || 'custom',
      fields: selectedTemplate?.fields || [],
      status: 'active'
    };

    createFormMutation.mutate(formData);
  };

  const handleCreateList = () => {
    if (!canEdit) return;
    if (!newListName.trim() || !selectedSpaceId) return;
    createListMutation.mutate({
      name: newListName.trim(),
      space_id: selectedSpaceId
    } as any);
  };

  const filteredForms = useMemo(() => {
    let result = forms;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q));
    }
    return result;
  }, [forms, searchQuery]);

  const recentForms = useMemo(() => {
    return [...forms]
      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
      .slice(0, 5);
  }, [forms]);

  const favoriteForms = useMemo(() => {
    return forms.filter(f => (f as any).is_favorited);
  }, [forms]);

  const myForms = useMemo(() => {
    return forms.filter(f => f.owner_id === user?.id);
  }, [forms, user]);

  const displayedForms = useMemo(() => {
    let result = activeTab === 'my-forms' ? myForms : filteredForms;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q));
    }
    return result;
  }, [activeTab, myForms, filteredForms, searchQuery]);

  const toggleFavorite = (form: Form) => {
    const isFavorited = (form as any).is_favorited;
    updateFormMutation.mutate(
      { id: form.id, data: { is_favorited: !isFavorited } as any },
      {
        onSuccess: () => {
          toast.success(isFavorited ? 'Removed from favorites' : 'Added to favorites');
        }
      }
    );
  };

  const handleRename = () => {
    if (!renameForm || !renameValue.trim()) return;
    updateFormMutation.mutate(
      { id: renameForm.id, data: { name: renameValue.trim() } },
      {
        onSuccess: () => {
          toast.success('Form renamed');
          setRenameForm(null);
          setRenameValue('');
        }
      }
    );
  };

  const copyLink = (form: Form, isPublic: boolean) => {
    const baseUrl = window.location.origin;
    // Public link uses /form/[id] for people to fill out and submit
    // Internal link uses /forms/[id] for editing the form
    const link = isPublic
      ? `${baseUrl}/form/${form.id}`
      : `${baseUrl}/forms/${form.id}`;
    navigator.clipboard.writeText(link);
    toast.success(isPublic ? 'Public form link copied - share this with respondents' : 'Edit link copied');
  };

  const getLocation = (form: Form) => {
    const space = spaces.find(s => s.id === form.space_id);
    const spaceName = space?.name || 'Unknown';

    if (form.list_id) {
      const list = lists.find(l => l.id === form.list_id);
      if (list) {
        // Check if list is in a folder
        if (list.folder_id) {
          const folder = folders.find(f => f.id === list.folder_id);
          return folder ? `${spaceName} / ${folder.name} / ${list.name}` : `${spaceName} / ${list.name}`;
        }
        return `${spaceName} / ${list.name}`;
      }
    }
    if (form.folder_id) {
      const folder = folders.find(f => f.id === form.folder_id);
      return folder ? `${spaceName} / ${folder.name}` : spaceName;
    }
    return spaceName;
  };

  const getLocationSpace = (form: Form) => {
    const space = spaces.find(s => s.id === form.space_id);
    return space;
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const d = new Date(date);
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  // FormBuilder is now rendered inline as a slide-in panel (see bottom of return)

  // Template Selection View
  if (viewState === 'template-select') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <button
          onClick={() => setViewState('dashboard')}
          className="absolute top-4 right-4 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="text-center max-w-3xl">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Create a new Form</h1>
          <p className="text-gray-500 dark:text-slate-400 mb-10">Get started with a Form template or create a custom Form to fit your exact needs.</p>

          <div className="grid grid-cols-3 gap-4">
            {formTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="p-6 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl text-left hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.bgColor} flex items-center justify-center mb-4`}>
                  <template.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{template.name}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">{template.description}</p>
              </button>
            ))}
            <button
              onClick={() => handleSelectTemplate(null)}
              className="p-6 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl text-left hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-[#15161a] flex items-center justify-center mb-4">
                <Plus className="w-6 h-6 text-gray-500 dark:text-slate-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Start from scratch</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">Build a custom form</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Location Selection View
  if (viewState === 'location-select') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <button
          onClick={() => setViewState('template-select')}
          className="absolute top-4 right-4 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="text-center max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Where do you want submissions saved?</h1>
          <p className="text-gray-500 dark:text-slate-400 mb-2">When a user submits a form, a task is created.</p>
          <p className="text-gray-500 dark:text-slate-400 mb-8">Select a List for responses.</p>

          <div className="bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-gray-200 dark:border-[#1f2229]">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-slate-900/50 rounded-lg">
                <Search className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
                />
              </div>
            </div>

            {/* Spaces list */}
            <div className="max-h-80 overflow-y-auto">
              <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Spaces
              </div>
              {spaces.map(space => {
                const spaceLists = lists.filter(l => l.space_id === space.id);
                const spaceFolders = folders.filter(f => f.space_id === space.id);
                const isExpanded = expandedSpaces[space.id];

                return (
                  <div key={space.id}>
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-slate-700/50 cursor-pointer group"
                      onClick={() => {
                        setExpandedSpaces(prev => ({ ...prev, [space.id]: !prev[space.id] }));
                        setSelectedSpaceId(space.id);
                      }}
                    >
                      {(spaceLists.length > 0 || spaceFolders.length > 0) && (
                        <ChevronRight className={`w-4 h-4 text-gray-500 dark:text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      )}
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold text-white"
                        style={{ backgroundColor: space.color || '#6366f1' }}
                      >
                        {space.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-900 dark:text-white flex-1">{space.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSpaceId(space.id);
                          setViewState('create-list');
                        }}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-gray-200 dark:bg-[#15161a] text-xs text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-slate-600"
                      >
                        New List
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="ml-6">
                        {spaceLists.map(list => (
                          <button
                            key={list.id}
                            onClick={() => handleSelectLocation(space.id, list.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700/50 text-left"
                          >
                            <ClipboardList className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                            <span className="text-sm text-gray-700 dark:text-slate-300">{list.name}</span>
                          </button>
                        ))}
                        {spaceFolders.map(folder => {
                          const folderLists = lists.filter(l => l.folder_id === folder.id);
                          return (
                            <div key={folder.id}>
                              <div className="flex items-center gap-2 px-3 py-2 text-gray-500 dark:text-slate-400">
                                <ChevronRight className="w-3.5 h-3.5" />
                                <span className="text-sm">{folder.name}</span>
                              </div>
                              {folderLists.map(list => (
                                <button
                                  key={list.id}
                                  onClick={() => handleSelectLocation(space.id, list.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 pl-8 hover:bg-gray-100 dark:hover:bg-slate-700/50 text-left"
                                >
                                  <ClipboardList className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                                  <span className="text-sm text-gray-700 dark:text-slate-300">{list.name}</span>
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Create List View
  if (viewState === 'create-list') {
    const filteredMembers = members.filter(m =>
      m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email?.toLowerCase().includes(memberSearch.toLowerCase())
    );

    const getInitials = (name: string) => {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getAvatarColor = (name: string) => {
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
      const index = name.charCodeAt(0) % colors.length;
      return colors[index];
    };

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <div className="bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1f2229]">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create List</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">All Lists are located within a Space. Lists can house any type of task.</p>
            </div>
            <button onClick={() => setViewState('location-select')} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Name</label>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g. Project, List of items, Campaign"
                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-slate-900/50 border border-violet-500 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900 dark:text-white">Make private</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Only you, members, invited guests</p>
              </div>
              <button
                onClick={() => setNewListPrivate(!newListPrivate)}
                className={`w-10 h-5 rounded-full transition-colors relative ${newListPrivate ? 'bg-violet-600' : 'bg-slate-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${newListPrivate ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Share only with - shows when private is enabled */}
            {newListPrivate && (
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-slate-400">Share only with</p>
                  <div className="flex items-center gap-1">
                    {/* Selected members avatars */}
                    <div className="flex -space-x-2">
                      {selectedMembers.slice(0, 3).map(memberId => {
                        const member = members.find(m => m.id === memberId);
                        if (!member) return null;
                        return (
                          <div
                            key={memberId}
                            className="w-7 h-7 rounded-full border-2 border-gray-200 dark:border-[#1f2229] flex items-center justify-center text-[10px] font-medium text-white"
                            style={{ backgroundColor: getAvatarColor(member.name || member.email) }}
                            title={member.name || member.email}
                          >
                            {getInitials(member.name || member.email)}
                          </div>
                        );
                      })}
                      {selectedMembers.length > 3 && (
                        <div className="w-7 h-7 rounded-full border-2 border-gray-200 dark:border-[#1f2229] bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-[10px] font-medium text-gray-900 dark:text-white">
                          +{selectedMembers.length - 3}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                      className="w-7 h-7 rounded-full border-2 border-dashed border-gray-400 dark:border-slate-500 flex items-center justify-center text-gray-500 dark:text-slate-400 hover:border-gray-500 dark:hover:border-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Member dropdown */}
                {showMemberDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMemberDropdown(false)} />
                    <div className="absolute right-0 top-8 w-72 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50 max-h-80 overflow-hidden">
                      <div className="p-2 border-b border-gray-200 dark:border-[#1f2229]">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-[#14151a] rounded-lg">
                          <Search className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                          <input
                            type="text"
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder="Search or enter email..."
                            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto py-1">
                        {/* Current user (Me) */}
                        {user && (
                          <button
                            onClick={() => {
                              if (selectedMembers.includes(user.id)) {
                                setSelectedMembers(selectedMembers.filter(id => id !== user.id));
                              } else {
                                setSelectedMembers([...selectedMembers, user.id]);
                              }
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-700/50 ${
                              selectedMembers.includes(user.id) ? 'bg-violet-600/20' : ''
                            }`}
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
                              style={{ backgroundColor: '#14b8a6' }}
                            >
                              {getInitials(user.user_metadata?.name || user.email || 'Me')}
                            </div>
                            <span className="text-sm text-gray-900 dark:text-white">Me</span>
                            {selectedMembers.includes(user.id) && (
                              <Check className="w-4 h-4 text-violet-400 ml-auto" />
                            )}
                          </button>
                        )}
                        {filteredMembers.map(member => (
                          <button
                            key={member.id}
                            onClick={() => {
                              if (selectedMembers.includes(member.id)) {
                                setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                              } else {
                                setSelectedMembers([...selectedMembers, member.id]);
                              }
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-700/50 ${
                              selectedMembers.includes(member.id) ? 'bg-violet-600/20' : ''
                            }`}
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
                              style={{ backgroundColor: getAvatarColor(member.name || member.email) }}
                            >
                              {getInitials(member.name || member.email)}
                            </div>
                            <span className="text-sm text-gray-900 dark:text-white truncate">{member.name || member.email}</span>
                            {selectedMembers.includes(member.id) && (
                              <Check className="w-4 h-4 text-violet-400 ml-auto flex-shrink-0" />
                            )}
                          </button>
                        ))}
                        {filteredMembers.length === 0 && !user && (
                          <p className="px-3 py-4 text-sm text-gray-400 dark:text-slate-500 text-center">No members found</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-[#1f2229]">
            <button
              onClick={handleCreateList}
              disabled={!newListName.trim()}
              className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 font-medium"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard View
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] text-gray-900 dark:text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 dark:border-[#1f2229]">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          <h1 className="text-lg font-semibold">Forms</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Forms"
              className="w-full pl-9 pr-3 py-1.5 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#242730] rounded-md text-gray-900 dark:text-white text-xs placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {canEdit && (
            <button
              onClick={() => setViewState('template-select')}
              className="px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-md hover:bg-violet-700"
            >
              New Form
            </button>
          )}
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Templates section */}
        {showTemplates && (
          <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white/70 dark:bg-[#14151a] p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400">Start with a template</h2>
              <button onClick={() => setShowTemplates(false)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {formTemplates.slice(0, 3).map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="flex-shrink-0 w-72 p-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-left hover:border-gray-300 dark:hover:border-[#2a2d36] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-[#1a1c22] flex items-center justify-center">
                      <template.icon className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white text-xs">{template.name}</h3>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">{template.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent / Favorites / Created by Me */}
        <div className="grid grid-cols-3 gap-4">
          {/* Recent */}
          <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white/70 dark:bg-[#14151a] p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" /> Recent
              </h3>
              {recentForms.length > 3 && (
                <button className="text-[11px] text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">See all</button>
              )}
            </div>
            <div className="space-y-1.5">
              {recentForms.slice(0, 3).map(form => (
                <button
                  key={form.id}
                  onClick={() => setEditingForm(form)}
                  className="w-full text-left px-2 py-1.5 hover:bg-gray-100/70 dark:hover:bg-[#1b1c25] rounded-md flex items-center gap-2"
                >
                  <ClipboardList className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-900 dark:text-white truncate">{form.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500">in {getLocation(form)}</p>
                  </div>
                </button>
              ))}
              {recentForms.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">No recent forms</p>
              )}
            </div>
          </div>

          {/* Favorites */}
          <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white/70 dark:bg-[#14151a] p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" /> Favorites
              </h3>
              {favoriteForms.length > 3 && (
                <button className="text-[11px] text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">See all</button>
              )}
            </div>
            {favoriteForms.length > 0 ? (
              <div className="space-y-1.5">
                {favoriteForms.slice(0, 3).map(form => (
                  <button
                    key={form.id}
                    onClick={() => setEditingForm(form)}
                    className="w-full text-left px-2 py-1.5 hover:bg-gray-100/70 dark:hover:bg-[#1b1c25] rounded-md flex items-center gap-2"
                  >
                    <ClipboardList className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-900 dark:text-white truncate">{form.name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500">in {getLocation(form)}</p>
                    </div>
                    <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Star className="w-6 h-6 text-gray-300 dark:text-slate-600 mb-2" />
                <p className="text-xs text-gray-400 dark:text-slate-500">Your favorited Forms will show here.</p>
              </div>
            )}
          </div>

          {/* Created by Me */}
          <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white/70 dark:bg-[#14151a] p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" /> Created by Me
              </h3>
              {myForms.length > 3 && (
                <button className="text-[11px] text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">See all</button>
              )}
            </div>
            <div className="space-y-1.5">
              {myForms.slice(0, 3).map(form => (
                <button
                  key={form.id}
                  onClick={() => setEditingForm(form)}
                  className="w-full text-left px-2 py-1.5 hover:bg-gray-100/70 dark:hover:bg-[#1b1c25] rounded-md flex items-center gap-2"
                >
                  <ClipboardList className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-900 dark:text-white truncate">{form.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500">in {getLocation(form)}</p>
                  </div>
                </button>
              ))}
              {myForms.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">No forms created yet</p>
              )}
            </div>
          </div>
        </div>

        {/* All Forms Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveTab('all')}
                className={`text-xs font-semibold pb-2 border-b-2 ${
                  activeTab === 'all' ? 'text-gray-900 dark:text-white border-blue-500' : 'text-gray-500 dark:text-slate-400 border-transparent hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab('my-forms')}
                className={`text-xs font-semibold pb-2 border-b-2 ${
                  activeTab === 'my-forms' ? 'text-gray-900 dark:text-white border-blue-500' : 'text-gray-500 dark:text-slate-400 border-transparent hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                My Forms
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              <span className="text-xs text-gray-500 dark:text-slate-400">Search</span>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-gray-200 dark:border-[#1f2229] overflow-hidden bg-white/70 dark:bg-[#14151a]">
            <table className="w-full">
            <thead>
              <tr className="bg-gray-100/60 dark:bg-[#14151a] border-b border-gray-200 dark:border-[#1f2229]">
                <th className="py-2 px-3 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 align-middle whitespace-nowrap">Name</th>
                <th className="py-2 px-3 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 align-middle whitespace-nowrap">Location</th>
                <th className="py-2 px-3 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 align-middle whitespace-nowrap">Created by</th>
                <th className="py-2 px-3 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 align-middle whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    Date viewed <ChevronDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {displayedForms.map(form => {
                const space = getLocationSpace(form);
                const isFavorited = (form as any).is_favorited;
                return (
                  <tr
                    key={form.id}
                    className="border-b border-gray-200 dark:border-[#1f2229] hover:bg-gray-100/70 dark:hover:bg-[#16171c] cursor-pointer group"
                    onClick={() => setEditingForm(form)}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                        <span className="text-xs text-gray-900 dark:text-white">{form.name}</span>
                        {/* Inline action icons */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyLink(form, false); }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
                            title="Copy link"
                          >
                            <Link2 className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(form); }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
                            title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star className={`w-3.5 h-3.5 ${isFavorited ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500 dark:text-slate-400'}`} />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        {space && (
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: space.color || '#6366f1' }}
                          >
                            {space.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs text-gray-700 dark:text-slate-300">{getLocation(form)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-[10px] text-white">
                        U
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 dark:text-slate-400">
                      {formatTimeAgo(form.updated_at || form.created_at)}
                    </td>
                    <td className="py-2.5 px-3 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenuForm(actionMenuForm?.id === form.id ? null : form);
                        }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
                      >
                        <MoreHorizontal className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                      </button>

                      {/* Action Menu Dropdown */}
                      {actionMenuForm?.id === form.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setActionMenuForm(null)} />
                          <div className="absolute right-0 top-8 w-52 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50 py-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); copyLink(form, false); setActionMenuForm(null); }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-3"
                            >
                              <Link2 className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Copy Link
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(form.id);
                                toast.success('Form ID copied!');
                                setActionMenuForm(null);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-3"
                            >
                              <Copy className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Copy ID
                            </button>
                            <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuForm(null);
                                setEditingForm(form);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-3"
                            >
                              <Columns className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Add a Column
                            </button>
                            <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                            {canEdit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameForm(form);
                                  setRenameValue(form.name);
                                  setActionMenuForm(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-3"
                              >
                                <Edit2 className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Rename
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={(e) => { e.stopPropagation(); duplicateFormMutation.mutate(form); setActionMenuForm(null); }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-3"
                              >
                                <Files className="w-4 h-4 text-gray-500 dark:text-slate-400" /> Duplicate
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(form); setActionMenuForm(null); }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-3"
                            >
                              <Star className={`w-4 h-4 ${isFavorited ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500 dark:text-slate-400'}`} />
                              {isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                            </button>
                            {canEdit && (
                              <>
                                <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteFormMutation.mutate(form.id); setActionMenuForm(null); }}
                                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-3"
                                >
                                  <Trash2 className="w-4 h-4" /> Delete
                                </button>
                              </>
                            )}
                            <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                            <button
                              onClick={(e) => { e.stopPropagation(); setShareDialogForm(form); setActionMenuForm(null); }}
                              className="w-full text-left px-3 py-2 text-sm text-white bg-violet-600 hover:bg-violet-700 rounded-lg mx-1.5 my-1 flex items-center gap-3"
                              style={{ width: 'calc(100% - 12px)' }}
                            >
                              <Share2 className="w-4 h-4" /> Sharing & Permissions
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {displayedForms.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <ClipboardList className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-slate-400">No forms found</p>
                    {canEdit && (
                      <button
                        onClick={() => setViewState('template-select')}
                        className="mt-3 text-sm text-violet-400 hover:text-violet-300"
                      >
                        Create your first form
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

      {/* Rename Modal */}
      {renameForm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setRenameForm(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rename Form</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-300 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:border-violet-500"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRenameForm(null)}
                className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700"
              >
                Rename
              </button>
            </div>
          </div>
        </>
      )}

      {/* Share Dialog */}
      {shareDialogForm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShareDialogForm(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1f2229]">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Share this view</span>
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              </div>
              <button onClick={() => setShareDialogForm(null)} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              {/* Sharing as single view */}
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-4">
                <span>Sharing as a single view</span>
                <ClipboardList className="w-4 h-4" />
                <span className="text-gray-900 dark:text-white">{shareDialogForm.name}</span>
              </div>

              {/* Published toggle */}
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-[#1f2229]">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                  <span className="text-sm text-gray-900 dark:text-white">Published</span>
                  <button className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300">
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    const newPublishState = !shareDialogForm.is_published;
                    updateFormMutation.mutate(
                      { id: shareDialogForm.id, data: { is_published: newPublishState } as any },
                      {
                        onSuccess: () => {
                          setShareDialogForm({ ...shareDialogForm, is_published: newPublishState });
                          toast.success(newPublishState ? 'Form published' : 'Form unpublished');
                        }
                      }
                    );
                  }}
                  className={`w-10 h-5 rounded-full transition-colors ${shareDialogForm.is_published ? 'bg-violet-600' : 'bg-slate-600'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${shareDialogForm.is_published ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Private link */}
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-[#1f2229]">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                  <span className="text-sm text-gray-900 dark:text-white">Private link</span>
                  <button className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300">
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => copyLink(shareDialogForm, false)}
                  className="px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-[#1f2229] rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  Copy link
                </button>
              </div>

              {/* Share with */}
              <div className="pt-4">
                <h4 className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Share with</h4>
                <div className="flex items-center justify-between py-2 px-3 bg-gray-100 dark:bg-[#14151a] rounded-lg">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                    {(() => {
                      const space = spaces.find(s => s.id === shareDialogForm.space_id);
                      return space ? (
                        <>
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ backgroundColor: space.color || '#6366f1' }}
                          >
                            {space.name.charAt(0)}
                          </div>
                          <span className="text-sm text-gray-900 dark:text-white">{getLocation(shareDialogForm)}</span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-slate-400">Unknown location</span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-violet-600 border-2 border-white dark:border-[#1e1f28] flex items-center justify-center text-[10px] text-white">
                        U
                      </div>
                    </div>
                    <button className={`w-8 h-4 rounded-full transition-colors bg-violet-600`}>
                      <div className={`w-3 h-3 rounded-full bg-white transition-transform translate-x-4`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Form Builder Inline Panel */}
      {editingForm && (
        <FormBuilder form={editingForm} inline onClose={() => setEditingForm(null)} />
      )}
    </div>
  );
}
