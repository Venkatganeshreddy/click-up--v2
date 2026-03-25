import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Activity, User, CheckCircle2, Plus, Edit, Trash2, MessageSquare, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '../lib/supabase';
import type { Activity as ActivityType } from '../types';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  created: <Plus className="h-4 w-4 text-green-500" />,
  updated: <Edit className="h-4 w-4 text-blue-500" />,
  deleted: <Trash2 className="h-4 w-4 text-red-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  commented: <MessageSquare className="h-4 w-4 text-purple-500" />,
  tagged: <Tag className="h-4 w-4 text-orange-500" />,
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
  commented: 'bg-purple-100 text-purple-700',
  tagged: 'bg-orange-100 text-orange-700',
};

interface ActivityFeedProps {
  taskId?: string;
  projectId?: string;
  limit?: number;
}

export default function ActivityFeed({ taskId, projectId, limit }: ActivityFeedProps) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', taskId, projectId],
    queryFn: async () => {
      let query = supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit || 50);

      if (taskId) {
        query = query.eq('entity_type', 'task').eq('entity_id', taskId);
      } else if (projectId) {
        query = query.eq('entity_type', 'project').eq('entity_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityType[];
    },
    enabled: true
  });

  const formatActivityMessage = (activity: ActivityType) => {
    const action = activity.action.toLowerCase();
    const entityType = activity.entity_type.toLowerCase();

    switch (action) {
      case 'created':
        return `created ${entityType} "${activity.details.name || activity.details.title || 'item'}"`;
      case 'updated':
        return `updated ${entityType} "${activity.details.name || activity.details.title || 'item'}"`;
      case 'deleted':
        return `deleted ${entityType} "${activity.details.name || activity.details.title || 'item'}"`;
      case 'completed':
        return `completed task "${activity.details.title || 'item'}"`;
      case 'commented':
        return `commented on task "${activity.details.title || 'item'}"`;
      case 'tagged':
        return `added tags to task "${activity.details.title || 'item'}"`;
      default:
        return `${action} ${entityType}`;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No activity yet</p>
            <p className="text-sm mt-1">Activity will appear here as you work</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Feed
          {activities.length > 0 && (
            <Badge variant="secondary">{activities.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary-100 text-primary-700">
                  {activity.user_id?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className={ACTION_COLORS[activity.action.toLowerCase()] || 'bg-gray-100 text-gray-700'}>
                    {ACTION_ICONS[activity.action.toLowerCase()] || <Activity className="h-4 w-4" />}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {formatActivityMessage(activity)}
                  </span>
                </div>
                {activity.details && Object.keys(activity.details).length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    {(() => {
                      const desc = activity.details.description;
                      return desc && typeof desc === 'string' ? (
                        <p className="line-clamp-1">{desc}</p>
                      ) : null;
                    })()}
                    {(() => {
                      const tags = activity.details.tags;
                      return tags && Array.isArray(tags) ? (
                        <div className="flex gap-1 mt-1">
                          {tags.slice(0, 3).map((tag: unknown, idx: number) => {
                            const tagString = typeof tag === 'string' ? tag : String(tag);
                            return (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tagString}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

