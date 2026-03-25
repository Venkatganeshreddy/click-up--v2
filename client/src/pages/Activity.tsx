import ActivityFeed from '../components/ActivityFeed';

export default function Activity() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-[#0f1012] dark:via-[#0f1012] dark:to-[#0f1012] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Activity Feed</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">View all activity across your workspace</p>
        </div>
        <ActivityFeed />
      </div>
    </div>
  );
}











