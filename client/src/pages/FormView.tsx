import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formsApi } from '../services/api';
import FormBuilder from '../components/FormBuilder';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function FormView() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const { data: form, isLoading, error } = useQuery({
    queryKey: ['form', formId],
    queryFn: () => formsApi.getById(formId!),
    enabled: !!formId
  });

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
            onClick={() => navigate('/forms')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to Forms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-gray-50 dark:bg-[#0f1012]">
      <FormBuilder
        form={form}
        onClose={() => navigate('/forms')}
      />
    </div>
  );
}
