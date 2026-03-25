import { supabase } from '../lib/supabase';
import type {
  Project,
  Task,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  Space,
  Folder,
  Comment,
  SprintFolder,
  Sprint,
  Doc,
  DocPage,
  Form,
  FormResponse
} from '../types';

// Projects API
export const projectsApi = {
  async getAll(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getById(id: string): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(input: CreateProjectInput): Promise<Project> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('projects')
      .insert({
        ...input,
        owner_id: user?.id || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, input: Partial<Project>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// Spaces API
export const spacesApi = {
  async getAll(): Promise<Space[]> {
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(input: { name: string; description?: string; color?: string; icon?: string }): Promise<Space> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('spaces')
      .insert({
        name: input.name,
        description: input.description || null,
        color: input.color || '#6366f1',
        icon: input.icon || '📁',
        owner_id: user?.id || null
      })
      .select()
      .single();

    if (error) {
      console.error('Space creation error:', error);
      throw new Error(error.message || 'Failed to create space');
    }
    return data;
  },

  async update(id: string, input: Partial<Space>): Promise<Space> {
    const { data, error } = await supabase
      .from('spaces')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// Folders API
export const foldersApi = {
  async getAll(): Promise<Folder[]> {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getBySpace(spaceId: string): Promise<Folder[]> {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async create(input: { name: string; space_id: string }): Promise<Folder> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('folders')
      .insert({
        name: input.name,
        space_id: input.space_id,
        owner_id: user?.id || null
      })
      .select()
      .single();

    if (error) {
      console.error('Folder creation error:', error);
      throw new Error(error.message || 'Failed to create folder');
    }
    return data;
  },

  async update(id: string, input: Partial<Folder>): Promise<Folder> {
    console.log('foldersApi.update called with id:', id, 'input:', input);
    const { data, error } = await supabase
      .from('folders')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    console.log('Supabase update result:', { data, error });
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// Tasks API (stored in 'lists' table)
// Hierarchy: Space > Folder > Task
export const tasksApi = {
  async getAll(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getBySpace(spaceId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('space_id', spaceId)
      .order('position', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getByFolder(folderId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('folder_id', folderId)
      .order('position', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async create(input: CreateTaskInput): Promise<Task> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('lists')
      .insert({
        name: input.name,
        description: input.description || null,
        space_id: input.space_id,
        folder_id: input.folder_id || null,
        list_id: input.list_id || null,
        status: input.status || 'To Do',
        priority: input.priority || 'MEDIUM',
        due_date: input.due_date || null,
        start_date: input.start_date || null,
        assignee_name: input.assignee_name || null,
        assignees: input.assignees || null,
        estimated_hours: input.estimated_hours || null,
        tags: input.tags || null,
        sprint_id: input.sprint_id || null,
        sprint_points: input.sprint_points || null,
        position: 0,
        is_completed: false,
        owner_id: user?.id || null
      })
      .select()
      .single();

    if (error) {
      console.error('Task creation error:', error);
      throw new Error(error.message || 'Failed to create task');
    }
    return data;
  },

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.due_date !== undefined) updateData.due_date = input.due_date;
    if (input.start_date !== undefined) updateData.start_date = input.start_date;
    if (input.position !== undefined) updateData.position = input.position;
    if (input.assignee_name !== undefined) updateData.assignee_name = input.assignee_name;
    if (input.assignees !== undefined) updateData.assignees = input.assignees;
    if (input.estimated_hours !== undefined) updateData.estimated_hours = input.estimated_hours;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.task_type !== undefined) updateData.task_type = input.task_type;
    if (input.tracked_time !== undefined) updateData.tracked_time = input.tracked_time;
    if (input.checklists !== undefined) updateData.checklists = input.checklists;
    if (input.sprint_id !== undefined) updateData.sprint_id = input.sprint_id;
    if (input.sprint_points !== undefined) updateData.sprint_points = input.sprint_points;
    if (input.is_completed !== undefined) {
      updateData.is_completed = input.is_completed;
      if (input.is_completed) {
        updateData.completed_date = new Date().toISOString();
        updateData.status = 'Done';
      }
    }

    const { data, error } = await supabase
      .from('lists')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Task update error:', error);
      throw new Error(error.message || 'Failed to update task');
    }
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// Backward compatibility alias
export const listsApi = tasksApi;

// Comments API
export const commentsApi = {
  async getByTask(taskId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('list_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async create(taskId: string, content: string): Promise<Comment> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('comments')
      .insert({
        list_id: taskId,
        content,
        user_id: user?.id || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, content: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .update({ content })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// Members API
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface Member {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'limited_member' | 'guest';
  status: 'pending' | 'active' | 'offline';
}

export interface SpaceMember {
  id: string;
  space_id: string;
  member_id: string;
  permission: 'full_edit' | 'edit' | 'comment' | 'view_only';
  member?: Member;
}

export const membersApi = {
  async getAll(): Promise<Member[]> {
    const response = await fetch(`${API_BASE_URL}/api/members`);
    if (!response.ok) throw new Error('Failed to fetch members');
    return response.json();
  }
};

export const spaceMembersApi = {
  async getBySpace(spaceId: string): Promise<SpaceMember[]> {
    const response = await fetch(`${API_BASE_URL}/api/space-members/space/${spaceId}`);
    if (!response.ok) throw new Error('Failed to fetch space members');
    return response.json();
  },

  async getByMember(memberId: string): Promise<{ space_id: string; permission: string }[]> {
    const response = await fetch(`${API_BASE_URL}/api/space-members/member/${memberId}`);
    if (!response.ok) throw new Error('Failed to fetch member spaces');
    return response.json();
  },

  async addMember(data: { space_id: string; member_id: string; permission?: string; added_by?: string }): Promise<SpaceMember> {
    const response = await fetch(`${API_BASE_URL}/api/space-members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add member');
    }
    return response.json();
  },

  async addBulkMembers(data: { space_id: string; members: { member_id: string; permission?: string }[]; added_by?: string }): Promise<SpaceMember[]> {
    const response = await fetch(`${API_BASE_URL}/api/space-members/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add members');
    }
    return response.json();
  },

  async updatePermission(id: string, permission: string): Promise<SpaceMember> {
    const response = await fetch(`${API_BASE_URL}/api/space-members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission })
    });
    if (!response.ok) throw new Error('Failed to update permission');
    return response.json();
  },

  async removeMember(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/space-members/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to remove member');
  }
};

// Task Lists API (Lists that contain tasks)
// Hierarchy: Space > Folder > List > Task
export interface TaskList {
  id: string;
  name: string;
  description?: string;
  color: string;
  space_id: string;
  folder_id?: string;
  owner_id?: string;
  position: number;
  created_at: string;
  updated_at?: string;
}

export const taskListsApi = {
  async getAll(): Promise<TaskList[]> {
    const response = await fetch(`${API_BASE_URL}/api/task-lists`);
    if (!response.ok) throw new Error('Failed to fetch task lists');
    return response.json();
  },

  async getBySpace(spaceId: string): Promise<TaskList[]> {
    const response = await fetch(`${API_BASE_URL}/api/task-lists/space/${spaceId}`);
    if (!response.ok) throw new Error('Failed to fetch space lists');
    return response.json();
  },

  async getByFolder(folderId: string): Promise<TaskList[]> {
    const response = await fetch(`${API_BASE_URL}/api/task-lists/folder/${folderId}`);
    if (!response.ok) throw new Error('Failed to fetch folder lists');
    return response.json();
  },

  async getAllBySpace(spaceId: string): Promise<TaskList[]> {
    const response = await fetch(`${API_BASE_URL}/api/task-lists/space/${spaceId}/all`);
    if (!response.ok) throw new Error('Failed to fetch all space lists');
    return response.json();
  },

  async create(input: { name: string; description?: string; color?: string; space_id?: string; folder_id?: string }): Promise<TaskList> {
    const response = await fetch(`${API_BASE_URL}/api/task-lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create list');
    }
    return response.json();
  },

  async update(id: string, input: Partial<TaskList>): Promise<TaskList> {
    const response = await fetch(`${API_BASE_URL}/api/task-lists/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('Failed to update list');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/task-lists/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete list');
  }
};

// AI API

export const aiApi = {
  async askAI(question: string, taskContext: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
  }): Promise<{ answer: string }> {
    const response = await fetch(`${API_BASE_URL}/api/ai/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question, taskContext }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get AI response');
    }

    return response.json();
  },

  async writeDescription(taskTitle: string, additionalContext?: string): Promise<{ description: string }> {
    const response = await fetch(`${API_BASE_URL}/api/ai/write-description`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskTitle, additionalContext }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate description');
    }

    return response.json();
  },

  async suggestPriority(taskTitle: string, taskDescription?: string, dueDate?: string): Promise<{ priority: string }> {
    const response = await fetch(`${API_BASE_URL}/api/ai/suggest-priority`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskTitle, taskDescription, dueDate }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to suggest priority');
    }

    return response.json();
  }
};

// Custom Fields API

export type CustomFieldType =
  // Basic fields
  | 'dropdown' | 'text' | 'textarea' | 'number' | 'date' | 'checkbox'
  // Contact fields
  | 'email' | 'url' | 'phone' | 'website'
  // Advanced fields
  | 'currency' | 'money' | 'labels' | 'people' | 'files' | 'location'
  // Progress fields
  | 'progress_auto' | 'progress_manual' | 'progress_updates'
  // Relationship fields
  | 'relationship' | 'tasks'
  // Rating fields
  | 'rating' | 'voting'
  // AI fields
  | 'ai_summary' | 'ai_custom_text' | 'ai_custom_dropdown'
  | 'translation' | 'sentiment' | 'categorize'
  // Formula
  | 'formula';

export interface DropdownOption {
  id: string;
  name: string;
  color: string;
}

export interface CustomFieldTypeConfig {
  // Dropdown
  options?: DropdownOption[];
  sorting?: 'manual' | 'name_asc' | 'name_desc';
  // Number
  precision?: number;
  prefix?: string;
  suffix?: string;
  // People
  show_workspace?: boolean;
  show_guests?: boolean;
  multiple?: boolean;
  include_teams?: boolean;
  // Text
  default_text?: string;
  // Currency/Money
  currency_type?: string;
  // Rating
  emoji?: string;
  count?: number;
  // Location
  format?: string;
  // Progress
  progress_source?: 'subtasks' | 'checklists' | 'comments' | 'manual';
  // Formula
  formula?: string;
  // AI fields
  ai_prompt?: string;
}

export interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
  type_config: CustomFieldTypeConfig;
  space_id: string;
  folder_id?: string;
  list_id?: string;
  description?: string;
  default_value?: string;
  is_required: boolean;
  is_pinned: boolean;
  is_visible_to_guests: boolean;
  is_private: boolean;
  position: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface CustomFieldValue {
  id: string;
  task_id: string;
  field_id: string;
  value_text?: string;
  value_number?: number;
  value_boolean?: boolean;
  value_date?: string;
  value_json?: any;
  created_at: string;
  updated_at?: string;
}

export interface CreateCustomFieldInput {
  name: string;
  type: CustomFieldType;
  type_config?: CustomFieldTypeConfig;
  space_id: string;
  folder_id?: string;
  list_id?: string;
  description?: string;
  default_value?: string;
  is_required?: boolean;
  is_pinned?: boolean;
  is_visible_to_guests?: boolean;
  is_private?: boolean;
  created_by?: string;
}

export const customFieldsApi = {
  // Get all custom fields for a space (space-level only)
  async getBySpace(spaceId: string): Promise<CustomField[]> {
    const response = await fetch(`${API_BASE_URL}/api/custom-fields/space/${spaceId}`);
    if (!response.ok) throw new Error('Failed to fetch custom fields');
    return response.json();
  },

  // Get all custom fields for a folder (folder + inherited from space)
  async getByFolder(folderId: string): Promise<CustomField[]> {
    const response = await fetch(`${API_BASE_URL}/api/custom-fields/folder/${folderId}`);
    if (!response.ok) throw new Error('Failed to fetch custom fields');
    return response.json();
  },

  // Get all custom fields for a list (list + folder + space inheritance)
  async getByList(listId: string): Promise<CustomField[]> {
    const response = await fetch(`${API_BASE_URL}/api/custom-fields/list/${listId}`);
    if (!response.ok) throw new Error('Failed to fetch custom fields');
    return response.json();
  },

  // Get all custom fields
  async getAll(): Promise<CustomField[]> {
    const response = await fetch(`${API_BASE_URL}/api/custom-fields`);
    if (!response.ok) throw new Error('Failed to fetch custom fields');
    return response.json();
  },

  // Create a custom field
  async create(input: CreateCustomFieldInput): Promise<CustomField> {
    const response = await fetch(`${API_BASE_URL}/api/custom-fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create custom field');
    }
    return response.json();
  },

  // Update a custom field
  async update(id: string, input: Partial<CustomField>): Promise<CustomField> {
    const response = await fetch(`${API_BASE_URL}/api/custom-fields/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('Failed to update custom field');
    return response.json();
  },

  // Delete a custom field
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/custom-fields/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete custom field');
  },

  // Get field values for a task
  async getValuesByTask(taskId: string): Promise<CustomFieldValue[]> {
    const response = await fetch(`${API_BASE_URL}/api/custom-fields/values/task/${taskId}`);
    if (!response.ok) throw new Error('Failed to fetch field values');
    return response.json();
  },

  // Get field values for multiple tasks (batch)
  async getValuesBatch(taskIds: string[]): Promise<CustomFieldValue[]> {
    const response = await fetch(`${API_BASE_URL}/api/custom-fields/values/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds })
    });
    if (!response.ok) throw new Error('Failed to fetch field values');
    return response.json();
  },

  // Set a field value for a task
  async setValue(taskId: string, fieldId: string, value: any): Promise<CustomFieldValue> {
    const response = await fetch(`${API_BASE_URL}/api/custom-fields/values`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, field_id: fieldId, value })
    });
    if (!response.ok) throw new Error('Failed to set field value');
    return response.json();
  },

  // Delete a field value
  async deleteValue(taskId: string, fieldId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/custom-fields/values/${taskId}/${fieldId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete field value');
  }
};

// Task Status interface
export interface TaskStatus {
  id: string;
  name: string;
  color: string;
  status_group: 'active' | 'done' | 'closed';
  position: number;
  space_id?: string;
  folder_id?: string;
  list_id?: string;
  sprint_id?: string;
  form_id?: string;
  inherit_from_parent?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Task Statuses API
export const taskStatusesApi = {
  // Get statuses for a space
  async getBySpace(spaceId: string): Promise<TaskStatus[]> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses/space/${spaceId}`);
    if (!response.ok) throw new Error('Failed to fetch statuses');
    return response.json();
  },

  // Get statuses for a folder (with inheritance)
  async getByFolder(folderId: string): Promise<TaskStatus[]> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses/folder/${folderId}`);
    if (!response.ok) throw new Error('Failed to fetch statuses');
    return response.json();
  },

  // Get statuses for a list (with inheritance)
  async getByList(listId: string): Promise<TaskStatus[]> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses/list/${listId}`);
    if (!response.ok) throw new Error('Failed to fetch statuses');
    return response.json();
  },

  // Get statuses for a form
  async getByForm(formId: string): Promise<TaskStatus[]> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses/form/${formId}`);
    if (!response.ok) throw new Error('Failed to fetch statuses');
    return response.json();
  },

  // Get statuses for a sprint (strict isolation)
  async getBySprint(sprintId: string): Promise<TaskStatus[]> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses/sprint/${sprintId}`);
    if (!response.ok) throw new Error('Failed to fetch statuses');
    return response.json();
  },

  // Create a status
  async create(input: Partial<TaskStatus>): Promise<TaskStatus> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('Failed to create status');
    return response.json();
  },

  // Update a status
  async update(id: string, input: Partial<TaskStatus>): Promise<TaskStatus> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('Failed to update status');
    return response.json();
  },

  // Delete a status
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete status');
  },

  // Bulk update statuses (strict isolation - only one scope allowed)
  async bulkUpdate(data: {
    statuses: Partial<TaskStatus>[];
    space_id?: string;
    folder_id?: string;
    list_id?: string;
    sprint_id?: string;
    form_id?: string;
  }): Promise<TaskStatus[]> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses/bulk/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update statuses');
    return response.json();
  },

  // Update status settings (inherit vs custom)
  async updateSettings(scope: 'space' | 'folder' | 'list', id: string, settings: {
    use_custom_statuses?: boolean;
    status_template?: string;
  }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses/settings/${scope}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error('Failed to update status settings');
    return response.json();
  },

  // Initialize default statuses for a scope
  async initialize(data: {
    space_id?: string;
    folder_id?: string;
    list_id?: string;
    sprint_id?: string;
  }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to initialize statuses');
    return response.json();
  },

  // Copy statuses from one scope to another
  async copy(data: {
    from_space_id?: string;
    from_folder_id?: string;
    from_list_id?: string;
    to_space_id?: string;
    to_folder_id?: string;
    to_list_id?: string;
    to_sprint_id?: string;
  }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/task-statuses/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to copy statuses');
    return response.json();
  }
};

// Sprint Folders API
export const sprintFoldersApi = {
  async getAll(): Promise<SprintFolder[]> {
    const response = await fetch(`${API_BASE_URL}/api/sprints/folders`);
    if (!response.ok) throw new Error('Failed to fetch sprint folders');
    return response.json();
  },

  async getBySpace(spaceId: string): Promise<SprintFolder[]> {
    const response = await fetch(`${API_BASE_URL}/api/sprints/folders/space/${spaceId}`);
    if (!response.ok) throw new Error('Failed to fetch sprint folders');
    return response.json();
  },

  async create(input: { name?: string; space_id: string; default_duration?: number; folder_id?: string }): Promise<{ folder: SprintFolder; sprint: Sprint; backlog: any }> {
    const response = await fetch(`${API_BASE_URL}/api/sprints/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create sprint folder');
    }
    return response.json();
  },

  async update(id: string, input: Partial<SprintFolder>): Promise<SprintFolder> {
    const response = await fetch(`${API_BASE_URL}/api/sprints/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('Failed to update sprint folder');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/sprints/folders/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete sprint folder');
  }
};

// Sprints API
export const sprintsApi = {
  async getAll(): Promise<Sprint[]> {
    const response = await fetch(`${API_BASE_URL}/api/sprints`);
    if (!response.ok) throw new Error('Failed to fetch sprints');
    return response.json();
  },

  async getByFolder(folderId: string): Promise<Sprint[]> {
    const response = await fetch(`${API_BASE_URL}/api/sprints/folder/${folderId}`);
    if (!response.ok) throw new Error('Failed to fetch sprints');
    return response.json();
  },

  async create(input: { name?: string; sprint_folder_id: string; space_id: string; start_date: string; end_date: string; folder_id?: string }): Promise<Sprint> {
    const response = await fetch(`${API_BASE_URL}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create sprint');
    }
    return response.json();
  },

  async update(id: string, input: Partial<Sprint>): Promise<Sprint> {
    const response = await fetch(`${API_BASE_URL}/api/sprints/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('Failed to update sprint');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/sprints/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete sprint');
  },

  async rollover(id: string, targetSprintId: string): Promise<{ message: string; moved: number; tasks: any[] }> {
    const response = await fetch(`${API_BASE_URL}/api/sprints/${id}/rollover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_sprint_id: targetSprintId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to rollover sprint');
    }
    return response.json();
  }
};

// Docs API
export const docsApi = {
  async getAll(): Promise<Doc[]> {
    const response = await fetch(`${API_BASE_URL}/api/docs`);
    if (!response.ok) throw new Error('Failed to fetch docs');
    return response.json();
  },

  async getBySpace(spaceId: string): Promise<Doc[]> {
    const response = await fetch(`${API_BASE_URL}/api/docs/space/${spaceId}`);
    if (!response.ok) throw new Error('Failed to fetch space docs');
    return response.json();
  },

  async getByFolder(folderId: string): Promise<Doc[]> {
    const response = await fetch(`${API_BASE_URL}/api/docs/folder/${folderId}`);
    if (!response.ok) throw new Error('Failed to fetch folder docs');
    return response.json();
  },

  async getById(id: string): Promise<Doc> {
    const response = await fetch(`${API_BASE_URL}/api/docs/${id}`);
    if (!response.ok) throw new Error('Failed to fetch doc');
    return response.json();
  },

  async getPublic(id: string): Promise<Doc> {
    const response = await fetch(`${API_BASE_URL}/api/docs/public/${id}`);
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('This document is not publicly shared');
      }
      throw new Error('Failed to fetch doc');
    }
    return response.json();
  },

  async create(input: { name: string; space_id?: string; folder_id?: string; content?: string; sharing?: string; tags?: string[]; cover_image?: string; icon?: string; is_wiki?: boolean; owner_id?: string }): Promise<Doc> {
    const response = await fetch(`${API_BASE_URL}/api/docs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create doc');
    }
    return response.json();
  },

  async update(id: string, input: Partial<Doc>): Promise<Doc> {
    const response = await fetch(`${API_BASE_URL}/api/docs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('Failed to update doc');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/docs/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete doc');
  }
};

// Doc Pages API
export const docPagesApi = {
  async getByDoc(docId: string): Promise<DocPage[]> {
    const response = await fetch(`${API_BASE_URL}/api/doc-pages/doc/${docId}`);
    if (!response.ok) throw new Error('Failed to fetch doc pages');
    return response.json();
  },

  async create(input: { doc_id: string; title?: string; content?: string; icon?: string; position?: number; parent_page_id?: string }): Promise<DocPage> {
    const response = await fetch(`${API_BASE_URL}/api/doc-pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create page');
    }
    return response.json();
  },

  async update(id: string, input: Partial<DocPage>): Promise<DocPage> {
    const response = await fetch(`${API_BASE_URL}/api/doc-pages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('Failed to update page');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/doc-pages/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete page');
  }
};

// Forms API
export const formsApi = {
  async getAll(): Promise<Form[]> {
    const response = await fetch(`${API_BASE_URL}/api/forms`);
    if (!response.ok) throw new Error('Failed to fetch forms');
    return response.json();
  },

  async getBySpace(spaceId: string): Promise<Form[]> {
    const response = await fetch(`${API_BASE_URL}/api/forms/space/${spaceId}`);
    if (!response.ok) throw new Error('Failed to fetch space forms');
    return response.json();
  },

  async getByFolder(folderId: string): Promise<Form[]> {
    const response = await fetch(`${API_BASE_URL}/api/forms/folder/${folderId}`);
    if (!response.ok) throw new Error('Failed to fetch folder forms');
    return response.json();
  },

  async getById(id: string): Promise<Form> {
    const response = await fetch(`${API_BASE_URL}/api/forms/${id}`);
    if (!response.ok) throw new Error('Failed to fetch form');
    return response.json();
  },

  async create(input: { name: string; description?: string; space_id?: string; folder_id?: string; list_id?: string; status?: string; fields?: any[]; template_type?: string; settings?: any; is_published?: boolean; cover_color?: string }): Promise<Form> {
    const response = await fetch(`${API_BASE_URL}/api/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create form');
    }
    return response.json();
  },

  async update(id: string, input: Partial<Form>): Promise<Form> {
    const response = await fetch(`${API_BASE_URL}/api/forms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('Failed to update form');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/forms/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete form');
  }
};

// Form Responses API
export const formResponsesApi = {
  async getByForm(formId: string): Promise<FormResponse[]> {
    const response = await fetch(`${API_BASE_URL}/api/form-responses/form/${formId}`);
    if (!response.ok) throw new Error('Failed to fetch form responses');
    return response.json();
  },

  async getById(id: string): Promise<FormResponse> {
    const response = await fetch(`${API_BASE_URL}/api/form-responses/${id}`);
    if (!response.ok) throw new Error('Failed to fetch form response');
    return response.json();
  },

  async create(input: { form_id: string; name?: string; response_data?: Record<string, any>; status?: string; assignee_id?: string; due_date?: string; priority?: string; tags?: string[]; description?: string }): Promise<FormResponse> {
    const response = await fetch(`${API_BASE_URL}/api/form-responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create form response');
    }
    return response.json();
  },

  async update(id: string, input: Partial<FormResponse>): Promise<FormResponse> {
    const response = await fetch(`${API_BASE_URL}/api/form-responses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('Failed to update form response');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/form-responses/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete form response');
  },

  async bulkUpdateStatus(ids: string[], status: string): Promise<FormResponse[]> {
    const response = await fetch(`${API_BASE_URL}/api/form-responses/bulk/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status })
    });
    if (!response.ok) throw new Error('Failed to update form responses');
    return response.json();
  }
};
