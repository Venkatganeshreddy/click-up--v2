import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, ChevronDown, ChevronRight, ChevronLeft, Plus, Trash2,
  Type, Hash, Users, Calendar, CheckSquare, AtSign, Link, Phone,
  DollarSign, Tag, List, Lock, Eye, Pin, Sparkles, GripVertical,
  Globe, FileText, MapPin, Star, ThumbsUp, FileUp, GitBranch,
  ListTodo, BarChart3, Languages, SmilePlus, Folders, Calculator,
  AlignLeft, Clock, MessageSquare, Circle, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { customFieldsApi, CustomFieldType, CreateCustomFieldInput, DropdownOption } from '../services/api';

interface CustomFieldPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  onFieldCreated?: () => void;
  onBack?: () => void;
  folderId?: string;
  listId?: string;
  statusFieldVisible?: boolean;
  onToggleStatusField?: (visible: boolean) => void;
}

// Field type definitions with icons and descriptions
const FIELD_TYPES: {
  type: CustomFieldType;
  label: string;
  icon: React.ElementType;
  description: string;
  category: 'ai' | 'all';
  iconColor?: string;
}[] = [
  // AI Fields
  { type: 'ai_summary', label: 'Summary', icon: Sparkles, description: 'AI-generated task summary', category: 'ai', iconColor: '#a855f7' },
  { type: 'ai_custom_text', label: 'Custom Text', icon: Type, description: 'AI-generated custom text', category: 'ai', iconColor: '#a855f7' },
  { type: 'ai_custom_dropdown', label: 'Custom Dropdown', icon: List, description: 'AI-generated dropdown selection', category: 'ai', iconColor: '#a855f7' },

  // All Fields (Basic)
  { type: 'dropdown', label: 'Dropdown', icon: List, description: 'Select from a list of options', category: 'all', iconColor: '#6366f1' },
  { type: 'text', label: 'Text', icon: Type, description: 'Single line text input', category: 'all', iconColor: '#22c55e' },
  { type: 'date', label: 'Date', icon: Calendar, description: 'Date and time picker', category: 'all', iconColor: '#ec4899' },
  { type: 'textarea', label: 'Text area (Long Text)', icon: AlignLeft, description: 'Multi-line text input', category: 'all', iconColor: '#22c55e' },
  { type: 'number', label: 'Number', icon: Hash, description: 'Numeric values', category: 'all', iconColor: '#3b82f6' },
  { type: 'labels', label: 'Labels', icon: Tag, description: 'Multiple tags/labels', category: 'all', iconColor: '#f97316' },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare, description: 'True or false toggle', category: 'all', iconColor: '#22c55e' },
  { type: 'money', label: 'Money', icon: DollarSign, description: 'Currency amounts', category: 'all', iconColor: '#22c55e' },
  { type: 'website', label: 'Website', icon: Globe, description: 'Website URL link', category: 'all', iconColor: '#3b82f6' },
  { type: 'formula', label: 'Formula', icon: Calculator, description: 'Calculate values from other fields', category: 'all', iconColor: '#8b5cf6' },
  { type: 'progress_updates', label: 'Progress Updates', icon: MessageSquare, description: 'Track progress updates', category: 'all', iconColor: '#f97316' },
  { type: 'files', label: 'Files', icon: FileUp, description: 'File attachments', category: 'all', iconColor: '#6b7280' },
  { type: 'relationship', label: 'Relationship', icon: GitBranch, description: 'Link related tasks', category: 'all', iconColor: '#8b5cf6' },
  { type: 'people', label: 'People', icon: Users, description: 'Select team members', category: 'all', iconColor: '#ef4444' },
  { type: 'progress_auto', label: 'Progress (Auto)', icon: BarChart3, description: 'Auto-calculated progress', category: 'all', iconColor: '#22c55e' },
  { type: 'email', label: 'Email', icon: AtSign, description: 'Email address input', category: 'all', iconColor: '#ef4444' },
  { type: 'phone', label: 'Phone', icon: Phone, description: 'Phone number input', category: 'all', iconColor: '#22c55e' },
  { type: 'categorize', label: 'Categorize', icon: Folders, description: 'Categorize tasks', category: 'all', iconColor: '#6366f1' },
  { type: 'translation', label: 'Translation', icon: Languages, description: 'AI-powered translations', category: 'all', iconColor: '#3b82f6' },
  { type: 'sentiment', label: 'Sentiment', icon: SmilePlus, description: 'AI sentiment analysis', category: 'all', iconColor: '#eab308' },
  { type: 'tasks', label: 'Tasks', icon: ListTodo, description: 'Link to other tasks', category: 'all', iconColor: '#6366f1' },
  { type: 'location', label: 'Location', icon: MapPin, description: 'Geographic location', category: 'all', iconColor: '#ef4444' },
  { type: 'progress_manual', label: 'Progress (Manual)', icon: Clock, description: 'Manual progress tracking', category: 'all', iconColor: '#f97316' },
  { type: 'rating', label: 'Rating', icon: Star, description: 'Star rating (1-5)', category: 'all', iconColor: '#eab308' },
  { type: 'voting', label: 'Voting', icon: ThumbsUp, description: 'Upvote/downvote', category: 'all', iconColor: '#3b82f6' },
];

