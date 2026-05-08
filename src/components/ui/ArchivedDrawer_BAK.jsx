import React from 'react';
import { X, RotateCcw, Trash2 } from 'lucide-react';

const ArchivedDrawer = ({ isOpen, onClose, archivedItems = [], onRestore, onDelete }) => {
  if (!isOpen) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      misc: 'Miscellaneous'
    };
    return bucketNames[bucket] || bucket;
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-purple-600 text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Archived Items</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-purple-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {archivedItems.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <div className="text-4xl mb-4">📦</div>
              <p className="text-lg font-medium">No archived items</p>
              <p className="text-sm">Archived items will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {archivedItems.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {item.category || 'Untitled Item'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        From: {getBucketDisplayName(item.originalBucket)}
                      </p>
                    </div>
                    
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => onRestore(item.id)}
                        className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
                        title="Restore Item"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-2">
                    <div>
                      <span className="font-medium">Est. Budget:</span>
                      <div className="text-gray-900">${item.estBudget?.toFixed(2) || '0.00'}</div>
                    </div>
                    <div>
                      <span className="font-medium">Actual Cost:</span>
                      <div className="text-gray-900">${item.actualCost?.toFixed(2) || '0.00'}</div>
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
                      <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.status === 'paid' ? 'Paid' : 'Pending'}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 border-t pt-2">
                    Archived: {formatDate(item.archivedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
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