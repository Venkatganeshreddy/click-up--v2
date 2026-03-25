import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../types';
import { Calendar, Flag, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
}

const PRIORITY_COLORS = {
  LOW: { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'text-gray-400' },
  MEDIUM: { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'text-blue-500' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-600', icon: 'text-orange-500' },
  URGENT: { bg: 'bg-red-100', text: 'text-red-600', icon: 'text-red-500' }
};

export default function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const priorityStyle = PRIORITY_COLORS[task.priority];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow ${
        isDragging || isSortableDragging ? 'opacity-50 shadow-lg rotate-2' : ''
      }`}
    >
      <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{task.name}</h3>

      {task.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0.5">
              <Tag className="h-2.5 w-2.5 mr-1" />
              {tag}
            </Badge>
          ))}
          {task.tags.length > 3 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
              +{task.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {/* Priority Badge */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${priorityStyle.bg} ${priorityStyle.text}`}
        >
          <Flag className={`h-3 w-3 ${priorityStyle.icon}`} />
          {task.priority}
        </span>

        {/* Due Date */}
        {task.due_date && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
              isOverdue
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Calendar className="h-3 w-3" />
            {formatDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}
