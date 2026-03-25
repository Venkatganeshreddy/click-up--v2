import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Copy, CheckCircle2,
  ExternalLink, Code, Link as LinkIcon, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format as formatDate } from 'date-fns';
import { supabase } from '@/lib/supabase';

const integrationServices = [
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    icon: '📅',
    description: 'Sync task deadlines with Google Calendar',
    color: 'bg-blue-500',
    features: ['Two-way sync', 'Automatic updates', 'Multiple calendars']
  },
  {
    id: 'outlook_calendar',
    name: 'Outlook Calendar',
    icon: '📆',
    description: 'Sync tasks with Microsoft Outlook',
    color: 'bg-blue-600',
    features: ['Calendar sync', 'Event creation', 'Reminder sync']
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    icon: '📁',
    description: 'Attach files directly from Google Drive',
    color: 'bg-yellow-500',
    features: ['File picker', 'Direct attachments', 'Shared access']
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Get task notifications in Slack',
    color: 'bg-purple-500',
    features: ['Notifications', 'Task updates', 'Channel integration']
  }
];

const webhookEvents = [
  { value: 'task.created', label: 'Task Created' },
  { value: 'task.updated', label: 'Task Updated' },
  { value: 'task.deleted', label: 'Task Deleted' },
  { value: 'task.completed', label: 'Task Completed' },
  { value: 'comment.created', label: 'Comment Added' },
  { value: 'status.changed', label: 'Status Changed' }
];

