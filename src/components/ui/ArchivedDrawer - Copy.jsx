import React from 'react';
import { X, RotateCcw, Trash2, Archive, ListTodo, WalletCards } from 'lucide-react';

const ArchivedDrawer = ({
  isOpen,
  onClose,
  archivedItems = [],
  onRestore,
  onDelete,
  archiveType = 'budget',
  title,
}) => {
  if (!isOpen) return null;

  const isTodoArchive = archiveType === 'todo';
  const drawerTitle = title || (isTodoArchive ? 'To-Do Archives' : 'Budget Archives');

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value) => {
    const number = Number(value || 0);
    return `$${number.toFixed(2)}`;
  };

  const getBucketDisplayName = (bucket) => {
    const bucketNames = {
      income: 'Income',
      housing: 'Housing',
      transportation: 'Transportation',
      food: 'Food & Dining',
      personal: 'Personal',
      homeOffice: 'Home & Office',
      banking: 'Banking & Finance',
      subscriptions: 'Subscriptions',
      misc: 'Miscellaneous',
    };
    return bucketNames[bucket] || bucket || 'Unknown';
  };

  const getTodoType = (item) => item.typeOverride || item.type || 'General';

  const getTodoOwner = (item) => item.ownerOverride || item.person || '';

  const getTodoDate = (item) => item.deadline || item.date || item.effectiveDate || '';

  const renderBudgetItem = (item) => (
    <div
      key={item.id}
      className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">
            {item.category || item.item || 'Untitled Item'}
          </h3>
          <p className="text-sm text-gray-600">
            From: {getBucketDisplayName(item.originalBucket)}
          </p>
        </div>

        <div className="flex gap-1 ml-2">
          <button
            onClick={() => onRestore(item.id)}
            className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
            title="Restore archived budget item"
            aria-label="Restore archived budget item"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Delete archived item permanently"
            aria-label="Delete archived item permanently"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-2">
        <div>
          <span className="font-medium">Est. Budget:</span>
          <div className="text-gray-900">
            {formatCurrency(item.estBudget ?? item.estimatedBudget ?? item.estimatedCost)}
          </div>
        </div>
        <div>
          <span className="font-medium">Actual Cost:</span>
          <div className="text-gray-900">
            {formatCurrency(item.actualCost ?? item.actualSpent)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-2">
        <div>
          <span className="font-medium">Due Date:</span>
          <div className="text-gray-900">
            {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'N/A'}
          </div>
        </div>
        <div>
          <span className="font-medium">Status:</span>
          <div
            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
              item.status === 'paid'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {item.status === 'paid' ? 'Paid' : 'Pending'}
          </div>
        </div>
      </div>

      {item.notes && (
        <div className="text-sm text-gray-600 mb-2">
          <span className="font-medium">Notes:</span>
          <div className="mt-1 whitespace-pre-wrap text-gray-900">{item.notes}</div>
        </div>
      )}

      <div className="text-xs text-gray-500 border-t pt-2">
        Archived: {formatDate(item.archivedAt)}
      </div>
    </div>
  );

  const renderTodoItem = (item) => (
    <div
      key={item.id}
      className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">
            {item.taskName || item.title || 'Untitled Task'}
          </h3>
          <p className="text-sm text-gray-600">
            From: {getTodoType(item)}
          </p>
          {getTodoOwner(item) && (
            <p className="text-xs font-medium text-purple-700 mt-1">
              For: {getTodoOwner(item)}
            </p>
          )}
        </div>

        <div className="flex gap-1 ml-2">
          <button
            onClick={() => onRestore(item.id)}
            className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
            title="Restore archived task"
            aria-label="Restore archived task"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Delete archived item permanently"
            aria-label="Delete archived item permanently"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-2">
        <div>
          <span className="font-medium">Due Date:</span>
          <div className="text-gray-900">{getTodoDate(item) || 'N/A'}</div>
        </div>
        <div>
          <span className="font-medium">Status:</span>
          <div className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
            {item.completed ? 'Done' : 'Pending'}
          </div>
        </div>
      </div>

      {item.details && (
        <div className="text-sm text-gray-600 mb-2">
          <span className="font-medium">Details:</span>
          <div className="mt-1 whitespace-pre-wrap text-gray-900">
            {String(item.details).replace(/^Details:\s*/i, '')}
          </div>
        </div>
      )}

      {item.notes && (
        <div className="text-sm text-gray-600 mb-2">
          <span className="font-medium">Notes:</span>
          <div className="mt-1 whitespace-pre-wrap text-gray-900">{item.notes}</div>
        </div>
      )}

      <div className="text-xs text-gray-500 border-t pt-2">
        Archived: {formatDate(item.archivedAt)}
      </div>
    </div>
  );

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg z-50 overflow-hidden flex flex-col">
        <div className="bg-purple-600 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {isTodoArchive ? <ListTodo className="w-5 h-5" /> : <WalletCards className="w-5 h-5" />}
            <h2 className="text-xl font-semibold">{drawerTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-purple-200 transition-colors"
            title="Close archive drawer"
            aria-label="Close archive drawer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {archivedItems.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <Archive className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No archived items</p>
              <p className="text-sm">Archived items will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {archivedItems.map((item) =>
                isTodoArchive ? renderTodoItem(item) : renderBudgetItem(item)
              )}
            </div>
          )}
        </div>

        {archivedItems.length > 0 && (
          <div className="bg-gray-50 p-4 border-t">
            <div className="text-sm text-gray-600 text-center">
              {archivedItems.length} archived item{archivedItems.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ArchivedDrawer;