// Default colors for dropdown options
const OPTION_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#6b7280'
];

export default function CustomFieldPanel({ isOpen, onClose, spaceId, onFieldCreated, onBack, folderId, listId, statusFieldVisible, onToggleStatusField }: CustomFieldPanelProps) {
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedType, setSelectedType] = useState<CustomFieldType | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isVisibleToGuests, setIsVisibleToGuests] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showMoreSettings, setShowMoreSettings] = useState(false);
  const [fillMethod, setFillMethod] = useState<'manual' | 'ai'>('manual');

  // Dropdown specific state
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOption[]>([
    { id: '1', name: 'Option 1', color: OPTION_COLORS[0] },
    { id: '2', name: 'Option 2', color: OPTION_COLORS[1] }
  ]);
  const [newOptionText, setNewOptionText] = useState('');

  // People specific state
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [showGuests, setShowGuests] = useState(false);
  const [selectMultiple, setSelectMultiple] = useState(true);
  const [includeTeams, setIncludeTeams] = useState(false);

  // Number specific state
  const [numberPrecision, setNumberPrecision] = useState(0);
  const [numberPrefix, setNumberPrefix] = useState('');
  const [numberSuffix, setNumberSuffix] = useState('');

  // Rating specific state
  const [ratingEmoji, setRatingEmoji] = useState('star');
  const [ratingCount, setRatingCount] = useState(5);

  // Voting specific state
  const [votingEmoji, setVotingEmoji] = useState('thumbsup');
  const [hideVoters, setHideVoters] = useState(false);

  // Labels specific state (similar to dropdown)
  const [labelOptions, setLabelOptions] = useState<DropdownOption[]>([]);
  const [newLabelText, setNewLabelText] = useState('');

  // Currency/Money specific state
  const [currencyType, setCurrencyType] = useState('USD');

  // Progress specific state
  const [progressSource, setProgressSource] = useState<'subtasks' | 'checklists' | 'comments'>('subtasks');
  const [progressStart, setProgressStart] = useState(0);
  const [progressEnd, setProgressEnd] = useState(100);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Filter field types based on search
  const filteredFieldTypes = FIELD_TYPES.filter(field =>
    field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    field.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const aiFields = filteredFieldTypes.filter(f => f.category === 'ai');
  const allFields = filteredFieldTypes.filter(f => f.category === 'all');

  // Reset form
  const resetForm = () => {
    setStep('select');
    setSelectedType(null);
    setFieldName('');
    setDescription('');
    setDefaultValue('');
    setIsRequired(false);
    setIsPinned(false);
    setIsVisibleToGuests(true);
    setIsPrivate(false);
    setShowMoreSettings(false);
    setFillMethod('manual');
    setDropdownOptions([
      { id: '1', name: 'Option 1', color: OPTION_COLORS[0] },
      { id: '2', name: 'Option 2', color: OPTION_COLORS[1] }
    ]);
    setNewOptionText('');
    setShowWorkspace(false);
    setShowGuests(false);
    setSelectMultiple(true);
    setIncludeTeams(false);
    setNumberPrecision(0);
    setNumberPrefix('');
    setNumberSuffix('');
    setSearchQuery('');
    // Rating
    setRatingEmoji('star');
    setRatingCount(5);
    // Voting
    setVotingEmoji('thumbsup');
    setHideVoters(false);
    // Labels
    setLabelOptions([]);
    setNewLabelText('');
    // Currency
    setCurrencyType('USD');
    // Progress
    setProgressSource('subtasks');
    setProgressStart(0);
    setProgressEnd(100);
  };

  // Close and reset
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Create mutation
  const createFieldMutation = useMutation({
    mutationFn: (input: CreateCustomFieldInput) => customFieldsApi.create(input),
    onSuccess: (data) => {
      // Invalidate all custom field queries to ensure the new field shows up
      queryClient.invalidateQueries({ queryKey: ['customFields'] });
      // Also refetch immediately
      queryClient.refetchQueries({ queryKey: ['customFields', spaceId] });
      toast.success(`Custom field "${fieldName}" created successfully!`);
      onFieldCreated?.();
      handleClose();
    },
    onError: (err: Error) => {
      console.error('Failed to create custom field:', err);
      toast.error(err.message || 'Failed to create custom field');
    }
  });

  // Handle field type selection
  const handleTypeSelect = (type: CustomFieldType) => {
    setSelectedType(type);
    setStep('configure');
  };

  // Add dropdown option
  const handleAddOption = () => {
    const optionName = newOptionText.trim() || `Option ${dropdownOptions.length + 1}`;
    const newOption: DropdownOption = {
      id: Date.now().toString(),
      name: optionName,
      color: OPTION_COLORS[dropdownOptions.length % OPTION_COLORS.length]
    };
    setDropdownOptions([...dropdownOptions, newOption]);
    setNewOptionText('');
  };

  // Remove dropdown option
  const handleRemoveOption = (id: string) => {
    setDropdownOptions(dropdownOptions.filter(o => o.id !== id));
  };

  // Update dropdown option
  const handleUpdateOption = (id: string, name: string) => {
    setDropdownOptions(dropdownOptions.map(o =>
      o.id === id ? { ...o, name } : o
    ));
  };

  // Handle create
  const handleCreate = () => {
    if (!fieldName.trim() || !selectedType) {
      toast.error('Field name is required');
      return;
    }

    // Build type config based on field type
    let typeConfig: Record<string, any> = {};

    switch (selectedType) {
      case 'dropdown':
        typeConfig = {
          options: dropdownOptions,
          sorting: 'manual'
        };
        break;
      case 'number':
      case 'currency':
        typeConfig = {
          precision: numberPrecision,
          prefix: numberPrefix,
          suffix: numberSuffix
        };
        break;
      case 'people':
        typeConfig = {
          show_workspace: showWorkspace,
          show_guests: showGuests,
          multiple: selectMultiple,
          include_teams: includeTeams
        };
        break;
      case 'text':
      case 'textarea':
      case 'email':
      case 'phone':
      case 'website':
      case 'url':
        typeConfig = {
          default_text: defaultValue
        };
        break;
      case 'labels':
        typeConfig = {
          options: labelOptions,
          sorting: 'manual'
        };
        break;
      case 'rating':
        typeConfig = {
          emoji: ratingEmoji,
          count: ratingCount
        };
        break;
      case 'voting':
        typeConfig = {
          emoji: votingEmoji,
          hide_voters: hideVoters
        };
        break;
      case 'money':
        typeConfig = {
          currency_type: currencyType,
          precision: numberPrecision
        };
        break;
      case 'progress_auto':
        typeConfig = {
          progress_source: progressSource
        };
        break;
      case 'progress_manual':
        typeConfig = {
          start_value: progressStart,
          end_value: progressEnd
        };
        break;
    }

    createFieldMutation.mutate({
      name: fieldName.trim(),
      type: selectedType,
      type_config: typeConfig,
      space_id: spaceId,
      folder_id: folderId,
      list_id: listId,
      description: description || undefined,
      default_value: defaultValue || undefined,
      is_required: isRequired,
      is_pinned: isPinned,
      is_visible_to_guests: isVisibleToGuests,
      is_private: isPrivate
    });
  };

  if (!isOpen) return null;

  const selectedTypeInfo = FIELD_TYPES.find(f => f.type === selectedType);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={handleClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[340px] bg-[#1e1f28] border-l border-[#3e3f4a] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3e3f4a]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (step === 'configure') {
                  setStep('select');
                } else if (onBack) {
                  onBack();
                } else {
                  handleClose();
                }
              }}
              className="p-1 hover:bg-[#2e2f3a] rounded text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {selectedTypeInfo ? (
              <div className="flex items-center gap-2">
                <selectedTypeInfo.icon
                  className="w-4 h-4"
                  style={{ color: selectedTypeInfo.iconColor || '#a855f7' }}
                />
                <span className="text-white font-medium">{selectedTypeInfo.label}</span>
              </div>
            ) : (
              <span className="text-white font-medium">Create field</span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-[#2e2f3a] rounded text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'select' ? (
            /* Field Type Selection */
            <div className="flex flex-col h-full">
              {/* Search Box */}
              <div className="p-3 border-b border-[#3e3f4a]">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for new or existing fields"
                    className="w-full pl-3 pr-3 py-2 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Field Types List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* AI Fields Section */}
                {aiFields.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">AI fields</p>
                    <div className="space-y-0.5">
                      {aiFields.map(field => (
                        <button
                          key={field.type}
                          onClick={() => handleTypeSelect(field.type)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2e2f3a] transition-colors text-left"
                        >
                          <field.icon
                            className="w-4 h-4"
                            style={{ color: field.iconColor || '#a855f7' }}
                          />
                          <span className="text-white text-sm">{field.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Fields Section */}
                {(allFields.length > 0 || (onToggleStatusField && (!searchQuery || 'status'.includes(searchQuery.toLowerCase())))) && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">All</p>
                    <div className="space-y-0.5">
                      {/* Status field - built-in, click to add/remove from list view */}
                      {onToggleStatusField && (!searchQuery || 'status'.includes(searchQuery.toLowerCase())) && (
                        <button
                          onClick={() => {
                            onToggleStatusField(!statusFieldVisible);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2e2f3a] transition-colors text-left"
                        >
                          <Circle className="w-4 h-4 flex-shrink-0" style={{ color: '#22c55e' }} fill={statusFieldVisible ? '#22c55e' : 'none'} />
                          <span className="text-white text-sm flex-1">Status</span>
                          {statusFieldVisible && <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />}
                        </button>
                      )}
                      {allFields.map(field => (
                        <button
                          key={field.type}
                          onClick={() => handleTypeSelect(field.type)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2e2f3a] transition-colors text-left"
                        >
                          <field.icon
                            className="w-4 h-4"
                            style={{ color: field.iconColor || '#6366f1' }}
                          />
                          <span className="text-white text-sm">{field.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Results */}
                {filteredFieldTypes.length === 0 && !onToggleStatusField && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No fields match your search
                  </div>
                )}

                {/* Add existing fields link */}
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-violet-400 hover:bg-[#2e2f3a] rounded-lg transition-colors text-sm mt-4">
                  <Plus className="w-4 h-4" />
                  <span>Add existing fields</span>
                </button>
              </div>
            </div>
          ) : (
            /* Field Configuration */
            <div className="p-4 space-y-4">
              {/* Field Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Field name <span className="text-pink-500">*</span>
                </label>
                <div className="relative">
                  {selectedTypeInfo && (
                    <selectedTypeInfo.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  )}
                  <input
                    type="text"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder="Enter name..."
                    className="w-full pl-10 pr-3 py-2.5 bg-[#2e2f3a] border border-violet-500 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Dropdown Options */}
              {selectedType === 'dropdown' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-400">
                      Dropdown options <span className="text-pink-500">*</span>
                    </label>
                    <button className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
                      <ChevronDown className="w-3 h-3" /> Manual
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dropdownOptions.map((option, index) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: option.color }}
                        />
                        <input
                          type="text"
                          value={option.name}
                          onChange={(e) => handleUpdateOption(option.id, e.target.value)}
                          className="flex-1 px-3 py-2 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                        />
                        {dropdownOptions.length > 1 && (
                          <button
                            onClick={() => handleRemoveOption(option.id)}
                            className="p-1 text-gray-500 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Plus className="w-3 h-3 text-gray-500" />
                      <input
                        type="text"
                        value={newOptionText}
                        onChange={(e) => setNewOptionText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                        onPaste={(e) => {
                          const pastedText = e.clipboardData.getData('text');
                          // Support pasting multiple options separated by newlines or commas
                          const parts = pastedText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                          if (parts.length > 1) {
                            e.preventDefault();
                            const newOptions = parts.map((name, i) => ({
                              id: Date.now().toString() + i,
                              name,
                              color: OPTION_COLORS[(dropdownOptions.length + i) % OPTION_COLORS.length]
                            }));
                            setDropdownOptions([...dropdownOptions, ...newOptions]);
                          }
                        }}
                        placeholder="Type or paste options"
                        className="flex-1 px-3 py-2 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500"
                      />
                      <button
                        onClick={handleAddOption}
                        className="p-2 bg-violet-600 hover:bg-violet-700 rounded-lg"
                        title="Add option"
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* People Settings */}
              {selectedType === 'people' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Settings</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showWorkspace}
                        onChange={(e) => setShowWorkspace(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-[#2e2f3a] text-violet-500 focus:ring-violet-500"
                      />
                      <span className="text-sm text-white">Show people from my entire Workspace</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showGuests}
                        onChange={(e) => setShowGuests(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-[#2e2f3a] text-violet-500 focus:ring-violet-500"
                      />
                      <span className="text-sm text-white">Show guests</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectMultiple}
                        onChange={(e) => setSelectMultiple(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-[#2e2f3a] text-violet-500 focus:ring-violet-500"
                      />
                      <span className="text-sm text-white">Select multiple people</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeTeams}
                        onChange={(e) => setIncludeTeams(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-[#2e2f3a] text-violet-500 focus:ring-violet-500"
                      />
                      <span className="text-sm text-white">Include teams</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Labels Options */}
              {selectedType === 'labels' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-400">
                      Labels options <span className="text-pink-500">*</span>
                    </label>
                    <button className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
                      <ChevronDown className="w-3 h-3" /> Manual
                    </button>
                  </div>
                  <div className="space-y-2">
                    {labelOptions.map((option) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: option.color }}
                        />
                        <input
                          type="text"
                          value={option.name}
                          onChange={(e) => {
                            setLabelOptions(labelOptions.map(o =>
                              o.id === option.id ? { ...o, name: e.target.value } : o
                            ));
                          }}
                          className="flex-1 px-3 py-2 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                        />
                        <button
                          onClick={() => setLabelOptions(labelOptions.filter(o => o.id !== option.id))}
                          className="p-1 text-gray-500 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Plus className="w-3 h-3 text-gray-500" />
                      <input
                        type="text"
                        value={newLabelText}
                        onChange={(e) => setNewLabelText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newLabelText.trim()) {
                            setLabelOptions([...labelOptions, {
                              id: Date.now().toString(),
                              name: newLabelText.trim(),
                              color: OPTION_COLORS[labelOptions.length % OPTION_COLORS.length]
                            }]);
                            setNewLabelText('');
                          }
                        }}
                        placeholder="Type or paste options"
                        className="flex-1 px-3 py-2 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500"
                      />
                      <button
                        onClick={() => {
                          if (newLabelText.trim()) {
                            setLabelOptions([...labelOptions, {
                              id: Date.now().toString(),
                              name: newLabelText.trim(),
                              color: OPTION_COLORS[labelOptions.length % OPTION_COLORS.length]
                            }]);
                            setNewLabelText('');
                          }
                        }}
                        className="p-2 bg-violet-600 hover:bg-violet-700 rounded-lg"
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Rating Settings */}
              {selectedType === 'rating' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Emoji type</label>
                    <select
                      value={ratingEmoji}
                      onChange={(e) => setRatingEmoji(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                    >
                      <option value="star">⭐ Star</option>
                      <option value="heart">❤️ Heart</option>
                      <option value="fire">🔥 Fire</option>
                      <option value="thumbsup">👍 Thumbs Up</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Rating scale (1-5)</label>
                    <select
                      value={ratingCount}
                      onChange={(e) => setRatingCount(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                    >
                      <option value={3}>1-3</option>
                      <option value={5}>1-5</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Voting Settings */}
              {selectedType === 'voting' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Emoji type</label>
                    <select
                      value={votingEmoji}
                      onChange={(e) => setVotingEmoji(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                    >
                      <option value="thumbsup">👍 Thumbs Up</option>
                      <option value="heart">❤️ Heart</option>
                      <option value="star">⭐ Star</option>
                      <option value="fire">🔥 Fire</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideVoters}
                      onChange={(e) => setHideVoters(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-[#2e2f3a] text-violet-500 focus:ring-violet-500"
                    />
                    <span className="text-sm text-white">Hide users who have voted</span>
                  </label>
                </div>
              )}

              {/* Money/Currency Settings */}
              {(selectedType === 'money' || selectedType === 'currency') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Currency</label>
                    <select
                      value={currencyType}
                      onChange={(e) => setCurrencyType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                    >
                      <option value="USD">$ USD - US Dollar</option>
                      <option value="EUR">€ EUR - Euro</option>
                      <option value="GBP">£ GBP - British Pound</option>
                      <option value="INR">₹ INR - Indian Rupee</option>
                      <option value="JPY">¥ JPY - Japanese Yen</option>
                      <option value="CNY">¥ CNY - Chinese Yuan</option>
                      <option value="AUD">$ AUD - Australian Dollar</option>
                      <option value="CAD">$ CAD - Canadian Dollar</option>
                      <option value="BRL">R$ BRL - Brazilian Real</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Decimal places</label>
                    <select
                      value={numberPrecision}
                      onChange={(e) => setNumberPrecision(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                    >
                      <option value={0}>0 (e.g., $100)</option>
                      <option value={2}>2 (e.g., $100.00)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Progress Auto Settings */}
              {selectedType === 'progress_auto' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Track completion of</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="progressSource"
                        checked={progressSource === 'subtasks'}
                        onChange={() => setProgressSource('subtasks')}
                        className="w-4 h-4 border-gray-600 bg-[#2e2f3a] text-violet-500 focus:ring-violet-500"
                      />
                      <span className="text-sm text-white">Subtasks</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="progressSource"
                        checked={progressSource === 'checklists'}
                        onChange={() => setProgressSource('checklists')}
                        className="w-4 h-4 border-gray-600 bg-[#2e2f3a] text-violet-500 focus:ring-violet-500"
                      />
                      <span className="text-sm text-white">Checklists</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="progressSource"
                        checked={progressSource === 'comments'}
                        onChange={() => setProgressSource('comments')}
                        className="w-4 h-4 border-gray-600 bg-[#2e2f3a] text-violet-500 focus:ring-violet-500"
                      />
                      <span className="text-sm text-white">Assigned comments</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Progress Manual Settings */}
              {selectedType === 'progress_manual' && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-400 mb-2">Start value</label>
                      <input
                        type="number"
                        value={progressStart}
                        onChange={(e) => setProgressStart(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm text-gray-400 mb-2">End value</label>
                      <input
                        type="number"
                        value={progressEnd}
                        onChange={(e) => setProgressEnd(Number(e.target.value))}
                        className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Number Settings */}
              {selectedType === 'number' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Decimal places</label>
                    <select
                      value={numberPrecision}
                      onChange={(e) => setNumberPrecision(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                    >
                      <option value={0}>0</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-400 mb-2">Prefix</label>
                      <input
                        type="text"
                        value={numberPrefix}
                        onChange={(e) => setNumberPrefix(e.target.value)}
                        placeholder="e.g., $"
                        className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm text-gray-400 mb-2">Suffix</label>
                      <input
                        type="text"
                        value={numberSuffix}
                        onChange={(e) => setNumberSuffix(e.target.value)}
                        placeholder="e.g., %"
                        className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Fill Method - for text and dropdown */}
              {(selectedType === 'text' || selectedType === 'dropdown') && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Fill method</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFillMethod('manual')}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        fillMethod === 'manual'
                          ? "bg-[#2e2f3a] text-white"
                          : "text-gray-500 hover:text-white"
                      )}
                    >
                      Manual fill
                    </button>
                    <button
                      onClick={() => setFillMethod('ai')}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1",
                        fillMethod === 'ai'
                          ? "bg-[#2e2f3a] text-white"
                          : "text-gray-500 hover:text-white"
                      )}
                    >
                      <Sparkles className="w-4 h-4" /> Fill with AI
                    </button>
                  </div>
                </div>
              )}

              {/* More Settings */}
              <div>
                <button
                  onClick={() => setShowMoreSettings(!showMoreSettings)}
                  className="flex items-center justify-between w-full py-2 text-gray-400 hover:text-white"
                >
                  <span className="text-sm">More settings and permissions</span>
                  <ChevronRight className={cn("w-4 h-4 transition-transform", showMoreSettings && "rotate-90")} />
                </button>

                {showMoreSettings && (
                  <div className="space-y-4 pt-2">
                    {/* Description */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Description</label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Tell other users how to use this field"
                        className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    {/* Default Value */}
                    {selectedType === 'text' && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-1.5">Default value</label>
                        <input
                          type="text"
                          value={defaultValue}
                          onChange={(e) => setDefaultValue(e.target.value)}
                          placeholder="Text"
                          className="w-full px-3 py-2.5 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    )}

                    {/* Baseline Permissions */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Baseline permissions</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsPrivate(false)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm",
                            !isPrivate
                              ? "bg-[#2e2f3a] text-white"
                              : "text-gray-500 hover:text-white"
                          )}
                        >
                          <Users className="w-4 h-4" /> Default
                        </button>
                        <button
                          onClick={() => setIsPrivate(true)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm",
                            isPrivate
                              ? "bg-[#2e2f3a] text-white"
                              : "text-gray-500 hover:text-white"
                          )}
                        >
                          <Lock className="w-4 h-4" /> Make private
                        </button>
                      </div>
                    </div>

                    {/* Display Settings */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Display settings</label>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => setIsRequired(!isRequired)}
                            className={cn(
                              "w-10 h-6 rounded-full transition-colors flex-shrink-0",
                              isRequired ? "bg-violet-500" : "bg-gray-600"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded-full bg-white transition-transform mx-1 mt-1",
                              isRequired && "translate-x-4"
                            )} />
                          </button>
                          <div>
                            <p className="text-sm text-white">Required in tasks</p>
                            <p className="text-xs text-gray-500">Required Custom Fields must be filled out when creating tasks.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => setIsPinned(!isPinned)}
                            className={cn(
                              "w-10 h-6 rounded-full transition-colors flex-shrink-0",
                              isPinned ? "bg-violet-500" : "bg-gray-600"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded-full bg-white transition-transform mx-1 mt-1",
                              isPinned && "translate-x-4"
                            )} />
                          </button>
                          <div>
                            <p className="text-sm text-white">Pinned</p>
                            <p className="text-xs text-gray-500">Pinned Custom Fields will always be displayed in Task view, even if empty.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => setIsVisibleToGuests(!isVisibleToGuests)}
                            className={cn(
                              "w-10 h-6 rounded-full transition-colors flex-shrink-0",
                              isVisibleToGuests ? "bg-violet-500" : "bg-gray-600"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded-full bg-white transition-transform mx-1 mt-1",
                              isVisibleToGuests && "translate-x-4"
                            )} />
                          </button>
                          <div>
                            <p className="text-sm text-white">Visible to guests and limited members</p>
                            <p className="text-xs text-gray-500">Custom Fields can be hidden or shown to guests and limited members.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'configure' && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#3e3f4a]">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!fieldName.trim() || createFieldMutation.isPending}
              className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createFieldMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
