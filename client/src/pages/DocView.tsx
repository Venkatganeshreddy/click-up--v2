import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { docsApi } from '../services/api';
import DocEditor from '../components/DocEditor';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function DocView() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ['doc', docId],
    queryFn: () => docsApi.getById(docId!),
    enabled: !!docId
  });

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

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Document not found</h1>
          <p className="text-gray-500 dark:text-slate-400 mb-4">The document you're looking for doesn't exist or has been deleted.</p>
          <button
            onClick={() => navigate('/docs')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to Docs
          </button>
        </div>
      </div>
    );
  }

  return (
    <DocEditor
      doc={doc}
      onClose={() => {
        queryClient.invalidateQueries({ queryKey: ['docs'] });
        navigate('/docs');
      }}
    />
  );
}
