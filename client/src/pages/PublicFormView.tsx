import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formsApi, formResponsesApi, membersApi, taskStatusesApi, Member, type TaskStatus } from '../services/api';
import { ArrowLeft, Loader2, Check, Send, Upload, X, Image as ImageIcon, User, Search, ChevronDown, Flag, Circle, Ban } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Form, FormField } from '../types';

// Priority options matching ClickUp
const priorityOptions = [
  { id: 'urgent', name: 'Urgent', color: '#ef4444', flag: '🟥' },
  { id: 'high', name: 'High', color: '#f97316', flag: '🟧' },
  { id: 'normal', name: 'Normal', color: '#3b82f6', flag: '🟦' },
  { id: 'low', name: 'Low', color: '#6b7280', flag: '⬜' },
];

export default function PublicFormView() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploadingFields, setUploadingFields] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { name: string; url: string; type: string }[]>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const assigneeRef = useRef<HTMLDivElement>(null);

  const { data: form, isLoading, error } = useQuery({
    queryKey: ['public-form', formId],
    queryFn: () => formsApi.getById(formId!),
    enabled: !!formId
  });

  // Fetch workspace members for assignee dropdown
  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: membersApi.getAll
  });

  // Fetch statuses for this form (form-level or inherited from space)
  const { data: formStatuses = [] } = useQuery({
    queryKey: ['task-statuses-form', formId],
    queryFn: () => taskStatusesApi.getByForm(formId!),
    enabled: !!formId
  });

  // Fallback: fetch space statuses if form has none
  const { data: spaceStatuses = [] } = useQuery({
    queryKey: ['task-statuses-space', form?.space_id],
    queryFn: () => taskStatusesApi.getBySpace(form!.space_id),
    enabled: !!form?.space_id && formStatuses.length === 0
  });

  const statusOptions = formStatuses.length > 0 ? formStatuses : spaceStatuses;

  // Dropdown open state for status and priority
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);

  // Close assignee/status/priority dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) {
        setAssigneeDropdownOpen(null);
        setAssigneeSearch('');
      }
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) {
        setPriorityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const submitMutation = useMutation({
    mutationFn: (data: any) => formResponsesApi.create(data),
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['form-responses', formId] });
      toast.success('Response submitted successfully!');
    },
    onError: () => {
      toast.error('Failed to submit response');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // Validate required fields
    const missingRequired = form.fields?.filter(
      (field: FormField) => field.required && !formData[field.id]
    );

    if (missingRequired && missingRequired.length > 0) {
      toast.error(`Please fill in all required fields`);
      return;
    }

    // Build response_data with field LABELS as keys (not IDs) for better readability
    // Include ALL fields in response_data for display purposes
    // Task Name, Status, Priority, Assignee are excluded since they become top-level fields
    const responseData: Record<string, any> = {};
    form.fields?.forEach((field: FormField) => {
      if (formData[field.id] !== undefined && formData[field.id] !== '') {
        // Exclude fields that map to top-level response properties
        if (field.mapTo !== 'name' && field.mapTo !== 'status' && field.mapTo !== 'priority'
            && field.mapTo !== 'assignee'
            && field.type !== 'status' && field.type !== 'priority'
            && field.type !== 'assignee' && field.type !== 'people') {
          responseData[field.label] = formData[field.id];
        }
      }
    });

    // Generate a name from the Task Name field (mapped to 'name') or first text field
    // In ClickUp, task name is just the value entered, without appending form name or date
    const taskNameField = form.fields?.find((f: FormField) => f.mapTo === 'name' && formData[f.id]);
    const firstTextField = form.fields?.find((f: FormField) =>
      ['text', 'short_text', 'email'].includes(f.type) && formData[f.id]
    );
    const responseName = taskNameField
      ? String(formData[taskNameField.id])
      : firstTextField
        ? String(formData[firstTextField.id])
        : `Response ${new Date().toLocaleDateString()}`;

    // Get assignee if an assignee field was filled
    const assigneeField = form.fields?.find((f: FormField) =>
      (f.type === 'assignee' || f.type === 'people' || f.mapTo === 'assignee') && formData[f.id]
    );
    const assigneeId = assigneeField ? formData[assigneeField.id] : undefined;

    // Get description if a description field was filled
    const descriptionField = form.fields?.find((f: FormField) => f.mapTo === 'description' && formData[f.id]);
    const description = descriptionField ? String(formData[descriptionField.id]) : undefined;

    // Get status if a status field was filled
    const statusField = form.fields?.find((f: FormField) =>
      (f.type === 'status' || f.mapTo === 'status') && formData[f.id]
    );
    const selectedStatus = statusField ? formData[statusField.id] : 'to_do';

    // Get priority if a priority field was filled
    const priorityField = form.fields?.find((f: FormField) =>
      (f.type === 'priority' || f.mapTo === 'priority') && formData[f.id]
    );
    const selectedPriority = priorityField ? formData[priorityField.id] : 'normal';

    submitMutation.mutate({
      form_id: formId,
      name: responseName,
      response_data: responseData,
      status: selectedStatus,
      priority: selectedPriority,
      assignee_id: assigneeId,
      description: description
    });
  };

  const updateField = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  // Handle file upload to Supabase Storage
  const handleFileUpload = async (fieldId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingFields(prev => new Set(prev).add(fieldId));
    const uploadedUrls: { name: string; url: string; type: string }[] = [];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    try {
      for (const file of Array.from(files)) {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} exceeds 10MB limit`);
          continue;
        }

        // Create a unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const fileExt = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
        const fileName = `${formId}/${timestamp}-${randomStr}.${fileExt}`;

        const { error } = await supabase.storage
          .from('form-uploads')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error('Upload error:', error);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('form-uploads')
          .getPublicUrl(fileName);

        uploadedUrls.push({
          name: file.name,
          url: publicUrl,
          type: file.type
        });
      }

      if (uploadedUrls.length > 0) {
        setUploadedFiles(prev => ({
          ...prev,
          [fieldId]: [...(prev[fieldId] || []), ...uploadedUrls]
        }));
        // Store URLs in formData for submission
        const existingUrls = formData[fieldId] || [];
        const newUrls = [...existingUrls, ...uploadedUrls.map(f => f.url)];
        setFormData(prev => ({ ...prev, [fieldId]: newUrls }));
        toast.success(`${uploadedUrls.length} file(s) uploaded successfully`);
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploadingFields(prev => {
        const next = new Set(prev);
        next.delete(fieldId);
        return next;
      });
    }
  };

  const removeUploadedFile = (fieldId: string, index: number) => {
    setUploadedFiles(prev => ({
      ...prev,
      [fieldId]: prev[fieldId]?.filter((_, i) => i !== index) || []
    }));
    setFormData(prev => ({
      ...prev,
      [fieldId]: (prev[fieldId] || []).filter((_: any, i: number) => i !== index)
    }));
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id] || '';

    // Check if this is an assignee field (by type or mapTo)
    if (field.type === 'assignee' || field.type === 'people' || field.mapTo === 'assignee') {
      const selectedMember = members.find((m: Member) => m.id === value);
      const filteredMembers = members.filter((m: Member) =>
        m.name?.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
        m.email?.toLowerCase().includes(assigneeSearch.toLowerCase())
      );
      const isDropdownOpen = assigneeDropdownOpen === field.id;

      return (
        <div className="relative" ref={isDropdownOpen ? assigneeRef : undefined}>
          {/* Trigger Button */}
          <button
            type="button"
            onClick={() => {
              setAssigneeDropdownOpen(isDropdownOpen ? null : field.id);
              setAssigneeSearch('');
            }}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-left flex items-center gap-3 hover:border-violet-500 transition-colors"
          >
            {selectedMember ? (
              <>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: '#6366f1' }}
                >
                  {selectedMember.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <span className="text-gray-900 dark:text-white flex-1">{selectedMember.name}</span>
                <X
                  className="w-4 h-4 text-gray-400 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateField(field.id, '');
                  }}
                />
              </>
            ) : (
              <>
                <User className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                <span className="text-gray-400 dark:text-slate-500 flex-1">Select assignee...</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </>
            )}
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 max-h-64 overflow-hidden">
              {/* Search Input */}
              <div className="p-2 border-b border-gray-200 dark:border-[#1f2229]">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    placeholder="Search or enter email..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-violet-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Members List */}
              <div className="max-h-48 overflow-y-auto">
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member: Member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        updateField(field.id, member.id);
                        setAssigneeDropdownOpen(null);
                        setAssigneeSearch('');
                      }}
                      className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors ${
                        value === member.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: '#6366f1' }}
                      >
                        {member.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <span className="text-sm text-gray-900 dark:text-white">{member.name}</span>
                      {value === member.id && (
                        <Check className="w-4 h-4 text-violet-500 ml-auto" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-sm text-gray-400 dark:text-slate-500">
                    No members found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Status field
    if (field.type === 'status' || field.mapTo === 'status') {
      const selectedStatusOption = statusOptions.find((s: TaskStatus) => s.id === value || s.name === value);
      return (
        <div className="relative" ref={statusDropdownOpen ? statusRef : undefined}>
          <button
            type="button"
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-left flex items-center gap-3 hover:border-violet-500 transition-colors"
          >
            {selectedStatusOption ? (
              <>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedStatusOption.color }} />
                <span className="text-gray-900 dark:text-white flex-1">{selectedStatusOption.name}</span>
                <X
                  className="w-4 h-4 text-gray-400 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateField(field.id, '');
                  }}
                />
              </>
            ) : (
              <>
                <Circle className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                <span className="text-gray-400 dark:text-slate-500 flex-1">Select option...</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </>
            )}
          </button>

          {statusDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto py-1">
              {statusOptions.length > 0 ? (
                statusOptions.map((s: TaskStatus) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      updateField(field.id, s.id);
                      setStatusDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors ${
                      value === s.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-sm text-gray-900 dark:text-white flex-1">{s.name}</span>
                    {value === s.id && <Check className="w-4 h-4 text-violet-500" />}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-sm text-gray-400 dark:text-slate-500">
                  No statuses available
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Priority field
    if (field.type === 'priority' || field.mapTo === 'priority') {
      const selectedPriorityOption = priorityOptions.find(p => p.id === value);
      return (
        <div className="relative" ref={priorityDropdownOpen ? priorityRef : undefined}>
          <button
            type="button"
            onClick={() => setPriorityDropdownOpen(!priorityDropdownOpen)}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-left flex items-center gap-3 hover:border-violet-500 transition-colors"
          >
            {selectedPriorityOption ? (
              <>
                <Flag className="w-4 h-4 flex-shrink-0" style={{ color: selectedPriorityOption.color }} />
                <span className="text-gray-900 dark:text-white flex-1">{selectedPriorityOption.flag}{selectedPriorityOption.name}</span>
                <X
                  className="w-4 h-4 text-gray-400 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateField(field.id, '');
                  }}
                />
              </>
            ) : (
              <>
                <Flag className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                <span className="text-gray-400 dark:text-slate-500 flex-1">Select Priority</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </>
            )}
          </button>

          {priorityDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
              {priorityOptions.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    updateField(field.id, p.id);
                    setPriorityDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors ${
                    value === p.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''
                  }`}
                >
                  <span>{p.flag}</span>
                  <span className="text-sm text-gray-900 dark:text-white flex-1">{p.name}</span>
                  {value === p.id && <Check className="w-4 h-4 text-violet-500" />}
                </button>
              ))}
              <div className="border-t border-gray-200 dark:border-[#1f2229] mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    updateField(field.id, '');
                    setPriorityDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors text-gray-400"
                >
                  <Ban className="w-4 h-4" />
                  <span className="text-sm">Clear</span>
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    switch (field.type) {
      case 'text':
      case 'short_text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <input
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'url' ? 'url' : 'text'}
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || 'Enter text...'}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500"
            required={field.required}
          />
        );

      case 'textarea':
      case 'long_text':
        return (
          <textarea
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || 'Enter text...'}
            rows={4}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
            required={field.required}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || 'Enter number...'}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500"
            required={field.required}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
            required={field.required}
          />
        );

      case 'dropdown':
      case 'single_select':
        return (
          <select
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
            required={field.required}
          >
            <option value="">Select an option...</option>
            {field.options?.map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'checkbox':
      case 'multi_select':
        return (
          <div className="space-y-2">
            {field.options?.map((opt: string) => (
              <label key={opt} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) ? value.includes(opt) : false}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      updateField(field.id, [...currentValues, opt]);
                    } else {
                      updateField(field.id, currentValues.filter((v: string) => v !== opt));
                    }
                  }}
                  className="w-5 h-5 rounded border-gray-300 dark:border-[#1f2229] bg-gray-100 dark:bg-[#14151a] text-violet-600 focus:ring-violet-500"
                />
                <span className="text-gray-900 dark:text-white">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'rating':
        return (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => updateField(field.id, star)}
                className={`text-2xl ${value >= star ? 'text-yellow-400' : 'text-gray-400 dark:text-slate-600'} hover:text-yellow-400 transition-colors`}
              >
                ★
              </button>
            ))}
          </div>
        );

      case 'image':
      case 'screenshot':
      case 'files':
      case 'attachments':
      case 'attach_documents':
      case 'uploads':
        const isImageOnly = field.type === 'image' || field.type === 'screenshot';
        const acceptTypes = isImageOnly ? 'image/*' : '*/*';
        const fieldFiles = uploadedFiles[field.id] || [];
        const isUploading = uploadingFields.has(field.id);

        return (
          <div className="space-y-3">
            {/* Upload Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
                ${isUploading ? 'border-violet-500 bg-violet-500/10' : 'border-gray-300 dark:border-[#1f2229] hover:border-violet-500 hover:bg-gray-100 dark:hover:bg-slate-800/50'}`}
              onClick={() => !isUploading && fileInputRefs.current[field.id]?.click()}
            >
              <input
                type="file"
                ref={(el) => { fileInputRefs.current[field.id] = el; }}
                accept={acceptTypes}
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(field.id, e.target.files)}
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                  <span className="text-gray-500 dark:text-slate-400">Uploading...</span>
                </div>
              ) : (
                <>
                  {isImageOnly ? (
                    <ImageIcon className="w-8 h-8 text-gray-500 dark:text-slate-400 mx-auto mb-2" />
                  ) : (
                    <Upload className="w-8 h-8 text-gray-500 dark:text-slate-400 mx-auto mb-2" />
                  )}
                  <p className="text-gray-500 dark:text-slate-400">
                    Click to upload
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {isImageOnly ? 'Supports: JPG, PNG, GIF, WebP' : 'Supports: All file types up to 10MB'}
                  </p>
                </>
              )}
            </div>

            {/* Uploaded Files Preview */}
            {fieldFiles.length > 0 && (
              <div className="space-y-2">
                {fieldFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-[#14151a] rounded-lg border border-gray-200 dark:border-[#1f2229]">
                    {file.type.startsWith('image/') ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 dark:bg-[#15161a] rounded flex items-center justify-center">
                        <Upload className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">{file.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">Uploaded</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeUploadedFile(field.id, index);
                      }}
                      className="p-1 text-gray-500 dark:text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || 'Enter text...'}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading form...</span>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Form not found</h1>
          <p className="text-gray-500 dark:text-slate-400 mb-4">The form you're looking for doesn't exist or has been deleted.</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Thank you!</h1>
          <p className="text-gray-500 dark:text-slate-400 mb-4">Your response has been submitted successfully.</p>
          <button
            onClick={() => {
              setFormData({});
              setSubmitted(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Form Header */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <div className="w-6 h-6 bg-white transform rotate-45" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{form.name}</h1>
          {form.description && (
            <p className="text-gray-500 dark:text-slate-400">{form.description}</p>
          )}
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#252631] rounded-xl p-6 shadow-lg">
          <div className="space-y-6">
            {form.fields && form.fields.length > 0 ? (
              form.fields.map((field: FormField) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.helpText && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">{field.helpText}</p>
                  )}
                  {renderField(field)}
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-slate-400 text-center py-8">This form has no fields yet.</p>
            )}
          </div>

          {form.fields && form.fields.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Response
                  </>
                )}
              </button>
            </div>
          )}
        </form>

        {/* Footer */}
        <p className="text-center text-gray-400 dark:text-slate-500 text-sm mt-6">
          Powered by Synergy Hub
        </p>
      </div>
    </div>
  );
}