export default function Integrations() {
  const queryClient = useQueryClient();
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<any>(null);
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    events: [] as string[],
    headers: {},
    is_active: true
  });
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [connectingService, setConnectingService] = useState<any>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    }
  });

  const { data: webhooks = [] } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    }
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase
        .from('webhooks')
        .insert({
          ...data,
          secret: Math.random().toString(36).substring(2, 15)
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setWebhookDialogOpen(false);
      resetWebhookForm();
      toast.success('Webhook created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create webhook')
  });

  const updateWebhookMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: result, error } = await supabase
        .from('webhooks')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setWebhookDialogOpen(false);
      resetWebhookForm();
      toast.success('Webhook updated');
    }
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook deleted');
    }
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('webhooks')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    }
  });

  const createIntegrationMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase
        .from('integrations')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setConnectDialogOpen(false);
      setApiKeyInput('');
      toast.success('Integration connected');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to connect')
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration disconnected');
    }
  });

  const resetWebhookForm = () => {
    setWebhookForm({
      name: '',
      url: '',
      events: [],
      headers: {},
      is_active: true
    });
    setEditingWebhook(null);
  };

  const handleWebhookSubmit = () => {
    if (editingWebhook) {
      updateWebhookMutation.mutate({ id: editingWebhook.id, data: webhookForm });
    } else {
      createWebhookMutation.mutate(webhookForm);
    }
  };

  const handleConnectService = (service: any) => {
    setConnectingService(service);
    setConnectDialogOpen(true);
  };

  const handleConnectSubmit = () => {
    if (!apiKeyInput) {
      toast.error('Please enter an API key');
      return;
    }

    createIntegrationMutation.mutate({
      service: connectingService.id,
      access_token: apiKeyInput,
      is_active: true,
      last_sync: new Date().toISOString()
    });
  };

  const handleDisconnect = (integration: any) => {
    deleteIntegrationMutation.mutate(integration.id);
  };

  const getUserIntegration = (serviceId: string) => {
    return integrations.find((i: any) => i.service === serviceId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-[#0f1012] dark:via-[#0f1012] dark:to-[#0f1012] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Integrations</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Connect with your favorite tools</p>
        </div>

        <Tabs defaultValue="services" className="space-y-6">
          <TabsList className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
            <TabsTrigger value="services" className="gap-2">
              <LinkIcon className="w-4 h-4" /> Services
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Code className="w-4 h-4" /> Webhooks
            </TabsTrigger>
          </TabsList>

          {/* Services Tab */}
          <TabsContent value="services">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {integrationServices.map(service => {
                const connected = getUserIntegration(service.id);

                return (
                  <Card key={service.id} className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl ${service.color} flex items-center justify-center text-2xl`}>
                            {service.icon}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{service.name}</CardTitle>
                            <CardDescription className="mt-1">{service.description}</CardDescription>
                          </div>
                        </div>
                        {connected && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {service.features.map((feature, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>

                        {connected ? (
                          <div className="space-y-3">
                            <div className="p-3 bg-slate-50 dark:bg-[#15161a] rounded-lg border border-transparent dark:border-[#1f2229]">
                              {connected.last_sync && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Last synced: {formatDate(new Date(connected.last_sync), 'MMM d, h:mm a')}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1">
                                <RefreshCw className="w-4 h-4 mr-2" /> Sync Now
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDisconnect(connected)}
                              >
                                Disconnect
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleConnectService(service)}
                            className="w-full"
                          >
                            <LinkIcon className="w-4 h-4 mr-2" /> Connect {service.name}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Webhook Endpoints</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Receive real-time notifications when events occur
                  </p>
                </div>
                <Button
                  onClick={() => {
                    resetWebhookForm();
                    setWebhookDialogOpen(true);
                  }}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Webhook
                </Button>
              </div>

              {webhooks.length > 0 ? (
                <div className="space-y-4">
                  {webhooks.map((webhook: any) => (
                    <Card key={webhook.id} className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-slate-900 dark:text-white">{webhook.name}</h3>
                              <Badge
                                variant={webhook.is_active ? "default" : "secondary"}
                                className={webhook.is_active ? "bg-green-100 text-green-700" : ""}
                              >
                                {webhook.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                              <Code className="w-4 h-4 text-slate-400" />
                              <code className="text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#14151a] px-2 py-0.5 rounded">
                                {webhook.url}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(webhook.url)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {webhook.events?.map((event: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {event}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Switch
                              checked={webhook.is_active}
                              onCheckedChange={(checked) =>
                                toggleWebhookMutation.mutate({ id: webhook.id, is_active: checked })
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingWebhook(webhook);
                                setWebhookForm(webhook);
                                setWebhookDialogOpen(true);
                              }}
                            >
                              <Code className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
                      <Code className="w-8 h-8 text-violet-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Webhooks Yet</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                      Create webhooks to receive real-time notifications
                    </p>
                    <Button
                      onClick={() => setWebhookDialogOpen(true)}
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Create Webhook
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Documentation */}
              <Card className="bg-slate-50/80 dark:bg-[#14151a]/80 backdrop-blur border-0">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ExternalLink className="w-5 h-5" /> Webhook Documentation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm text-slate-900 dark:text-white mb-1">Payload Format</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Webhooks send a POST request with JSON payload containing event data
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-slate-900 dark:text-white mb-1">Security</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Each webhook includes a secret for HMAC signature verification
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Connect Service Dialog */}
        <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
          <DialogContent className="max-w-md bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Connect {connectingService?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg">
                <div className={`w-10 h-10 rounded-lg ${connectingService?.color} flex items-center justify-center text-xl`}>
                  {connectingService?.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-white">{connectingService?.name}</p>
                  <p className="text-xs text-slate-400">{connectingService?.description}</p>
                </div>
              </div>

              <div>
                <Label className="text-slate-300">API Key / Access Token</Label>
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter your API key..."
                  className="mt-1.5 bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConnectDialogOpen(false)} className="border-slate-600 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleConnectSubmit} disabled={!apiKeyInput}>
                Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Webhook Dialog */}
        <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
          <DialogContent className="max-w-lg bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-slate-300">Name</Label>
                <Input
                  value={webhookForm.name}
                  onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                  placeholder="e.g., Slack Notifications"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <Label className="text-slate-300">Webhook URL</Label>
                <Input
                  value={webhookForm.url}
                  onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                  placeholder="https://your-service.com/webhook"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <Label className="text-slate-300">Events</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {webhookEvents.map(event => (
                    <label
                      key={event.value}
                      className="flex items-center gap-2 p-2 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={webhookForm.events.includes(event.value)}
                        onChange={(e) => {
                          const newEvents = e.target.checked
                            ? [...webhookForm.events, event.value]
                            : webhookForm.events.filter(ev => ev !== event.value);
                          setWebhookForm({ ...webhookForm, events: newEvents });
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-slate-300">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Custom Headers (Optional)</Label>
                <Textarea
                  value={JSON.stringify(webhookForm.headers || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const headers = JSON.parse(e.target.value);
                      setWebhookForm({ ...webhookForm, headers });
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  placeholder='{"Authorization": "Bearer token"}'
                  className="font-mono text-xs bg-slate-700 border-slate-600 text-white"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWebhookDialogOpen(false)} className="border-slate-600 text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={handleWebhookSubmit}
                disabled={!webhookForm.name || !webhookForm.url || webhookForm.events.length === 0}
              >
                {editingWebhook ? 'Save Changes' : 'Create Webhook'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
