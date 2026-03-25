export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
// Default statuses, but custom statuses are also supported
export type TaskStatus = 'To Do' | 'In Progress' | 'Review' | 'Done' | string;

export interface User {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
  };
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  owner_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  content: string;
  list_id: string;
  user_id: string;
  created_at: string;
}

export interface Activity {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: string;
}

// Workspace types
export interface Space {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  owner_id: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Folder {
  id: string;
  name: string;
  space_id: string;
  owner_id: string | null;
  created_at: string;
  updated_at?: string;
}

// Task type (stored in 'lists' table)
// In our hierarchy: Space > Folder > List > Task
export interface Task {
  id: string;
  name: string;
  description: string | null;
  space_id: string;
  folder_id: string | null;
  list_id: string | null;

  // Task properties
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  start_date: string | null;
  position: number;
  assignee_id: string | null;
  assignee_name: string | null;
  assignees: string[] | null; // Multiple assignees support
  estimated_hours: number | null;
  tags: string[] | null;
  is_completed: boolean;
  completed_date: string | null;

  // Sprint properties
  sprint_id: string | null;
  sprint_points: number | null;

  // Additional properties
  task_type: string | null;
  tracked_time: number | null; // in minutes
  checklists: ChecklistData[] | null;

  owner_id: string | null;
  created_at: string;
  updated_at?: string;
}

// Checklist types
export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface ChecklistData {
  id: string;
  name: string;
  items: ChecklistItem[];
}

// Input types for creating/updating tasks
export interface CreateTaskInput {
  name: string;
  description?: string;
  space_id: string;
  folder_id?: string;
  list_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  start_date?: string;
  assignee_name?: string;
  assignees?: string[];
  estimated_hours?: number;
  tags?: string[];
  sprint_id?: string;
  sprint_points?: number;
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  start_date?: string | null;
  position?: number;
  assignee_name?: string | null;
  assignees?: string[] | null;
  estimated_hours?: number;
  tags?: string[];
  is_completed?: boolean;
  completed_date?: string | null;
  task_type?: string;
  tracked_time?: number;
  checklists?: ChecklistData[];
  sprint_id?: string | null;
  sprint_points?: number | null;
}

// Sprint types
export interface SprintFolder {
  id: string;
  name: string;
  space_id: string;
  default_duration: number;
  owner_id: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Sprint {
  id: string;
  name: string;
  sprint_folder_id: string;
  space_id: string;
  folder_id: string | null;
  start_date: string;
  end_date: string;
  position: number;
  owner_id: string | null;
  created_at: string;
  updated_at?: string;
}

export type SprintStatus = 'not_started' | 'in_progress' | 'done';

// Doc type
export interface Doc {
  id: string;
  name: string;
  content: string;
  space_id: string;
  folder_id: string | null;
  owner_id: string | null;
  owner_name?: string | null;
  sharing: 'public' | 'private' | 'workspace';
  shared_with?: { email: string; member_id?: string | null; role: 'viewer' | 'commenter' | 'editor' }[];
  link_role?: 'viewer' | 'commenter' | 'editor';
  tags: string[];
  cover_image: string | null;
  icon: string;
  is_wiki: boolean;
  is_archived: boolean;
  is_favorited: boolean;
  last_viewed_at: string;
  created_at: string;
  updated_at?: string;
}

// Doc page type (sub-pages within a doc)
export interface DocPage {
  id: string;
  doc_id: string;
  title: string;
  content: string;
  icon: string;
  position: number;
  parent_page_id: string | null;
  created_at: string;
  updated_at?: string;
}

// Form types
export interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  mapTo?: string; // Map to task field like 'assignee', 'status', 'due_date'
}

export interface FormSettings {
  theme?: 'light' | 'dark';
  buttonLabel?: string;
  redirectUrl?: string;
  showResubmit?: boolean;
  showRecaptcha?: boolean;
  hideBranding?: boolean;
  layout?: 'one-column' | 'two-column';
  backgroundColor?: string;
  buttonColor?: string;
  assignTasksTo?: string;
  applyTemplate?: string;
  createTaskIn?: string;
}

export interface FormStatusSettings {
  inherit_from_space?: boolean;
  status_template?: string;
}

export interface FormStatusOption {
  id: string;
  name: string;
  color: string;
  status_group?: 'active' | 'done' | 'closed';
  position?: number;
}

export interface Form {
  id: string;
  name: string;
  description: string | null;
  space_id: string;
  folder_id: string | null;
  list_id?: string | null;
  owner_id: string | null;
  status: 'active' | 'inactive';
  fields: FormField[];
  responses_count: number;
  template_type?: string;
  settings?: FormSettings;
  is_published?: boolean;
  cover_color?: string;
  last_viewed_at?: string;
  custom_statuses?: FormStatusOption[];
  status_settings?: FormStatusSettings;
  created_at: string;
  updated_at?: string;
}

export interface FormResponse {
  id: string;
  form_id: string;
  name: string;
  response_data: Record<string, any>;
  status: string | null;  // null = No status assigned
  assignee_id: string | null; // Legacy single assignee (for backward compat)
  assignee_ids: string[]; // Multiple assignees
  due_date: string | null;
  priority: string;
  position: number;
  tags: string[];
  created_at: string;
  updated_at?: string;
}

// Alias for backward compatibility (List = Task)
export type List = Task;
