import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { docsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DocEditor from '../components/DocEditor';
import { ArrowLeft, Loader2, FileText, Lock } from 'lucide-react';

export default function DocLinkView() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { user, member, loading } = useAuth();

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ['doc-link', docId],
    queryFn: () => docsApi.getById(docId!),
    enabled: !!docId
  });

  useEffect(() => {
    if (!loading && !user) {
      const redirectTo = `/doc/${docId}`;
      navigate(`/login?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
    }
  }, [loading, user, docId, navigate]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading document...</span>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Document not found</h1>
          <p className="text-gray-500 dark:text-slate-400 mb-6">
            The document you're looking for doesn't exist or has been deleted.
          </p>
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

  const sharedWith = doc.shared_with || [];
  const memberMatch = sharedWith.find(entry => {
    if (entry.member_id && member?.id) return entry.member_id === member.id;
    if (entry.email && member?.email) return entry.email.toLowerCase() === member.email.toLowerCase();
    return false;
  });

  const isOwner = !!member?.id && doc.owner_id === member.id;
  const role = isOwner ? 'editor' : memberMatch?.role || (doc.sharing === 'workspace' ? 'viewer' : 'viewer');
  const canEdit = role === 'editor';

  if (!isOwner && !memberMatch && doc.sharing !== 'workspace') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access restricted</h1>
          <p className="text-gray-500 dark:text-slate-400 mb-6">
            You don't have access to this document.
          </p>
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

  return (
    <DocEditor
      doc={doc}
      readOnly={!canEdit}
      minimalMode
      onClose={() => navigate('/docs')}
    />
  );
}
