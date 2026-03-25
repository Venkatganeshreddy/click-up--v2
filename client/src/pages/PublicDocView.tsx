import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { docsApi } from '../services/api';
import { ArrowLeft, Loader2, FileText, Lock } from 'lucide-react';
import DocEditor from '../components/DocEditor';
import { useAuth } from '../context/AuthContext';

export default function PublicDocView() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { user, member, loading } = useAuth();

  const { data: privateDoc, isLoading: privateLoading, error: privateError } = useQuery({
    queryKey: ['doc', docId],
    queryFn: () => docsApi.getById(docId!),
    enabled: !!docId && !!user
  });

  const { data: publicDoc, isLoading: publicLoading, error: publicError } = useQuery({
    queryKey: ['public-doc', docId],
    queryFn: () => docsApi.getPublic(docId!),
    enabled: !!docId,
    retry: false
  });

  const doc = privateDoc || publicDoc;
  const isLoading = loading || privateLoading || publicLoading;
  const error = privateError || publicError;
  const isPrivate = publicError instanceof Error && publicError.message?.includes('not publicly shared');

  // Redirect to login for private docs - must be before any early returns (React hooks rules)
  useEffect(() => {
    if (isPrivate && docId) {
      navigate(`/docs/${docId}`, { replace: true });
    }
  }, [isPrivate, docId, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading document...</span>
        </div>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className={`w-16 h-16 ${isPrivate ? 'bg-amber-500/20' : 'bg-red-500/20'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {isPrivate ? (
              <Lock className="w-8 h-8 text-amber-500" />
            ) : (
              <FileText className="w-8 h-8 text-red-500" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isPrivate ? 'Redirecting to login...' : 'Document not found'}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mb-6">
            {isPrivate
              ? 'This document is private. Please sign in to view it.'
              : "The document you're looking for doesn't exist or has been deleted."}
          </p>
          {!isPrivate && (
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Home
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!doc) {
    return null;
  }

  const sharedWith = doc.shared_with || [];
  const memberMatch = sharedWith.find(entry => {
    if (entry.member_id && member?.id) return entry.member_id === member.id;
    if (entry.email && member?.email) return entry.email.toLowerCase() === member.email.toLowerCase();
    return false;
  });
  const isOwner = !!member?.id && doc.owner_id === member.id;
  const role = isOwner
    ? 'editor'
    : memberMatch?.role || (doc.link_role === 'editor' ? 'editor' : 'viewer');
  // If public link is set to editor, allow editing even for anonymous viewers
  const canEdit = role === 'editor' || (doc.link_role === 'editor');

  return (
    <DocEditor
      doc={doc}
      readOnly={!canEdit}
      minimalMode
      onClose={() => navigate('/')}
    />
  );
}
